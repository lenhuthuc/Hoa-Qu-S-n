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
  QrCode,
  Sparkles,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { orderApi, productApi, isLoggedIn } from "@/lib/api";

interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  pendingOrders: number;
  revenue: number;
}

export default function SellerDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    revenue: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    (async () => {
      try {
        const [productsRes, ordersRes] = await Promise.allSettled([
          productApi.getAll(),
          orderApi.getAll(),
        ]);

        const products =
          productsRes.status === "fulfilled" ? productsRes.value.data?.data || [] : [];
        const orders =
          ordersRes.status === "fulfilled" ? ordersRes.value.data?.data || [] : [];

        const pending = orders.filter(
          (o: any) => o.status === "PENDING" || o.status === "PROCESSING"
        );
        const revenue = orders
          .filter((o: any) => o.status === "DELIVERED" || o.status === "COMPLETED")
          .reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);

        setStats({
          totalProducts: products.length,
          totalOrders: orders.length,
          pendingOrders: pending.length,
          revenue,
        });
        setRecentOrders(orders.slice(0, 5));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const quickLinks = [
    { href: "/seller/create-post", icon: Sparkles, label: "Tạo bài với AI", color: "text-purple-600 bg-purple-50" },
    { href: "/seller/go-live", icon: Radio, label: "Phát sóng trực tiếp", color: "text-red-600 bg-red-50" },
    { href: "/seller/journal", icon: BookOpen, label: "Nhật ký canh tác", color: "text-green-600 bg-green-50" },
    { href: "/search", icon: TrendingUp, label: "Tìm kiếm ngữ nghĩa", color: "text-blue-600 bg-blue-50" },
  ];

  const statCards = [
    { label: "Sản phẩm", value: stats.totalProducts, icon: Package, color: "bg-green-500" },
    { label: "Tổng đơn hàng", value: stats.totalOrders, icon: ShoppingCart, color: "bg-blue-500" },
    { label: "Đơn chờ xử lý", value: stats.pendingOrders, icon: ShoppingCart, color: "bg-amber-500" },
    {
      label: "Doanh thu",
      value: new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(stats.revenue),
      icon: TrendingUp,
      color: "bg-emerald-500",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-6">
        <LayoutDashboard className="w-6 h-6 text-green-600" />
        Bảng điều khiển người bán
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{s.label}</span>
              <div className={`${s.color} w-9 h-9 rounded-lg flex items-center justify-center`}>
                <s.icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-800">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <h2 className="text-lg font-semibold text-gray-800 mb-3">Truy cập nhanh</h2>
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
            <span className="font-medium text-gray-700 text-sm group-hover:text-green-700 transition">
              {l.label}
            </span>
          </Link>
        ))}
      </div>

      {/* Recent Orders */}
      <h2 className="text-lg font-semibold text-gray-800 mb-3">Đơn hàng gần đây</h2>
      {recentOrders.length === 0 ? (
        <p className="text-gray-400 text-sm bg-white rounded-xl border p-6 text-center">
          Chưa có đơn hàng nào
        </p>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Mã đơn</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Trạng thái</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">Tổng tiền</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">Ngày</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentOrders.map((o: any) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-700">#{o.id}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        o.status === "DELIVERED" || o.status === "COMPLETED"
                          ? "bg-green-100 text-green-700"
                          : o.status === "PENDING"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {new Intl.NumberFormat("vi-VN").format(o.totalAmount || 0)}đ
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">
                    {o.createdAt ? new Date(o.createdAt).toLocaleDateString("vi-VN") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
