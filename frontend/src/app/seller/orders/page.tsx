"use client";
import { useEffect, useState } from "react";
import { getReturnEvidenceMediaSrc, isVideoEvidenceUrl, parseEvidenceUrls, sellerApi, returnApi } from "@/lib/api";
import Link from "next/link";

interface SellerOrder {
  orderId: number;
  status: string;
  totalPrice: number;
  createdAt: string;
  buyerName: string;
  address: string;
  items: { productId: number; productName: string; quantity: number; price: number }[];
}

interface SellerReturn {
  id: number;
  orderId: number;
  buyerName: string;
  reasonCode: string;
  description: string;
  evidenceUrls?: string | null;
  refundAmount: number;
  status: string;
  createdAt: string;
  deadline: string;
  sellerResponse?: string | null;
}

const RETURN_STATUS_META: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  REJECTED: "bg-red-100 text-red-700",
  REJECTED_ACCEPTED: "bg-slate-100 text-slate-700",
  ESCALATED: "bg-amber-100 text-amber-800",
  REFUNDED: "bg-green-100 text-green-700",
};

const RETURN_STATUS_LABEL: Record<string, string> = {
  PENDING: "Đang chờ xử lý",
  REJECTED: "Đã từ chối",
  REJECTED_ACCEPTED: "Người mua đã chấp nhận từ chối",
  ESCALATED: "Đã khiếu nại lên admin",
  REFUNDED: "Đã hoàn tiền",
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Chờ xác nhận", color: "bg-yellow-100 text-yellow-700" },
  PENDING_PAYMENT: { label: "Chờ thanh toán", color: "bg-orange-100 text-orange-700" },
  PLACED: { label: "Đã đặt", color: "bg-blue-100 text-blue-700" },
  PAID: { label: "Đã thanh toán", color: "bg-green-100 text-green-700" },
  PREPARING: { label: "Đang chuẩn bị", color: "bg-orange-100 text-orange-700" },
  SHIPPED: { label: "Đang giao", color: "bg-purple-100 text-purple-700" },
  FINISHED: { label: "Hoàn thành", color: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Đã hủy", color: "bg-red-100 text-red-700" },
};

export default function SellerOrdersPage() {
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [returns, setReturns] = useState<SellerReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"orders" | "returns">("orders");
  const [filter, setFilter] = useState("ALL");
  const [rejectTarget, setRejectTarget] = useState<SellerReturn | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [respondingReturnId, setRespondingReturnId] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [ordRes, retRes] = await Promise.all([
        sellerApi.getOrders(),
        returnApi.getSellerRequests(),
      ]);
      setOrders(ordRes.data);
      setReturns(retRes.data);
    } catch {
      // Silently handle if returns endpoint not available
      try {
        const ordRes = await sellerApi.getOrders();
        setOrders(ordRes.data);
      } catch {
        alert("Không thể tải đơn hàng");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateStatus(orderId: number, newStatus: string) {
    const labels: Record<string, string> = {
      PREPARING: "Xác nhận đơn hàng",
      SHIPPED: "Xác nhận giao hàng",
      CANCELLED: "Hủy đơn",
    };
    if (!confirm(`${labels[newStatus] || newStatus} cho đơn #${orderId}?`)) return;
    try {
      await sellerApi.updateOrderStatus(orderId, newStatus);
      setOrders((prev) =>
        prev.map((o) => (o.orderId === orderId ? { ...o, status: newStatus } : o))
      );
    } catch (err: any) {
      alert(err.response?.data?.message || "Không thể cập nhật trạng thái");
    }
  }

  async function handleReturnRespond(returnId: number, action: "ACCEPT" | "REJECT", response?: string) {
    if (action === "REJECT" && !response?.trim()) {
      alert("Vui lòng nhập lý do từ chối");
      return;
    }

    setRespondingReturnId(returnId);

    try {
      await returnApi.respond(returnId, action, response?.trim() || undefined);
      setRejectTarget(null);
      setRejectNote("");
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Không thể phản hồi");
    } finally {
      setRespondingReturnId(null);
    }
  }

  const filteredOrders = filter === "ALL" ? orders : orders.filter((o) => o.status === filter);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Quản lý Đơn hàng</h1>
          <Link href="/seller/dashboard" className="px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50">
            ← Dashboard
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setTab("orders")}
            className={`px-4 py-2 rounded-lg font-medium ${tab === "orders" ? "bg-green-600 text-white" : "bg-white text-gray-600 border"}`}
          >
            Đơn hàng ({orders.length})
          </button>
          <button
            onClick={() => setTab("returns")}
            className={`px-4 py-2 rounded-lg font-medium ${tab === "returns" ? "bg-green-600 text-white" : "bg-white text-gray-600 border"}`}
          >
            Yêu cầu hoàn trả ({returns.length})
          </button>
        </div>

        {tab === "orders" && (
          <>
            {/* Filter */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {["ALL", "PLACED", "PAID", "PREPARING", "SHIPPED", "FINISHED", "CANCELLED"].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-3 py-1 rounded-full text-sm ${filter === s ? "bg-green-600 text-white" : "bg-white text-gray-600 border"}`}
                >
                  {s === "ALL" ? "Tất cả" : STATUS_MAP[s]?.label || s}
                </button>
              ))}
            </div>

            {filteredOrders.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                Không có đơn hàng nào
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => (
                  <div key={order.orderId} className="bg-white rounded-lg shadow p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-800">Đơn #{order.orderId}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_MAP[order.status]?.color || "bg-gray-100"}`}>
                          {STATUS_MAP[order.status]?.label || order.status}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString("vi-VN")}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                      <div>
                        <span className="text-gray-500">Khách hàng:</span>{" "}
                        <span className="font-medium">{order.buyerName}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Địa chỉ:</span>{" "}
                        <span>{order.address}</span>
                      </div>
                    </div>

                    <div className="border-t pt-3 mb-3">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm py-1">
                          <span>{item.productName} × {item.quantity}</span>
                          <span className="font-medium">{Number(item.price * item.quantity).toLocaleString("vi-VN")}₫</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold text-base pt-2 border-t mt-2">
                        <span>Tổng cộng</span>
                        <span className="text-green-600">{Number(order.totalPrice).toLocaleString("vi-VN")}₫</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 justify-end">
                      {(order.status === "PLACED" || order.status === "PAID") && (
                        <button
                          onClick={() => handleUpdateStatus(order.orderId, "PREPARING")}
                          className="px-3 py-1.5 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700"
                        >
                          Xác nhận đơn
                        </button>
                      )}
                      {order.status === "PREPARING" && (
                        <button
                          onClick={() => handleUpdateStatus(order.orderId, "SHIPPED")}
                          className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
                        >
                          Giao hàng
                        </button>
                      )}
                      {order.status === "SHIPPED" && (
                        <span className="px-3 py-1.5 bg-purple-50 text-purple-700 text-sm rounded-lg">
                          Chờ người mua xác nhận đã nhận hàng
                        </span>
                      )}
                      {(order.status === "PLACED" || order.status === "PREPARING") && (
                        <button
                          onClick={() => handleUpdateStatus(order.orderId, "CANCELLED")}
                          className="px-3 py-1.5 bg-red-100 text-red-600 text-sm rounded-lg hover:bg-red-200"
                        >
                          Hủy đơn
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "returns" && (
          <div className="space-y-4">
            {returns.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                Không có yêu cầu hoàn trả nào
              </div>
            ) : (
              returns.map((ret) => (
                <div key={ret.id} className="bg-white rounded-lg shadow p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-bold">Yêu cầu #{ret.id}</span>
                      <span className="text-sm text-gray-500">Đơn #{ret.orderId}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        RETURN_STATUS_META[ret.status] || "bg-blue-100 text-blue-700"
                      }`}>
                        {RETURN_STATUS_LABEL[ret.status] || ret.status}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(ret.createdAt).toLocaleDateString("vi-VN")}
                    </span>
                  </div>

                  <div className="text-sm mb-2">
                    <span className="text-gray-500">Người mua:</span> {ret.buyerName}
                  </div>
                  <div className="text-sm mb-2">
                    <span className="text-gray-500">Lý do:</span> {ret.reasonCode} — {ret.description}
                  </div>
                  {ret.sellerResponse && (
                    <div className="text-sm mb-2">
                      <span className="text-gray-500">Phản hồi của bạn:</span> {ret.sellerResponse}
                    </div>
                  )}
                  <div className="text-sm mb-3">
                    <span className="text-gray-500">Số tiền hoàn:</span>{" "}
                    <span className="font-medium text-red-600">
                      {Number(ret.refundAmount).toLocaleString("vi-VN")}₫
                    </span>
                  </div>

                  {ret.evidenceUrls && (
                    <div className="mb-3 rounded-lg bg-gray-50 p-3 text-sm">
                      <p className="mb-2 font-medium text-gray-700">Bằng chứng</p>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {parseEvidenceUrls(ret.evidenceUrls).map((url) => {
                          const mediaSrc = getReturnEvidenceMediaSrc(url);
                          const fileName = url.split("/").pop() || url;

                          return (
                            <div key={url} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                              <div className="h-40 bg-gray-100">
                                {isVideoEvidenceUrl(url) ? (
                                  <video src={mediaSrc} controls className="h-full w-full object-cover" />
                                ) : (
                                  <img src={mediaSrc} alt={fileName} className="h-full w-full object-cover" />
                                )}
                              </div>
                              <div className="px-3 py-2 text-xs text-gray-600">
                                <p className="truncate font-medium text-gray-700">{fileName}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {ret.status === "PENDING" && (
                    <div className="flex gap-2 justify-end border-t pt-3">
                      <button
                        onClick={() => handleReturnRespond(ret.id, "ACCEPT")}
                        disabled={respondingReturnId === ret.id}
                        className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700"
                      >
                        Chấp nhận hoàn tiền
                      </button>
                      <button
                        onClick={() => {
                          setRejectTarget(ret);
                          setRejectNote("");
                        }}
                        disabled={respondingReturnId === ret.id}
                        className="px-3 py-1.5 border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm rounded-lg hover:bg-emerald-100"
                      >
                        Từ chối
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {rejectTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="flex w-full max-w-xl flex-col rounded-3xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Từ chối hoàn tiền</p>
                  <h3 className="mt-2 text-xl font-bold text-gray-900">Nhập lý do từ chối</h3>
                </div>
                <button
                  onClick={() => {
                    if (respondingReturnId) return;
                    setRejectTarget(null);
                    setRejectNote("");
                  }}
                  className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100"
                >
                  ×
                </button>
              </div>

              <p className="mb-4 text-sm text-gray-600">
                Phiếu #{rejectTarget.id} - Đơn #{rejectTarget.orderId}. Buyer sẽ nhận được quyết định này để chấp nhận hoặc khiếu nại lên sàn.
              </p>

              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={5}
                placeholder="Nhập lý do từ chối..."
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />

              <div className="mt-5 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    if (respondingReturnId) return;
                    setRejectTarget(null);
                    setRejectNote("");
                  }}
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  onClick={() => handleReturnRespond(rejectTarget.id, "REJECT", rejectNote)}
                  disabled={respondingReturnId === rejectTarget.id}
                  className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {respondingReturnId === rejectTarget.id ? "Đang gửi..." : "Gửi từ chối"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
