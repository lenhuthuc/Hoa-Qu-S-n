"use client";
import { useEffect, useState } from "react";
import { returnApi, orderApi } from "@/lib/api";
import Link from "next/link";

interface ReturnRequest {
  id: number;
  orderId: number;
  buyerId: number;
  buyerName: string;
  sellerId: number;
  sellerName: string;
  reasonCode: string;
  description: string;
  evidenceUrls: string | null;
  refundAmount: number;
  status: string;
  sellerResponse: string | null;
  createdAt: string;
  updatedAt: string;
  deadline: string;
}

interface OrderSummary {
  orderId: number;
  status: string;
  totalPrice: number;
}

const REASON_CODES = [
  { value: "DAMAGED", label: "Hàng bị dập nát do vận chuyển" },
  { value: "WRONG_ITEM", label: "Không đúng mô tả" },
  { value: "MISSING_QUANTITY", label: "Giao thiếu số lượng" },
  { value: "SPOILED", label: "Hàng biến chất / hỏng" },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Đã gửi yêu cầu", color: "bg-yellow-100 text-yellow-700" },
  SELLER_REVIEWING: { label: "Nông hộ đang xem xét", color: "bg-blue-100 text-blue-700" },
  NEGOTIATING: { label: "Đang thương lượng", color: "bg-purple-100 text-purple-700" },
  APPROVED: { label: "Đã chấp nhận", color: "bg-green-100 text-green-700" },
  REJECTED: { label: "Bị từ chối", color: "bg-red-100 text-red-700" },
  REFUNDED: { label: "Đã hoàn tiền", color: "bg-green-200 text-green-800" },
};

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [form, setForm] = useState({
    orderId: 0,
    reasonCode: "",
    description: "",
    evidenceUrls: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadReturns();
  }, []);

  async function loadReturns() {
    try {
      const res = await returnApi.getMyRequests();
      setReturns(res.data);
    } catch {
      // endpoint may not exist yet
    } finally {
      setLoading(false);
    }
  }

  async function openCreateForm() {
    try {
      const res = await orderApi.getMyOrders();
      const eligible = (res.data as OrderSummary[]).filter(
        (o) => o.status === "FINISHED" || o.status === "SHIPPED"
      );
      setOrders(eligible);
      setShowForm(true);
    } catch {
      alert("Không thể tải danh sách đơn hàng");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.orderId || !form.reasonCode) {
      alert("Vui lòng chọn đơn hàng và lý do");
      return;
    }
    setSubmitting(true);
    try {
      await returnApi.create({
        orderId: form.orderId,
        reasonCode: form.reasonCode,
        description: form.description,
        evidenceUrls: form.evidenceUrls || undefined,
      });
      setShowForm(false);
      setForm({ orderId: 0, reasonCode: "", description: "", evidenceUrls: "" });
      loadReturns();
    } catch (err: any) {
      alert(err.response?.data?.message || "Không thể tạo yêu cầu hoàn trả");
    } finally {
      setSubmitting(false);
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
          <h1 className="text-2xl font-bold text-gray-800">Hoàn trả & Khiếu nại</h1>
          <div className="flex gap-3">
            <Link href="/orders" className="px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50">
              ← Đơn hàng
            </Link>
            <button
              onClick={openCreateForm}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              + Tạo yêu cầu hoàn trả
            </button>
          </div>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-bold mb-4">Tạo yêu cầu hoàn trả</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chọn đơn hàng</label>
                {orders.length === 0 ? (
                  <p className="text-sm text-gray-500">Không có đơn hàng nào đủ điều kiện hoàn trả (chỉ đơn đã giao)</p>
                ) : (
                  <select
                    value={form.orderId}
                    onChange={(e) => setForm({ ...form, orderId: parseInt(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value={0}>-- Chọn đơn hàng --</option>
                    {orders.map((o) => (
                      <option key={o.orderId} value={o.orderId}>
                        Đơn #{o.orderId} — {Number(o.totalPrice).toLocaleString("vi-VN")}₫
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lý do</label>
                <select
                  value={form.reasonCode}
                  onChange={(e) => setForm({ ...form, reasonCode: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">-- Chọn lý do --</option>
                  {REASON_CODES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả chi tiết</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Mô tả tình trạng hàng hóa..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link ảnh/video bằng chứng</label>
                <input
                  type="text"
                  value={form.evidenceUrls}
                  onChange={(e) => setForm({ ...form, evidenceUrls: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="URL ảnh hoặc video bằng chứng"
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting || orders.length === 0}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Returns list */}
        {returns.length === 0 && !showForm ? (
          <div className="bg-white rounded-lg p-8 text-center text-gray-500">
            <p className="mb-4">Bạn chưa có yêu cầu hoàn trả nào</p>
            <p className="text-sm">Nếu sản phẩm nhận được bị hư hỏng, bạn có thể tạo yêu cầu hoàn trả trong vòng 24h kể từ khi nhận hàng.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {returns.map((ret) => (
              <div key={ret.id} className="bg-white rounded-lg shadow p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-800">Phiếu #{ret.id}</span>
                    <Link
                      href={`/orders/${ret.orderId}`}
                      className="text-sm text-blue-500 hover:underline"
                    >
                      Đơn #{ret.orderId}
                    </Link>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_MAP[ret.status]?.color || "bg-gray-100"}`}>
                      {STATUS_MAP[ret.status]?.label || ret.status}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(ret.createdAt).toLocaleDateString("vi-VN")}
                  </span>
                </div>

                <div className="text-sm space-y-1 mb-3">
                  <div><span className="text-gray-500">Nông hộ:</span> {ret.sellerName}</div>
                  <div><span className="text-gray-500">Lý do:</span> {REASON_CODES.find(r => r.value === ret.reasonCode)?.label || ret.reasonCode}</div>
                  <div><span className="text-gray-500">Mô tả:</span> {ret.description}</div>
                  <div>
                    <span className="text-gray-500">Số tiền hoàn:</span>{" "}
                    <span className="font-medium text-red-600">{Number(ret.refundAmount).toLocaleString("vi-VN")}₫</span>
                  </div>
                </div>

                {ret.sellerResponse && (
                  <div className="bg-gray-50 rounded p-3 text-sm">
                    <span className="font-medium text-gray-700">Phản hồi từ nông hộ:</span>{" "}
                    {ret.sellerResponse}
                  </div>
                )}

                {ret.deadline && ret.status === "PENDING" && (
                  <div className="text-xs text-orange-500 mt-2">
                    ⏱ Thời hạn phản hồi: {new Date(ret.deadline).toLocaleString("vi-VN")}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
