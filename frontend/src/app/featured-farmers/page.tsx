"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Award, Leaf, MapPin, Search, Star } from "lucide-react";
import { productApi, shopApi } from "@/lib/api";

interface ProductLite {
  id: number;
  sellerId?: number;
  sellerName?: string;
  shopName?: string;
  rating?: number;
}

interface FeaturedFarmer {
  sellerId: number;
  sellerName: string;
  shopName: string;
  avatar: string | null;
  province: string | null;
  district: string | null;
  avgRating: number;
  trustScore: number;
}

function unwrap(raw: any): any[] {
  return raw?.data?.content || raw?.data || raw || [];
}

export default function FeaturedFarmersPage() {
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [farmers, setFarmers] = useState<FeaturedFarmer[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const productsRes = await productApi.getAll(0, 200);
        const rawProducts = unwrap(productsRes.data);
        const products: ProductLite[] = (Array.isArray(rawProducts) ? rawProducts : [])
          .map((p: any) => ({
            id: Number(p?.id || 0),
            sellerId: Number(p?.sellerId || 0),
            sellerName: typeof p?.sellerName === "string" ? p.sellerName : undefined,
            shopName: typeof p?.shopName === "string" ? p.shopName : undefined,
            rating: Number(p?.rating || 0),
          }))
          .filter((p) => p.id > 0 && (p.sellerId || 0) > 0);

        const sellerIds = Array.from(
          new Set(products.map((p) => p.sellerId).filter((id): id is number => Boolean(id && id > 0)))
        );

        const rows = await Promise.all(
          sellerIds.map(async (sellerId) => {
            const sellerProducts = products.filter((p) => p.sellerId === sellerId);
            const fallbackName = sellerProducts[0]?.shopName || sellerProducts[0]?.sellerName || `Nông hộ #${sellerId}`;
            const shopRes = await shopApi.getProfile(sellerId);
            const shop = shopRes.data || {};

            const avgFromProducts = sellerProducts.length
              ? sellerProducts.reduce((sum, p) => sum + (p.rating || 0), 0) / sellerProducts.length
              : 0;

            return {
              sellerId,
              sellerName: shop?.sellerName || fallbackName,
              shopName: shop?.shopName || fallbackName,
              avatar: shop?.avatar || null,
              province: shop?.province || null,
              district: shop?.district || null,
              avgRating: Number(shop?.trustScore?.avgRating || avgFromProducts || 0),
              trustScore: Number(shop?.trustScore?.score || 0),
            } as FeaturedFarmer;
          })
        );

        const sorted = rows
          .filter((f) => f.avgRating > 0 || f.trustScore > 0)
          .sort((a, b) => {
            if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;
            if (b.trustScore !== a.trustScore) return b.trustScore - a.trustScore;
            return 0;
          });

        if (!cancelled) setFarmers(sorted);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredFarmers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return farmers;
    return farmers.filter(
      (f) => f.shopName.toLowerCase().includes(q) || f.sellerName.toLowerCase().includes(q)
    );
  }, [farmers, query]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#e7f6ec] via-[#f9fdf9] to-white py-10">
      <section className="max-w-7xl mx-auto px-4">
        <div className="rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <Award className="w-3.5 h-3.5" /> Danh sách chọn lọc
              </p>
              <h1 className="mt-3 text-3xl font-extrabold text-slate-900 md:text-4xl">Nông hộ nổi bật</h1>
              <p className="mt-2 text-sm text-slate-600">Tìm theo tên nông hộ để khám phá các shop uy tín và được đánh giá cao.</p>
            </div>

            <div className="w-full max-w-lg">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tìm nông hộ</label>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-emerald-400 focus-within:bg-white">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Nhập tên shop hoặc tên nông hộ..."
                  className="w-full bg-transparent text-sm text-slate-700 outline-none"
                />
              </div>
              {query.trim() && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {filteredFarmers.slice(0, 8).map((f) => (
                    <Link
                      key={`search-${f.sellerId}`}
                      href={`/shop/${f.sellerId}`}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                    >
                      {f.shopName}
                    </Link>
                  ))}
                  {filteredFarmers.length === 0 && (
                    <span className="text-sm text-slate-500">Không tìm thấy nông hộ phù hợp.</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto mt-8 px-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-400 border-t-transparent" />
          </div>
        ) : filteredFarmers.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">Chưa có dữ liệu nông hộ nổi bật.</div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredFarmers.map((farmer) => {
              const location = [farmer.district, farmer.province].filter(Boolean).join(", ");
              return (
                <Link
                  key={farmer.sellerId}
                  href={`/shop/${farmer.sellerId}`}
                  className="group block rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-emerald-100">
                      {farmer.avatar ? (
                        <img src={farmer.avatar} alt={farmer.shopName} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-emerald-700"><Leaf className="w-6 h-6" /></div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-lg font-bold text-slate-900 group-hover:text-emerald-700">{farmer.shopName}</p>
                      <p className="line-clamp-1 text-sm text-slate-500">{farmer.sellerName}</p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="w-3.5 h-3.5" /> {location || "Địa chỉ đang cập nhật"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-4 rounded-xl bg-emerald-50 px-3 py-2">
                    <p className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-800">
                      <Star className="w-4 h-4" /> {farmer.avgRating.toFixed(1)}
                    </p>
                    <p className="text-xs text-emerald-700">Trust score: {farmer.trustScore.toFixed(1)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
