"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Package, Loader2, Eye, ChevronRight, ShoppingBag, Trash2 } from "lucide-react";
import { orderApi } from "@/lib/api";
import toast from "react-hot-toast";

interface Order {
  id: number;
  totalAmount: number;
  status: string;
  paymentMethod?: string;
  createdAt: string;
  items?: Array<{ productName: string; quantity: number; price: number }>;
}

const statusMap: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Chờ xác nhận", color: "bg-amber-100 text-amber-700" },
  PROCESSING: { label: "Đang xử lý", color: "bg-blue-100 text-blue-700" },
  SHIPPING: { label: "Đang giao", color: "bg-purple-100 text-purple-700" },
  DELIVERED: { label: "Đã giao", color: "bg-green-100 text-green-700" },
  COMPLETED: { label: "Hoàn thành", color: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Đã hủy", color: "bg-red-100 text-red-700" },
};

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await orderApi.getMyOrders();
        setOrders(res.data?.data || []);
      } catch {
        toast.error("Vui lòng đăng nhập");
        router.push("/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);

  const handleDelete = async (id: number) => {
    if (!confirm("Bạn muốn hủy đơn hàng này?")) return;
    try {
      await orderApi.delete(id);
      setOrders((prev) => prev.filter((o) => o.id !== id));
      toast.success("Đã hủy đơn hàng");
    } catch {
      toast.error("Không thể hủy đơn hàng");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-6">
        <Package className="w-6 h-6 text-primary-600" />
        Đơn hàng của tôi
      </h1>

      {orders.length === 0 ? (
        <div className="text-center py-20">
          <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-4">Chưa có đơn hàng nào</p>
          <Link href="/search" className="text-primary-600 hover:underline font-medium">
            Khám phá sản phẩm
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const status = statusMap[order.status] || { label: order.status, color: "bg-gray-100 text-gray-700" };
            return (
              <div key={order.id} className="bg-white rounded-xl border hover:shadow-sm transition">
                <div className="p-5 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-sm text-gray-500">#{order.id}</span>
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-lg font-bold text-gray-800">{formatPrice(order.totalAmount || 0)}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString("vi-VN", {
                        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
                      }) : "—"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {(order.status === "PENDING" || order.status === "PROCESSING") && (
                      <button
                        onClick={() => handleDelete(order.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition"
                        title="Hủy đơn"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                    <Link
                      href={`/orders/${order.id}`}
                      className="flex items-center gap-1 px-4 py-2 text-sm bg-gray-50 hover:bg-primary-50 text-gray-700 hover:text-primary-700 rounded-lg transition font-medium"
                    >
                      <Eye className="w-4 h-4" /> Chi tiết <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
