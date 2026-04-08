"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Plus, Trash2, Image as ImageIcon, Calendar, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { farmingApi, isLoggedIn } from "@/lib/api";

interface LogEntry {
  id: string;
  batchId: string;
  note: string;
  imageUrl?: string;
  activityType: string;
  weatherCondition?: string;
  gpsLat?: number;
  gpsLng?: number;
  capturedAt: string;
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

export default function JournalPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [batchId, setBatchId] = useState("");
  const [note, setNote] = useState("");
  const [activityType, setActivityType] = useState("OTHER");
  const [weatherCondition, setWeatherCondition] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const fetchEntries = async () => {
    try {
      const res = await farmingApi.getMyEntries();
      setEntries(res.data?.data || []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    fetchEntries();
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchId.trim() || !note.trim()) {
      toast.error("Vui lòng nhập mã lô và ghi chú");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("batchId", batchId);
      formData.append("note", note);
      formData.append("activityType", activityType);
      if (weatherCondition) formData.append("weatherCondition", weatherCondition);
      if (image) formData.append("image", image);

      await farmingApi.createEntry(formData);
      toast.success("Đã thêm nhật ký!");
      setBatchId("");
      setNote("");
      setActivityType("OTHER");
      setWeatherCondition("");
      setImage(null);
      setImagePreview(null);
      setShowForm(false);
      fetchEntries();
    } catch {
      toast.error("Lỗi khi tạo nhật ký");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xóa mục nhật ký này?")) return;
    try {
      await farmingApi.deleteEntry(id);
      toast.success("Đã xóa");
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch {
      toast.error("Lỗi khi xóa");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-green-600" />
          Nhật ký canh tác
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Thêm mới
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mã lô hàng *</label>
              <input
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                placeholder="VD: LO-VAITHIEU-2024-001"
                maxLength={50}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hoạt động</label>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {activityOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú *</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Mô tả hoạt động canh tác hôm nay..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Thời tiết</label>
              <input
                value={weatherCondition}
                onChange={(e) => setWeatherCondition(e.target.value)}
                placeholder="VD: Nắng, 32°C"
                maxLength={100}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ảnh</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-green-50 file:text-green-700 file:font-medium file:text-sm hover:file:bg-green-100"
              />
              {imagePreview && (
                <img src={imagePreview} alt="preview" className="mt-2 rounded-lg max-h-32 object-cover" />
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition text-sm font-medium"
            >
              {submitting ? "Đang lưu..." : "Lưu nhật ký"}
            </button>
          </div>
        </form>
      )}

      {/* Entries List */}
      {loading ? (
        <div className="text-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Chưa có nhật ký nào. Bắt đầu ghi nhận hoạt động canh tác!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div key={entry.id} className="bg-white rounded-xl border p-5 hover:shadow-sm transition">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                      {activityOptions.find((o) => o.value === entry.activityType)?.label || entry.activityType}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">{entry.batchId}</span>
                  </div>
                  <p className="text-gray-700 text-sm">{entry.note}</p>
                  <div className="flex gap-3 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(entry.createdAt).toLocaleDateString("vi-VN")}
                    </span>
                    {entry.weatherCondition && <span>🌤 {entry.weatherCondition}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {entry.imageUrl && (
                    <img src={entry.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover" />
                  )}
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="text-gray-400 hover:text-red-500 p-1 transition"
                    title="Xóa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
