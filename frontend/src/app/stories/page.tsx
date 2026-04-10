"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, User, Calendar, Leaf } from "lucide-react";
import { storyApi } from "@/lib/api";

interface Story {
  id: number;
  sellerId: number;
  sellerName: string;
  batchId: string | null;
  title: string;
  content: string;
  imageUrl: string | null;
  videoUrl: string | null;
  activityType: string | null;
  likesCount: number;
  createdAt: string;
}

const ACTIVITY_LABELS: Record<string, string> = {
  PLANTING: "🌱 Gieo trồng",
  WATERING: "💧 Tưới nước",
  FERTILIZING: "🧪 Bón phân",
  SPRAYING: "🔫 Phun thuốc",
  HARVESTING: "🌾 Thu hoạch",
  PACKING: "📦 Đóng gói",
  OTHER: "📝 Khác",
};

export default function StoriesPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    loadStories();
  }, [page]);

  async function loadStories() {
    try {
      const res = await storyApi.getAll(page, 12);
      const data = res.data;
      setStories(data.content || data || []);
      setTotalPages(data.totalPages || 0);
    } catch {
      setStories([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-green-600" /> Câu chuyện nhà nông
          </h1>
        </div>

        {stories.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center text-gray-500">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Chưa có câu chuyện nào được chia sẻ</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {stories.map((story) => (
              <div key={story.id} className="bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition-shadow">
                {story.imageUrl && (
                  <div className="h-48 bg-gray-100 overflow-hidden">
                    <img
                      src={story.imageUrl}
                      alt={story.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {story.activityType && (
                      <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                        {ACTIVITY_LABELS[story.activityType] || story.activityType}
                      </span>
                    )}
                    {story.batchId && (
                      <Link href={`/trace/${story.batchId}`} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full hover:underline">
                        🔗 {story.batchId}
                      </Link>
                    )}
                  </div>

                  <h2 className="font-semibold text-gray-800 mb-1 line-clamp-2">{story.title}</h2>
                  <p className="text-sm text-gray-600 line-clamp-3 mb-3">{story.content}</p>

                  {story.videoUrl && (
                    <a href={story.videoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mb-2 inline-block">
                      🎥 Xem video
                    </a>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-400 mt-2 pt-2 border-t">
                    <Link href={`/shop/${story.sellerId}`} className="flex items-center gap-1 hover:text-green-600">
                      <User className="w-3 h-3" />
                      {story.sellerName || `Nông hộ #${story.sellerId}`}
                    </Link>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(story.createdAt).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-4 py-2 border rounded-lg disabled:opacity-50 hover:bg-white"
            >
              ← Trước
            </button>
            <span className="text-sm text-gray-600">
              Trang {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-4 py-2 border rounded-lg disabled:opacity-50 hover:bg-white"
            >
              Sau →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
