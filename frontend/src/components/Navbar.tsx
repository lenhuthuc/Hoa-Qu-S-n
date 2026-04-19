"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Leaf, Search, Video, ShoppingCart, User, LogOut, LayoutDashboard,
  MessageCircle, TrendingUp, Menu, X, ChevronDown, Shield, Bell, BookOpen,
} from "lucide-react";
import { parseToken, notificationApi } from "@/lib/api";
import { useSSE } from "@/hooks/useSSE";

export default function Navbar() {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSeller, setIsSeller] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadDmCount, setUnreadDmCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("hqs_token");
    setIsLoggedIn(!!token);
    if (token) {
      const parsed = parseToken();
      setIsAdmin(parsed?.roles?.includes("ADMIN") ?? false);
      setIsSeller((parsed?.roles?.includes("SELLER") ?? false) || (parsed?.roles?.includes("ADMIN") ?? false));
      notificationApi.getUnreadCount().then(res => {
        setUnreadCount(res.data?.count || 0);
      }).catch(() => {});
    } else {
      setIsAdmin(false);
      setIsSeller(false);
      setUnreadCount(0);
      setUnreadDmCount(0);
    }
  }, [pathname]);

  // Reset DM badge khi đang ở trang messages
  useEffect(() => {
    if (pathname === "/messages") setUnreadDmCount(0);
  }, [pathname]);

  // Real-time badge updates qua SSE
  useSSE({
    "notification": () => setUnreadCount((c) => c + 1),
    "dm:message": () => {
      if (pathname !== "/messages") setUnreadDmCount((c) => c + 1);
    },
  });

  const handleLogout = () => {
    localStorage.removeItem("hqs_token");
    localStorage.removeItem("hqs_refresh_token");
    setIsLoggedIn(false);
    setUserMenuOpen(false);
    window.location.href = "/login";
  };

  const navLinks = [
    { href: "/featured-farmers", icon: Leaf, label: "Nông hộ nổi bật" },
    { href: "/search", icon: Search, label: "Tìm kiếm" },
    { href: "/live", icon: Video, label: "Livestream" },
    { href: "/market-prices", icon: TrendingUp, label: "Giá thị trường" },
    { href: "/stories", icon: BookOpen, label: "Câu chuyện" },
    { href: "/chatbot", icon: MessageCircle, label: "Trợ lý AI" },
  ];

  // Hide navbar on livestream viewer pages for immersive experience
  if (pathname?.startsWith("/live/") && pathname !== "/live") return null;

  return (
    <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
        <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap text-primary-700 font-bold text-xl">
          <Leaf className="w-6 h-6" />
          Hoa Quả Sơn
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-0.5 flex-nowrap">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-1.5 px-2 lg:px-3 py-2 rounded-lg text-xs lg:text-sm whitespace-nowrap transition ${
                pathname === link.href
                  ? "bg-primary-50 text-primary-700 font-medium"
                  : "text-gray-600 hover:text-primary-600 hover:bg-gray-50"
              }`}
            >
              <link.icon className="w-4 h-4" />
              <span className="hidden lg:inline">{link.label}</span>
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-2 flex-nowrap">
          {isLoggedIn ? (
            <>
              <Link
                href="/messages"
                className={`relative p-2 rounded-lg transition ${
                  pathname === "/messages" ? "bg-primary-50 text-primary-700" : "text-gray-600 hover:text-primary-600 hover:bg-gray-50"
                }`}
                title="Tin nhắn"
              >
                <MessageCircle className="w-5 h-5" />
                {unreadDmCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                    {unreadDmCount > 9 ? "9+" : unreadDmCount}
                  </span>
                )}
              </Link>
              <Link
                href="/notifications"
                className={`relative p-2 rounded-lg transition ${
                  pathname === "/notifications" ? "bg-primary-50 text-primary-700" : "text-gray-600 hover:text-primary-600 hover:bg-gray-50"
                }`}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
              <Link
                href="/cart"
                className={`p-2 rounded-lg transition ${
                  pathname === "/cart" ? "bg-primary-50 text-primary-700" : "text-gray-600 hover:text-primary-600 hover:bg-gray-50"
                }`}
              >
                <ShoppingCart className="w-5 h-5" />
              </Link>
              <Link
                href={isSeller ? "/seller/dashboard" : "/seller/register"}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium whitespace-nowrap"
              >
                Kênh Người Bán
              </Link>
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-1 p-2 rounded-lg text-gray-600 hover:bg-gray-50 transition"
                >
                  <User className="w-5 h-5" />
                  <ChevronDown className="w-3 h-3" />
                </button>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border rounded-xl shadow-lg py-1 z-50">
                      <Link
                        href="/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <User className="w-4 h-4" /> Tài khoản
                      </Link>
                      <Link
                        href="/orders"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <ShoppingCart className="w-4 h-4" /> Đơn hàng
                      </Link>
                      <Link
                        href="/returns"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <ShoppingCart className="w-4 h-4" /> Hoàn trả
                      </Link>
                      {isAdmin && (
                        <Link
                          href="/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Shield className="w-4 h-4" /> Quản trị
                        </Link>
                      )}
                      <hr className="my-1" />
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full"
                      >
                        <LogOut className="w-4 h-4" /> Đăng xuất
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                href={isSeller ? "/seller/dashboard" : "/seller/register"}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium whitespace-nowrap"
              >
                Kênh Người Bán
              </Link>
              <Link
                href="/login"
                className="px-4 py-2 text-sm text-gray-600 hover:text-primary-600 font-medium whitespace-nowrap"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium whitespace-nowrap"
              >
                Đăng ký
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2 text-gray-600"
        >
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t bg-white px-4 py-3 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </Link>
          ))}
          <hr className="my-2" />
          {isLoggedIn ? (
            <>
              <Link href="/cart" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                <ShoppingCart className="w-4 h-4" /> Giỏ hàng
              </Link>
              <Link href="/notifications" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                <Bell className="w-4 h-4" /> Thông báo {unreadCount > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-1.5">{unreadCount}</span>}
              </Link>
              <Link href="/messages" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                <MessageCircle className="w-4 h-4" /> Tin nhắn {unreadDmCount > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-1.5">{unreadDmCount}</span>}
              </Link>
              <Link href="/orders" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                <LayoutDashboard className="w-4 h-4" /> Đơn hàng
              </Link>
              <Link href="/returns" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                <LayoutDashboard className="w-4 h-4" /> Hoàn trả
              </Link>
              <Link href="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                <User className="w-4 h-4" /> Tài khoản
              </Link>
              <Link href={isSeller ? "/seller/dashboard" : "/seller/register"} onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-primary-600 font-medium hover:bg-primary-50">
                <Leaf className="w-4 h-4" /> Kênh Người Bán
              </Link>
              {isAdmin && (
                <Link href="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                  <Shield className="w-4 h-4" /> Quản trị
                </Link>
              )}
              <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 w-full">
                <LogOut className="w-4 h-4" /> Đăng xuất
              </button>
            </>
          ) : (
            <>
              <Link href={isSeller ? "/seller/dashboard" : "/seller/register"} onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-primary-600 font-medium hover:bg-primary-50">
                <Leaf className="w-4 h-4" /> Kênh Người Bán
              </Link>
              <Link href="/login" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                Đăng nhập
              </Link>
              <Link href="/register" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-primary-600 font-medium hover:bg-primary-50">
                Đăng ký
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
