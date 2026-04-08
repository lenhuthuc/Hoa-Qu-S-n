"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Package, Loader2, ChevronLeft, Leaf, CreditCard, Truck, FileText } from "lucide-react";
import { orderApi, invoiceApi, paymentApi } from "@/lib/api";
import toast from "react-hot-toast";

interface OrderDetail {
  id: number;
  totalAmount: number;
  status: string;
  paymentMethod?: string;
  createdAt: string;
  items?: Array<{
    productId: number;
    productName: string;
    quantity: number;
    price: number;
    imageUrl?: string;
  }>;
}

const statusMap: Record<string, { label: string; color: string; step: number }> = {
  PENDING: { label: "Chờ xác nhận", color: "text-amber-600", step: 1 },
  PROCESSING: { label: "Đang xử lý", color: "text-blue-600", step: 2 },
  SHIPPING: { label: "Đang giao", color: "text-purple-600", step: 3 },
  DELIVERED: { label: "Đã giao", color: "text-green-600", step: 4 },
  COMPLETED: { label: "Hoàn thành", color: "text-green-600", step: 5 },
  CANCELLED: { label: "Đã hủy", color: "text-red-600", step: 0 },
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = Number(params.id);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [payingVnPay, setPayingVnPay] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await orderApi.getById(orderId);
        setOrder(res.data?.data || res.data);
      } catch {
        toast.error("Không tìm thấy đơn hàng");
        router.push("/orders");
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId, router]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);

  const handleVnPay = async () => {
    if (!order) return;
    setPayingVnPay(true);
    try {
      const res = await paymentApi.createVnPayUrl(order.totalAmount, `Thanh toan don hang #${order.id}`, order.id);
      const url = res.data?.data?.paymentUrl || res.data?.paymentUrl;
      if (url) {
        window.location.href = url;
      } else {
        toast.error("Không thể tạo link thanh toán");
      }
    } catch {
      toast.error("Lỗi tạo thanh toán VNPay");
    } finally {
      setPayingVnPay(false);
    }
  };

  const handleCreateInvoice = async () => {
    if (!order) return;
    try {
      await invoiceApi.create(order.id);
      toast.success("Đã tạo hóa đơn!");
    } catch {
      toast.error("Lỗi tạo hóa đơn");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!order) return null;

  const status = statusMap[order.status] || { label: order.status, color: "text-gray-600", step: 0 };
  const steps = ["Đặt hàng", "Xác nhận", "Đang giao", "Đã giao", "Hoàn thành"];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button onClick={() => router.push("/orders")} className="flex items-center gap-1 text-gray-500 hover:text-primary-600 mb-6 text-sm">
        <ChevronLeft className="w-4 h-4" /> Quay lại đơn hàng
      </button>

      {/* Order Header */}
      <div className="bg-white rounded-2xl border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Package className="w-5 h-5 text-primary-600" />
              Đơn hàng #{order.id}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {order.createdAt && new Date(order.createdAt).toLocaleString("vi-VN")}
            </p>
          </div>
          <span className={`text-lg font-bold ${status.color}`}>{status.label}</span>
        </div>

        {/* Progress Steps */}
        {order.status !== "CANCELLED" && (
          <div className="flex items-center justify-between mt-6">
            {steps.map((label, i) => (
              <div key={label} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    i + 1 <= status.step ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-400"
                  }`}>
                    {i + 1}
                  </div>
                  <span className="text-xs text-gray-500 mt-1 text-center">{label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${i + 1 < status.step ? "bg-primary-400" : "bg-gray-200"}`} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order Items */}
      <div className="bg-white rounded-2xl border p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">Sản phẩm</h2>
        {order.items && order.items.length > 0 ? (
          <div className="space-y-3">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center gap-4 py-3 border-b last:border-0">
                <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                  ) : (
                    <Leaf className="w-6 h-6 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/product/${item.productId}`} className="font-medium text-gray-800 hover:text-primary-600 text-sm">
                    {item.productName}
                  </Link>
                  <p className="text-xs text-gray-400">x{item.quantity}</p>
                </div>
                <span className="font-bold text-gray-800 text-sm">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">Không có chi tiết sản phẩm</p>
        )}

        <hr className="my-4" />
        <div className="flex justify-between font-bold text-lg">
          <span>Tổng cộng</span>
          <span className="text-primary-600">{formatPrice(order.totalAmount || 0)}</span>
        </div>
      </div>

      {/* Actions */}
      {order.status === "PENDING" && (
        <div className="bg-white rounded-2xl border p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Thanh toán</h2>
          <div className="flex gap-3">
            <button
              onClick={handleVnPay}
              disabled={payingVnPay}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
            >
              {payingVnPay ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
              Thanh toán VNPay
            </button>
            <button
              onClick={handleCreateInvoice}
              className="py-3 px-6 border rounded-xl text-gray-700 hover:bg-gray-50 font-medium flex items-center gap-2"
            >
              <FileText className="w-5 h-5" /> Tạo hóa đơn
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
