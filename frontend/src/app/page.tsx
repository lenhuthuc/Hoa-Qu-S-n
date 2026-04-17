"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Leaf, Search, Video, QrCode, TruckIcon, Sparkles, Loader2, ArrowRight } from "lucide-react";
import { parseToken, productApi } from "@/lib/api";

interface Product {
  id: number;
  productName: string;
  price: number;
  description: string;
  imageUrl?: string;
}

export default function Home() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
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
        const res = await productApi.getAll(0, 8); // fetch top 8 products
        // Extract data depending on how Spring Boot wraps it, usually res.data?.data?.content or just array
        const data = res.data?.data?.content || res.data?.data || res.data || [];
        setProducts(Array.isArray(data) ? data.slice(0, 8) : []);
      } catch {
        // silently fail or show minimal toast
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
          Nông sản tươi ngon<br />
          <span className="text-primary-600">từ vườn đến bàn ăn</span>
        </h1>
        <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
          Kết nối trực tiếp nông hộ Việt Nam với người tiêu dùng. 
          Truy xuất nguồn gốc minh bạch, giao hàng nhanh chóng.
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
            {products.map((p) => (
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

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 py-16 mb-20 bg-gray-50 rounded-3xl">
        <h2 className="text-2xl font-bold text-center mb-12">Tại sao chọn Hoa Quả Sơn?</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: Sparkles, title: "AI Nông Nghiệp", desc: "AI tự động chấm điểm chất lượng, gợi ý giá và nhận diện sâu bệnh" },
            { icon: Search, title: "Tìm kiếm ngữ nghĩa", desc: "Tìm kiếm tự nhiên: 'trái cây giải nhiệt', 'quà biếu lễ Tết'" },
            { icon: Video, title: "Livestream", desc: "Mua hàng trực tiếp từ vườn qua sóng livestream độ trễ thấp" },
            { icon: QrCode, title: "Truy xuất Blockchain", desc: "Minh bạch 100% vòng đời nông sản qua mã QR" },
            { icon: TruckIcon, title: "Vận chuyển", desc: "Giao hàng tối ưu hóa, đảm bảo độ tươi ngon đến tận tay" },
            { icon: Leaf, title: "Nhật ký số", desc: "Bản ghi canh tác điện tử, kết nối niềm tin nông hộ và người mua" },
          ].map((f, i) => (
            <div key={i} className="p-6 bg-white rounded-2xl shadow-sm border hover:shadow-md transition-shadow group">
              <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <f.icon className="w-7 h-7 text-primary-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
