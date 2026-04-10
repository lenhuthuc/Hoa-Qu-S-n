"use client";
import { useEffect, useState } from "react";
import { voucherApi } from "@/lib/api";
import Link from "next/link";

interface Voucher {
  id: number;
  code: string;
  description: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  usageLimit: number | null;
  usedCount: number;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
}

export default function SellerVouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: "",
    description: "",
    discountType: "PERCENTAGE" as "PERCENTAGE" | "FIXED_AMOUNT",
    discountValue: 0,
    minOrderAmount: "",
    maxDiscount: "",
    usageLimit: "",
    startDate: "",
    endDate: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadVouchers();
  }, []);

  async function loadVouchers() {
    try {
      const res = await voucherApi.getMyVouchers();
      setVouchers(res.data);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code || !form.discountValue) {
      alert("Vui lòng nhập mã voucher và giá trị giảm");
      return;
    }
    setSubmitting(true);
    try {
      await voucherApi.create({
        code: form.code,
        description: form.description,
        discountType: form.discountType,
        discountValue: form.discountValue,
        minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : undefined,
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      });
      setShowForm(false);
      setForm({ code: "", description: "", discountType: "PERCENTAGE", discountValue: 0, minOrderAmount: "", maxDiscount: "", usageLimit: "", startDate: "", endDate: "" });
      loadVouchers();
    } catch (err: any) {
      alert(err.response?.data?.message || "Không thể tạo voucher");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Xóa voucher này?")) return;
    try {
      await voucherApi.delete(id);
      setVouchers((prev) => prev.filter((v) => v.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.message || "Không thể xóa");
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
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Quản lý Voucher</h1>
          <div className="flex gap-3">
            <Link href="/seller/dashboard" className="px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50">
              ← Dashboard
            </Link>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              + Tạo voucher
            </button>
          </div>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-bold mb-4">Tạo voucher mới</h2>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mã voucher</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="VD: GIAM10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loại giảm giá</label>
                <select
                  value={form.discountType}
                  onChange={(e) => setForm({ ...form, discountType: e.target.value as any })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="PERCENTAGE">Phần trăm (%)</option>
                  <option value="FIXED_AMOUNT">Số tiền cố định (₫)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Giá trị giảm {form.discountType === "PERCENTAGE" ? "(%)" : "(₫)"}
                </label>
                <input
                  type="number"
                  value={form.discountValue}
                  onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Đơn tối thiểu (₫)</label>
                <input
                  type="number"
                  value={form.minOrderAmount}
                  onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Không bắt buộc"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Giảm tối đa (₫)</label>
                <input
                  type="number"
                  value={form.maxDiscount}
                  onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Chỉ áp dụng với %"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Giới hạn lượt dùng</label>
                <input
                  type="number"
                  value={form.usageLimit}
                  onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Không giới hạn"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu</label>
                <input
                  type="datetime-local"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày kết thúc</label>
                <input
                  type="datetime-local"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Mô tả ngắn về voucher"
                />
              </div>
              <div className="md:col-span-2 flex gap-3 justify-end">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-100 rounded-lg">
                  Hủy
                </button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {submitting ? "Đang tạo..." : "Tạo voucher"}
                </button>
              </div>
            </form>
          </div>
        )}

        {vouchers.length === 0 && !showForm ? (
          <div className="bg-white rounded-lg p-8 text-center text-gray-500">
            Bạn chưa tạo voucher nào
          </div>
        ) : (
          <div className="space-y-3">
            {vouchers.map((v) => (
              <div key={v.id} className={`bg-white rounded-lg shadow p-4 flex items-center gap-4 ${!v.isActive ? "opacity-60" : ""}`}>
                <div className="bg-green-50 border-2 border-dashed border-green-300 rounded-lg px-4 py-2 text-center min-w-[100px]">
                  <span className="text-lg font-bold text-green-700">{v.code}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">
                      {v.discountType === "PERCENTAGE"
                        ? `Giảm ${v.discountValue}%`
                        : `Giảm ${Number(v.discountValue).toLocaleString("vi-VN")}₫`}
                    </span>
                    {v.maxDiscount && (
                      <span className="text-xs text-gray-400">(tối đa {Number(v.maxDiscount).toLocaleString("vi-VN")}₫)</span>
                    )}
                    {!v.isActive && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">Hết hạn</span>}
                  </div>
                  {v.description && <p className="text-sm text-gray-500">{v.description}</p>}
                  <div className="text-xs text-gray-400 mt-1 flex gap-4">
                    {v.minOrderAmount && <span>Đơn tối thiểu: {Number(v.minOrderAmount).toLocaleString("vi-VN")}₫</span>}
                    <span>Đã dùng: {v.usedCount}{v.usageLimit ? `/${v.usageLimit}` : ""}</span>
                    {v.endDate && <span>HSD: {new Date(v.endDate).toLocaleDateString("vi-VN")}</span>}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(v.id)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Xóa
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
