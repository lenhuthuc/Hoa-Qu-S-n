"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart, Trash2, Minus, Plus, Loader2, ShoppingBag, Leaf, ArrowRight } from "lucide-react";
import { cartApi } from "@/lib/api";
import toast from "react-hot-toast";

interface CartItem {
  productId: number;
  productName: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  subtotal: number;
}

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);

  const fetchCart = async () => {
    try {
      const res = await cartApi.getItems();
      setItems(res.data?.data || res.data || []);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        toast.error("Vui lòng đăng nhập");
        router.push("/login");
      } else {
        toast.error(err.response?.data?.message || "Lỗi tải giỏ hàng");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, []);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);

  const total = items.reduce((s, i) => s + (i.subtotal || i.price * i.quantity), 0);

  const updateQty = async (productId: number, newQty: number) => {
    if (newQty < 1) return;
    setUpdating(productId);
    try {
      await cartApi.updateItem(productId, newQty);
      setItems((prev) =>
        prev.map((i) =>
          i.productId === productId
            ? { ...i, quantity: newQty, subtotal: i.price * newQty }
            : i
        )
      );
    } catch {
      toast.error("Lỗi cập nhật số lượng");
    } finally {
      setUpdating(null);
    }
  };

  const removeItem = async (productId: number) => {
    setUpdating(productId);
    try {
      await cartApi.removeItem(productId);
      setItems((prev) => prev.filter((i) => i.productId !== productId));
      toast.success("Đã xóa khỏi giỏ hàng");
    } catch {
      toast.error("Lỗi xóa sản phẩm");
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-green-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 lg:px-8 py-8 lg:py-12">
        <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-8 tracking-tight">Giỏ hàng của bạn</h1>

        {items.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-6">Giỏ hàng trống</p>
            <Link href="/search" className="inline-flex items-center gap-2 px-6 py-3 bg-green-700 text-white rounded-xl hover:bg-green-800 font-bold transition">
              <Leaf className="w-5 h-5" /> Khám phá sản phẩm
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
            {/* Product List Section (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              {items.map((item) => (
                <div key={item.productId} className="bg-white rounded-2xl p-6 flex items-center gap-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
                  {/* Product Image */}
                  <Link href={`/product/${item.productId}`} className="flex-shrink-0">
                    <div className="w-28 h-28 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                      ) : (
                        <Leaf className="w-8 h-8 text-gray-300" />
                      )}
                    </div>
                  </Link>

                  {/* Product Info */}
                  <div className="flex-grow min-w-0">
                    <Link href={`/product/${item.productId}`} className="text-lg font-semibold text-gray-900 hover:text-green-700 transition line-clamp-2">
                      {item.productName}
                    </Link>
                    <p className="text-gray-500 text-sm mt-1">Sản phẩm nông sản hữu cơ</p>
                    <div className="mt-3 flex items-center gap-4">
                      <span className="text-green-700 font-bold text-lg">{formatPrice(item.price)}</span>
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2 bg-gray-100 rounded-full px-2 py-1">
                    <button
                      onClick={() => updateQty(item.productId, item.quantity - 1)}
                      disabled={updating === item.productId || item.quantity <= 1}
                      className="w-8 h-8 flex items-center justify-center text-green-700 hover:bg-white rounded-full transition-colors disabled:opacity-50"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-semibold text-gray-900">
                      {updating === item.productId ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : (
                        String(item.quantity).padStart(2, '0')
                      )}
                    </span>
                    <button
                      onClick={() => updateQty(item.productId, item.quantity + 1)}
                      disabled={updating === item.productId}
                      className="w-8 h-8 flex items-center justify-center text-green-700 hover:bg-white rounded-full transition-colors disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Subtotal & Delete */}
                  <div className="flex flex-col items-end gap-3">
                    <span className="text-lg font-bold text-gray-900">
                      {formatPrice(item.price * item.quantity)}
                    </span>
                    <button
                      onClick={() => removeItem(item.productId)}
                      disabled={updating === item.productId}
                      className="text-gray-400 hover:text-red-600 transition p-2 hover:bg-red-50 rounded-lg disabled:opacity-50"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary Sidebar (4 cols, sticky) */}
            <div className="lg:col-span-4">
              <div className="bg-white rounded-2xl p-8 sticky top-28 shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Tóm tắt đơn hàng</h2>

                {/* Pricing Breakdown */}
                <div className="space-y-4 mb-8">
                  <div className="flex justify-between items-center text-gray-500">
                    <span>Tạm tính</span>
                    <span className="font-medium text-gray-900">{formatPrice(total)}</span>
                  </div>

                  <div className="pt-4 mt-4 border-t border-gray-200 flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900">Tổng cộng</span>
                    <span className="text-3xl font-bold text-green-700 tracking-tight">{formatPrice(total)}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3">
                  <Link
                    href="/checkout"
                    className="block w-full bg-gradient-to-r from-green-700 to-green-800 text-white font-bold py-4 rounded-2xl shadow-lg shadow-green-700/20 hover:shadow-xl hover:from-green-800 hover:to-green-900 transition-all text-center"
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      <span>Tiến hành thanh toán</span>
                      <ArrowRight className="w-5 h-5" />
                    </span>
                  </Link>
                  <Link
                    href="/search"
                    className="block w-full py-3 text-gray-600 font-medium hover:text-green-700 transition-colors text-center text-sm hover:bg-gray-50 rounded-xl"
                  >
                    Tiếp tục mua sắm
                  </Link>
                </div>

                {/* Payment Methods */}
                <div className="mt-8 pt-8 border-t border-gray-200 flex justify-center gap-4 opacity-40">
                  <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 8H4V6h16m0 10H4v-2h16m0-4H4v2h16z"/>
                  </svg>
                  <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                  </svg>
                  <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 4H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H5V6h14v12zm-6-3.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5z"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full mt-auto bg-gray-50 border-t border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-center px-4 lg:px-8 py-8 max-w-7xl mx-auto">
          <div className="mb-6 md:mb-0">
            <div className="font-bold text-green-700 text-xl mb-2">The Organic Curator</div>
            <p className="text-gray-500 text-sm">© 2024 The Organic Curator. Bảo lưu mọi quyền.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            <a className="text-gray-500 text-sm hover:text-green-700 hover:underline transition-all" href="#">Chính sách bảo mật</a>
            <a className="text-gray-500 text-sm hover:text-green-700 hover:underline transition-all" href="#">Điều khoản sử dụng</a>
            <a className="text-gray-500 text-sm hover:text-green-700 hover:underline transition-all" href="#">Liên hệ</a>
            <a className="text-gray-500 text-sm hover:text-green-700 hover:underline transition-all" href="#">Hỗ trợ</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
