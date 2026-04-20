"use client";

import { useState } from "react";
import { Search, Leaf } from "lucide-react";
import { searchApi, productApi, shopApi } from "@/lib/api";
import Link from "next/link";

interface SearchResult {
  product_id: number;
  product_name: string;
  description: string;
  category?: string;
  price: number;
  image?: string;
  score: number;
  sellerId?: number;
  shopName?: string;
  sellerName?: string;
  shopAvatar?: string;
}

const resolveImageUrl = (value?: string | null) => {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/api/")) {
    return value;
  }
  const normalized = value.startsWith("/") ? value : `/${value}`;
  return normalized;
};

export default function SemanticSearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const res = await searchApi.semantic(searchQuery);
      const rawResults: SearchResult[] = res.data.data?.results || [];

      const enrichedResults = await Promise.all(
        rawResults.map(async (item) => {
          const fromIndex = resolveImageUrl(item.image);
          try {
            const productRes = await productApi.getById(item.product_id);
            const product = productRes.data?.data || productRes.data;
            const fallback = resolveImageUrl(
              fromIndex || product?.imageUrl || product?.image || product?.imageUrls?.[0] || ""
            );

            return {
              ...item,
              image: fallback,
              sellerId: Number(product?.sellerId || 0) || undefined,
              shopName: typeof product?.shopName === "string" ? product.shopName : undefined,
              sellerName: typeof product?.sellerName === "string" ? product.sellerName : undefined,
            };
          } catch {
            return { ...item, image: fromIndex || "" };
          }
        })
      );

      const sellerIds = Array.from(
        new Set(enrichedResults.map((x) => x.sellerId).filter((id): id is number => Boolean(id && id > 0)))
      );

      const shopMap = new Map<number, { shopName?: string; sellerName?: string; avatar?: string }>();
      await Promise.all(
        sellerIds.map(async (sellerId) => {
          try {
            const res = await shopApi.getProfile(sellerId);
            const shop = res.data || {};
            shopMap.set(sellerId, {
              shopName: typeof shop?.shopName === "string" ? shop.shopName : undefined,
              sellerName: typeof shop?.sellerName === "string" ? shop.sellerName : undefined,
              avatar: typeof shop?.avatar === "string" ? shop.avatar : undefined,
            });
          } catch {
            shopMap.set(sellerId, {});
          }
        })
      );

      const withShops = enrichedResults.map((item) => {
        const shop = item.sellerId ? shopMap.get(item.sellerId) : undefined;
        return {
          ...item,
          shopName: shop?.shopName || item.shopName,
          sellerName: shop?.sellerName || item.sellerName,
          shopAvatar: shop?.avatar,
        };
      });

      setResults(withShops);
      setSearched(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Search Bar */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2">
            <Leaf className="w-6 h-6 text-primary-600" />
            Tìm kiếm nông sản
          </h1>
          <form onSubmit={handleSearch} className="flex gap-2 max-w-xl mx-auto">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Ví dụ: "trái cây giải nhiệt", "rau sạch organic"...'
              className="flex-1 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              <Search className="w-5 h-5" />
            </button>
          </form>
          <div className="flex gap-2 justify-center mt-3">
            {["trái cây giải nhiệt", "rau sạch", "đặc sản miền Tây", "organic"].map((tag) => (
              <button
                key={tag}
                onClick={() => { setQuery(tag); doSearch(tag); }}
                className="px-3 py-1 bg-white border rounded-full text-sm text-gray-600 hover:bg-primary-50 hover:border-primary-300"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {loading && (
          <div className="text-center py-12 text-gray-500">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Đang tìm kiếm...
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            Không tìm thấy sản phẩm phù hợp với &quot;{query}&quot;
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((item) => (
            <Link
              href={`/product/${item.product_id}`}
              key={item.product_id}
              className="bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition"
            >
              <div className="h-40 bg-gray-100 flex items-center justify-center">
                {item.image ? (
                  <img src={item.image} alt={item.product_name} className="h-full w-full object-cover" />
                ) : (
                  <Leaf className="w-12 h-12 text-gray-300" />
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-sm mb-1">{item.product_name}</h3>
                <p className="text-xs text-gray-500 line-clamp-2 mb-2">{item.description}</p>

                {item.sellerId && (
                  <Link
                    href={`/shop/${item.sellerId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="mb-3 flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-2 py-1.5 hover:bg-gray-100"
                  >
                    {item.shopAvatar ? (
                      <img src={item.shopAvatar} alt={item.shopName || item.sellerName || "Shop"} className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                        <Leaf className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <span className="truncate text-xs font-medium text-gray-700">
                      {item.shopName || item.sellerName || `Shop #${item.sellerId}`}
                    </span>
                  </Link>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-primary-600 font-bold">{formatPrice(item.price)}</span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                    {Math.round(item.score * 100)}% phù hợp
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
