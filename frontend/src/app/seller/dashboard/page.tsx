"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Radio,
  BookOpen,
  Sparkles,
  TrendingUp,
  Loader2,
  Shield,
  RotateCcw,
  ClipboardList,
  Star,
  Tag,
} from "lucide-react";
import { sellerApi, trustScoreApi, isLoggedIn, parseToken, hasRole } from "@/lib/api";

interface DashboardData {
  totalProducts: number;
  totalOrders: number;
  pendingOrders: number;
  shippedOrders: number;
  finishedOrders: number;
  cancelledOrders: number;
  cancelRate: number;
  totalRevenue: number;
  topProducts: { productId: number; productName: string; totalRevenue: number; totalSold: number }[];
  trustScore: { score: number; badge: string; avgRating: number; totalReviews: number } | null;
}

interface TrustScoreData {
  score: number;
  badge: string;
  avgRating: number;
  totalReviews: number;
  successfulOrders: number;
  cancelledOrders: number;
  onTimeDeliveryRate: number;
}

const BADGE_MAP: Record<string, { label: string; color: string }> = {
  NONG_HO_TIEU_BIEU: { label: "Nông hộ tiêu biểu", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  UY_TIN: { label: "Uy tín", color: "bg-green-100 text-green-700 border-green-300" },
  CAN_CAI_THIEN: { label: "Cần cải thiện", color: "bg-red-100 text-red-700 border-red-300" },
};

export default function SellerDashboard() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [trustScore, setTrustScore] = useState<TrustScoreData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    if (!hasRole("SELLER") && !hasRole("ADMIN")) { router.push("/seller/register"); return; }
    (async () => {
      try {
        const [dashRes, trustRes] = await Promise.allSettled([
          sellerApi.getDashboard(),
          trustScoreApi.get(parseToken()?.id || 0),
        ]);
        if (dashRes.status === "fulfilled") setDashboard(dashRes.value.data);
        if (trustRes.status === "fulfilled") setTrustScore(trustRes.value.data);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const quickLinks = [
    { href: "/seller/products", icon: Package, label: "Quản lý sản phẩm", color: "text-green-600 bg-green-50" },
    { href: "/seller/orders", icon: ClipboardList, label: "Quản lý đơn hàng", color: "text-orange-600 bg-orange-50" },
    { href: "/seller/create-post", icon: Sparkles, label: "Tạo bài với AI", color: "text-purple-600 bg-purple-50" },
    { href: "/seller/go-live", icon: Radio, label: "Phát sóng trực tiếp", color: "text-red-600 bg-red-50" },
    { href: "/seller/journal", icon: BookOpen, label: "Nhật ký canh tác", color: "text-green-600 bg-green-50" },
    { href: "/seller/stories", icon: BookOpen, label: "Câu chuyện nhà nông", color: "text-teal-600 bg-teal-50" },
    { href: "/seller/vouchers", icon: Tag, label: "Quản lý Voucher", color: "text-orange-600 bg-orange-50" },
    { href: "/search", icon: TrendingUp, label: "Tìm kiếm ngữ nghĩa", color: "text-blue-600 bg-blue-50" },
  ];

  const fmt = (v: number) => new Intl.NumberFormat("vi-VN").format(v);
  const fmtCurrency = (v: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(v);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  const d = dashboard;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-6">
        <LayoutDashboard className="w-6 h-6 text-green-600" />
        Bảng điều khiển người bán
      </h1>

      {/* Trust Score Banner */}
      {trustScore && (
        <div className="bg-white rounded-xl border p-5 mb-6 flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <Shield className="w-10 h-10 text-green-600" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-gray-800">{trustScore.score.toFixed(1)}</span>
                <span className="text-gray-400">/10</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${BADGE_MAP[trustScore.badge]?.color || "bg-gray-100"}`}>
                  {BADGE_MAP[trustScore.badge]?.label || trustScore.badge}
                </span>
              </div>
              <p className="text-sm text-gray-500">Điểm uy tín</p>
            </div>
          </div>
          <div className="flex gap-6 ml-auto text-sm">
            <div className="text-center">
              <div className="flex items-center gap-1 text-yellow-500">
                <Star className="w-4 h-4 fill-current" /> {trustScore.avgRating.toFixed(1)}
              </div>
              <span className="text-gray-400">Đánh giá TB</span>
            </div>
            <div className="text-center">
              <div className="font-bold text-gray-700">{trustScore.totalReviews}</div>
              <span className="text-gray-400">Lượt đánh giá</span>
            </div>
            <div className="text-center">
              <div className="font-bold text-gray-700">{trustScore.successfulOrders}</div>
              <span className="text-gray-400">Đơn thành công</span>
            </div>
            <div className="text-center">
              <div className="font-bold text-gray-700">{(trustScore.onTimeDeliveryRate * 100).toFixed(0)}%</div>
              <span className="text-gray-400">Đúng hẹn</span>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Sản phẩm</span>
            <div className="bg-green-500 w-9 h-9 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800">{d?.totalProducts || 0}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Tổng đơn hàng</span>
            <div className="bg-blue-500 w-9 h-9 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800">{d?.totalOrders || 0}</p>
          <p className="text-xs text-gray-400 mt-1">Chờ xử lý: {d?.pendingOrders || 0}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Doanh thu</span>
            <div className="bg-emerald-500 w-9 h-9 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800">{fmtCurrency(d?.totalRevenue || 0)}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Tỷ lệ huỷ</span>
            <div className={`${(d?.cancelRate || 0) > 5 ? "bg-red-500" : "bg-amber-500"} w-9 h-9 rounded-lg flex items-center justify-center`}>
              <RotateCcw className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800">{(d?.cancelRate || 0).toFixed(1)}%</p>
          <p className="text-xs text-gray-400 mt-1">{d?.cancelledOrders || 0} đơn huỷ</p>
        </div>
      </div>

      {/* Quick Actions - Product Creation Options */}
      <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Package className="w-5 h-5 text-green-600" />
        Đăng bán nông sản mới
      </h2>
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Link
          href="/seller/products/create"
          className="group relative bg-white rounded-2xl border-2 border-dashed border-gray-200 p-6 hover:border-green-500 transition-all hover:shadow-lg overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Package className="w-24 h-24 rotate-12" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-green-50 text-green-600 flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-colors">
              <Package className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">Tạo thủ công</h3>
              <p className="text-sm text-gray-500">Tự nhập thông tin chi tiết sản phẩm</p>
            </div>
          </div>
        </Link>

        <Link
          href="/seller/create-post"
          className="group relative bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-6 hover:shadow-xl transition-all hover:-translate-y-1 overflow-hidden text-white"
        >
          <div className="absolute top-0 right-0 p-3 opacity-20">
            <Sparkles className="w-24 h-24 rotate-12" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Tạo bằng AI (Gemini)</h3>
              <p className="text-purple-100 text-sm">Chỉ cần ảnh, AI lo phần còn lại</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Quick Links */}
      <h2 className="text-lg font-semibold text-gray-800 mb-3 uppercase tracking-wider text-sm opacity-60">Các chức năng khác</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {quickLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="bg-white rounded-xl border p-4 flex items-center gap-3 hover:shadow-md transition group"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${l.color}`}>
              <l.icon className="w-5 h-5" />
            </div>
            <span className="font-medium text-gray-700 text-xs group-hover:text-green-700 transition">
              {l.label}
            </span>
          </Link>
        ))}
      </div>

      {/* Top Products */}
      {d?.topProducts && d.topProducts.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Sản phẩm bán chạy</h2>
          <div className="bg-white rounded-xl border overflow-hidden mb-8">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">#</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Sản phẩm</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">Đã bán</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">Doanh thu</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {d.topProducts.map((p, i) => (
                  <tr key={p.productId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3">
                      <Link href={`/product/${p.productId}`} className="text-green-600 hover:underline">
                        {p.productName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(p.totalSold)}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-700">{fmtCurrency(p.totalRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Order Status Breakdown */}
      <h2 className="text-lg font-semibold text-gray-800 mb-3">Phân bổ đơn hàng</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{d?.pendingOrders || 0}</p>
          <p className="text-sm text-gray-500">Chờ xử lý</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{d?.shippedOrders || 0}</p>
          <p className="text-sm text-gray-500">Đang giao</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{d?.finishedOrders || 0}</p>
          <p className="text-sm text-gray-500">Hoàn tất</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{d?.cancelledOrders || 0}</p>
          <p className="text-sm text-gray-500">Đã huỷ</p>
        </div>
      </div>
    </div>
  );
}
