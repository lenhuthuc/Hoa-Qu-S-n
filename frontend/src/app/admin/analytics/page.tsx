"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3, Users, Package, ShoppingCart, DollarSign, Star, TrendingUp, Loader2, ArrowLeft,
} from "lucide-react";
import { adminAnalyticsApi, isLoggedIn, hasRole } from "@/lib/api";
import toast from "react-hot-toast";
import Link from "next/link";

interface Overview {
  totalUsers: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  totalReviews: number;
  ordersByStatus: Record<string, number>;
}

interface TopProduct {
  productId: number;
  productName: string;
  price: number;
  totalSold: number;
  revenue: number;
  imageUrl?: string;
}

interface TopSeller {
  sellerId: number;
  sellerName: string;
  email: string;
  totalProducts: number;
  revenue: number;
}

type Tab = "overview" | "products" | "sellers";

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topSellers, setTopSellers] = useState<TopSeller[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    if (!hasRole("ADMIN")) { toast.error("Bạn không có quyền truy cập"); router.push("/"); return; }
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [ov, tp, ts] = await Promise.all([
        adminAnalyticsApi.getOverview(),
        adminAnalyticsApi.getTopProducts(),
        adminAnalyticsApi.getTopSellers(),
      ]);
      setOverview(ov.data);
      setTopProducts(tp.data || []);
      setTopSellers(ts.data || []);
    } catch {
      toast.error("Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

  const ORDER_STATUS_LABELS: Record<string, { label: string; color: string }> = {
    PENDING: { label: "Chờ xử lý", color: "bg-yellow-100 text-yellow-700" },
    PAID: { label: "Đã thanh toán", color: "bg-blue-100 text-blue-700" },
    PLACED: { label: "Đã đặt", color: "bg-indigo-100 text-indigo-700" },
    PREPARING: { label: "Đang chuẩn bị", color: "bg-purple-100 text-purple-700" },
    SHIPPED: { label: "Đang giao", color: "bg-cyan-100 text-cyan-700" },
    FINISHED: { label: "Hoàn thành", color: "bg-green-100 text-green-700" },
    CANCELLED: { label: "Đã huỷ", color: "bg-red-100 text-red-700" },
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <BarChart3 className="w-7 h-7 text-green-600" />
          <h1 className="text-2xl font-bold text-gray-800">Phân tích & Thống kê</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
          {([
            { key: "overview", label: "Tổng quan", icon: BarChart3 },
            { key: "products", label: "Sản phẩm bán chạy", icon: Package },
            { key: "sellers", label: "Nông hộ nổi bật", icon: Users },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                tab === t.key ? "bg-white text-green-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === "overview" && overview && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: "Người dùng", value: overview.totalUsers, icon: Users, color: "text-blue-600 bg-blue-50" },
                { label: "Sản phẩm", value: overview.totalProducts, icon: Package, color: "text-green-600 bg-green-50" },
                { label: "Đơn hàng", value: overview.totalOrders, icon: ShoppingCart, color: "text-purple-600 bg-purple-50" },
                { label: "Doanh thu", value: formatPrice(overview.totalRevenue), icon: DollarSign, color: "text-yellow-600 bg-yellow-50" },
                { label: "Đánh giá", value: overview.totalReviews, icon: Star, color: "text-orange-600 bg-orange-50" },
              ].map((card) => (
                <div key={card.label} className="bg-white rounded-xl shadow p-5">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${card.color}`}>
                      <card.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{card.label}</p>
                      <p className="text-xl font-bold text-gray-800">{typeof card.value === "number" ? card.value.toLocaleString("vi-VN") : card.value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Orders by Status */}
            {overview.ordersByStatus && Object.keys(overview.ordersByStatus).length > 0 && (
              <div className="bg-white rounded-xl shadow p-6">
                <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" /> Đơn hàng theo trạng thái
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                  {Object.entries(overview.ordersByStatus).map(([status, count]) => {
                    const info = ORDER_STATUS_LABELS[status] || { label: status, color: "bg-gray-100 text-gray-600" };
                    return (
                      <div key={status} className={`rounded-lg p-3 text-center ${info.color}`}>
                        <p className="text-2xl font-bold">{count}</p>
                        <p className="text-xs mt-1">{info.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Top Products Tab */}
        {tab === "products" && (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="text-left py-3 px-4 font-semibold">#</th>
                    <th className="text-left py-3 px-4 font-semibold">Sản phẩm</th>
                    <th className="text-right py-3 px-4 font-semibold">Giá</th>
                    <th className="text-right py-3 px-4 font-semibold">Đã bán</th>
                    <th className="text-right py-3 px-4 font-semibold">Doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-gray-400">Chưa có dữ liệu</td>
                    </tr>
                  ) : (
                    topProducts.map((p, i) => (
                      <tr key={p.productId} className="border-t hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-400">{i + 1}</td>
                        <td className="py-3 px-4">
                          <Link href={`/product/${p.productId}`} className="font-medium text-gray-800 hover:text-green-600">
                            {p.productName}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600">{formatPrice(p.price)}</td>
                        <td className="py-3 px-4 text-right font-medium">{p.totalSold}</td>
                        <td className="py-3 px-4 text-right font-bold text-green-600">{formatPrice(p.revenue)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Top Sellers Tab */}
        {tab === "sellers" && (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="text-left py-3 px-4 font-semibold">#</th>
                    <th className="text-left py-3 px-4 font-semibold">Nông hộ</th>
                    <th className="text-left py-3 px-4 font-semibold">Email</th>
                    <th className="text-right py-3 px-4 font-semibold">Sản phẩm</th>
                    <th className="text-right py-3 px-4 font-semibold">Doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  {topSellers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-gray-400">Chưa có dữ liệu</td>
                    </tr>
                  ) : (
                    topSellers.map((s, i) => (
                      <tr key={s.sellerId} className="border-t hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-400">{i + 1}</td>
                        <td className="py-3 px-4">
                          <Link href={`/shop/${s.sellerId}`} className="font-medium text-gray-800 hover:text-green-600">
                            {s.sellerName || `Nông hộ #${s.sellerId}`}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{s.email}</td>
                        <td className="py-3 px-4 text-right">{s.totalProducts}</td>
                        <td className="py-3 px-4 text-right font-bold text-green-600">{formatPrice(s.revenue)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
