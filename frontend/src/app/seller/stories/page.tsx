"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Plus, Trash2, Loader2, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import { storyApi, farmingApi, isLoggedIn } from "@/lib/api";

interface Story {
  id: number;
  batchId: string | null;
  farmingLogId: string | null;
  title: string;
  content: string;
  imageUrl: string | null;
  videoUrl: string | null;
  activityType: string | null;
  likesCount: number;
  isPublished: boolean;
  createdAt: string;
}

interface LogEntry {
  id: string;
  batchId: string;
  note: string;
  imageUrl?: string;
  activityType: string;
  createdAt: string;
}

const activityOptions = [
  { value: "PLANTING", label: "Gieo trồng" },
  { value: "WATERING", label: "Tưới nước" },
  { value: "FERTILIZING", label: "Bón phân" },
  { value: "SPRAYING", label: "Phun thuốc" },
  { value: "HARVESTING", label: "Thu hoạch" },
  { value: "PACKING", label: "Đóng gói" },
  { value: "OTHER", label: "Khác" },
];

export default function SellerStoriesPage() {
  const router = useRouter();
  const [stories, setStories] = useState<Story[]>([]);
  const [journalEntries, setJournalEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [batchId, setBatchId] = useState("");
  const [activityType, setActivityType] = useState("OTHER");
  const [selectedJournalId, setSelectedJournalId] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    loadData();
  }, []);

  async function loadData() {
    try {
      const [storiesRes, journalRes] = await Promise.all([
        storyApi.getMyStories(),
        farmingApi.getMyEntries(),
      ]);
      setStories(storiesRes.data || []);
      const entries = journalRes.data?.data || journalRes.data || [];
      setJournalEntries(Array.isArray(entries) ? entries : []);
    } catch {
      // empty
    } finally {
      setLoading(false);
    }
  }

  function fillFromJournal(entry: LogEntry) {
    setSelectedJournalId(entry.id);
    setTitle(`Nhật ký: ${activityOptions.find((a) => a.value === entry.activityType)?.label || entry.activityType} - ${entry.batchId}`);
    setContent(entry.note);
    setBatchId(entry.batchId);
    setActivityType(entry.activityType);
    if (entry.imageUrl) setImageUrl(entry.imageUrl);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("Vui lòng nhập tiêu đề và nội dung");
      return;
    }
    setSubmitting(true);
    try {
      await storyApi.create({
        title: title.trim(),
        content: content.trim(),
        imageUrl: imageUrl || undefined,
        videoUrl: videoUrl || undefined,
        batchId: batchId || undefined,
        farmingLogId: selectedJournalId || undefined,
        activityType: activityType || undefined,
      });
      toast.success("Đã đăng câu chuyện!");
      setShowForm(false);
      resetForm();
      loadData();
    } catch {
      toast.error("Không thể đăng câu chuyện");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Bạn có chắc muốn xoá câu chuyện này?")) return;
    try {
      await storyApi.delete(id);
      setStories((prev) => prev.filter((s) => s.id !== id));
      toast.success("Đã xoá");
    } catch {
      toast.error("Không thể xoá");
    }
  }

  function resetForm() {
    setTitle("");
    setContent("");
    setImageUrl("");
    setVideoUrl("");
    setBatchId("");
    setActivityType("OTHER");
    setSelectedJournalId("");
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
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-green-600" /> Câu chuyện của tôi
          </h1>
          <button
            onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            {showForm ? "Đóng" : "Viết câu chuyện"}
          </button>
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            {/* Journal Quick Fill */}
            {journalEntries.length > 0 && (
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 mb-1 block">Tạo từ nhật ký canh tác</label>
                <select
                  value={selectedJournalId}
                  onChange={(e) => {
                    const entry = journalEntries.find((j) => j.id === e.target.value);
                    if (entry) fillFromJournal(entry);
                  }}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                >
                  <option value="">-- Chọn nhật ký để điền nhanh --</option>
                  {journalEntries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      [{entry.batchId}] {entry.activityType} - {new Date(entry.createdAt).toLocaleDateString("vi-VN")}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Tiêu đề *</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 mt-1" placeholder="Tiêu đề câu chuyện..." />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Nội dung *</label>
                <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} className="w-full border border-gray-300 rounded-lg p-2 mt-1" placeholder="Chia sẻ câu chuyện canh tác của bạn..." />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Loại hoạt động</label>
                  <select value={activityType} onChange={(e) => setActivityType(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 mt-1">
                    {activityOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Mã lô hàng</label>
                  <input type="text" value={batchId} onChange={(e) => setBatchId(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 mt-1" placeholder="VD: BATCH-001" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">URL ảnh</label>
                  <input type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 mt-1" placeholder="https://..." />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">URL video</label>
                  <input type="text" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 mt-1" placeholder="https://..." />
                </div>
              </div>
              <button type="submit" disabled={submitting} className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                Đăng câu chuyện
              </button>
            </form>
          </div>
        )}

        {/* Stories list */}
        {stories.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center text-gray-500">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="mb-2">Bạn chưa có câu chuyện nào</p>
            <p className="text-sm">Chia sẻ hành trình canh tác của bạn để kết nối với người mua!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {stories.map((story) => (
              <div key={story.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-800">{story.title}</h3>
                      {story.activityType && (
                        <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                          {activityOptions.find((a) => a.value === story.activityType)?.label || story.activityType}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{story.content}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>{new Date(story.createdAt).toLocaleDateString("vi-VN")}</span>
                      {story.batchId && (
                        <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Lô: {story.batchId}</span>
                      )}
                      <span>❤️ {story.likesCount}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <a href={`/stories`} target="_blank" className="text-gray-400 hover:text-blue-500">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button onClick={() => handleDelete(story.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
