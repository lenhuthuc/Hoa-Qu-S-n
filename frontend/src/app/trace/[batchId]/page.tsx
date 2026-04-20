"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { QrCode, MapPin, Cloud, Calendar, Leaf, Package, Loader2 } from "lucide-react";
import { traceApi } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface LogEntry {
  id: string;
  title?: string;
  note: string;
  imageUrl?: string;
  videoUrl?: string;
  mediaType?: string;
  activityType: string;
  weatherCondition?: string;
  gpsLat?: number;
  gpsLng?: number;
  capturedAt: string;
  createdAt: string;
}

interface Traceability {
  batchId: string;
  productName: string;
  cropType?: string;
  sellerName?: string;
  origin: string;
  harvestAt?: string;
  totalEntries: number;
  timeline: LogEntry[];
}

function resolveTraceMediaUrl(raw?: string | null): string | null {
  if (!raw) return null;

  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:") || value.startsWith("blob:")) {
    return value;
  }
  if (value.startsWith("/api/reviews/media") || value.startsWith("/api/farming-journal/media")) {
    return `${API_BASE}${value}`;
  }
  if (value.startsWith("local:") || value.startsWith("review-media/") || value.startsWith("reviews/") || value.includes(".r2.cloudflarestorage.com/")) {
    return `${API_BASE}/api/reviews/media?url=${encodeURIComponent(value)}`;
  }
  if (value.startsWith("/uploads/farming/") || value.startsWith("uploads/farming/")) {
    return `${API_BASE}/api/farming-journal/media?url=${encodeURIComponent(value)}`;
  }
  if (value.startsWith("/uploads/") || value.startsWith("uploads/")) {
    return `${API_BASE}/api/farming-journal/media?url=${encodeURIComponent(value)}`;
  }
  return value;
}

const activityIcons: Record<string, any> = {
  PLANTING: Leaf,
  WATERING: Cloud,
  HARVESTING: Package,
};

const activityLabels: Record<string, string> = {
  PLANTING: "Gieo trồng",
  WATERING: "Tưới nước",
  FERTILIZING: "Bón phân",
  SPRAYING: "Phun thuốc",
  HARVESTING: "Thu hoạch",
  PACKING: "Đóng gói",
  OTHER: "Khác",
};

export default function TracePage() {
  const params = useParams();
  const batchId = params.batchId as string;
  const [data, setData] = useState<Traceability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await traceApi.getByBatchId(batchId);
        setData(res.data?.data || res.data);
      } catch {
        setError("Không tìm thấy thông tin truy xuất cho lô hàng này");
      } finally {
        setLoading(false);
      }
    })();
  }, [batchId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <QrCode className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 text-lg">{error || "Không có dữ liệu"}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-500 text-white rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-2">
          <QrCode className="w-8 h-8" />
          <h1 className="text-2xl font-bold">Truy xuất nguồn gốc</h1>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
          <div>
            <span className="text-green-200">Mã lô:</span>
            <p className="font-mono font-semibold">{data.batchId}</p>
          </div>
          <div>
            <span className="text-green-200">Sản phẩm:</span>
            <p className="font-semibold">{data.productName || "—"}</p>
          </div>
          <div>
            <span className="text-green-200">Nhà vườn:</span>
            <p className="font-semibold">{data.sellerName || "—"}</p>
          </div>
          <div>
            <span className="text-green-200">Loại cây:</span>
            <p className="font-semibold">{data.cropType || "—"}</p>
          </div>
          <div>
            <span className="text-green-200">Số bước ghi nhận:</span>
            <p className="font-semibold">{data.totalEntries}</p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Nhật ký canh tác</h2>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-green-200" />

        <div className="space-y-6">
          {data.timeline.map((entry, index) => {
            const Icon = activityIcons[entry.activityType] || Leaf;
            return (
              <div key={entry.id || index} className="relative flex gap-4">
                {/* Dot */}
                <div className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full bg-green-100 border-2 border-green-500 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-green-700" />
                </div>

                {/* Content */}
                <div className="flex-1 bg-white rounded-xl border p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-block bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                      {activityLabels[entry.activityType] || entry.activityType}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(entry.capturedAt || entry.createdAt).toLocaleDateString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {entry.title && <p className="text-sm font-semibold text-gray-900">{entry.title}</p>}
                  <p className="mt-1 text-gray-700 text-sm">{entry.note || "Không có ghi chú"}</p>

                  {resolveTraceMediaUrl(entry.imageUrl) && (
                    <img
                      src={resolveTraceMediaUrl(entry.imageUrl) || undefined}
                      alt="Ảnh nhật ký"
                      className="mt-3 rounded-lg max-h-48 w-full object-cover"
                    />
                  )}

                  {resolveTraceMediaUrl(entry.videoUrl) && (
                    <video
                      src={resolveTraceMediaUrl(entry.videoUrl) || undefined}
                      controls
                      playsInline
                      preload="metadata"
                      className="mt-3 rounded-lg max-h-56 w-full bg-black object-contain"
                    />
                  )}

                  <div className="flex gap-4 mt-2 text-xs text-gray-400">
                    {entry.weatherCondition && (
                      <span className="flex items-center gap-1">
                        <Cloud className="w-3 h-3" /> {entry.weatherCondition}
                      </span>
                    )}
                    {entry.gpsLat && entry.gpsLng && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {entry.gpsLat.toFixed(4)}, {entry.gpsLng.toFixed(4)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {data.timeline.length === 0 && (
        <p className="text-center text-gray-400 py-8">Chưa có dữ liệu nhật ký canh tác</p>
      )}
    </div>
  );
}
