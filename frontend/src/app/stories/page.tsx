"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Calendar, User } from "lucide-react";
import { storyApi } from "@/lib/api";
import StoryCircleList, { StoryCircleSeller } from "@/components/stories/StoryCircleList";
import StoryViewer, { ViewerStory } from "@/components/stories/StoryViewer";
import { formatDateTimeVi } from "@/lib/datetime";

interface Story {
  id: number;
  sellerId: number;
  sellerName: string;
  shopName?: string;
  title: string;
  mediaUrl: string | null;
  mediaType: "IMAGE" | "VIDEO";
  content?: string;
  expiresAt?: string;
  createdAt: string;
}

const VIEWED_STORAGE_KEY = "hqs_story_viewed_ids";

export default function StoriesPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewedIds, setViewedIds] = useState<number[]>([]);
  const [activeSellerId, setActiveSellerId] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(VIEWED_STORAGE_KEY);
      if (raw) {
        const ids = JSON.parse(raw);
        if (Array.isArray(ids)) {
          setViewedIds(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id)));
        }
      }
    } catch {
      // Không làm gì
    }
    loadStories();
  }, []);

  async function loadStories() {
    try {
      const { data } = await storyApi.getAll(0, 60);
      const items = Array.isArray(data?.stories)
        ? data.stories
        : Array.isArray(data?.content)
          ? data.content
          : Array.isArray(data)
            ? data
            : [];
      const normalized = items
        .map((s: any) => {
          const mediaUrlRaw = typeof s?.mediaUrl === "string" ? s.mediaUrl : (typeof s?.imageUrl === "string" ? s.imageUrl : (typeof s?.videoUrl === "string" ? s.videoUrl : null));
          return {
            id: Number(s?.id || 0),
            sellerId: Number(s?.sellerId || 0),
            sellerName: typeof s?.sellerName === "string" ? s.sellerName : "Nông hộ",
            shopName: typeof s?.shopName === "string" ? s.shopName : undefined,
            title: typeof s?.title === "string" ? s.title : "Nhật ký canh tác",
            mediaUrl: mediaUrlRaw,
            mediaType: String(s?.mediaType || (s?.videoUrl ? "VIDEO" : "IMAGE")).toUpperCase() === "VIDEO" ? "VIDEO" : "IMAGE",
            content: typeof s?.content === "string" ? s.content : "",
            expiresAt: typeof s?.expiresAt === "string" ? s.expiresAt : undefined,
            createdAt: typeof s?.createdAt === "string" ? s.createdAt : new Date().toISOString(),
          } as Story;
        })
        .filter((s: Story) => s.id > 0 && s.sellerId > 0);

      setStories(normalized);
    } catch {
      setStories([]);
    } finally {
      setLoading(false);
    }
  }

  function markViewed(storyId: number) {
    setViewedIds((prev) => {
      if (prev.includes(storyId)) return prev;
      const next = [...prev, storyId];
      localStorage.setItem(VIEWED_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const groupedBySeller = useMemo(() => {
    const grouped = new Map<number, Story[]>();
    stories.forEach((story) => {
      if (!grouped.has(story.sellerId)) {
        grouped.set(story.sellerId, []);
      }
      grouped.get(story.sellerId)!.push(story);
    });
    grouped.forEach((list) => {
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });
    return grouped;
  }, [stories]);

  const sellerCircles: StoryCircleSeller[] = useMemo(() => {
    const circles: StoryCircleSeller[] = [];
    groupedBySeller.forEach((list, sellerId) => {
      const first = list[0];
      const hasUnseen = list.some((story) => !viewedIds.includes(story.id));
      circles.push({
        sellerId,
        sellerName: first?.shopName || first?.sellerName || "Nông hộ",
        shopName: first?.shopName,
        avatar: first?.mediaType === "IMAGE" ? first.mediaUrl : null,
        storiesCount: list.length,
        hasUnseen,
      });
    });
    return circles;
  }, [groupedBySeller, viewedIds]);

  const activeStories: ViewerStory[] = useMemo(() => {
    if (activeSellerId === null) return [];
    return (groupedBySeller.get(activeSellerId) || []).map((story) => ({
      id: story.id,
      sellerId: story.sellerId,
      sellerName: story.sellerName,
      shopName: story.shopName,
      title: story.title,
      mediaUrl: story.mediaUrl,
      mediaType: story.mediaType,
      createdAt: story.createdAt,
    }));
  }, [activeSellerId, groupedBySeller]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#edf9f0] via-[#f8fcf8] to-[#e2f0e6] p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
            <BookOpen className="w-6 h-6 text-green-600" /> Câu chuyện nhà nông
          </h1>
        </div>

        <div className="mb-6 rounded-2xl border border-emerald-100 bg-white/90 p-4 shadow-sm">
          <StoryCircleList
            sellers={sellerCircles}
            onOpenSellerStories={(sellerId) => {
              setActiveSellerId(sellerId);
              setActiveIndex(0);
            }}
          />
        </div>

        {stories.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center text-gray-500">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Chưa có câu chuyện nào được chia sẻ</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {stories.map((story) => (
              <button
                key={story.id}
                type="button"
                onClick={() => {
                  setActiveSellerId(story.sellerId);
                  const sellerList = groupedBySeller.get(story.sellerId) || [];
                  const index = sellerList.findIndex((item) => item.id === story.id);
                  setActiveIndex(index >= 0 ? index : 0);
                }}
                className="bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition-shadow text-left"
              >
                {story.mediaUrl && (
                  <div className="h-48 bg-gray-100 overflow-hidden">
                    {story.mediaType === "VIDEO" ? (
                      <video src={story.mediaUrl} className="h-full w-full object-cover" muted playsInline />
                    ) : (
                      <img src={story.mediaUrl} alt={story.title} className="w-full h-full object-cover" />
                    )}
                  </div>
                )}
                <div className="p-4">
                  <h2 className="font-semibold text-gray-800 mb-1 line-clamp-2">{story.title ?? ""}</h2>
                  <p className="text-sm text-gray-600 line-clamp-3 mb-3">{story.content || "Nông hộ vừa cập nhật nhật ký canh tác."}</p>

                  <div className="flex items-center justify-between text-xs text-gray-400 mt-2 pt-2 border-t">
                    <span className="flex items-center gap-1 text-green-700">
                      <User className="w-3 h-3" />
                      {story.shopName || story.sellerName || `Nông hộ #${story.sellerId}`}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDateTimeVi(story.createdAt)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {activeStories.length > 0 && activeSellerId !== null && (
        <StoryViewer
          stories={activeStories}
          initialIndex={activeIndex}
          onViewed={markViewed}
          onClose={() => {
            setActiveSellerId(null);
            setActiveIndex(0);
          }}
        />
      )}
    </div>
  );
}
