"use client";
import { useEffect, useState } from "react";
import { wishlistApi, cartApi } from "@/lib/api";
import Link from "next/link";

interface WishlistItem {
  id: number;
  productId: number;
  productName: string;
  price: number;
  image: string;
  quantity: number;
  addedAt: string;
}

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWishlist();
  }, []);

  async function loadWishlist() {
    try {
      const res = await wishlistApi.getAll();
      setItems(res.data);
    } catch {
      // empty
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(productId: number) {
    try {
      await wishlistApi.remove(productId);
      setItems((prev) => prev.filter((i) => i.productId !== productId));
    } catch {}
  }

  async function handleAddToCart(productId: number) {
    try {
      await cartApi.addItem({ productId, quantity: 1 });
      alert("Đã thêm vào giỏ hàng!");
    } catch {
      alert("Không thể thêm vào giỏ hàng");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Sản phẩm yêu thích</h1>

        {items.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center text-gray-500">
            <p className="mb-4">Danh sách yêu thích trống</p>
            <Link href="/" className="text-green-600 hover:underline">
              Khám phá sản phẩm →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div key={item.id} className="bg-white rounded-lg shadow overflow-hidden">
                <Link href={`/product/${item.productId}`}>
                  <div className="h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
                    {item.image ? (
                      <img
                        src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003"}/api/products/${item.productId}/img`}
                        alt={item.productName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-gray-400 text-4xl">🍊</span>
                    )}
                  </div>
                </Link>
                <div className="p-4">
                  <Link href={`/product/${item.productId}`}>
                    <h3 className="font-medium text-gray-800 hover:text-green-600 line-clamp-2">
                      {item.productName}
                    </h3>
                  </Link>
                  <p className="text-lg font-bold text-green-700 mt-1">
                    {Number(item.price).toLocaleString("vi-VN")}₫
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {item.quantity > 0 ? `Còn ${item.quantity} sản phẩm` : "Hết hàng"}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleAddToCart(item.productId)}
                      disabled={item.quantity === 0}
                      className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      Thêm vào giỏ
                    </button>
                    <button
                      onClick={() => handleRemove(item.productId)}
                      className="px-3 py-2 text-red-500 border border-red-200 text-sm rounded-lg hover:bg-red-50"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
