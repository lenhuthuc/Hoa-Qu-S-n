"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";

interface LivePlayerProps {
  whepUrl: string;
  streamKey: string;
}

export default function LivePlayer({ whepUrl, streamKey }: LivePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const connect = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    setError(null);

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          video.srcObject = event.streams[0];
          video.play().then(() => setIsPlaying(true)).catch(() => {});
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          setIsPlaying(false);
          setError("Mất kết nối. Đang thử lại...");
          setTimeout(() => setRetryCount((prev) => prev + 1), 3000);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
        } else {
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === "complete") resolve();
          };
        }
      });

      const resp = await fetch(whepUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: pc.localDescription!.sdp,
      });

      if (resp.status === 404) {
        setError("Stream chưa bắt đầu hoặc đã kết thúc");
        pc.close();
        setTimeout(() => setRetryCount((prev) => prev + 1), 5000);
        return;
      }

      if (!resp.ok) {
        throw new Error(`WHEP request failed: ${resp.status}`);
      }

      const answerSdp = await resp.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (err: any) {
      setError(err.message || "Lỗi kết nối");
      setTimeout(() => setRetryCount((prev) => prev + 1), 5000);
    }
  }, [whepUrl]);

  useEffect(() => {
    connect();
    return () => {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, [connect, retryCount]);

  return (
    <div className="relative bg-black w-full h-full overflow-hidden">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        controls
        playsInline
        muted
        autoPlay
      />

      {isPlaying && (
        <div className="absolute top-3 left-3 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          LIVE
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
          <p className="text-white/70 text-sm mb-3">{error}</p>
          <button
            onClick={() => setRetryCount((prev) => prev + 1)}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Thử lại
          </button>
        </div>
      )}
    </div>
  );
}
