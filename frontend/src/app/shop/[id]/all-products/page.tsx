"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { cartApi, shopApi } from "@/lib/api";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import toast from "react-hot-toast";

interface ShopProfile {
  sellerId: number;
  sellerName: string;
  shopName: string;
  province: string | null;
  district: string | null;
  products: {
    id: number;
    productName: string;
    price: number;
    image: string | null;
    quantity: number;
  }[];
}

export default function ShopAllProductsPage() {
  const params = useParams();
  const router = useRouter();
  const sellerId = Number(params.id);

  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingProductId, setAddingProductId] = useState<number | null>(null);

  useEffect(() => {
    if (!sellerId) return;

    (async () => {
      try {
        const res = await shopApi.getProfile(sellerId);
        const raw = res.data || null;
        setShop(raw
          ? {
              ...raw,
              shopName: typeof raw.shopName === "string" && raw.shopName.trim() ? raw.shopName.trim() : (typeof raw.sellerName === "string" ? raw.sellerName : "Nông hộ"),
            }
          : null);
      } catch {
        setShop(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [sellerId]);

  const locationText = useMemo(() => {
    if (!shop) return "";
    return [shop.district, shop.province].filter(Boolean).join(", ");
  }, [shop]);
  const displayShopName = shop?.shopName || shop?.sellerName || "Nông hộ";

  async function handleAddToCart(productId: number) {
    try {
      setAddingProductId(productId);
      await cartApi.addItem({ productId, quantity: 1 });
      toast.success("Đã thêm vào giỏ hàng");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Không thể thêm vào giỏ hàng");
    } finally {
      setAddingProductId(null);
    }
  }

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
    <div className="min-h-screen bg-gradient-to-br from-[#eaf8ea] via-[#f6fbf6] to-[#d7ead8] py-6 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#0f5132]">Toàn bộ kho hàng</h1>
            <p className="mt-1 text-sm text-slate-600">
              {displayShopName}
              {locationText ? ` · ${locationText}` : ""}
            </p>
          </div>

          <Link
            href={`/shop/${sellerId}`}
            className="inline-flex items-center gap-2 rounded-full border border-[#146c43] bg-white px-4 py-2 text-sm font-semibold text-[#146c43] shadow-sm transition hover:bg-[#edf8ef]"
          >
            <ArrowLeft className="h-4 w-4" />
            Về trang nông hộ
          </Link>
        </div>

        {shop.products.length === 0 ? (
          <div className="rounded-xl bg-white/90 px-5 py-10 text-center text-slate-500 shadow-sm ring-1 ring-emerald-900/10">
            Chưa có sản phẩm nào trong kho hàng.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shop.products.map((product) => {
              const imageSrc = product.image
                ? `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/products/${product.id}/img`
                : "https://images.unsplash.com/photo-1542838132-92c53300491e?w=900&h=900&fit=crop";

              return (
                <div
                  key={product.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/product/${product.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/product/${product.id}`);
                    }
                  }}
                  className="group rounded-2xl bg-white p-3 shadow-sm ring-1 ring-emerald-900/10 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-emerald-700/20"
                >
                  <div className="overflow-hidden rounded-xl bg-[#f2f3ee]">
                    <img
                      src={imageSrc}
                      alt={product.productName}
                      className="h-52 w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  </div>

                  <div className="pt-3">
                    <h3 className="line-clamp-2 min-h-[42px] text-[17px] font-bold text-[#0f2e24]">
                      {product.productName}
                    </h3>
                    <p className="mt-1 text-sm font-bold text-[#146c43]">
                      {Number(product.price).toLocaleString("vi-VN")}đ/kg
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleAddToCart(product.id);
                    }}
                    disabled={addingProductId === product.id}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#d9f4de] px-3 py-2.5 text-sm font-bold text-[#0f5132] transition hover:bg-[#c7ebcf] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    {addingProductId === product.id ? "Đang thêm..." : "Thêm vào giỏ"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
