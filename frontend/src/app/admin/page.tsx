"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  Users,
  Package,
  Loader2,
  Trash2,
  Eye,
  Plus,
  Search,
  Leaf,
  X,
} from "lucide-react";
import { adminApi, productApi, isLoggedIn, hasRole } from "@/lib/api";
import toast from "react-hot-toast";

interface UserItem {
  id: number;
  email: string;
  fullName?: string;
  role?: string;
  createdAt?: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
  category?: string;
  imageUrl?: string;
  stock?: number;
}

type Tab = "users" | "products";

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<UserItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", price: "", category: "", description: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    if (!hasRole("ADMIN")) { toast.error("Bạn không có quyền truy cập"); router.push("/"); return; }
    loadData();
  }, [tab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === "users") {
        const res = await adminApi.getUsers();
        const data = res.data?.data || res.data || [];
        setUsers(Array.isArray(data) ? data : []);
      } else {
        const res = await productApi.getAll();
        const data = res.data?.data || res.data || [];
        setProducts(Array.isArray(data) ? data : []);
      }
    } catch {
      toast.error("Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm("Xác nhận xóa người dùng này?")) return;
    try {
      await adminApi.deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success("Đã xóa người dùng");
    } catch {
      toast.error("Lỗi xóa người dùng");
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm("Xác nhận xóa sản phẩm này?")) return;
    try {
      await adminApi.deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast.success("Đã xóa sản phẩm");
    } catch {
      toast.error("Lỗi xóa sản phẩm");
    }
  };

  const handleCreateProduct = async () => {
    if (!newProduct.name.trim() || !newProduct.price) {
      toast.error("Vui lòng nhập tên và giá sản phẩm");
      return;
    }
    if (!imageFile) {
      toast.error("Vui lòng chọn ảnh sản phẩm");
      return;
    }
    setCreating(true);
    try {
      await adminApi.createProduct({
        name: newProduct.name,
        price: Number(newProduct.price),
        category: newProduct.category,
        description: newProduct.description,
      }, imageFile);
      toast.success("Đã tạo sản phẩm");
      setShowCreateProduct(false);
      setNewProduct({ name: "", price: "", category: "", description: "" });
      setImageFile(null);
      if (tab === "products") loadData();
    } catch {
      toast.error("Lỗi tạo sản phẩm");
    } finally {
      setCreating(false);
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-7 h-7 text-primary-600" />
        <h1 className="text-2xl font-bold text-gray-800">Quản trị hệ thống</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("users")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
            tab === "users" ? "bg-white text-primary-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Users className="w-4 h-4" /> Người dùng
        </button>
        <button
          onClick={() => setTab("products")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
            tab === "products" ? "bg-white text-primary-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Package className="w-4 h-4" /> Sản phẩm
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : tab === "users" ? (
        /* Users Tab */
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="text-left py-3 px-4 font-semibold">ID</th>
                  <th className="text-left py-3 px-4 font-semibold">Email</th>
                  <th className="text-left py-3 px-4 font-semibold">Họ tên</th>
                  <th className="text-left py-3 px-4 font-semibold">Vai trò</th>
                  <th className="text-left py-3 px-4 font-semibold">Ngày tạo</th>
                  <th className="text-center py-3 px-4 font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-400">
                      Không có người dùng
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-t hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-500">#{user.id}</td>
                      <td className="py-3 px-4 font-medium text-gray-800">{user.email}</td>
                      <td className="py-3 px-4 text-gray-600">{user.fullName || "—"}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          user.role === "ADMIN" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
                        }`}>
                          {user.role || "USER"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-xs">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString("vi-VN") : "—"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Products Tab */
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowCreateProduct(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Thêm sản phẩm
            </button>
          </div>

          {/* Create product modal */}
          {showCreateProduct && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateProduct(false)}>
              <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800">Thêm sản phẩm mới</h3>
                  <button onClick={() => setShowCreateProduct(false)} className="p-1 text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-3">
                  <input
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    placeholder="Tên sản phẩm"
                    className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
                  />
                  <input
                    type="number"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                    placeholder="Giá (VND)"
                    className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
                  />
                  <input
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    placeholder="Danh mục"
                    className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
                  />
                  <textarea
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                    placeholder="Mô tả sản phẩm"
                    rows={3}
                    className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-300 outline-none resize-none"
                  />
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Ảnh sản phẩm</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                      className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary-50 file:text-primary-600 file:font-medium hover:file:bg-primary-100"
                    />
                  </div>
                  <button
                    onClick={handleCreateProduct}
                    disabled={creating}
                    className="w-full py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Tạo sản phẩm
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="text-left py-3 px-4 font-semibold">Sản phẩm</th>
                    <th className="text-right py-3 px-4 font-semibold">Giá</th>
                    <th className="text-left py-3 px-4 font-semibold">Danh mục</th>
                    <th className="text-center py-3 px-4 font-semibold">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-gray-400">
                        Không có sản phẩm
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => (
                      <tr key={product.id} className="border-t hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {product.imageUrl ? (
                                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                              ) : (
                                <Leaf className="w-4 h-4 text-gray-300" />
                              )}
                            </div>
                            <span className="font-medium text-gray-800">{product.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-gray-700">{formatPrice(product.price)}</td>
                        <td className="py-3 px-4 text-gray-500">{product.category || "—"}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => router.push(`/product/${product.id}`)}
                              className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition"
                              title="Xem"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
