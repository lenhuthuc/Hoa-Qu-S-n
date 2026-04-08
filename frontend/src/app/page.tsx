import Link from "next/link";
import { Leaf, Search, Video, QrCode, TruckIcon, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-primary-700 font-bold text-xl">
            <Leaf className="w-7 h-7" />
            Hoa Quả Sơn
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/search" className="text-gray-600 hover:text-primary-600 flex items-center gap-1">
              <Search className="w-4 h-4" /> Tìm kiếm
            </Link>
            <Link href="/live" className="text-gray-600 hover:text-primary-600 flex items-center gap-1">
              <Video className="w-4 h-4" /> Livestream
            </Link>
            <Link href="/seller/dashboard" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
              Bán hàng
            </Link>
          </nav>
        </div>
      </header>

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
          <Link href="/seller/create-post" className="px-6 py-3 border-2 border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 font-medium">
            Đăng bán ngay
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-12">Tính năng nổi bật</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: Sparkles, title: "AI tạo bài đăng", desc: "Upload ảnh nông sản, AI tự động tạo tiêu đề, mô tả và gợi ý giá bán" },
            { icon: Search, title: "Tìm kiếm thông minh", desc: "Tìm kiếm bằng ngôn ngữ tự nhiên: 'trái cây giải nhiệt', 'rau sạch organic'" },
            { icon: Video, title: "Livestream bán hàng", desc: "Phát trực tiếp từ vườn, người mua đặt hàng ngay trong stream" },
            { icon: QrCode, title: "Truy xuất nguồn gốc", desc: "Quét mã QR xem toàn bộ hành trình từ gieo trồng đến thu hoạch" },
            { icon: TruckIcon, title: "Vận chuyển thông minh", desc: "Tự động kiểm tra thời gian giao hàng phù hợp với hạn sử dụng sản phẩm" },
            { icon: Leaf, title: "Nhật ký canh tác", desc: "Ghi lại quá trình trồng trọt hàng ngày, tạo niềm tin với khách hàng" },
          ].map((f, i) => (
            <div key={i} className="p-6 bg-white rounded-xl shadow-sm border hover:shadow-md transition">
              <f.icon className="w-10 h-10 text-primary-600 mb-4" />
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-gray-600 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
