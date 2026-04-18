"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { formatRelativeTimeVi } from "@/lib/datetime";

export interface ViewerStory {
  id: number;
  sellerId: number;
  sellerName: string;
  shopName?: string;
  title: string;
  mediaUrl: string | null;
  mediaType: "IMAGE" | "VIDEO";
  createdAt: string;
}

interface StoryViewerProps {
  stories: ViewerStory[];
  initialIndex: number;
  onClose: () => void;
  onViewed?: (storyId: number) => void;
}

const IMAGE_DURATION_MS = 5500;

function formatRelativeTime(raw: string): string {
  return formatRelativeTimeVi(raw);
}

export default function StoryViewer({ stories, initialIndex, onClose, onViewed }: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [videoDurationMs, setVideoDurationMs] = useState(12000);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const current = stories[currentIndex];

  useEffect(() => {
    if (!current) return;
    onViewed?.(current.id);
    setProgress(0);
    setVideoError(null);
    setVideoReady(false);
  }, [current?.id]);

  useEffect(() => {
    if (!current || current.mediaType !== "VIDEO" || !current.mediaUrl) {
      return;
    }

    const element = document.querySelector<HTMLVideoElement>(`video[data-story-id="${current.id}"]`);
    if (!element) {
      return;
    }

    const playPromise = element.play();
    if (playPromise && typeof playPromise.catch === "function") {
      void playPromise.catch(() => {
        // Bỏ qua lỗi autoplay; controls vẫn cho phép người dùng tự bấm phát.
      });
    }
  }, [current?.id, current?.mediaType, current?.mediaUrl]);

  useEffect(() => {
    if (!current) return;

    const total = current.mediaType === "VIDEO" ? videoDurationMs : IMAGE_DURATION_MS;
    const tick = 60;
    const step = (tick / total) * 100;

    const timer = window.setInterval(() => {
      setProgress((prev) => {
        const next = prev + step;
        if (next >= 100) {
          if (currentIndex < stories.length - 1) {
            setCurrentIndex((idx) => idx + 1);
            return 0;
          }
          onClose();
          return 100;
        }
        return next;
      });
    }, tick);

    return () => window.clearInterval(timer);
  }, [current?.id, currentIndex, stories.length, videoDurationMs, onClose]);

  const title = useMemo(() => {
    if (!current) return "";
    return current.title || "Nhật ký canh tác";
  }, [current]);

  function goPrev() {
    setCurrentIndex((idx) => Math.max(0, idx - 1));
  }

  function goNext() {
    setCurrentIndex((idx) => {
      if (idx >= stories.length - 1) {
        onClose();
        return idx;
      }
      return idx + 1;
    });
  }

  if (!current) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] bg-black/90"
      >
        <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-3 py-4 sm:px-4">
          <div className="mb-3 flex gap-1.5">
            {stories.map((story, idx) => {
              const width = idx < currentIndex ? 100 : idx === currentIndex ? progress : 0;
              return (
                <div key={story.id} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25">
                  <div
                    className="h-full rounded-full bg-white transition-[width] duration-75"
                    style={{ width: `${width}%` }}
                  />
                </div>
              );
            })}
          </div>

          <div className="mb-3 flex items-center justify-between text-white">
            <div>
              <p className="text-sm font-semibold">{current.shopName || current.sellerName}</p>
              <p className="text-xs text-white/70">{formatRelativeTime(current.createdAt)}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <motion.div
            key={current.id}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.x > 120) goPrev();
              if (info.offset.x < -120) goNext();
            }}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative flex-1 overflow-hidden rounded-2xl bg-black"
          >
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {current.mediaType === "VIDEO" && current.mediaUrl ? (
              <>
                <video
                  key={current.mediaUrl}
                  data-story-id={current.id}
                  src={current.mediaUrl}
                  autoPlay
                  muted
                  controls={false}
                  playsInline
                  preload="auto"
                  className="h-full w-full object-contain"
                  onLoadedMetadata={(e) => {
                    const seconds = e.currentTarget.duration;
                    setVideoReady(true);
                    if (Number.isFinite(seconds) && seconds > 0) {
                      setVideoDurationMs(Math.max(10000, Math.min(30000, Math.round(seconds * 1000))));
                    }
                    void e.currentTarget.play().catch(() => {
                      // Người dùng vẫn có thể bấm play thủ công bằng controls.
                    });
                  }}
                  onCanPlay={(e) => {
                    setVideoReady(true);
                    void e.currentTarget.play().catch(() => {
                      // Không chặn tương tác của người dùng.
                    });
                  }}
                  onError={() => {
                    setVideoError("Không thể phát video này. Hãy kiểm tra lại định dạng hoặc tải lại trang.");
                  }}
                />
                {!videoReady && !videoError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/25 text-sm text-white/80">
                    Đang tải video...
                  </div>
                )}
                {videoError && (
                  <div className="absolute inset-x-4 bottom-4 rounded-xl bg-black/70 p-3 text-center text-sm text-white">
                    {videoError}
                  </div>
                )}
              </>
            ) : current.mediaUrl ? (
              <img src={current.mediaUrl} alt={title} className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-white/70">Không có phương tiện</div>
            )}
          </motion.div>

          <div className="mt-3 text-white">
            <p className="text-base font-semibold">{title}</p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
