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
  Settings2, Sparkles, Activity, Package, X, Tag,
  Copy, ExternalLink, Search, CheckSquare,
} from "lucide-react";
import toast from "react-hot-toast";
import { livestreamApi, isLoggedIn, sellerApi } from "@/lib/api";
import api from "@/lib/api";
import LiveChat from "@/components/LiveChat";

interface LiveProduct {
  id: number;
  name: string;
  price: number;
  imageUrl?: string;
  stock?: number;
}

export default function GoLivePage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isLiveRef = useRef(false);
  const streamKeyRef = useRef("");


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
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>("");

  // ── Quản lý sản phẩm trong phiên live ──
  const [products, setProducts] = useState<LiveProduct[]>([]);          // đang bán trong live
  const [sellerProducts, setSellerProducts] = useState<LiveProduct[]>([]); // toàn bộ sp của seller
  const [productSearch, setProductSearch] = useState("");
  const [showProductPanel, setShowProductPanel] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // ── Auth guard ──
  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/login");
    }
  }, [router]);

  // ── Enumerate audio input devices ──
  const refreshAudioDevices = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const mics = devices.filter((d) => d.kind === "audioinput");
    setAudioDevices(mics);
    setSelectedMicId((prev) => {
      if (prev && mics.find((d) => d.deviceId === prev)) return prev;
      const array = mics.find((d) => d.label.toLowerCase().includes("array"));
      return array?.deviceId || mics[0]?.deviceId || "";
    });
  }, []);

  useEffect(() => {
    refreshAudioDevices();
  }, [refreshAudioDevices]);

  // ── Load danh sách sản phẩm của seller ──
  useEffect(() => {
    const load = async () => {
      setLoadingProducts(true);
      try {
        const res = await sellerApi.getProducts();
        const items: { id: number; productName?: string; name?: string; price: number; imageUrl?: string; quantity?: number }[] = res.data || [];
        setSellerProducts(
          items.map((p) => ({
            id: p.id,
            name: p.productName ?? p.name ?? "",
            price: p.price,
            imageUrl: p.imageUrl,
            stock: p.quantity ?? 0,
          }))
        );
      } catch {
        // ignore
      } finally {
        setLoadingProducts(false);
      }
    };
    load();
  }, []);

  // Sync refs để dùng trong event handlers mà không bị stale closure
  useEffect(() => { isLiveRef.current = isLive; }, [isLive]);
  useEffect(() => { streamKeyRef.current = streamKey; }, [streamKey]);

  // ── Dừng stream khi rời trang (SPA navigate / tab close) ──
  useEffect(() => {
    const stopRemote = () => {
      if (!isLiveRef.current || !streamKeyRef.current) return;
      const token = typeof window !== "undefined" ? localStorage.getItem("hqs_token") : null;
      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
      // keepalive: true — request hoàn thành dù page đã unload
      fetch(`${base}/api/livestream/stop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ streamKey: streamKeyRef.current }),
        keepalive: true,
      }).catch(() => {});
      pcRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isLiveRef.current) return;
      e.preventDefault();
      // Hiện dialog xác nhận trước khi đóng tab / refresh
      e.returnValue = "Phiên livestream đang chạy. Thoát ra sẽ kết thúc ngay lập tức!";
      stopRemote();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      stopRemote(); // gọi khi component unmount (Next.js SPA navigation)
    };
  }, []);

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
        },
        audio: {
          ...(selectedMicId ? { deviceId: { exact: selectedMicId } } : {}),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsPreviewing(true);
      // Re-enumerate sau khi có permission để lấy label đầy đủ
      refreshAudioDevices();
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
      streamKeyRef.current = key;

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

      const opusMatch = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/i);
      if (opusMatch) {
        const pt = opusMatch[1];
        const opusParams = `minptime=10;useinbandfec=1;usedtx=0;maxaveragebitrate=128000`;
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
      isLiveRef.current = true;
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

    isLiveRef.current = false;
    streamKeyRef.current = "";
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
  const toggleProduct = async (product: LiveProduct) => {
    const isSelected = products.some((p) => p.id === product.id);
    const updated = isSelected
      ? products.filter((p) => p.id !== product.id)
      : [...products, { id: product.id, name: product.name, price: product.price }];
    setProducts(updated);
    if (streamKey) {
      try {
        await api.put(`/api/livestream/${streamKey}/products`, { products: updated });
        toast.success(isSelected ? `Đã bỏ: ${product.name}` : `Đang bán: ${product.name}`);
      } catch {
        toast.error("Lỗi cập nhật sản phẩm");
      }
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
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 py-8 px-4 sm:px-6">
      <div className="max-w-[1400px] mx-auto">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-primary-600 flex items-center justify-center shadow-lg shadow-red-500/20">
              <Radio className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">Studio Phát Sóng</h1>
              <p className="text-slate-500 text-sm">Hoa Quả Sơn Live Center</p>
            </div>
          </div>
          {isLive && (
            <div className="flex items-center gap-4 bg-white px-5 py-2.5 rounded-full border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
                <span className="text-red-600 font-bold tracking-widest text-sm">LIVE</span>
              </div>
              <div className="w-px h-4 bg-slate-200" />
              <span className="text-slate-700 font-mono">{formatDuration(liveDuration)}</span>
              <div className="w-px h-4 bg-slate-200" />
              <span className="text-slate-500 text-sm flex items-center gap-1">
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
              className={`relative flex-1 rounded-3xl overflow-hidden bg-slate-900 border transition-all duration-500 ${isLive
                ? "border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.15)]"
                : "border-slate-200"
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
                  <p className="text-slate-400 text-lg mb-6">Hệ thống Camera đang tắt</p>

                  {/* ── Chọn Microphone ── */}
                  {audioDevices.length > 0 && (
                    <div className="mb-6 w-full max-w-xs">
                      <label className="block text-xs text-slate-500 mb-1.5 flex items-center gap-1.5">
                        <Mic className="w-3.5 h-3.5" /> Chọn Microphone
                      </label>
                      <select
                        value={selectedMicId}
                        onChange={(e) => setSelectedMicId(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500 transition-colors"
                      >
                        {audioDevices.map((d) => (
                          <option key={d.deviceId} value={d.deviceId} className="bg-gray-900">
                            {d.label || `Microphone (${d.deviceId.slice(0, 8)})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button
                    onClick={startPreview}
                    className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all duration-300 flex items-center gap-2 backdrop-blur-md border border-white/20 hover:scale-105"
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
            <div className="h-24 glass-panel rounded-2xl flex items-center justify-between px-6 border border-slate-200">
              {!isLive ? (
                <>
                  <div className="flex-1 max-w-sm mr-6">
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Nhập chủ đề livestream của bạn..."
                      disabled={!isPreviewing}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:bg-white transition-all shadow-sm"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={toggleCamera}
                      disabled={!isPreviewing}
                      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${!isPreviewing
                        ? "bg-slate-100 hover:bg-slate-200 text-slate-400"
                        : cameraOn
                          ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                          : "bg-red-50 text-red-500 border border-red-100"
                        }`}
                    >
                      {cameraOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                    </button>
                    <button
                      onClick={toggleMic}
                      disabled={!isPreviewing}
                      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${!isPreviewing
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : micOn
                          ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                          : "bg-red-50 text-red-500 border border-red-100"
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
                    <div className="bg-red-50 text-red-600 border border-red-100 px-4 py-2 rounded-lg flex items-center gap-2 font-medium">
                      <Radio className="w-5 h-5 animate-pulse" /> Đang phát đến toàn hệ thống
                    </div>
                    {/* Nút copy link phòng live */}
                    <button
                      onClick={copyStreamLink}
                      className="text-slate-600 hover:text-slate-900 flex items-center gap-1.5 text-sm bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy link
                    </button>
                    <a
                      href={`/live/${streamKey}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-600 hover:text-slate-900 flex items-center gap-1.5 text-sm bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Xem phòng
                    </a>
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={toggleCamera}
                      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${cameraOn
                        ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        : "bg-red-50 text-red-500 border border-red-100"
                        }`}
                    >
                      {cameraOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                    </button>
                    <button
                      onClick={toggleMic}
                      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${micOn
                        ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        : "bg-red-50 text-red-500 border border-red-100"
                        }`}
                    >
                      {micOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                    </button>

                    {/* Nút mở panel sản phẩm */}
                    <button
                      onClick={() => setShowProductPanel(!showProductPanel)}
                      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${showProductPanel
                        ? "bg-accent-100 text-accent-600 border border-accent-200"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        }`}
                      title="Quản lý sản phẩm"
                    >
                      <Package className="w-6 h-6" />
                    </button>

                    <button
                      onClick={stopLive}
                      className="ml-4 px-8 h-14 rounded-xl font-bold bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 border border-slate-200 hover:border-red-200 transition-all flex items-center gap-2 group"
                    >
                      <Square className="w-5 h-5 group-hover:scale-110 transition-transform" /> Kết
                      Thúc Live
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ═══════════════════════════════════════════════════
                PANEL QUẢN LÝ SẢN PHẨM — Chọn SP từ kho để bán live
                ═══════════════════════════════════════════════════ */}
            {isLive && showProductPanel && (
              <div className="glass-panel rounded-2xl border border-slate-200 p-5 flex flex-col gap-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                    <Tag className="w-5 h-5 text-accent-500" />
                    Chọn sản phẩm bán live
                    {products.length > 0 && (
                      <span className="bg-accent-100 text-accent-600 text-xs px-2 py-0.5 rounded-full border border-accent-200">
                        {products.length} đang bán
                      </span>
                    )}
                  </h3>
                  <button onClick={() => setShowProductPanel(false)} className="text-slate-400 hover:text-slate-600 transition">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* ── Thanh tìm kiếm ── */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Tìm sản phẩm..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-accent-400"
                  />
                </div>

                {/* ── Danh sách sản phẩm để chọn ── */}
                <div className="max-h-64 overflow-y-auto flex flex-col gap-1.5 pr-1">
                  {loadingProducts ? (
                    <p className="text-slate-500 text-sm text-center py-6">Đang tải sản phẩm...</p>
                  ) : sellerProducts.filter((p) =>
                      (p.name ?? "").toLowerCase().includes(productSearch.toLowerCase())
                    ).length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-6">Không tìm thấy sản phẩm</p>
                  ) : (
                    sellerProducts
                      .filter((p) => (p.name ?? "").toLowerCase().includes(productSearch.toLowerCase()))
                      .map((p) => {
                        const selected = products.some((s) => s.id === p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() => toggleProduct(p)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left w-full ${
                              selected
                                ? "bg-accent-50 border-accent-200"
                                : "bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200"
                            }`}
                          >
                            {/* Ảnh sản phẩm */}
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center border border-slate-100">
                              {p.imageUrl
                                ? <img src={p.imageUrl} alt={p.name ?? ""} className="w-full h-full object-cover" />
                                : <Package className="w-5 h-5 text-slate-400" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate text-slate-800">
                                {p.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {Number(p.price).toLocaleString("vi-VN")}đ
                                {p.stock !== undefined && (
                                  <span className="text-slate-400"> • Tồn: {p.stock}</span>
                                )}
                              </p>
                            </div>
                            {selected
                              ? <CheckSquare className="w-4 h-4 text-accent-400 shrink-0" />
                              : <Square className="w-4 h-4 text-slate-500 shrink-0" />
                            }
                          </button>
                        );
                      })
                  )}
                </div>

                {/* ── Tóm tắt đang bán ── */}
                {products.length > 0 && (
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-xs text-slate-500 mb-2">Đang hiển thị với viewer ({products.length} sản phẩm):</p>
                    <div className="flex flex-wrap gap-1.5">
                      {products.map((p) => (
                        <span
                          key={p.id}
                          className="flex items-center gap-1.5 bg-accent-50 text-accent-700 text-xs px-2 py-1 rounded-full border border-accent-100"
                        >
                          {p.imageUrl && (
                            <img src={p.imageUrl} alt={p.name ?? ""} className="w-4 h-4 rounded-full object-cover shrink-0 border border-accent-100" />
                          )}
                          {p.name}
                          <button onClick={() => toggleProduct(p)} className="hover:text-red-400 transition ml-0.5">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════════════════
              CỘT PHẢI (4 col): Chat realtime + Tương tác
              ════════════════════════════════════════════════════ */}
          <div className="lg:col-span-4 flex flex-col gap-6 h-full">
            <div className="glass-panel rounded-3xl p-6 flex-1 flex flex-col overflow-hidden relative border border-slate-200">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-2xl" />

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

              <div className="flex-1 bg-white rounded-2xl border border-slate-100 overflow-hidden">
                {isLive && streamKey ? (
                  <div className="h-full">
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
