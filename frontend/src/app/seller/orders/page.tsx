"use client";
import { useEffect, useState } from "react";
import { sellerApi, returnApi } from "@/lib/api";
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
  refundAmount: number;
  status: string;
  createdAt: string;
  deadline: string;
}

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
      FINISHED: "Xác nhận hoàn thành",
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

  async function handleReturnRespond(returnId: number, action: string) {
    const labels: Record<string, string> = {
      ACCEPT: "Chấp nhận hoàn tiền",
      REJECT: "Từ chối yêu cầu",
      NEGOTIATE: "Thương lượng",
    };
    const response = action === "REJECT" || action === "NEGOTIATE"
      ? prompt("Nhập lý do phản hồi:")
      : null;
    if (action !== "ACCEPT" && !response) return;

    try {
      await returnApi.respond(returnId, action, response || undefined);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Không thể phản hồi");
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
                          ✅ Xác nhận đơn
                        </button>
                      )}
                      {order.status === "PREPARING" && (
                        <button
                          onClick={() => handleUpdateStatus(order.orderId, "SHIPPED")}
                          className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
                        >
                          📦 Giao hàng
                        </button>
                      )}
                      {order.status === "SHIPPED" && (
                        <button
                          onClick={() => handleUpdateStatus(order.orderId, "FINISHED")}
                          className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                        >
                          ✅ Hoàn thành
                        </button>
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
                        ret.status === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                        ret.status === "REFUNDED" ? "bg-green-100 text-green-700" :
                        ret.status === "REJECTED" ? "bg-red-100 text-red-700" :
                        "bg-blue-100 text-blue-700"
                      }`}>
                        {ret.status}
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
                  <div className="text-sm mb-3">
                    <span className="text-gray-500">Số tiền hoàn:</span>{" "}
                    <span className="font-medium text-red-600">
                      {Number(ret.refundAmount).toLocaleString("vi-VN")}₫
                    </span>
                  </div>

                  {(ret.status === "PENDING" || ret.status === "NEGOTIATING") && (
                    <div className="flex gap-2 justify-end border-t pt-3">
                      <button
                        onClick={() => handleReturnRespond(ret.id, "ACCEPT")}
                        className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                      >
                        Chấp nhận hoàn tiền
                      </button>
                      <button
                        onClick={() => handleReturnRespond(ret.id, "NEGOTIATE")}
                        className="px-3 py-1.5 bg-blue-100 text-blue-600 text-sm rounded-lg hover:bg-blue-200"
                      >
                        Thương lượng
                      </button>
                      <button
                        onClick={() => handleReturnRespond(ret.id, "REJECT")}
                        className="px-3 py-1.5 bg-red-100 text-red-600 text-sm rounded-lg hover:bg-red-200"
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
      </div>
    </div>
  );
}
