"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Leaf, ShoppingCart, Star, Truck, QrCode, Loader2, Minus, Plus,
  MessageCircle, ChevronLeft, Shield, User, Store,
} from "lucide-react";
import { productApi, cartApi, reviewApi, shippingApi, interactionApi, userApi } from "@/lib/api";
import toast from "react-hot-toast";

interface Product {
  id: number;
  productName: string;
  price: number;
  quantity: number;
  unitWeightGrams?: number;
  totalStockWeightKg?: number;
  categoryName?: string;
  description: string;
  imageUrl?: string;
  imageUrls?: string[];
  batchId?: string;
  sellerId?: number;
  sellerName?: string;
}

interface Review {
  id: number;
  userId: number;
  reviewerName?: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = Number(params.id);

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [shippingInfo, setShippingInfo] = useState<string | null>(null);

  // Review form
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [prodRes, reviewRes] = await Promise.allSettled([
          productApi.getById(productId),
          reviewApi.getByProduct(productId),
        ]);
        if (prodRes.status === "fulfilled") {
          setProduct(prodRes.value.data?.data || prodRes.value.data);
        }
        if (reviewRes.status === "fulfilled") {
          setReviews(reviewRes.value.data?.data || reviewRes.value.data || []);
        }
        // Record interaction
        try { await interactionApi.record(productId); } catch {}
        // Check shipping
        try {
          let districtId: string | undefined;
          let wardCode: string | undefined;
          try {
            const profileRes = await userApi.getProfile();
            const profile = profileRes.data?.data || profileRes.data;
            const address = profile?.address;
            if (address?.ghnDistrictId) {
              districtId = String(address.ghnDistrictId);
            }
            if (address?.ghnWardCode) {
              wardCode = String(address.ghnWardCode);
            }
          } catch {}

          const shipRes = await shippingApi.validate(productId, districtId, wardCode);
          setShippingInfo(shipRes.data?.data || shipRes.data || null);
        } catch {}
      } catch {
        toast.error("Không tìm thấy sản phẩm");
      } finally {
        setLoading(false);
      }
    })();
  }, [productId]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);

  const formatWeight = (grams: number) => {
    if (grams >= 1000) {
      return `${(grams / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} kg`;
    }
    return `${grams.toLocaleString("vi-VN")} g`;
  };

  const handleAddToCart = async () => {
    if (!localStorage.getItem("hqs_token")) {
      toast.error("Vui lòng đăng nhập");
      router.push("/login");
      return;
    }
    setAddingToCart(true);
    try {
      await cartApi.addItem({ productId, quantity: qty });
      toast.success("Đã thêm vào giỏ hàng!");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Lỗi thêm giỏ hàng");
    } finally {
      setAddingToCart(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return toast.error("Vui lòng nhập đánh giá");
    if (!localStorage.getItem("hqs_token")) {
      toast.error("Vui lòng đăng nhập để đánh giá");
      return;
    }
    setSubmittingReview(true);
    try {
      await reviewApi.create(productId, { rating, comment });
      toast.success("Cảm ơn đánh giá của bạn!");
      setComment("");
      setRating(5);
      const res = await reviewApi.getByProduct(productId);
      setReviews(res.data?.data || res.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Lỗi gửi đánh giá");
    } finally {
      setSubmittingReview(false);
    }
  };

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <Leaf className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 text-lg">Không tìm thấy sản phẩm</p>
        <Link href="/search" className="text-primary-600 hover:underline mt-2 inline-block">Tìm kiếm sản phẩm khác</Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-gray-500 hover:text-primary-600 mb-6 text-sm">
        <ChevronLeft className="w-4 h-4" /> Quay lại
      </button>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {/* Image */}
        <div className="bg-gray-100 rounded-2xl overflow-hidden aspect-square flex items-center justify-center">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.productName} className="w-full h-full object-cover" />
          ) : (
            <Leaf className="w-24 h-24 text-gray-300" />
          )}
        </div>

        {/* Info */}
        <div>
          <div className="mb-2">
            {product.categoryName && (
              <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                {product.categoryName}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.productName}</h1>

          {avgRating && (
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={`w-4 h-4 ${s <= Math.round(Number(avgRating)) ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`} />
                ))}
              </div>
              <span className="text-sm text-gray-500">{avgRating} ({reviews.length} đánh giá)</span>
            </div>
          )}

          <p className="text-3xl font-bold text-primary-600 mb-4">{formatPrice(product.price)}</p>
          <p className="text-gray-600 mb-6 leading-relaxed">{product.description}</p>

          {product.sellerName && (
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded-lg">
              <Store className="w-4 h-4 text-primary-600" />
              Người bán: <strong className="text-gray-800">{product.sellerName}</strong>
            </div>
          )}

          <div className="flex items-center gap-3 text-sm text-gray-500 mb-6">
            <span>Kho: <strong className="text-gray-700">{product.quantity}</strong></span>
            {typeof product.unitWeightGrams === "number" && product.unitWeightGrams > 0 && (
              <span>
                Trọng lượng/SP: <strong className="text-gray-700">{formatWeight(product.unitWeightGrams)}</strong>
              </span>
            )}
            {typeof product.totalStockWeightKg === "number" && product.totalStockWeightKg > 0 && (
              <span>
                Tổng hàng còn: <strong className="text-gray-700">{product.totalStockWeightKg.toLocaleString("vi-VN", { maximumFractionDigits: 3 })} kg</strong>
              </span>
            )}
            {product.batchId && (
              <Link href={`/trace/${product.batchId}`} className="flex items-center gap-1 text-primary-600 hover:underline">
                <QrCode className="w-4 h-4" /> Truy xuất nguồn gốc
              </Link>
            )}
          </div>

          {/* Enhanced Shipping Info */}
          <div className="bg-gray-50 p-4 rounded-xl mb-6 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3">
              <Truck className="w-4 h-4 text-primary-600" /> Thông tin vận chuyển
            </h3>
            
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Loader2 className="w-3 h-3 animate-spin" /> Đang tính toán khoảng cách...
              </div>
            ) : (
              <div className="space-y-3">
                {/* Available Methods */}
                {(shippingInfo as any)?.availableMethods?.map((method: any) => (
                  <div key={method.serviceName} className="flex items-start gap-2 text-sm bg-white p-2.5 rounded-lg border border-green-100">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                    <div>
                      <p className="font-medium text-gray-800">{method.serviceName}</p>
                      <p className="text-xs text-gray-500">Dự kiến: {method.estimatedDays} ngày • Phí: {formatPrice(method.fee)}</p>
                    </div>
                  </div>
                ))}

                {/* Disabled Methods */}
                {(shippingInfo as any)?.disabledMethods?.map((method: any) => (
                  <div key={method.serviceName} className="flex items-start gap-2 text-sm bg-gray-100 p-2.5 rounded-lg border border-gray-200 opacity-60">
                    <div className="w-2 h-2 rounded-full bg-gray-400 mt-1.5 shrink-0" />
                    <div>
                      <p className="font-medium text-gray-700">{method.serviceName} (Không hỗ trợ)</p>
                      <p className="text-xs text-red-500 font-medium">{method.reason}</p>
                    </div>
                  </div>
                ))}

                {!(shippingInfo as any)?.availableMethods?.length && !(shippingInfo as any)?.disabledMethods?.length && (
                  <p className="text-xs text-gray-400">Đang cập nhật tùy chọn vận chuyển...</p>
                )}
              </div>
            )}
          </div>

          {/* Quantity & Add to Cart */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center border rounded-xl overflow-hidden">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="px-3 py-3 hover:bg-gray-50 transition"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="px-4 py-3 font-medium min-w-[48px] text-center">{qty}</span>
              <button
                onClick={() => setQty(Math.min(product.quantity, qty + 1))}
                className="px-3 py-3 hover:bg-gray-50 transition"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 flex gap-2 flex-wrap">
              <button
                onClick={handleAddToCart}
                disabled={addingToCart || product.quantity === 0}
                className="flex-1 py-3 border-2 border-primary-600 text-primary-600 rounded-xl hover:bg-primary-50 disabled:opacity-50 font-medium flex items-center justify-center gap-2 transition"
              >
                {addingToCart ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingCart className="w-5 h-5" />}
                Thêm vào giỏ
              </button>
              <button
                onClick={async () => {
                  if (!localStorage.getItem("hqs_token")) {
                    toast.error("Vui lòng đăng nhập");
                    router.push("/login");
                    return;
                  }
                  setAddingToCart(true);
                  try {
                    await cartApi.addItem({ productId, quantity: qty });
                    router.push("/cart");
                  } catch (err: any) {
                    toast.error(err.response?.data?.message || "Lỗi thêm giỏ hàng");
                    setAddingToCart(false);
                  }
                }}
                disabled={addingToCart || product.quantity === 0}
                className="flex-1 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2 transition"
              >
                Mua ngay
              </button>
              {product.sellerId ? (
                <Link
                  href={`/messages?sellerId=${product.sellerId}`}
                  className="basis-full py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition text-sm font-medium flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4 text-primary-600" />
                  Chat người bán
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => toast.error("Sản phẩm này chưa có thông tin người bán")}
                  className="basis-full py-3 border border-gray-200 rounded-xl text-gray-400 bg-gray-50 text-sm font-medium flex items-center justify-center gap-2 cursor-not-allowed"
                >
                  <MessageCircle className="w-4 h-4" />
                  Chat người bán
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Shield className="w-4 h-4" />
            Đảm bảo chất lượng & hoàn tiền nếu không đúng mô tả
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="border-t pt-8">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-6">
          <MessageCircle className="w-5 h-5 text-primary-600" />
          Đánh giá sản phẩm ({reviews.length})
        </h2>

        {/* Review Form */}
        <form onSubmit={handleSubmitReview} className="bg-gray-50 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm text-gray-600">Đánh giá:</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRating(s)}
                  className="focus:outline-none"
                >
                  <Star className={`w-5 h-5 transition ${s <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`} />
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm này..."
            rows={3}
            maxLength={500}
            className="w-full border rounded-lg px-3 py-2 text-sm mb-3 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
          />
          <button
            type="submit"
            disabled={submittingReview}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium"
          >
            {submittingReview ? "Đang gửi..." : "Gửi đánh giá"}
          </button>
        </form>

        {/* Reviews List */}
        {reviews.length === 0 ? (
          <p className="text-center text-gray-400 py-8">Chưa có đánh giá nào. Hãy là người đầu tiên!</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="bg-white rounded-xl border p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-gray-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">{r.reviewerName || `Khách hàng #${r.userId}`}</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`w-3 h-3 ${s <= r.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`} />
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(r.createdAt).toLocaleDateString("vi-VN")}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{r.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
