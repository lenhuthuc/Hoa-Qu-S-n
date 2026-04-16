"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Package, Loader2, ChevronLeft, Leaf, CreditCard, Truck, CheckCircle, MapPin, Star, X, ImageIcon, Film, Trash2 } from "lucide-react";
import { orderApi, reviewApi, sellerApi, userApi } from "@/lib/api";
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

type ReviewTarget = {
  productId: number;
  productName: string;
};

type SelectedReviewFile = {
  file: File;
  previewUrl: string;
};

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
  const [confirmingReceived, setConfirmingReceived] = useState(false);
  const [updatingSellerStatus, setUpdatingSellerStatus] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewedProductIds, setReviewedProductIds] = useState<number[]>([]);
  const [profilePhone, setProfilePhone] = useState<string>("");
  const [reviewImages, setReviewImages] = useState<SelectedReviewFile[]>([]);
  const [reviewVideo, setReviewVideo] = useState<SelectedReviewFile | null>(null);

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

  const handleConfirmReceived = async () => {
    if (!order || order.status !== "SHIPPED") return;
    if (!confirm("Xác nhận bạn đã nhận được đơn hàng này?")) return;

    setConfirmingReceived(true);
    try {
      await orderApi.updateStatus(order.id, "FINISHED");
      setOrder((prev) => (prev ? { ...prev, status: "FINISHED" } : prev));
      toast.success("Đã xác nhận nhận hàng");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Không thể xác nhận nhận hàng");
    } finally {
      setConfirmingReceived(false);
    }
  };

  const handleSellerUpdateStatus = async (newStatus: "PREPARING" | "SHIPPED") => {
    if (!order || order.viewerRole !== "SELLER") return;

    const label = newStatus === "PREPARING" ? "Xác nhận đơn" : "Giao hàng";
    if (!confirm(`${label} cho đơn #${order.id}?`)) return;

    setUpdatingSellerStatus(true);
    try {
      await sellerApi.updateOrderStatus(order.id, newStatus);
      setOrder((prev) => (prev ? { ...prev, status: newStatus } : prev));
      toast.success(label + " thành công");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Không thể cập nhật trạng thái");
    } finally {
      setUpdatingSellerStatus(false);
    }
  };

  const openReviewModal = (productId: number, productName: string) => {
    setReviewTarget({ productId, productName });
    setReviewRating(5);
    setReviewComment("");
    setReviewImages([]);
    setReviewVideo(null);
  };

  const closeReviewModal = () => {
    if (submittingReview) return;
    reviewImages.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    if (reviewVideo?.previewUrl) {
      URL.revokeObjectURL(reviewVideo.previewUrl);
    }
    setReviewTarget(null);
    setReviewRating(5);
    setReviewComment("");
    setReviewImages([]);
    setReviewVideo(null);
  };

  const handleReviewImagesChange = (files: FileList | null) => {
    if (!files) return;
    const nextFiles = Array.from(files).slice(0, Math.max(0, 2 - reviewImages.length));
    const mapped = nextFiles
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    setReviewImages((prev) => [...prev, ...mapped].slice(0, 2));
  };

  const handleReviewVideoChange = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("Chỉ được tải lên 1 video hợp lệ");
      return;
    }
    if (reviewVideo?.previewUrl) {
      URL.revokeObjectURL(reviewVideo.previewUrl);
    }
    setReviewVideo({ file, previewUrl: URL.createObjectURL(file) });
  };

  const removeReviewImage = (index: number) => {
    setReviewImages((prev) => {
      const next = [...prev];
      const removed = next.splice(index, 1)[0];
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  };

  const removeReviewVideo = () => {
    setReviewVideo((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  };

  const handleSubmitReview = async () => {
    if (!reviewTarget) return;
    if (!reviewRating || reviewRating < 1 || reviewRating > 5) {
      toast.error("Vui lòng chọn số sao đánh giá");
      return;
    }
    if (!reviewComment.trim()) {
      toast.error("Vui lòng nhập nhận xét sản phẩm");
      return;
    }

    setSubmittingReview(true);
    try {
      const formData = new FormData();
      formData.append("rating", String(reviewRating));
      formData.append("comment", reviewComment.trim());
      reviewImages.forEach(({ file }) => formData.append("images", file));
      if (reviewVideo) {
        formData.append("video", reviewVideo.file);
      }

      await reviewApi.createWithMedia(reviewTarget.productId, formData);
      setReviewedProductIds((prev) => (prev.includes(reviewTarget.productId) ? prev : [...prev, reviewTarget.productId]));
      toast.success(`Đã gửi đánh giá cho ${reviewTarget.productName}`);
      closeReviewModal();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Không thể gửi đánh giá");
    } finally {
      setSubmittingReview(false);
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
                      {order.status === "FINISHED" && order.viewerRole !== "SELLER" && (
                        reviewedProductIds.includes(item.productId) ? (
                          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                            <Star className="w-3.5 h-3.5 fill-current" />
                            Đã đánh giá
                          </div>
                        ) : (
                          <button
                            onClick={() => openReviewModal(item.productId, item.productName)}
                            className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                          >
                            <Star className="w-3.5 h-3.5" />
                            Đánh giá sản phẩm
                          </button>
                        )
                      )}
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

              {order.status === "SHIPPED" && order.viewerRole !== "SELLER" && (
                <button
                  onClick={handleConfirmReceived}
                  disabled={confirmingReceived}
                  className="w-full py-3 bg-green-700 text-white font-bold rounded-xl hover:bg-green-800 transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                >
                  {confirmingReceived ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang xác nhận...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Đã nhận hàng
                    </>
                  )}
                </button>
              )}

              {order.viewerRole === "SELLER" && (order.status === "PLACED" || order.status === "PAID") && (
                <button
                  onClick={() => handleSellerUpdateStatus("PREPARING")}
                  disabled={updatingSellerStatus}
                  className="w-full py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                >
                  {updatingSellerStatus ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    "Xác nhận đơn"
                  )}
                </button>
              )}

              {order.viewerRole === "SELLER" && order.status === "PREPARING" && (
                <button
                  onClick={() => handleSellerUpdateStatus("SHIPPED")}
                  disabled={updatingSellerStatus}
                  className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                >
                  {updatingSellerStatus ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    "Giao hàng"
                  )}
                </button>
              )}

              {order.viewerRole === "SELLER" && order.status === "SHIPPED" && (
                <div className="w-full py-3 px-4 bg-purple-50 text-purple-700 font-medium rounded-xl mt-2 text-center">
                  Chờ người mua xác nhận đã nhận hàng
                </div>
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

      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Đánh giá sản phẩm</p>
                <h2 className="mt-2 text-xl font-bold text-gray-900">{reviewTarget.productName}</h2>
              </div>
              <button
                onClick={closeReviewModal}
                disabled={submittingReview}
                className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-5">
              <p className="mb-3 text-sm font-medium text-gray-700">Mức độ hài lòng</p>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((value) => {
                  const active = value <= reviewRating;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setReviewRating(value)}
                      className="transition hover:scale-105"
                      aria-label={`Đánh giá ${value} sao`}
                    >
                      <Star className={`w-8 h-8 ${active ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
                    </button>
                  );
                })}
                <span className="ml-2 text-sm font-semibold text-gray-600">{reviewRating}/5</span>
              </div>
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-gray-700">Nhận xét</label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={5}
                placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm..."
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div className="mb-6 space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-sm font-medium text-gray-700">Ảnh đính kèm</label>
                  <span className="text-xs text-gray-500">Tối đa 2 ảnh</span>
                </div>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700">
                  <ImageIcon className="w-4 h-4" />
                  Chọn ảnh
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleReviewImagesChange(e.target.files)}
                    className="hidden"
                  />
                </label>
                {reviewImages.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {reviewImages.map((item, index) => (
                      <div key={`${item.previewUrl}-${index}`} className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                        <img src={item.previewUrl} alt={`Ảnh đánh giá ${index + 1}`} className="h-32 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeReviewImage(index)}
                          className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white transition hover:bg-black/75"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-sm font-medium text-gray-700">Video đính kèm</label>
                  <span className="text-xs text-gray-500">Tối đa 1 video</span>
                </div>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700">
                  <Film className="w-4 h-4" />
                  Chọn video
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => handleReviewVideoChange(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
                {reviewVideo && (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                    <video src={reviewVideo.previewUrl} controls className="h-56 w-full object-cover" />
                    <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-gray-600">
                      <span className="truncate">{reviewVideo.file.name}</span>
                      <button type="button" onClick={removeReviewVideo} className="font-semibold text-emerald-700">
                        Xóa video
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={closeReviewModal}
                disabled={submittingReview}
                className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed"
              >
                Hủy
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={submittingReview}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-lime-600 px-5 py-3 text-sm font-semibold text-white transition hover:from-emerald-700 hover:to-lime-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submittingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
                Gửi đánh giá
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
