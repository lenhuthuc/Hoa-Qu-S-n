"use client";

/**
 * ══════════════════════════════════════════════════════════════
 * LivePlayer — Component phát video livestream
 * ══════════════════════════════════════════════════════════════
 * 
 * HAI KẾT NỐI SONG SONG CỦA VIEWER:
 * ┌────────────────────────────────┬───────────────────────────────┐
 * │ Kết nối 1: WebRTC (WHEP)      │ Kết nối 2: HLS.js (fallback) │
 * │ Giao thức: WebRTC              │ Giao thức: HTTP (GET)         │
 * │ Latency: ~0.5 giây             │ Latency: ~4-8 giây            │
 * │ Đặc điểm: Realtime, P2P       │ Đặc điểm: ABR, CDN cache     │
 * └────────────────────────────────┴───────────────────────────────┘
 * 
 * LUỒNG KHỞI ĐỘNG:
 * 1. Thử WebRTC (WHEP) trước → latency thấp nhất
 * 2. Nếu WebRTC thất bại → fallback sang HLS.js
 * 3. HLS.js: Tải master.m3u8 → đo bandwidth → chọn quality
 * 4. ABR tự động switch quality theo mạng:
 *    - 720p (2000kbps) — WiFi/4G tốt
 *    - 480p (800kbps)  — 4G/3G  
 *    - 360p (300kbps)  — 3G yếu/vùng sâu xa
 * 
 * XỬ LÝ TÌNH HUỐNG ĐẶC BIỆT:
 * - Mất mạng giữa chừng → HLS.js tự retry
 * - Stream offline → hiển thị "Stream đang gián đoạn"
 * - Mạng yếu → ABR tự chuyển xuống quality thấp hơn
 */

import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { RefreshCw, Wifi, WifiOff, Signal, Monitor } from "lucide-react";

interface LivePlayerProps {
  whepUrl: string;
  hlsUrl?: string;
  streamKey: string;
  /** Trạng thái stream từ server (LIVE/OFFLINE/ENDED) */
  streamStatus?: string;
}

/** Các chất lượng video ABR */
interface QualityLevel {
  index: number;
  height: number;
  bitrate: number;
  label: string;
}

export default function LivePlayer({ whepUrl, hlsUrl, streamKey, streamStatus }: LivePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [playerMode, setPlayerMode] = useState<"webrtc" | "hls" | "none">("none");

  // ── ABR Quality State ──
  const [qualities, setQualities] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState(-1); // -1 = auto
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(true);


  // ══════════════════════════════════════════════════════════════
  // BƯỚC 1 — Kết nối WebRTC (WHEP) — Ưu tiên latency thấp
  // ══════════════════════════════════════════════════════════════
  const connectWebRTC = useCallback(async (): Promise<boolean> => {
    const video = videoRef.current;
    if (!video) return false;

    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          {
            urls: "turn:your-turn-server.com:3478",   // ← thêm TURN
            username: "user",
            credential: "pass"
          }
        ],
      });

      let trackCount = 0;
      let mediaStream: MediaStream | null = null;

      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      pc.ontrack = (event) => {
        if (!mediaStream && event.streams?.[0]) {
          mediaStream = event.streams[0];
        }
        trackCount++;
        if (trackCount >= 2 && mediaStream) {
          video.srcObject = mediaStream;
          video.play().then(() => setIsPlaying(true)).catch(() => { });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          setIsPlaying(false);
          connectHLSRef.current();
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await Promise.race([
        new Promise<void>((resolve) => {
          if (pc.iceGatheringState === "complete") resolve();
          else pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === "complete") resolve();
          };
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 5000))
      ]);

      const resp = await fetch(whepUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: pc.localDescription!.sdp,
      });

      if (!resp.ok) {
        pc.close();
        return false;
      }

      const answerSdp = await resp.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      // jitterBufferTarget — Chrome only, graceful fallback cho browser khác
      pc.getReceivers().forEach((receiver) => {
        if (receiver.track.kind === "audio" && "jitterBufferTarget" in receiver) {
          (receiver as RTCRtpReceiver & { jitterBufferTarget: number }).jitterBufferTarget = 50;
        }
      });

      pcRef.current = pc;
      setPlayerMode("webrtc");
      return true;
    } catch {
      return false;
    }
  }, [whepUrl]);

  // ══════════════════════════════════════════════════════════════
  // BƯỚC 2 — HLS.js Fallback (Adaptive Bitrate Streaming)
  // ══════════════════════════════════════════════════════════════
  // Luồng:
  // 1. Tải master.m3u8 → parse variants (720p, 480p, 360p)
  // 2. Đo bandwidth → ABR algorithm chọn quality phù hợp
  // 3. Tải index.m3u8 → danh sách chunks hiện tại
  // 4. Download chunks vào buffer → bắt đầu phát
  // 5. Mỗi 2-4 giây: tải manifest mới → download chunk mới
  // 6. Nếu bandwidth giảm → ABR tự switch xuống quality thấp
  const connectHLS = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const baseUrl = hlsUrl || `${process.env.NEXT_PUBLIC_HLS_URL || "http://localhost:8888"}/${streamKey}/index.m3u8`;
    // ── Sử dụng path -aac để đảm bảo có âm thanh chuẩn AAC cho HLS (Tránh chắp nối đúp) ──
    const url = baseUrl.includes("-aac/index.m3u8") ? baseUrl : baseUrl.replace("/index.m3u8", "-aac/index.m3u8");

    // Dọn dẹp WebRTC nếu đang dùng
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    // ── Kiểm tra browser hỗ trợ HLS native (Safari) ──
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      video.play().then(() => {
        setIsPlaying(true);
        setPlayerMode("hls");
      }).catch(() => { });
      return;
    }

    // ── Khởi tạo HLS.js cho các browser khác ──
    if (!Hls.isSupported()) {
      setError("Trình duyệt không hỗ trợ phát video");
      return;
    }

    // Dọn dẹp HLS instance cũ
    if (hlsRef.current) {
      hlsRef.current.destroy();
    }

    const hls = new Hls({
      // ── Cấu hình ABR & Sync cao cấp (Fix Audio desync) ──
      enableWorker: true,
      lowLatencyMode: true,           // Low-latency HLS
      backBufferLength: 30,           // Buffer 30 giây
      maxBufferLength: 15,            // Tăng để tránh dropout
      maxMaxBufferLength: 8,
      liveSyncDurationCount: 3,       // Sync với 3 segments gần nhất
      liveMaxLatencyDurationCount: 10, // Giữ độ trễ ổn định

      // Auto-sync audio/video (Nudging)
      nudgeMaxRetry: 10,
      nudgeOffset: 0.2,

      // ── Retry config cho mạng không ổn định ──
      fragLoadPolicy: {
        default: {
          maxTimeToFirstByteMs: 10000,
          maxLoadTimeMs: 20000,
          timeoutRetry: { maxNumRetry: 4, retryDelayMs: 1000, maxRetryDelayMs: 8000 },
          errorRetry: { maxNumRetry: 6, retryDelayMs: 1000, maxRetryDelayMs: 8000 },
        },
      },
    });

    hlsRef.current = hls;

    // ── Parse danh sách quality variants ──
    hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
      const levels: QualityLevel[] = data.levels.map((level, index) => ({
        index,
        height: level.height,
        bitrate: level.bitrate,
        label: level.height >= 720
          ? `${level.height}p HD`
          : level.height >= 480
            ? `${level.height}p SD`
            : `${level.height}p LD`,
      }));
      setQualities(levels);
      video.play().then(() => {
        setIsPlaying(true);
        setPlayerMode("hls");
      }).catch(() => { });
    });

    // ── Theo dõi quality hiện tại (ABR switching) ──
    hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
      setCurrentQuality(data.level);
    });

    // ── Xử lý lỗi HLS ──
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            // ── Mất mạng → HLS.js tự retry ──
            setError("Đang kết nối lại...");
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            setError("Stream chưa bắt đầu hoặc đã kết thúc");
            hls.destroy();
            break;
        }
      }
    });

    hls.loadSource(url);
    hls.attachMedia(video);
  }, [hlsUrl, streamKey]);

  // ── Dùng Ref để tránh stale closure khi fallback WebRTC -> HLS ──
  const connectHLSRef = useRef(connectHLS);
  useEffect(() => {
    connectHLSRef.current = connectHLS;
  }, [connectHLS]);

  // ══════════════════════════════════════════════════════════════
  // KHỞI ĐỘNG — Thử WebRTC trước, fallback HLS
  // ══════════════════════════════════════════════════════════════
  useEffect(() => {
    let cancelled = false;

    async function start() {
      setError(null);
      // ── Thử WebRTC (WHEP) trước ──
      const webrtcOk = await connectWebRTC();
      if (cancelled) return;

      if (!webrtcOk) {
        // ── WebRTC thất bại → fallback sang HLS ──
        connectHLS();
      }
    }

    start();

    return () => {
      cancelled = true;
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [connectWebRTC, connectHLS, retryCount]);

  // ══════════════════════════════════════════════════════════════
  // XỬ LÝ STREAM STATUS — Offline/Ended từ server
  // ══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (streamStatus === "OFFLINE") {
      setError("Stream đang gián đoạn — Farmer mất kết nối");
      setIsPlaying(false);
    } else if (streamStatus === "ENDED") {
      setError("Phiên live đã kết thúc");
      setIsPlaying(false);
    } else if (streamStatus === "LIVE" && error?.includes("gián đoạn")) {
      // Stream trở lại online → retry
      setRetryCount((prev) => prev + 1);
    }
  }, [streamStatus]);

  // ── Chuyển quality (ABR manual override) ──
  const switchQuality = (levelIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex; // -1 = auto
      setCurrentQuality(levelIndex);
    }
    setShowQualityMenu(false);
  };

  return (
    <div className="relative bg-black w-full h-full overflow-hidden group">
      {/* ── Video Element ── */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        controls
        playsInline
        muted={isMuted}
        autoPlay
      />

      {/* ── Nút unmute (Hiện khi đang phát mà bị muted) ── */}
      {isPlaying && isMuted && (
        <button
          onClick={() => {
            if (videoRef.current) videoRef.current.muted = false;
            setIsMuted(false);
          }}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 
                     bg-black/70 text-white px-6 py-2 rounded-full 
                     text-sm font-bold flex items-center gap-2 animate-bounce
                     border border-white/20 shadow-xl z-20"
        >
          🔇 Bấm để bật âm thanh
        </button>
      )}

      {/* ── LIVE Badge ── */}
      {isPlaying && (
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            LIVE
          </div>
          {/* ── Hiển thị mode phát (WebRTC / HLS) ── */}
          <div className="bg-black/60 text-white/80 px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1">
            {playerMode === "webrtc" ? (
              <><Signal className="w-3 h-3" /> WebRTC</>
            ) : playerMode === "hls" ? (
              <><Monitor className="w-3 h-3" /> HLS</>
            ) : null}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          ABR QUALITY SWITCHER — Chọn chất lượng video
          - Auto: ABR algorithm tự chọn theo bandwidth
          - 720p HD: WiFi / 4G tốt (2000kbps)
          - 480p SD: 4G / 3G tốt (800kbps)  
          - 360p LD: 3G yếu / vùng xa (300kbps)
          ══════════════════════════════════════════════════════ */}
      {isPlaying && qualities.length > 1 && (
        <div className="absolute bottom-16 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {showQualityMenu && (
            <div className="mb-2 bg-black/90 backdrop-blur-md rounded-lg p-1.5 min-w-[140px] border border-white/10">
              {/* Auto (ABR tự động) */}
              <button
                onClick={() => switchQuality(-1)}
                className={`w-full text-left px-3 py-1.5 rounded text-xs flex items-center justify-between ${currentQuality === -1
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:bg-white/10"
                  }`}
              >
                <span>Tự động</span>
                {currentQuality === -1 && <Wifi className="w-3 h-3 text-green-400" />}
              </button>
              {/* Danh sách quality levels */}
              {qualities.sort((a, b) => b.height - a.height).map((q) => (
                <button
                  key={q.index}
                  onClick={() => switchQuality(q.index)}
                  className={`w-full text-left px-3 py-1.5 rounded text-xs flex items-center justify-between ${currentQuality === q.index
                    ? "bg-white/20 text-white"
                    : "text-white/70 hover:bg-white/10"
                    }`}
                >
                  <span>{q.label}</span>
                  <span className="text-white/40">{Math.round(q.bitrate / 1000)}k</span>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowQualityMenu(!showQualityMenu)}
            className="bg-black/60 hover:bg-black/80 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Signal className="w-3.5 h-3.5" />
            {currentQuality === -1
              ? "Tự động"
              : qualities.find((q) => q.index === currentQuality)?.label || "HD"}
          </button>
        </div>
      )}

      {/* ── Stream offline / Error overlay ── */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
          {streamStatus === "OFFLINE" ? (
            <WifiOff className="w-12 h-12 text-yellow-500 mb-3 animate-pulse" />
          ) : null}
          <p className="text-white/70 text-sm mb-3">{error}</p>
          {streamStatus !== "ENDED" && (
            <button
              onClick={() => setRetryCount((prev) => prev + 1)}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Thử lại
            </button>
          )}
        </div>
      )}
    </div>
  );
}
