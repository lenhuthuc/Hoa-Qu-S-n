"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Radio, Users, RefreshCw } from "lucide-react";
import { livestreamApi } from "@/lib/api";

interface LiveSession {
  streamKey: string;
  sellerName: string;
  title: string;
  startedAt: string;
  viewerCount: number;
  thumbnailUrl?: string;
}

export default function LivePage() {
  const [streams, setStreams] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStreams = async () => {
    setLoading(true);
    try {
      const res = await livestreamApi.getActive();
      setStreams(res.data?.data || []);
    } catch {
      setStreams([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStreams();
    const interval = setInterval(fetchStreams, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Radio className="w-6 h-6 text-red-500 animate-pulse" />
          <h1 className="text-2xl font-bold text-gray-800">Đang phát trực tiếp</h1>
        </div>
        <button
          onClick={fetchStreams}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-green-600 transition"
        >
          <RefreshCw className="w-4 h-4" /> Làm mới
        </button>
      </div>

      {loading && streams.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          Đang tải...
        </div>
      ) : streams.length === 0 ? (
        <div className="text-center py-20">
          <Radio className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Hiện chưa có phiên phát sóng nào</p>
          <p className="text-gray-400 text-sm mt-1">Hãy quay lại sau nhé!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {streams.map((s) => (
            <Link
              key={s.streamKey}
              href={`/live/${s.streamKey}`}
              className="group block bg-white rounded-xl shadow hover:shadow-lg transition overflow-hidden border"
            >
              <div className="relative aspect-video bg-gray-900 flex items-center justify-center">
                {s.thumbnailUrl ? (
                  <img src={s.thumbnailUrl} alt={s.title} className="w-full h-full object-cover" />
                ) : (
                  <Radio className="w-12 h-12 text-gray-600" />
                )}
                <div className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  LIVE
                </div>
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {s.viewerCount || 0}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-800 group-hover:text-green-600 transition line-clamp-1">
                  {s.title || "Phát sóng trực tiếp"}
                </h3>
                <p className="text-sm text-gray-500 mt-1">{s.sellerName || "Người bán"}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
