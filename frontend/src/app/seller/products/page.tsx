"use client";
import { useEffect, useState } from "react";
import { sellerApi } from "@/lib/api";
import Link from "next/link";
import { Sparkles } from "lucide-react";

interface SellerProduct {
  id: number;
  productName: string;
  price: number;
  quantity: number;
  rating: number;
  ratingCount: number;
  category: string | null;
  description: string;
  shelfLifeDays: number | null;
  batchId: string | null;
  origin: string | null;
  imageUrl: string | null;
}

export default function SellerProductsPage() {
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStock, setEditingStock] = useState<{ id: number; quantity: number } | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const res = await sellerApi.getProducts();
      setProducts(res.data);
    } catch {
      alert("Không thể tải danh sách sản phẩm");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Bạn có chắc muốn xóa "${name}"?`)) return;
    try {
      await sellerApi.deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.message || "Không thể xóa sản phẩm");
    }
  }

  async function handleUpdateStock(id: number) {
    if (!editingStock) return;
    try {
      await sellerApi.updateStock(id, editingStock.quantity);
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, quantity: editingStock.quantity } : p))
      );
      setEditingStock(null);
    } catch (err: any) {
      alert(err.response?.data?.message || "Không thể cập nhật tồn kho");
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
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Quản lý Sản phẩm</h1>
          <div className="flex gap-3">
            <Link
              href="/seller/dashboard"
              className="px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
            >
              ← Dashboard
            </Link>
            <Link
              href="/seller/products/create"
              className="px-4 py-2 text-green-600 bg-white border border-green-600 rounded-lg hover:bg-green-50"
            >
              + Tạo thủ công
            </Link>
            <Link
              href="/seller/create-post"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> AI Tạo sản phẩm
            </Link>
          </div>
        </div>

        {products.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center">
            <p className="text-gray-500 mb-4">Bạn chưa có sản phẩm nào</p>
            <Link
              href="/seller/create-post"
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Tạo sản phẩm đầu tiên
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sản phẩm</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Danh mục</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Giá</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tồn kho</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Đánh giá</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.imageUrl && (
                          <img
                            src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003"}${p.imageUrl}`}
                            alt={p.productName}
                            className="w-12 h-12 rounded object-cover"
                          />
                        )}
                        <div>
                          <Link href={`/product/${p.id}`} className="text-sm font-medium text-gray-900 hover:text-green-600">
                            {p.productName}
                          </Link>
                          {p.batchId && (
                            <p className="text-xs text-gray-400">Batch: {p.batchId}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{p.category || "—"}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {Number(p.price).toLocaleString("vi-VN")}₫
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingStock?.id === p.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            min={0}
                            value={editingStock.quantity}
                            onChange={(e) =>
                              setEditingStock({ id: p.id, quantity: parseInt(e.target.value) || 0 })
                            }
                            className="w-20 px-2 py-1 border rounded text-sm text-right"
                          />
                          <button
                            onClick={() => handleUpdateStock(p.id)}
                            className="text-green-600 hover:text-green-800 text-sm"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => setEditingStock(null)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <span
                          className={`text-sm cursor-pointer ${p.quantity === 0 ? "text-red-500 font-bold" : "text-gray-700"}`}
                          onClick={() => setEditingStock({ id: p.id, quantity: p.quantity })}
                          title="Click để chỉnh sửa"
                        >
                          {p.quantity} {p.quantity === 0 && "⚠️"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm text-yellow-500">★ {Number(p.rating).toFixed(1)}</span>
                      <span className="text-xs text-gray-400 ml-1">({p.ratingCount})</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/product/${p.id}`}
                          className="text-blue-500 hover:text-blue-700 text-sm"
                          title="Xem"
                        >
                          👁
                        </Link>
                        <button
                          onClick={() => handleDelete(p.id, p.productName)}
                          className="text-red-500 hover:text-red-700 text-sm"
                          title="Xóa"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-500">
          Tổng: {products.length} sản phẩm · {products.filter((p) => p.quantity === 0).length} hết hàng
        </div>
      </div>
    </div>
  );
}
