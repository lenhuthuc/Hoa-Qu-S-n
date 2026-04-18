"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { cartApi, shopApi, storyApi } from "@/lib/api";
import Link from "next/link";
import { ChevronDown, MapPin, MessageCircle, X } from "lucide-react";
import toast from "react-hot-toast";

interface ShopProfile {
  sellerId: number;
  sellerName: string;
  shopName: string;
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

interface StoryItem {
  id: number;
  sellerId: number;
  sellerName: string;
  title: string;
  content: string;
  imageUrl: string | null;
  videoUrl: string | null;
  activityType: string | null;
  createdAt: string;
}

const ACTIVITY_FALLBACK: Record<string, string> = {
  PLANTING: "Gieo trồng",
  WATERING: "Tưới nước",
  FERTILIZING: "Bón phân",
  SPRAYING: "Phun sương",
  HARVESTING: "Thu hoạch",
  PACKING: "Đóng gói",
  OTHER: "Nhật ký",
};

function normalizeAvatarUrl(raw: unknown): string | null {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return null;
  if (value.startsWith("/api/reviews/media")) return value;
  if (value.startsWith("local:") || value.startsWith("review-media/") || value.startsWith("reviews/") || value.includes(".r2.cloudflarestorage.com/")) {
    return `/api/reviews/media?url=${encodeURIComponent(value)}`;
  }
  return value;
}

export default function ShopPage() {
  const router = useRouter();
  const params = useParams();
  const sellerId = Number(params.id);
  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [addingProductId, setAddingProductId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);

  async function fetchShopProfileWithRetry(id: number, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await shopApi.getProfile(id);
      } catch (error: any) {
        const status = error?.response?.status;
        const isServerError = status >= 500;
        if (!isServerError || attempt === retries) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
    }
    throw new Error("Không thể tải hồ sơ nông hộ");
  }

  useEffect(() => {
    if (!sellerId) return;
    let cancelled = false;

    const load = async () => {
      let hasShopData = false;
      let shouldRetry = false;
      try {
        const shopRes = await fetchShopProfileWithRetry(sellerId);
        const rawShop = shopRes.data || {};
        const rawProducts = Array.isArray(rawShop.products) ? rawShop.products : [];

        if (cancelled) return;
        setShop({
          sellerId: Number(rawShop.sellerId || sellerId),
          sellerName: typeof rawShop.sellerName === "string" ? rawShop.sellerName : "Nông hộ",
          shopName: typeof rawShop.shopName === "string" && rawShop.shopName.trim() ? rawShop.shopName.trim() : (typeof rawShop.sellerName === "string" ? rawShop.sellerName : "Nông hộ"),
          avatar: normalizeAvatarUrl(rawShop.avatar),
          phone: typeof rawShop.phone === "string" ? rawShop.phone : null,
          province: typeof rawShop.province === "string" ? rawShop.province : null,
          district: typeof rawShop.district === "string" ? rawShop.district : null,
          totalProducts: Number(rawShop.totalProducts || rawProducts.length || 0),
          trustScore: rawShop.trustScore && typeof rawShop.trustScore === "object"
            ? {
                score: Number(rawShop.trustScore.score || 0),
                badge: String(rawShop.trustScore.badge || ""),
                avgRating: Number(rawShop.trustScore.avgRating || 0),
                totalReviews: Number(rawShop.trustScore.totalReviews || 0),
                successfulOrders: Number(rawShop.trustScore.successfulOrders || 0),
              }
            : null,
          products: rawProducts.map((p: any) => ({
            id: Number(p?.id || 0),
            productName: typeof p?.productName === "string" ? p.productName : "Sản phẩm",
            price: Number(p?.price || 0),
            image: typeof p?.image === "string" ? p.image : null,
            rating: Number(p?.rating || 0),
            ratingCount: Number(p?.ratingCount || 0),
            quantity: Number(p?.quantity || 0),
          })).filter((p: { id: number }) => p.id > 0),
        });
        setNotFound(false);
        setServiceUnavailable(false);
        hasShopData = true;
      } catch (error: any) {
        const status = error?.response?.status;
        if (status === 404) {
          if (!cancelled) {
            setShop(null);
            setNotFound(true);
            setServiceUnavailable(false);
          }
        } else {
          shouldRetry = true;
          if (!cancelled) {
            setShop(null);
            setNotFound(false);
            setServiceUnavailable(true);
          }
        }
      }

      try {
        const storyRes = await storyApi.getBySeller(sellerId);
        const rawStories = storyRes.data?.data || storyRes.data?.content || storyRes.data || [];
        const list = Array.isArray(rawStories) ? rawStories : [];
        if (!cancelled) {
          setStories(
            list.slice(0, 12).map((s: any) => ({
              id: Number(s?.id || 0),
              sellerId: Number(s?.sellerId || sellerId),
              sellerName: typeof s?.sellerName === "string" ? s.sellerName : "Nông hộ",
              title: typeof s?.title === "string" ? s.title : "",
              content: typeof s?.content === "string" ? s.content : "",
              imageUrl: typeof s?.imageUrl === "string" ? s.imageUrl : null,
              videoUrl: typeof s?.videoUrl === "string" ? s.videoUrl : null,
              activityType: typeof s?.activityType === "string" ? s.activityType : null,
              createdAt: typeof s?.createdAt === "string" ? s.createdAt : "",
            })).filter((s: StoryItem) => s.id > 0)
          );
        }
      } catch {
        if (!cancelled) {
          setStories([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }

      if (!cancelled && !hasShopData && shouldRetry) {
        setTimeout(() => {
          if (!cancelled) {
            setLoading(true);
            load();
          }
        }, 2500);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Không tìm thấy nông hộ
      </div>
    );
  }

  if (!shop && serviceUnavailable) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Đang kết nối dữ liệu nông hộ... vui lòng chờ
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Đang tải dữ liệu nông hộ...
      </div>
    );
  }

  const locationText = [shop.district, shop.province].filter(Boolean).join(", ");
  const avgRatingText = shop.trustScore?.avgRating ? shop.trustScore.avgRating.toFixed(1) : "0.0";
  const ordersDone = shop.trustScore?.successfulOrders || 0;
  const shopUrl = `/shop/${sellerId}/all-products`;
  const displayShopName = shop.shopName || shop.sellerName || "Nông hộ";
  const visibleProducts = shop.products.slice(0, 3);
  const hasMoreProducts = shop.products.length > 3;

  const activeStory = activeStoryIndex === null ? null : stories[activeStoryIndex] || null;

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#eaf8ea] via-[#f6fbf6] to-[#d7ead8] py-6 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Khu vực 1: Trust Header */}
        <section className="rounded-3xl bg-white/85 p-5 shadow-[0_18px_50px_rgba(20,84,52,0.08)] ring-1 ring-emerald-900/10 backdrop-blur-sm sm:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="relative shrink-0">
                <div className="h-24 w-24 overflow-hidden rounded-2xl border-4 border-white bg-emerald-100 shadow-md">
                  {shop.avatar ? (
                    <img src={shop.avatar} alt={displayShopName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl">🧑‍🌾</div>
                  )}
                </div>
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#8bd450] px-3 py-1 text-[10px] font-extrabold tracking-wide text-[#17412f] shadow-sm">
                  CHỦ VƯỜN
                </span>
              </div>

              <div className="min-w-0 space-y-2 pt-1">
                <h1 className="line-clamp-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                  {displayShopName}
                </h1>
                <p className="flex items-center gap-1.5 text-sm text-slate-600">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  {locationText || "Địa chỉ đang cập nhật"}
                </p>

                <div className="mt-3 inline-flex overflow-hidden rounded-xl bg-[#e4e7de] ring-1 ring-black/5">
                  <div className="px-4 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Đánh giá</p>
                    <p className="mt-0.5 text-lg font-bold text-[#1b4332]">{avgRatingText} / 5</p>
                  </div>
                  <div className="w-px bg-slate-300/70" />
                  <div className="px-4 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Hoàn thành đơn</p>
                    <p className="mt-0.5 text-lg font-bold text-slate-900">{ordersDone.toLocaleString("vi-VN")} đơn</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/messages?sellerId=${sellerId}`}
                className="inline-flex items-center gap-2 rounded-full bg-[#146c43] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0f5b38]"
              >
                <MessageCircle className="h-4 w-4" />
                Chat với người bán
              </Link>
            </div>
          </div>
        </section>

        {/* Khu vực 2: Nhật ký Story */}
        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-3xl font-extrabold tracking-tight text-[#0f5132]">Nhật ký canh tác</h2>
            <Link href="/stories" className="text-sm font-semibold text-[#146c43] hover:underline">
              Xem tất cả
            </Link>
          </div>

          {stories.length === 0 ? (
            <div className="rounded-xl bg-white/90 px-5 py-6 text-sm text-slate-500 shadow-sm ring-1 ring-emerald-900/10">
              Chưa có story nào từ nông hộ này.
            </div>
          ) : (
            <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-2">
              {stories.map((story, index) => {
                const cleanTitle = typeof story.title === "string" ? story.title.trim() : "";
                const activityLabel = story.activityType ? ACTIVITY_FALLBACK[story.activityType] : "";
                const label = cleanTitle || activityLabel || "Nhật ký";
                const thumb = story.imageUrl || "https://images.unsplash.com/photo-1492496913980-501348b61469?w=320&h=320&fit=crop";
                return (
                  <button
                    key={story.id}
                    onClick={() => setActiveStoryIndex(index)}
                    className="group w-[88px] shrink-0 text-center"
                  >
                    <span className="mx-auto inline-flex h-[76px] w-[76px] items-center justify-center rounded-full bg-gradient-to-br from-[#35c46d] via-[#0f6b40] to-[#a2e26a] p-[3px]">
                      <span className="h-full w-full overflow-hidden rounded-full border-2 border-white bg-white">
                        <img src={thumb} alt={label} className="h-full w-full object-cover" />
                      </span>
                    </span>
                    <span className="mt-1.5 block line-clamp-2 text-[11px] font-semibold uppercase tracking-tight text-slate-700 group-hover:text-[#0f6b40]">
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Khu vực 3: Gian hàng */}
        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-3xl font-extrabold tracking-tight text-[#0f5132]">Gian hàng</h2>
          </div>

          {shop.products.length === 0 ? (
            <div className="rounded-xl bg-white/90 px-5 py-10 text-center text-slate-500 shadow-sm ring-1 ring-emerald-900/10">
              Chưa có sản phẩm nào trong gian hàng.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleProducts.map((product) => {
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
                        className="h-48 w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      />
                    </div>

                    <div className="pt-3">
                      <h3 className="line-clamp-2 min-h-[42px] text-[17px] font-bold text-[#0f2e24]">
                        {product.productName}
                      </h3>
                      <p className="mt-1 text-sm font-bold text-[#146c43]">
                        {Number(product.price).toLocaleString("vi-VN")}đ
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
                      className="mt-3 w-full rounded-xl bg-[#d9f4de] px-3 py-2.5 text-sm font-bold text-[#0f5132] transition hover:bg-[#c7ebcf] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {addingProductId === product.id ? "Đang thêm..." : "Thêm vào giỏ"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {hasMoreProducts && (
          <div className="mt-8 flex justify-center">
            <Link
              href={shopUrl}
              className="inline-flex items-center gap-2 rounded-full border border-[#146c43] bg-white px-7 py-3 text-sm font-bold text-[#146c43] shadow-sm transition hover:bg-[#edf8ef]"
            >
              Xem thêm toàn bộ kho hàng
              <ChevronDown className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* Story Modal */}
        {activeStory && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-[#0d2017] shadow-2xl ring-1 ring-emerald-400/20">
              <button
                type="button"
                onClick={() => setActiveStoryIndex(null)}
                className="absolute right-3 top-3 z-10 rounded-full bg-black/45 p-1.5 text-white hover:bg-black/65"
                aria-label="Đóng story"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="h-[520px] w-full bg-black">
                {activeStory.videoUrl ? (
                  <video
                    src={activeStory.videoUrl}
                    controls
                    autoPlay
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="relative h-full w-full">
                    <img
                      src={activeStory.imageUrl || "https://images.unsplash.com/photo-1492496913980-501348b61469?w=900&h=1600&fit=crop"}
                      alt={activeStory.title || "Story"}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/30" />
                  </div>
                )}
              </div>

              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent px-4 pb-5 pt-10 text-white">
                <p className="text-base font-bold">{activeStory.title || "Nhật ký nông hộ"}</p>
                <p className="mt-1 line-clamp-2 text-sm text-white/85">
                  {activeStory.content || "Cập nhật từ khu vườn hôm nay."}
                </p>
              </div>

              <div className="absolute left-3 right-3 top-3 h-1.5 overflow-hidden rounded-full bg-white/25">
                <div className="h-full w-full rounded-full bg-white/95" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
