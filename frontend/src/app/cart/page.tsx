"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart, Trash2, Minus, Plus, Loader2, ShoppingBag, Leaf } from "lucide-react";
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
      setItems(res.data?.data || []);
    } catch {
      toast.error("Vui lòng đăng nhập");
      router.push("/login");
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
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-6">
        <ShoppingCart className="w-6 h-6 text-primary-600" />
        Giỏ hàng ({items.length} sản phẩm)
      </h1>

      {items.length === 0 ? (
        <div className="text-center py-20">
          <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-4">Giỏ hàng trống</p>
          <Link href="/search" className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">
            <Leaf className="w-5 h-5" /> Khám phá sản phẩm
          </Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-3">
            {items.map((item) => (
              <div key={item.productId} className="bg-white rounded-xl border p-4 flex gap-4">
                <Link href={`/product/${item.productId}`} className="flex-shrink-0">
                  <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                    ) : (
                      <Leaf className="w-8 h-8 text-gray-300" />
                    )}
                  </div>
                </Link>

                <div className="flex-1 min-w-0">
                  <Link href={`/product/${item.productId}`} className="font-medium text-gray-800 hover:text-primary-600 line-clamp-1">
                    {item.productName}
                  </Link>
                  <p className="text-primary-600 font-bold mt-1">{formatPrice(item.price)}</p>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center border rounded-lg overflow-hidden">
                      <button
                        onClick={() => updateQty(item.productId, item.quantity - 1)}
                        disabled={updating === item.productId || item.quantity <= 1}
                        className="px-2 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-3 py-1.5 text-sm font-medium min-w-[32px] text-center">
                        {updating === item.productId ? (
                          <Loader2 className="w-3 h-3 animate-spin mx-auto" />
                        ) : (
                          item.quantity
                        )}
                      </span>
                      <button
                        onClick={() => updateQty(item.productId, item.quantity + 1)}
                        disabled={updating === item.productId}
                        className="px-2 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-700">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                      <button
                        onClick={() => removeItem(item.productId)}
                        disabled={updating === item.productId}
                        className="text-gray-400 hover:text-red-500 transition p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border p-6 sticky top-24">
              <h2 className="font-semibold text-gray-800 mb-4">Tổng đơn hàng</h2>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between text-gray-600">
                  <span>Tạm tính ({items.length} sản phẩm)</span>
                  <span>{formatPrice(total)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Phí vận chuyển</span>
                  <span className="text-primary-600">Miễn phí</span>
                </div>
              </div>
              <hr className="mb-4" />
              <div className="flex justify-between font-bold text-lg mb-6">
                <span>Tổng cộng</span>
                <span className="text-primary-600">{formatPrice(total)}</span>
              </div>
              <Link
                href="/checkout"
                className="block w-full py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-medium text-center transition"
              >
                Tiến hành thanh toán
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
