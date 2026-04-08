"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Video, VideoOff, Mic, MicOff, Radio, Square, Users, Settings2, Sparkles, Activity } from "lucide-react";
import toast from "react-hot-toast";
import { livestreamApi, isLoggedIn } from "@/lib/api";
import LiveChat from "@/components/LiveChat";

export default function GoLivePage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isLive, setIsLive] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [streamKey, setStreamKey] = useState("");
  const [title, setTitle] = useState("");
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [starting, setStarting] = useState(false);
  const [liveDuration, setLiveDuration] = useState(0);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); }
  }, [router]);

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
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "environment" },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsPreviewing(true);
    } catch {
      toast.error("Không thể truy cập camera/mic");
    }
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

      // Connect to MediaMTX via WebRTC (WHIP)
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      const stream = streamRef.current;
      if (!stream) throw new Error("No media stream");

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete before sending WHIP offer
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
        } else {
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === "complete") resolve();
          };
        }
      });

      const whipBase = process.env.NEXT_PUBLIC_WHIP_URL || "http://localhost:8889";
      const whipUrl = `${whipBase}/${key}/whip`;
      const resp = await fetch(whipUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: pc.localDescription!.sdp,
      });

      if (!resp.ok) throw new Error("WHIP handshake failed");

      const answerSdp = await resp.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      pcRef.current = pc;

      setIsLive(true);
      setLiveDuration(0);
      toast.success("Bạn đang phát sóng trực tiếp!");
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi bắt đầu livestream");
    } finally {
      setStarting(false);
    }
  };

  const stopLive = async () => {
    try {
      if (streamKey) {
        await livestreamApi.stop(streamKey);
      }
    } catch {}

    streamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;

    setIsLive(false);
    setIsPreviewing(false);
    setStreamKey("");
    setLiveDuration(0);
    toast.success("Đã kết thúc phiên live");
  };

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

  return (
    <div className="min-h-screen bg-surface-darker text-white py-8 px-4 sm:px-6">
      <div className="max-w-[1400px] mx-auto">
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
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                 </span>
                 <span className="text-red-400 font-bold tracking-widest text-sm">LIVE</span>
               </div>
               <div className="w-px h-4 bg-white/20"></div>
               <span className="text-slate-300 font-mono">{formatDuration(liveDuration)}</span>
             </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-180px)] min-h-[600px]">
          {/* Main Visual: Camera */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className={`relative flex-1 rounded-3xl overflow-hidden bg-black/50 border transition-all duration-500 ${isLive ? 'border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.15)]' : 'border-white/10'}`}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-opacity duration-700 ${isPreviewing ? 'opacity-100' : 'opacity-0'}`}
              />
              
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

              {/* In-stream Overlay */}
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

            {/* Controls Bar */}
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
                      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${!isPreviewing ? 'opacity-50 cursor-not-allowed' : cameraOn ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500/20 text-red-500 border border-red-500/50'}`}
                    >
                      {cameraOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                    </button>
                    <button
                      onClick={toggleMic}
                      disabled={!isPreviewing}
                      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${!isPreviewing ? 'opacity-50 cursor-not-allowed' : micOn ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500/20 text-red-500 border border-red-500/50'}`}
                    >
                      {micOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                    </button>
                    
                    <button
                      onClick={goLive}
                      disabled={!isPreviewing || starting}
                      className={`ml-4 px-8 h-14 rounded-xl font-bold flex items-center gap-2 transition-all ${
                        !isPreviewing 
                        ? 'bg-white/5 text-white/30 cursor-not-allowed'
                        : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-lg shadow-red-500/30'
                      }`}
                    >
                       {starting ? <Activity className="w-5 h-5 animate-spin" /> : <Radio className="w-5 h-5" />} 
                       {starting ? 'Đang kết nối...' : 'Bắt Đầu Phát'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2 rounded-lg flex items-center gap-2">
                       <Radio className="w-5 h-5 animate-pulse" /> Đang phát đến toàn hệ thống
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={toggleCamera}
                      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${cameraOn ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500/20 text-red-500 border border-red-500/50'}`}
                    >
                      {cameraOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                    </button>
                    <button
                      onClick={toggleMic}
                      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${micOn ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500/20 text-red-500 border border-red-500/50'}`}
                    >
                      {micOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                    </button>
                    
                    <button
                      onClick={stopLive}
                      className="ml-4 px-8 h-14 rounded-xl font-bold bg-white/10 hover:bg-red-500/20 text-white hover:text-red-500 border border-white/10 hover:border-red-500/50 transition-all flex items-center gap-2 group"
                    >
                      <Square className="w-5 h-5 group-hover:scale-110 transition-transform" /> Kết Thúc Live
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Chat & Stats */}
          <div className="lg:col-span-4 flex flex-col gap-6 h-full">
            <div className="dark-glass-panel rounded-3xl p-6 flex-1 flex flex-col overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-2xl"></div>
              
              <div className="flex items-center justify-between mb-6 relative z-10">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent-400" /> Tương tác
                </h3>
                {isLive && (
                  <div className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-black/40 rounded-full border border-white/10">
                    <Users className="w-3.5 h-3.5 text-slate-400" /> Trực tuyến
                  </div>
                )}
              </div>

              <div className="flex-1 bg-black/20 rounded-2xl border border-white/5 overflow-hidden">
                {isLive && streamKey ? (
                  <div className="h-full" style={{ filter: 'invert(0.9) hue-rotate(180deg)', background: '#fff' }}> 
                    <LiveChat streamKey={streamKey} userName="Người bán" /> 
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-30">
                     <Radio className="w-12 h-12 mb-4" />
                     <p className="text-sm">Bắt đầu phát sóng để xem<br/>khung chat và người xem thả tim</p>
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
