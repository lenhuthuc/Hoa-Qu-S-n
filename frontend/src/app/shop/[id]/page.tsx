"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { shopApi } from "@/lib/api";
import Link from "next/link";

interface ShopProfile {
  sellerId: number;
  sellerName: string;
  avatar: string | null;
  phone: string | null;
  province: string | null;
  district: string | null;
  totalProducts: number;
  trustScore: {
    score: number;
    badge: string;
    avgRating: number;
    totalReviews: number;
    successfulOrders: number;
  } | null;
  products: {
    id: number;
    productName: string;
    price: number;
    image: string | null;
    rating: number;
    ratingCount: number;
    quantity: number;
  }[];
}

const BADGE_MAP: Record<string, { label: string; color: string }> = {
  NONG_HO_TIEU_BIEU: { label: "Nông hộ tiêu biểu", color: "bg-yellow-100 text-yellow-700" },
  UY_TIN: { label: "Uy tín", color: "bg-green-100 text-green-700" },
  CAN_CAI_THIEN: { label: "Cần cải thiện", color: "bg-red-100 text-red-700" },
};

export default function ShopPage() {
  const params = useParams();
  const sellerId = Number(params.id);
  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sellerId) return;
    (async () => {
      try {
        const res = await shopApi.getProfile(sellerId);
        setShop(res.data);
      } catch {
        // not found
      } finally {
        setLoading(false);
      }
    })();
  }, [sellerId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Không tìm thấy nông hộ
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Shop Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center text-3xl overflow-hidden flex-shrink-0">
            {shop.avatar ? (
              <img src={shop.avatar} alt={shop.sellerName} className="w-full h-full object-cover" />
            ) : (
              "🧑‍🌾"
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-800">{shop.sellerName || "Nông hộ"}</h1>
              {shop.trustScore && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BADGE_MAP[shop.trustScore.badge]?.color || "bg-gray-100"}`}>
                  {BADGE_MAP[shop.trustScore.badge]?.label || shop.trustScore.badge}
                </span>
              )}
            </div>
            {(shop.province || shop.district) && (
              <p className="text-sm text-gray-500 mt-1">
                📍 {[shop.district, shop.province].filter(Boolean).join(", ")}
              </p>
            )}
            <div className="flex gap-6 mt-2 text-sm">
              <span><strong>{shop.totalProducts}</strong> sản phẩm</span>
              {shop.trustScore && (
                <>
                  <span>⭐ {shop.trustScore.avgRating.toFixed(1)} ({shop.trustScore.totalReviews} đánh giá)</span>
                  <span>Điểm uy tín: <strong>{shop.trustScore.score.toFixed(1)}/10</strong></span>
                  <span>{shop.trustScore.successfulOrders} đơn thành công</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Sản phẩm của nông hộ</h2>
        {shop.products.length === 0 ? (
          <p className="text-center text-gray-400 py-8">Chưa có sản phẩm nào</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {shop.products.map((p) => (
              <Link
                key={p.id}
                href={`/product/${p.id}`}
                className="bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition group"
              >
                <div className="h-40 bg-gray-100 flex items-center justify-center overflow-hidden">
                  {p.image ? (
                    <img
                      src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003"}/api/products/${p.id}/img`}
                      alt={p.productName}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                  ) : (
                    <span className="text-gray-400 text-3xl">🍊</span>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-medium text-gray-800 line-clamp-2 group-hover:text-green-600">
                    {p.productName}
                  </h3>
                  <p className="text-base font-bold text-green-700 mt-1">
                    {Number(p.price).toLocaleString("vi-VN")}₫
                  </p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                    <span>⭐ {Number(p.rating).toFixed(1)}</span>
                    <span>({p.ratingCount})</span>
                    {p.quantity === 0 && <span className="text-red-500 ml-auto">Hết hàng</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
