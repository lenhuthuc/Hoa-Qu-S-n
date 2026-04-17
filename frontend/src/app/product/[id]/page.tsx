"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Leaf, ShoppingCart, Star, Truck, QrCode, Loader2, Minus, Plus,
  MessageCircle, ChevronLeft, Shield, User, Store, ArrowUpRight, Package, MapPinned,
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
  shopName?: string;
}

interface Review {
  id: number;
  userId: number;
  reviewerName?: string;
  rating: number;
  comment: string;
  createdAt: string;
  mediaUrls?: string[];
}

interface ShippingMethod {
  serviceName: string;
  estimatedDays?: number;
  fee?: number;
}

interface ShippingInfo {
  availableMethods?: ShippingMethod[];
  disabledMethods?: Array<{ serviceName: string; reason: string }>;
}

function RatingStars({ value, sizeClass = "w-4 h-4" }: { value: number; sizeClass?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClass} ${star <= value ? "text-amber-400 fill-amber-400" : "text-gray-300"}`}
        />
      ))}
    </div>
  );
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
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo | null>(null);
  const [displayUnit, setDisplayUnit] = useState<"g" | "kg">("kg");

  useEffect(() => {
    (async () => {
      try {
        const [prodRes, reviewRes] = await Promise.allSettled([
          productApi.getById(productId),
          reviewApi.getByProduct(productId),
        ]);
        if (prodRes.status === "fulfilled") {
          const prod = prodRes.value.data?.data || prodRes.value.data;
          setProduct(prod);
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

  const formatMassByUnit = (grams: number, unit: "g" | "kg", maxFractionDigits = 2) => {
    if (unit === "kg") {
      return `${(grams / 1000).toLocaleString("vi-VN", { maximumFractionDigits: maxFractionDigits })} kg`;
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

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;
  const ratingSummary = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((review) => review.rating === star).length,
  }));
  const totalReviewCount = reviews.length;
  const shippingMethod = shippingInfo?.availableMethods?.[0];
  const estimatedShippingDays = shippingMethod?.estimatedDays;
  const sellerRoute = product?.sellerId ? `/shop/${product.sellerId}` : "/search";
  const displayShopName = product?.shopName || product?.sellerName || "Người bán";
  const sellerInitials = displayShopName
    ? displayShopName.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")
    : "NB";
  const isVideoUrl = (url: string) => /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
  const toReviewMediaSrc = (url: string) => `/api/reviews/media?url=${encodeURIComponent(url)}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gradient-to-br from-emerald-50 to-white">
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50">
      <div className="max-w-7xl mx-auto px-4 py-8 lg:py-10">
        <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-emerald-700">
          <ChevronLeft className="w-4 h-4" /> Quay lại
        </button>

        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-gray-500">
          {product.categoryName && (
            <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">{product.categoryName}</span>
          )}
          <span className="rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-emerald-100">#{product.id}</span>
          {avgRating && (
            <span className="rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-emerald-100">
              ⭐ {avgRating} ({totalReviewCount} đánh giá)
            </span>
          )}
        </div>

        {/* Top Section */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="sticky top-24">
              <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-emerald-100">
                <div className="aspect-[4/5] bg-gray-50 p-4 sm:aspect-square sm:p-6 flex items-center justify-center overflow-hidden">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.productName}
                      className="h-full w-full rounded-2xl object-cover"
                      style={{ maxHeight: "85vh", imageRendering: "crisp-edges" }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-300">
                      <Leaf className="w-24 h-24" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-5">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-emerald-100">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
                <Store className="w-4 h-4" /> Sản phẩm
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">{product.productName}</h1>
              <p className="mt-4 text-3xl font-bold text-emerald-700">{formatPrice(product.price)}</p>

              <div className="mt-5 flex items-center justify-end gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700/70">Đơn vị</span>
                <select
                  value={displayUnit}
                  onChange={(e) => setDisplayUnit(e.target.value as "g" | "kg")}
                  className="h-9 rounded-xl border border-emerald-200 bg-white px-3 text-sm font-semibold text-emerald-700 outline-none transition focus:ring-2 focus:ring-emerald-300"
                >
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                </select>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-center text-sm">
                <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700/70">Trọng lượng</p>
                  <p className="mt-2 text-lg font-bold text-gray-900">
                    {typeof product.unitWeightGrams === "number" && product.unitWeightGrams > 0
                      ? formatMassByUnit(product.unitWeightGrams, displayUnit, displayUnit === "kg" ? 3 : 0)
                      : "-"}
                  </p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700/70">Tồn kho</p>
                  <p className="mt-2 text-lg font-bold text-gray-900">
                    {typeof product.totalStockWeightKg === "number" && product.totalStockWeightKg > 0
                      ? formatMassByUnit(product.totalStockWeightKg * 1000, displayUnit, displayUnit === "kg" ? 3 : 0)
                      : "-"}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <Truck className="w-4 h-4" /> Vận chuyển
                </div>
                <p className="text-sm text-gray-700">
                  Dự kiến giao trong <strong className="text-gray-900">{estimatedShippingDays ?? "-"}</strong> ngày
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2.5">
                <div className="flex h-11 items-center rounded-xl border border-gray-200 bg-white px-2.5">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-1.5 text-gray-600 transition hover:text-emerald-700">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="min-w-[34px] text-center text-sm font-semibold text-gray-900">{qty}</span>
                  <button onClick={() => setQty(Math.min(product.quantity, qty + 1))} className="p-1.5 text-gray-600 transition hover:text-emerald-700">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={handleAddToCart}
                  disabled={addingToCart || product.quantity === 0}
                  className="h-11 min-w-[132px] flex-1 rounded-xl border-2 border-emerald-600 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {addingToCart ? <Loader2 className="inline-block w-4 h-4 animate-spin" /> : <ShoppingCart className="inline-block w-4 h-4" />}
                  <span className="ml-2">Thêm vào giỏ</span>
                </button>

                <button
                  onClick={async () => {
                    if (!localStorage.getItem("hqs_token")) {
                      toast.error("Vui lòng đăng nhập");
                      router.push("/login");
                      return;
                    }
                    if (!product) {
                      toast.error("Không tìm thấy thông tin sản phẩm");
                      return;
                    }

                    const buyNowPayload = {
                      productId,
                      productName: product.productName,
                      price: product.price,
                      quantity: qty,
                      imageUrl: product.imageUrl,
                    };

                    localStorage.setItem("hqs_buy_now_item", JSON.stringify(buyNowPayload));
                    router.push("/cart?mode=buy-now");
                  }}
                  disabled={addingToCart || product.quantity === 0}
                  className="h-11 min-w-[116px] flex-1 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Mua ngay
                </button>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                <Shield className="w-4 h-4" /> Đảm bảo chất lượng & hoàn tiền nếu không đúng mô tả
              </div>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-emerald-100">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="mt-1 text-lg font-bold text-gray-900">Gian hàng</h2>
                </div>
                <div className="rounded-2xl bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {displayShopName}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Link
                  href={sellerRoute}
                  className="group flex min-w-0 flex-1 items-center gap-4 rounded-2xl p-2 transition hover:bg-emerald-50"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 transition group-hover:scale-105">
                    {product.sellerId ? (
                      <span className="text-sm font-bold">{sellerInitials}</span>
                    ) : (
                      <User className="w-6 h-6" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-gray-900 transition group-hover:text-emerald-700">
                      {displayShopName}
                    </p>
                    <p className="text-sm text-gray-500">Xem hồ sơ người bán</p>
                  </div>
                </Link>

                <Link
                  href={product.sellerId ? `/messages?sellerId=${product.sellerId}` : "/messages"}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  <MessageCircle className="w-4 h-4" /> Chat ngay
                </Link>
              </div>

              {product.batchId && (
                <Link href={`/trace/${product.batchId}`} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 px-3.5 text-sm font-medium text-gray-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
                  <QrCode className="w-4 h-4" /> Truy xuất nguồn gốc <ArrowUpRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-10 space-y-6">
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-emerald-100">
            <h2 className="mt-2 text-xl font-bold text-gray-900">Mô tả sản phẩm</h2>
            <p className="mt-4 leading-8 text-gray-600">{product.description}</p>
            
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-emerald-100">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h2 className="mt-2 text-xl font-bold text-gray-900">Đánh giá sản phẩm</h2>
              </div>
              {avgRating && (
                <div className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-3xl font-bold text-gray-900">{avgRating}</span>
                    <RatingStars value={Math.round(Number(avgRating))} sizeClass="w-5 h-5" />
                  </div>
                  <p className="text-sm text-gray-500">Từ {totalReviewCount} đánh giá</p>
                </div>
              )}
            </div>

            <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
              <div className="w-full max-w-[420px] self-start rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-100 lg:col-span-1">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  Tổng điểm sao
                </div>
                <div className="mb-5 text-center">
                  <p className="text-5xl font-bold text-gray-900">{avgRating || "0.0"}</p>
                  <p className="mt-2 text-sm text-gray-500">{totalReviewCount} đánh giá thực tế</p>
                </div>

                <div className="space-y-3">
                  {ratingSummary.map(({ star, count }) => {
                    const percent = totalReviewCount > 0 ? (count / totalReviewCount) * 100 : 0;
                    return (
                      <div key={star} className="flex items-center gap-3 text-sm">
                        <div className="flex w-14 items-center gap-1 text-gray-600">
                          <span>{star}</span>
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        </div>
                        <div className="h-2 flex-1 rounded-full bg-white ring-1 ring-emerald-100 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${percent}%` }} />
                        </div>
                        <div className="w-10 text-right text-gray-600">{count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4 lg:col-span-2">
                {reviews.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-gray-500">
                    Chưa có đánh giá nào. Hãy là người đầu tiên!
                  </div>
                ) : (
                  reviews.map((review) => (
                    <article key={review.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                      <div className="mb-3 flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {review.reviewerName || `Khách hàng #${review.userId}`}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <RatingStars value={review.rating} sizeClass="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </div>
                        <span className="whitespace-nowrap text-xs text-gray-400">
                          {new Date(review.createdAt).toLocaleDateString("vi-VN")}
                        </span>
                      </div>
                      <p className="text-sm leading-7 text-gray-600">{review.comment}</p>
                      {review.mediaUrls && review.mediaUrls.length > 0 && (
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {review.mediaUrls.map((url, index) => (
                            <div key={`${review.id}-${index}`} className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
                              {isVideoUrl(url) ? (
                                <video src={toReviewMediaSrc(url)} controls className="h-48 w-full bg-black object-cover" />
                              ) : (
                                <img src={toReviewMediaSrc(url)} alt={`Đánh giá ${review.id} media ${index + 1}`} className="h-48 w-full object-cover" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
