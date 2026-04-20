"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Leaf, Video, Loader2, ArrowRight, BookOpen } from "lucide-react";
import { parseToken, productApi, livestreamApi, storyApi } from "@/lib/api";

interface Product {
  id: number;
  productName: string;
  price: number;
  description: string;
  imageUrl?: string;
}

interface LiveStream {
  streamKey: string;
  title?: string;
  sellerName?: string;
  thumbnailUrl?: string;
  viewerCount?: number;
}

interface Story {
  id: number;
  sellerId: number;
  sellerName?: string;
  shopName?: string;
  title: string;
  mediaUrl?: string | null;
  mediaType?: "IMAGE" | "VIDEO";
  content?: string;
}

export default function Home() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  const handleSellNow = () => {
    const token = localStorage.getItem("hqs_token");
    if (!token) {
      router.push("/seller/register");
      return;
    }

    const parsed = parseToken();
    const hasSellerAccess = (parsed?.roles?.includes("SELLER") ?? false) || (parsed?.roles?.includes("ADMIN") ?? false);
    router.push(hasSellerAccess ? "/seller/create-post" : "/seller/register");
  };

  useEffect(() => {
    (async () => {
      try {
        const [productRes, streamRes, storyRes] = await Promise.all([
          productApi.getAll(0, 8),
          livestreamApi.getActive(),
          storyApi.getAll(0, 6),
        ]);

        const productData = productRes.data?.data?.content || productRes.data?.data || productRes.data || [];
        setProducts(Array.isArray(productData) ? productData.slice(0, 8) : []);

        const streamData = streamRes.data?.data || streamRes.data || [];
        setStreams(Array.isArray(streamData) ? streamData.slice(0, 6) : []);

        const rawStories = storyRes?.data?.stories || storyRes?.data?.content || storyRes?.data || [];
        const normalizedStories = Array.isArray(rawStories)
          ? rawStories
              .map((s: any): Story => {
                const mediaType: "IMAGE" | "VIDEO" =
                  String(s?.mediaType || (s?.videoUrl ? "VIDEO" : "IMAGE")).toUpperCase() === "VIDEO"
                    ? "VIDEO"
                    : "IMAGE";

                return {
                  id: Number(s?.id || 0),
                  sellerId: Number(s?.sellerId || 0),
                  sellerName: typeof s?.sellerName === "string" ? s.sellerName : "Nông hộ",
                  shopName: typeof s?.shopName === "string" ? s.shopName : undefined,
                  title: typeof s?.title === "string" ? s.title : "Nhật ký nhà nông",
                  mediaUrl:
                    typeof s?.mediaUrl === "string"
                      ? s.mediaUrl
                      : typeof s?.imageUrl === "string"
                        ? s.imageUrl
                        : typeof s?.videoUrl === "string"
                          ? s.videoUrl
                          : null,
                  mediaType,
                  content: typeof s?.content === "string" ? s.content : "",
                };
              })
              .filter((s) => s.id > 0)
              .slice(0, 6)
          : [];
        setStories(normalizedStories);
      } catch {
        setProducts([]);
        setStreams([]);
        setStories([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);

  return (
    <main className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Tự hào nông sản Việt<br />
          <span className="text-primary-600">Tươi ngon trọn từng bữa</span>
        </h1>
        <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
          Kết nối trực tiếp nông hộ Việt Nam với người tiêu dùng. 
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/search" className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">
            Khám phá sản phẩm
          </Link>
          <button
            onClick={handleSellNow}
            className="px-6 py-3 border-2 border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 font-medium"
          >
            Đăng bán ngay
          </button>
        </div>
      </section>


      {/* Featured Products */}
      <section className="max-w-7xl mx-auto px-4 py-16 bg-white rounded-3xl shadow-sm border mb-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Sản phẩm mới nhất</h2>
          <Link href="/search" className="flex items-center gap-1 text-primary-600 hover:text-primary-700 font-medium">
            Xem tất cả <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Leaf className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p>Chưa có sản phẩm nào được hiển thị</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.slice(0, 8).map((p) => (
              <Link 
                key={p.id} 
                href={`/product/${p.id}`}
                className="group bg-white rounded-2xl border hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col hover:-translate-y-1"
              >
                <div className="aspect-square bg-gray-100 flex items-center justify-center relative overflow-hidden">
                  {p.imageUrl ? (
                    <img 
                      src={p.imageUrl} 
                      alt={p.productName} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                  ) : (
                    <Leaf className="w-12 h-12 text-gray-300" />
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1 group-hover:text-primary-600 transition-colors">
                    {p.productName}
                  </h3>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3 flex-1">
                    {p.description || "Chưa có mô tả chi tiết."}
                  </p>
                  <div className="flex items-center justify-between mt-auto pt-3 border-t">
                    <span className="font-bold text-lg text-primary-600">
                      {formatPrice(p.price)}
                    </span>
                    <span className="text-xs text-primary-600 font-medium opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 flex items-center gap-1">
                      Mua ngay <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Farmer Stories */}
      <section className="max-w-7xl mx-auto px-4 py-16 bg-white rounded-3xl shadow-sm border mb-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Câu chuyện nhà nông</h2>
          <Link href="/stories" className="flex items-center gap-1 text-primary-600 hover:text-primary-700 font-medium">
            Xem tất cả <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : stories.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p>Chưa có câu chuyện nhà nông nào</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {stories.map((story) => (
              <Link
                key={story.id}
                href="/stories"
                className="group bg-white rounded-2xl border hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col hover:-translate-y-1"
              >
                <div className="aspect-[3/4] bg-gray-100 flex items-center justify-center relative overflow-hidden">
                  {story.mediaUrl ? (
                    story.mediaType === "VIDEO" ? (
                      <video
                        src={story.mediaUrl}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        muted
                        playsInline
                      />
                    ) : (
                      <img
                        src={story.mediaUrl}
                        alt={story.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    )
                  ) : (
                    <BookOpen className="w-10 h-10 text-gray-300" />
                  )}
                </div>
                <div className="p-3 flex-1 flex flex-col">
                  <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2 group-hover:text-primary-600 transition-colors">
                    {story.title}
                  </h3>
                  <p className="text-xs text-gray-500 line-clamp-1 mt-auto">
                    {story.shopName || story.sellerName || "Nông hộ"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Livestream */}
      <section className="max-w-7xl mx-auto px-4 py-16 bg-white rounded-3xl shadow-sm border mb-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Livestream đang diễn ra</h2>
          <Link href="/live" className="flex items-center gap-1 text-primary-600 hover:text-primary-700 font-medium">
            Xem tất cả <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : streams.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Video className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p>Hiện chưa có phiên phát sóng nào</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {streams.map((stream) => (
              <Link
                key={stream.streamKey}
                href={`/live/${stream.streamKey}`}
                className="group bg-white rounded-2xl border hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col hover:-translate-y-1"
              >
                <div className="aspect-video bg-gray-100 flex items-center justify-center relative overflow-hidden">
                  {stream.thumbnailUrl ? (
                    <img
                      src={stream.thumbnailUrl}
                      alt={stream.title || "Livestream"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <Video className="w-12 h-12 text-gray-300" />
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1 group-hover:text-primary-600 transition-colors">
                    {stream.title || "Livestream nông sản"}
                  </h3>
                  <p className="text-sm text-gray-500 line-clamp-1 mb-2">{stream.sellerName || "Nông hộ"}</p>
                  <p className="text-xs text-primary-700 font-medium">
                    {stream.viewerCount ?? 0} người đang xem
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
