"use client";

/**
 * ══════════════════════════════════════════════════════════════
 * Studio Phát Sóng — Trang Seller Go Live
 * ══════════════════════════════════════════════════════════════
 *
 * LUỒNG PHÁT SÓNG:
 * 1. Seller bật camera → preview local (getUserMedia)
 * 2. Nhập tiêu đề + chọn sản phẩm bán
 * 3. Bấm "Bắt Đầu Phát":
 *    a. Gọi POST /api/livestream/start → nhận streamKey
 *    b. WebRTC WHIP: SDP Offer → MediaMTX → SDP Answer
 *    c. MediaMTX nhận RTMP/WHIP → tạo HLS segments
 *    d. runOnPublish webhook → xác thực streamKey → đánh dấu LIVE
 *    e. Socket.IO emit stream-status: LIVE
 * 4. Trong khi live:
 *    - Quản lý sản phẩm (thêm/xóa) → emit update-products
 *    - Ghim tin nhắn quan trọng → emit chat-pin
 *    - Xem viewer count realtime
 * 5. Kết thúc:
 *    a. Đóng RTCPeerConnection → WHIP disconnect
 *    b. Gọi POST /api/livestream/:streamKey/stop → status ENDED
 *    c. runOnUnpublish webhook → thông báo tất cả viewer
 *
 * KIẾN TRÚC VIDEO PIPELINE:
 * Camera → WebRTC (WHIP) → MediaMTX → HLS/WebRTC (WHEP) → Viewers
 */

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Video, VideoOff, Mic, MicOff, Radio, Square, Users,
  Settings2, Sparkles, Activity, Package, Plus, X, Tag,
  Copy, ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";
import { livestreamApi, isLoggedIn } from "@/lib/api";
import api from "@/lib/api";
import LiveChat from "@/components/LiveChat";

interface LiveProduct {
  id: number;
  name: string;
  price: number;
}

export default function GoLivePage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);


  // ── Trạng thái phát sóng ──
  const [isLive, setIsLive] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [streamKey, setStreamKey] = useState("");
  const [title, setTitle] = useState("");
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [starting, setStarting] = useState(false);
  const [liveDuration, setLiveDuration] = useState(0);
  const [viewerCount, setViewerCount] = useState(0);

  // ── Quản lý sản phẩm trong phiên live ──
  const [products, setProducts] = useState<LiveProduct[]>([]);
  const [addProductId, setAddProductId] = useState("");
  const [addProductName, setAddProductName] = useState("");
  const [addProductPrice, setAddProductPrice] = useState("");
  const [showProductPanel, setShowProductPanel] = useState(false);

  // ── Auth guard ──
  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/login");
    }
  }, [router]);

  // ── Timer đếm thời gian live ──
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLive) {
      interval = setInterval(() => {
        setLiveDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isLive]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // ── Lấy tên seller từ localStorage ──
  const getSellerName = () => {
    if (typeof window === "undefined") return "Người bán";
    try {
      const stored = localStorage.getItem("hqs_user");
      if (stored) {
        const user = JSON.parse(stored);
        return user.name || user.fullName || "Người bán";
      }
    } catch { /* ignore */ }
    return "Người bán";
  };

  // ══════════════════════════════════════════════════════════════
  // CAMERA PREVIEW — Bật thiết bị trước khi phát
  // ══════════════════════════════════════════════════════════════
  const startPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          facingMode: "environment"
        },
        audio: {
          echoCancellation: { exact: false },
          noiseSuppression: { exact: false },
          autoGainControl: { exact: false },
          channelCount: 2,
          sampleRate: 48000,
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsPreviewing(true);
    } catch (err) {
      console.error("Preview error:", err);
      toast.error("Không thể truy cập camera/mic");
    }
  };

  // ══════════════════════════════════════════════════════════════
  // GO LIVE — Kết nối WebRTC WHIP đến MediaMTX
  // ══════════════════════════════════════════════════════════════
  const preferH264 = (sdp: string): string => {
    const sections = sdp.split("\r\nm=");
    for (let i = 1; i < sections.length; i++) {
      if (!sections[i].startsWith("video")) continue;
      const lines = sections[i].split("\r\n");

      // Ưu tiên High profile (64xxxx) hoặc Main (4dxxxx), fallback Baseline (42xxxx)
      const profilePriority = ["64", "4d", "42"];
      let chosenPayload: string | null = null;

      for (const prefix of profilePriority) {
        const fmtpLine = lines.find(l =>
          /a=fmtp:\d+/.test(l) &&
          new RegExp(`profile-level-id=${prefix}`, "i").test(l)
        );
        if (fmtpLine) {
          chosenPayload = fmtpLine.match(/a=fmtp:(\d+)/)?.[1] ?? null;
          if (chosenPayload) break;
        }
      }

      // Fallback: lấy H264 payload đầu tiên nếu không tìm được theo profile
      if (!chosenPayload) {
        const rtpmapLine = lines.find(l => /a=rtpmap:\d+ H264\/90000/i.test(l));
        chosenPayload = rtpmapLine?.match(/a=rtpmap:(\d+)/)?.[1] ?? null;
      }

      if (!chosenPayload) continue;

      // Tìm rtx payload tương ứng
      const rtxLine = lines.find(l =>
        new RegExp(`a=fmtp:\\d+ apt=${chosenPayload}`).test(l)
      );
      const rtxPayload = rtxLine?.match(/a=fmtp:(\d+)/)?.[1];

      const keepPayloads = new Set([chosenPayload, rtxPayload].filter(Boolean) as string[]);

      // Rewrite m= line
      if (lines.length > 0 && lines[0]) {
        const mLineParts = lines[0].split(" ");
        if (mLineParts.length >= 3) {
          lines[0] = [
            ...mLineParts.slice(0, 3),
            ...mLineParts.slice(3).filter(p => keepPayloads.has(p))
          ].join(" ");
        }
      }

      sections[i] = lines
        .filter(l => {
          const match = l.match(/^a=(?:rtpmap|fmtp|rtcp-fb):(\d+)/);
          return !match || keepPayloads.has(match[1]);
        })
        .join("\r\n");
    }
    return sections.join("\r\nm=");
  };

  const goLive = async () => {
    if (!title.trim()) {
      toast.error("Vui lòng nhập tiêu đề phiên live");
      return;
    }
    setStarting(true);
    try {
      const res = await livestreamApi.start(title);
      const key = res.data?.data?.streamKey;
      if (!key) throw new Error("Không nhận được stream key");
      setStreamKey(key);

      // ✅ Truyền audio raw — không qua bất kỳ bộ lọc nào.
      // getUserMedia constraints đã tắt echoCancellation, noiseSuppression, autoGainControl.
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      const videoTrack = streamRef.current?.getVideoTracks()[0];
      const audioTrack = streamRef.current?.getAudioTracks()[0];

      // Đặt sendEncodings ngay khi tạo transceiver — đáng tin cậy hơn setParameters sau khi connected
      if (videoTrack) pc.addTransceiver(videoTrack, {
        direction: "sendonly",
        sendEncodings: [{ maxBitrate: 2_500_000, maxFramerate: 30 }],
      });
      if (audioTrack) pc.addTransceiver(audioTrack, { direction: "sendonly" });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Chờ ICE gathering (Timeout 5s)
      await Promise.race([
        new Promise<void>((resolve) => {
          if (pc.iceGatheringState === "complete") resolve();
          else pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === "complete") resolve();
          };
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 5000))
      ]);

      // ── Munge SDP: H.264 profile cao + Opus high-quality (CELT music mode) ──
      const { sdp: rawSdp } = pc.localDescription!;
      let sdp = rawSdp;
      sdp = preferH264(sdp);

      // Tìm Opus payload type qua rtpmap, rồi override toàn bộ fmtp:
      // maxaveragebitrate=510000 → Opus dùng CELT mode (music, không phải voice)
      // usedtx=0 → không cắt audio khi im lặng
      // stereo=1 → stereo
      const opusMatch = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/i);
      if (opusMatch) {
        const pt = opusMatch[1];
        const opusParams = `minptime=10;useinbandfec=1;usedtx=0;stereo=1;sprop-stereo=1;maxaveragebitrate=510000`;
        const fmtpRe = new RegExp(`a=fmtp:${pt} [^\r\n]*`);
        if (fmtpRe.test(sdp)) {
          sdp = sdp.replace(fmtpRe, `a=fmtp:${pt} ${opusParams}`);
        } else {
          sdp = sdp.replace(
            new RegExp(`(a=rtpmap:${pt} opus/48000/2)`, "i"),
            `$1\r\na=fmtp:${pt} ${opusParams}`
          );
        }
      }

      const whipBase = process.env.NEXT_PUBLIC_WHIP_URL || "http://localhost:8889";
      const whipUrl = `${whipBase}/${key}/whip`;
      const resp = await fetch(whipUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: sdp,
      });

      if (!resp.ok) throw new Error("WHIP handshake failed");

      const answerSdp = await resp.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      // ✅ 3. Chỉ lưu ref khi mọi thứ đã hoàn tất
      pcRef.current = pc;
      setIsLive(true);
      setLiveDuration(0);
      toast.success("Hệ thống đã sẵn sàng và đang phát sóng HD!");
    } catch (err: unknown) {

      toast.error(err instanceof Error ? err.message : "Lỗi livestream");
    } finally {
      setStarting(false);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // STOP LIVE — Kết thúc phiên phát sóng
  // ══════════════════════════════════════════════════════════════
  const stopLive = async () => {
    try {
      if (streamKey) {
        await livestreamApi.stop(streamKey);
      }
    } catch { /* ignore */ }

    streamRef.current?.getTracks().forEach((t) => t.stop());

    pcRef.current?.close();
    pcRef.current = null;

    setIsLive(false);
    setIsPreviewing(false);
    setStreamKey("");
    setLiveDuration(0);
    setProducts([]);
    toast.success("Đã kết thúc phiên live");
  };

  // ── Toggle camera/mic ──
  const toggleCamera = () => {
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCameraOn(videoTrack.enabled);
    }
  };

  const toggleMic = () => {
    const audioTrack = streamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicOn(audioTrack.enabled);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // QUẢN LÝ SẢN PHẨM — Thêm/Xóa sản phẩm trong phiên live
  // PUT /api/livestream/:streamKey/products
  // ══════════════════════════════════════════════════════════════
  const addProduct = async () => {
    if (!addProductId || !addProductName || !addProductPrice) {
      toast.error("Điền đầy đủ thông tin sản phẩm");
      return;
    }
    const newProduct: LiveProduct = {
      id: Number(addProductId),
      name: addProductName,
      price: Number(addProductPrice),
    };
    const updated = [...products, newProduct];
    setProducts(updated);
    setAddProductId("");
    setAddProductName("");
    setAddProductPrice("");

    // Gửi lên server → broadcast đến tất cả viewer
    if (streamKey) {
      try {
        await api.put(`/api/livestream/${streamKey}/products`, { products: updated });
        toast.success(`Đã thêm: ${newProduct.name}`);
      } catch {
        toast.error("Lỗi cập nhật sản phẩm");
      }
    }
  };

  const removeProduct = async (productId: number) => {
    const updated = products.filter((p) => p.id !== productId);
    setProducts(updated);
    if (streamKey) {
      try {
        await api.put(`/api/livestream/${streamKey}/products`, { products: updated });
      } catch { /* ignore */ }
    }
  };

  // ── Copy link phòng live ──
  const copyStreamLink = () => {
    const link = `${window.location.origin}/live/${streamKey}`;
    navigator.clipboard.writeText(link);
    toast.success("Đã copy link phòng live!");
  };

  // ── Callbacks từ LiveChat ──
  const handleViewerCount = useCallback((count: number) => {
    setViewerCount(count);
  }, []);

  return (
    <div className="min-h-screen bg-surface-darker text-white py-8 px-4 sm:px-6">
      <div className="max-w-[1400px] mx-auto">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-primary-600 flex items-center justify-center shadow-lg shadow-red-500/20">
              <Radio className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Studio Phát Sóng</h1>
              <p className="text-slate-400 text-sm">Hoa Quả Sơn Live Center</p>
            </div>
          </div>
          {isLive && (
            <div className="flex items-center gap-4 bg-surface-dark px-5 py-2.5 rounded-full border border-white/10">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
                <span className="text-red-400 font-bold tracking-widest text-sm">LIVE</span>
              </div>
              <div className="w-px h-4 bg-white/20" />
              <span className="text-slate-300 font-mono">{formatDuration(liveDuration)}</span>
              <div className="w-px h-4 bg-white/20" />
              <span className="text-slate-400 text-sm flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> {viewerCount}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-180px)] min-h-[600px]">
          {/* ════════════════════════════════════════════════════
              CỘT TRÁI (8 col): Camera + Controls + Products
              ════════════════════════════════════════════════════ */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* ── Camera Preview / Live Feed ── */}
            <div
              className={`relative flex-1 rounded-3xl overflow-hidden bg-black/50 border transition-all duration-500 ${isLive
                ? "border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.15)]"
                : "border-white/10"
                }`}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-opacity duration-700 ${isPreviewing ? "opacity-100" : "opacity-0"
                  }`}
              />

              {/* Màn hình chờ — Camera tắt */}
              {!isPreviewing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6 animate-pulse-slow">
                    <Video className="w-10 h-10 text-white/30" />
                  </div>
                  <p className="text-slate-400 text-lg mb-8">Hệ thống Camera đang tắt</p>
                  <button
                    onClick={startPreview}
                    className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all duration-300 flex items-center gap-2 backdrop-blur-md border border-white/10 hover:scale-105"
                  >
                    <Settings2 className="w-5 h-5" /> Khởi động thiết bị
                  </button>
                </div>
              )}

              {/* Overlay trạng thái camera/mic */}
              {isPreviewing && (
                <div className="absolute top-0 left-0 w-full p-6 bg-gradient-to-b from-black/80 to-transparent pointer-events-none flex justify-between items-start">
                  <div className="flex gap-3">
                    {!cameraOn && (
                      <div className="bg-red-500/80 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium">
                        <VideoOff className="w-4 h-4" /> Bị che
                      </div>
                    )}
                    {!micOn && (
                      <div className="bg-red-500/80 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium">
                        <MicOff className="w-4 h-4" /> Bị tắt
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Controls Bar: Input tiêu đề + Camera/Mic + Go Live ── */}
            <div className="h-24 dark-glass-panel rounded-2xl flex items-center justify-between px-6">
              {!isLive ? (
                <>
                  <div className="flex-1 max-w-sm mr-6">
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Nhập chủ đề livestream của bạn..."
                      disabled={!isPreviewing}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-5 py-3 text-white placeholder-white/40 focus:outline-none focus:border-primary-500 focus:bg-black/50 transition-all"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={toggleCamera}
                      disabled={!isPreviewing}
                      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${!isPreviewing
                        ? "opacity-50 cursor-not-allowed"
                        : cameraOn
                          ? "bg-white/10 hover:bg-white/20 text-white"
                          : "bg-red-500/20 text-red-500 border border-red-500/50"
                        }`}
                    >
                      {cameraOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                    </button>
                    <button
                      onClick={toggleMic}
                      disabled={!isPreviewing}
                      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${!isPreviewing
                        ? "opacity-50 cursor-not-allowed"
                        : micOn
                          ? "bg-white/10 hover:bg-white/20 text-white"
                          : "bg-red-500/20 text-red-500 border border-red-500/50"
                        }`}
                    >
                      {micOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                    </button>

                    <button
                      onClick={goLive}
                      disabled={!isPreviewing || starting}
                      className={`ml-4 px-8 h-14 rounded-xl font-bold flex items-center gap-2 transition-all ${!isPreviewing
                        ? "bg-white/5 text-white/30 cursor-not-allowed"
                        : "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-lg shadow-red-500/30"
                        }`}
                    >
                      {starting ? (
                        <Activity className="w-5 h-5 animate-spin" />
                      ) : (
                        <Radio className="w-5 h-5" />
                      )}
                      {starting ? "Đang kết nối..." : "Bắt Đầu Phát"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2 rounded-lg flex items-center gap-2">
                      <Radio className="w-5 h-5 animate-pulse" /> Đang phát đến toàn hệ thống
                    </div>
                    {/* Nút copy link phòng live */}
                    <button
                      onClick={copyStreamLink}
                      className="text-slate-400 hover:text-white flex items-center gap-1.5 text-sm bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg transition"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy link
                    </button>
                    <a
                      href={`/live/${streamKey}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-white flex items-center gap-1.5 text-sm bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Xem phòng
                    </a>
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={toggleCamera}
                      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${cameraOn
                        ? "bg-white/10 hover:bg-white/20 text-white"
                        : "bg-red-500/20 text-red-500 border border-red-500/50"
                        }`}
                    >
                      {cameraOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                    </button>
                    <button
                      onClick={toggleMic}
                      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${micOn
                        ? "bg-white/10 hover:bg-white/20 text-white"
                        : "bg-red-500/20 text-red-500 border border-red-500/50"
                        }`}
                    >
                      {micOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                    </button>

                    {/* Nút mở panel sản phẩm */}
                    <button
                      onClick={() => setShowProductPanel(!showProductPanel)}
                      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${showProductPanel
                        ? "bg-accent-500/20 text-accent-400 border border-accent-500/50"
                        : "bg-white/10 hover:bg-white/20 text-white"
                        }`}
                      title="Quản lý sản phẩm"
                    >
                      <Package className="w-6 h-6" />
                    </button>

                    <button
                      onClick={stopLive}
                      className="ml-4 px-8 h-14 rounded-xl font-bold bg-white/10 hover:bg-red-500/20 text-white hover:text-red-500 border border-white/10 hover:border-red-500/50 transition-all flex items-center gap-2 group"
                    >
                      <Square className="w-5 h-5 group-hover:scale-110 transition-transform" /> Kết
                      Thúc Live
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ═══════════════════════════════════════════════════
                PANEL QUẢN LÝ SẢN PHẨM — Thêm/Xóa SP trong live
                Chỉ hiển thị khi đang live và bấm nút Package
                ═══════════════════════════════════════════════════ */}
            {isLive && showProductPanel && (
              <div className="dark-glass-panel rounded-2xl border border-white/10 p-5">
                <h3 className="font-bold text-lg flex items-center gap-2 mb-4">
                  <Tag className="w-5 h-5 text-accent-400" />
                  Sản phẩm đang bán ({products.length})
                </h3>

                {/* ── Form thêm sản phẩm ── */}
                <div className="flex flex-wrap gap-3 mb-4">
                  <input
                    value={addProductId}
                    onChange={(e) => setAddProductId(e.target.value)}
                    placeholder="Mã SP (số)"
                    className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm w-24 text-white placeholder-white/30 focus:outline-none focus:border-accent-400"
                  />
                  <input
                    value={addProductName}
                    onChange={(e) => setAddProductName(e.target.value)}
                    placeholder="Tên sản phẩm"
                    className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm flex-1 min-w-[150px] text-white placeholder-white/30 focus:outline-none focus:border-accent-400"
                  />
                  <input
                    value={addProductPrice}
                    onChange={(e) => setAddProductPrice(e.target.value)}
                    placeholder="Giá (VNĐ)"
                    className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm w-28 text-white placeholder-white/30 focus:outline-none focus:border-accent-400"
                  />
                  <button
                    onClick={addProduct}
                    className="bg-accent-500 hover:bg-accent-400 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition"
                  >
                    <Plus className="w-4 h-4" /> Thêm
                  </button>
                </div>

                {/* ── Danh sách sản phẩm đã thêm ── */}
                {products.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {products.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 border border-white/10"
                      >
                        <div>
                          <span className="text-xs text-slate-500 font-mono">#{p.id}</span>
                          <span className="ml-2 text-sm font-medium">{p.name}</span>
                          <span className="ml-2 text-accent-400 text-sm font-bold">
                            {Number(p.price).toLocaleString("vi-VN")}đ
                          </span>
                        </div>
                        <button
                          onClick={() => removeProduct(p.id)}
                          className="text-slate-500 hover:text-red-400 transition"
                          title="Xóa sản phẩm"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm text-center py-4">
                    Chưa có sản phẩm nào. Thêm sản phẩm để viewer có thể chốt đơn!
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════════════════
              CỘT PHẢI (4 col): Chat realtime + Tương tác
              ════════════════════════════════════════════════════ */}
          <div className="lg:col-span-4 flex flex-col gap-6 h-full">
            <div className="dark-glass-panel rounded-3xl p-6 flex-1 flex flex-col overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-2xl" />

              <div className="flex items-center justify-between mb-6 relative z-10">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent-400" /> Tương tác
                </h3>
                {isLive && (
                  <div className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-black/40 rounded-full border border-white/10">
                    <Users className="w-3.5 h-3.5 text-slate-400" /> {viewerCount} trực tuyến
                  </div>
                )}
              </div>

              <div className="flex-1 bg-black/20 rounded-2xl border border-white/5 overflow-hidden">
                {isLive && streamKey ? (
                  <div
                    className="h-full"
                    style={{
                      filter: "invert(0.9) hue-rotate(180deg)",
                      background: "#fff",
                    }}
                  >
                    <LiveChat
                      streamKey={streamKey}
                      userName={getSellerName()}
                      isOwner={true}
                      onViewerCount={handleViewerCount}
                    />
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-30">
                    <Radio className="w-12 h-12 mb-4" />
                    <p className="text-sm">
                      Bắt đầu phát sóng để xem
                      <br />
                      khung chat và người xem thả tim
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
