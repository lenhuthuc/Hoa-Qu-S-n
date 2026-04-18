"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Clock3, Loader2, Plus, Trash2, Upload, Video } from "lucide-react";
import toast from "react-hot-toast";
import { hasRole, isLoggedIn, storyApi } from "@/lib/api";
import { formatDateTimeVi, parseBackendDate } from "@/lib/datetime";

interface StoryItem {
  id: number;
  title: string;
  content: string;
  mediaUrl: string | null;
  mediaType: "IMAGE" | "VIDEO";
  createdAt: string;
  expiresAt?: string;
  metadataMissing?: boolean;
}

function formatLeftTime(expiresAt?: string): string {
  if (!expiresAt) return "Không rõ";
  const diffMs = parseBackendDate(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return "Đã hết hạn";
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

export default function SellerJournalPage() {
  const router = useRouter();

  const [stories, setStories] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [activityType, setActivityType] = useState("OTHER");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    if (!hasRole("SELLER") && !hasRole("ADMIN")) {
      router.replace("/seller/register");
      return;
    }
    void loadStories();
  }, [router]);

  async function loadStories() {
    setLoading(true);
    try {
      const res = await storyApi.getMyStories();
      const list = Array.isArray(res.data) ? res.data : [];
      setStories(
        list
          .map((s: any): StoryItem => ({
            id: Number(s?.id || 0),
            title: typeof s?.title === "string" ? s.title : "",
            content: typeof s?.content === "string" ? s.content : "",
            mediaUrl:
              typeof s?.mediaUrl === "string"
                ? s.mediaUrl
                : typeof s?.imageUrl === "string"
                  ? s.imageUrl
                  : typeof s?.videoUrl === "string"
                    ? s.videoUrl
                    : null,
              mediaType: String(s?.mediaType || (s?.videoUrl ? "VIDEO" : "IMAGE")).toUpperCase() === "VIDEO" ? "VIDEO" : "IMAGE",
            createdAt: typeof s?.createdAt === "string" ? s.createdAt : new Date().toISOString(),
            expiresAt: typeof s?.expiresAt === "string" ? s.expiresAt : undefined,
            metadataMissing: Boolean(s?.metadataMissing),
          }))
          .filter((s: StoryItem) => s.id > 0)
      );
    } catch {
      toast.error("Không thể tải danh sách nhật ký");
      setStories([]);
    } finally {
      setLoading(false);
    }
  }

  async function validateVideo(file: File): Promise<void> {
    const url = URL.createObjectURL(file);
    try {
      await new Promise<void>((resolve, reject) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.src = url;
        video.onloadedmetadata = () => {
          const duration = Number(video.duration);
          if (!Number.isFinite(duration) || duration < 10 || duration > 30) {
            reject(new Error("Video phải có thời lượng từ 10 đến 30 giây"));
            return;
          }
          resolve();
        };
        video.onerror = () => reject(new Error("Không thể đọc metadata video"));
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function handleMediaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.type.startsWith("video/")) {
        if (file.type !== "video/mp4") {
          throw new Error("Chỉ hỗ trợ video MP4");
        }
        await validateVideo(file);
      } else if (file.type !== "image/jpeg" && file.type !== "image/png") {
        throw new Error("Chỉ hỗ trợ ảnh JPG/PNG hoặc video MP4");
      }

      if (mediaPreview) {
        URL.revokeObjectURL(mediaPreview);
      }
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    } catch (err: any) {
      toast.error(err?.message || "Media không hợp lệ");
      e.target.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Vui lòng nhập tiêu đề");
      return;
    }
    if (!mediaFile) {
      toast.error("Vui lòng chọn 1 ảnh hoặc 1 video");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("media", mediaFile);
      formData.append("content", content.trim());
      formData.append("activityType", activityType);

      await storyApi.create(formData);
      toast.success("Đăng nhật ký thành công");
      setTitle("");
      setContent("");
      setActivityType("OTHER");
      setMediaFile(null);
      if (mediaPreview) {
        URL.revokeObjectURL(mediaPreview);
      }
      setMediaPreview(null);
      setShowForm(false);
      await loadStories();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Không thể đăng nhật ký");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Xóa nhật ký này?")) return;
    try {
      await storyApi.delete(id);
      setStories((prev) => prev.filter((s) => s.id !== id));
      toast.success("Đã xóa nhật ký");
    } catch {
      toast.error("Không thể xóa nhật ký");
    }
  }

  const grouped = useMemo(() => {
    const active: StoryItem[] = [];
    const expired: StoryItem[] = [];
    stories.forEach((s) => {
      if (s.expiresAt && new Date(s.expiresAt).getTime() <= Date.now()) {
        expired.push(s);
      } else {
        active.push(s);
      }
    });
    return { active, expired };
  }, [stories]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <BookOpen className="h-6 w-6 text-green-600" />
          Nhật ký canh tác
        </h1>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          <Plus className="h-4 w-4" />
          {showForm ? "Đóng" : "Thêm mới"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-semibold text-slate-700">Tiêu đề *</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-green-500"
                placeholder="Ví dụ: Tưới nước vườn xoài"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-semibold text-slate-700">Hoạt động</span>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-green-500"
              >
                <option value="PLANTING">Gieo trồng</option>
                <option value="WATERING">Tưới nước</option>
                <option value="FERTILIZING">Bón phân</option>
                <option value="SPRAYING">Phun thuốc</option>
                <option value="HARVESTING">Thu hoạch</option>
                <option value="PACKING">Đóng gói</option>
                <option value="OTHER">Khác</option>
              </select>
            </label>
          </div>

          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-700">Mô tả ngắn</span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-green-500"
              placeholder="Mô tả thêm cho nhật ký..."
            />
          </label>

          <div className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Phương tiện *</span>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-green-300 bg-green-50/40 px-4 py-3 text-sm text-green-700">
              <Upload className="h-4 w-4" />
              Chọn 1 ảnh JPG/PNG hoặc 1 video MP4 (10-30 giây)
              <input type="file" accept="image/jpeg,image/png,video/mp4" onChange={handleMediaChange} className="hidden" />
            </label>

            {mediaPreview && mediaFile && (
              <div className="overflow-hidden rounded-xl border bg-slate-50 p-2">
                {mediaFile.type.startsWith("video/") ? (
                  <video src={mediaPreview} controls className="max-h-64 w-full rounded-lg object-contain" />
                ) : (
                  <img src={mediaPreview} alt="Preview" className="max-h-64 w-full rounded-lg object-contain" />
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-full bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
            {submitting ? "Đang đăng..." : "Đăng nhật ký"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-lg font-bold text-slate-800">Nhật ký đang hiển thị ({grouped.active.length})</h2>
            {grouped.active.length === 0 ? (
              <div className="rounded-xl border bg-white p-5 text-sm text-slate-500">Chưa có nhật ký nào đang hiển thị.</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {grouped.active.map((story) => (
                  <article key={story.id} className="overflow-hidden rounded-xl border bg-white shadow-sm">
                    {story.mediaUrl && (
                      <div className="h-48 bg-slate-100">
                        {story.mediaType === "VIDEO" ? (
                          <video src={story.mediaUrl} controls className="h-full w-full object-cover" />
                        ) : (
                          <img src={story.mediaUrl} alt={story.title} className="h-full w-full object-cover" />
                        )}
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="text-base font-semibold text-slate-800">{story.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{story.content || "Không có mô tả"}</p>
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                        <span>{formatDateTimeVi(story.createdAt)}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                          <Clock3 className="h-3 w-3" />
                          còn {formatLeftTime(story.expiresAt)}
                        </span>
                      </div>
                      {story.metadataMissing && (
                        <p className="mt-2 text-xs text-amber-600">Nhật ký này thiếu một phần metadata (GPS/thời gian chụp).</p>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(story.id)}
                        className="mt-3 inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Xóa
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-slate-800">Lịch sử đã hết hạn ({grouped.expired.length})</h2>
            {grouped.expired.length === 0 ? (
              <div className="rounded-xl border bg-white p-5 text-sm text-slate-500">Chưa có nhật ký nào hết hạn.</div>
            ) : (
              <div className="space-y-3">
                {grouped.expired.map((story) => (
                  <div key={story.id} className="flex items-center justify-between rounded-xl border bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{story.title}</p>
                      <p className="text-xs text-slate-500">Đăng lúc {formatDateTimeVi(story.createdAt)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(story.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Xóa
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
