"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Package, Loader2, ChevronLeft, Leaf, CreditCard, Truck, FileText, CheckCircle, XCircle, MapPin } from "lucide-react";
import { orderApi, userApi } from "@/lib/api";
import toast from "react-hot-toast";

interface OrderDetail {
  id: number;
  totalAmount: number;
  shippingFee?: number;
  status: string;
  paymentMethod?: string;
  address?: string;
  phone?: string;
  createdAt: string;
  viewerRole?: string;
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
  PLACED: { label: "Đã đặt hàng", color: "text-blue-600", step: 1 },
  PENDING_PAYMENT: { label: "Chờ thanh toán", color: "text-amber-600", step: 1 },
  PAID: { label: "Đã thanh toán", color: "text-green-600", step: 2 },
  PREPARING: { label: "Đang chuẩn bị", color: "text-orange-600", step: 3 },
  SHIPPED: { label: "Đang giao", color: "text-purple-600", step: 4 },
  FINISHED: { label: "Hoàn thành", color: "text-green-600", step: 5 },
  CANCELLED: { label: "Đã hủy", color: "text-red-600", step: 0 },
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = Number(params.id);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [payingVnPay, setPayingVnPay] = useState(false);
  const [profilePhone, setProfilePhone] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const [orderRes, profileRes] = await Promise.all([
          orderApi.getById(orderId),
          userApi.getProfile().catch(() => null),
        ]);

        setOrder(orderRes.data?.data || orderRes.data);

        const profile = profileRes?.data?.data || profileRes?.data;
        if (profile?.phone) {
          setProfilePhone(String(profile.phone));
        }
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
      const res = await orderApi.retryPayment(order.id);
      const payload = res.data?.data || res.data;
      const url = payload?.paymentUrl || payload;
      if (url && typeof url === "string") {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-green-700" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500">Không tìm thấy đơn hàng</p>
      </div>
    );
  }

  const stat = statusMap[order.status] || { label: "Không xác định", color: "text-gray-600", step: 0 };
  const createdDate = new Date(order.createdAt).toLocaleDateString("vi-VN");
  const addressLines = (order.address || "")
    .split(",")
    .map((line) => line.trim())
    .filter(Boolean);
  const deliveryPhone = (order.phone || profilePhone || "").trim();

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      {/* Header */}
      <div className="fixed top-0 w-full z-40 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4 flex items-center justify-between">
          <button onClick={() => router.push("/orders")} className="flex items-center gap-2 text-gray-600 hover:text-green-700 font-medium transition">
            <ChevronLeft className="w-5 h-5" /> Quay lại đơn hàng
          </button>
          <div className="hidden md:block text-center">
            <h1 className="text-lg font-bold text-gray-900">Chi tiết đơn hàng</h1>
          </div>
          <div className="w-20" />
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 pt-20">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Chi tiết đơn hàng</h1>
          <div className="flex items-center gap-4 text-gray-600">
            <span className="text-green-700 font-bold text-lg">#{order.id}</span>
            <span className="w-1 h-1 bg-gray-300 rounded-full" />
            <span>{createdDate}</span>
          </div>
        </div>

        {/* Progress Stepper */}
        <div className="bg-white rounded-2xl p-8 mb-8 border border-gray-100">
          <div className="relative flex justify-between items-start max-w-5xl mx-auto">
            {/* Progress Line */}
            <div className="absolute top-6 left-0 w-full h-1 bg-gray-200 -z-0">
              <div
                className="h-full bg-green-700 transition-all duration-700"
                style={{ width: `${(stat.step / 5) * 100}%` }}
              />
            </div>

            {/* Steps */}
            <div className="relative z-10 flex flex-col items-center gap-2 group">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition ${stat.step >= 1 ? "bg-green-700 text-white" : "bg-gray-200 text-gray-400"}`}>
                <CheckCircle className="w-6 h-6" />
              </div>
              <span className={`text-xs font-bold ${stat.step >= 1 ? "text-green-700" : "text-gray-500"}`}>Đặt hàng</span>
            </div>

            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition ${stat.step >= 2 ? "bg-green-700 text-white" : "bg-gray-200 text-gray-400"}`}>
                <CreditCard className="w-6 h-6" />
              </div>
              <span className={`text-xs font-bold ${stat.step >= 2 ? "text-green-700" : "text-gray-500"}`}>Xác nhận</span>
            </div>

            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition ${stat.step >= 3 ? "bg-green-700 text-white" : "bg-gray-200 text-gray-400"}`}>
                <Package className="w-6 h-6" />
              </div>
              <span className={`text-xs font-bold ${stat.step >= 3 ? "text-green-700" : "text-gray-500"}`}>Chuẩn bị hàng</span>
            </div>

            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition ${stat.step >= 4 ? "bg-green-700 text-white" : "bg-gray-200 text-gray-400"}`}>
                <Truck className="w-6 h-6" />
              </div>
              <span className={`text-xs font-bold ${stat.step >= 4 ? "text-green-700" : "text-gray-500"}`}>Đang giao</span>
            </div>

            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition ${stat.step >= 5 ? "bg-green-700 text-white" : "bg-gray-200 text-gray-400"}`}>
                <CheckCircle className="w-6 h-6" />
              </div>
              <span className={`text-xs font-bold ${stat.step >= 5 ? "text-green-700" : "text-gray-500"}`}>Hoàn thành</span>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Products & Address (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product List */}
            <div className="bg-white rounded-2xl p-8 border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Danh sách sản phẩm</h3>
              <div className="space-y-6">
                {(order.items || []).map((item, idx) => (
                  <div key={idx} className="flex items-center gap-6 pb-6 border-b border-gray-200 last:border-0 last:pb-0">
                    <Link href={`/product/${item.productId}`} className="flex-shrink-0">
                      <div className="w-24 h-24 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                        ) : (
                          <Leaf className="w-8 h-8 text-gray-300" />
                        )}
                      </div>
                    </Link>
                    <div className="flex-grow min-w-0">
                      <Link href={`/product/${item.productId}`} className="text-lg font-bold text-gray-900 hover:text-green-700 transition line-clamp-2">
                        {item.productName}
                      </Link>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-gray-500 text-sm">x{item.quantity}</p>
                      <p className="text-lg font-bold text-gray-900">{formatPrice(item.price * item.quantity)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Address */}
            <div className="bg-white rounded-2xl p-8 border border-gray-100">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6 text-green-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-3">Địa chỉ giao hàng</h3>
                  <p className="text-gray-600 leading-relaxed text-sm">
                    {addressLines.length > 0 ? (
                      addressLines.map((line, index) => (
                        <span key={`${line}-${index}`}>
                          {line}
                          <br />
                        </span>
                      ))
                    ) : (
                      <>
                        Chưa có thông tin địa chỉ giao hàng
                        <br />
                      </>
                    )}
                    {deliveryPhone ? `Điện thoại: ${deliveryPhone}` : ""}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Order Summary (1 col, sticky) */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-8 sticky top-28 border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Tổng kết đơn hàng</h3>

              {/* Pricing Breakdown */}
              <div className="space-y-4 mb-6 pb-6 border-b border-gray-200">
                <div className="flex justify-between text-gray-600">
                  <span>Tạm tính</span>
                  <span className="font-medium text-gray-900">{formatPrice((order.totalAmount || 0) - (order.shippingFee || 0))}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Phí vận chuyển</span>
                  <span className="font-medium text-gray-900">{formatPrice(order.shippingFee || 0)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Giảm giá</span>
                  <span className="font-medium text-red-600">-0 VNĐ</span>
                </div>

                <div className="flex justify-between items-end pt-4">
                  <span className="font-bold text-gray-900">Tổng cộng</span>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-700 tracking-tight">{formatPrice(order.totalAmount || 0)}</p>
                    <p className="text-xs text-gray-500 uppercase font-bold mt-1">Đã bao gồm VAT</p>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="w-5 h-5 text-green-700" />
                  <span className="font-bold text-gray-900">Thanh toán</span>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl flex items-center justify-between border border-gray-200">
                  <span className="text-sm font-medium text-gray-700">
                    {String(order.paymentMethod) === "2" ? "VNPay" : "Tiền mặt khi nhận hàng (COD)"}
                  </span>
                  <CheckCircle className="w-5 h-5 text-green-700" />
                </div>
              </div>

              {/* Action Buttons */}
              {order.status === "PENDING_PAYMENT" && String(order.paymentMethod) === "2" && (
                <button
                  onClick={handleVnPay}
                  disabled={payingVnPay}
                  className="w-full py-3 bg-green-700 text-white font-bold rounded-xl hover:bg-green-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {payingVnPay ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      Thanh toán VNPay
                    </>
                  )}
                </button>
              )}

              <Link
                href="/search"
                className="block w-full text-center py-3 text-green-700 font-medium hover:bg-green-50 rounded-xl transition mt-2"
              >
                Tiếp tục mua sắm
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
