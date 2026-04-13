"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  BadgeCheck,
} from "lucide-react";
import { adminApi, productApi, categoryApi, isLoggedIn, hasRole } from "@/lib/api";
import toast from "react-hot-toast";

interface UserItem {
  id: number;
  email: string;
  fullName?: string;
  roles?: string[];
  createdAt?: string;
}

interface Product {
  id: number;
  productName: string;
  price: number;
  categoryName?: string;
  imageUrl?: string;
  quantity?: number;
}

interface SellerApplication {
  id: number;
  userId: number;
  userEmail: string;
  shopName: string;
  contactEmail?: string;
  contactPhone: string;
  pickupAddress?: string;
  shippingProvider?: string;
  sellerType: "INDIVIDUAL" | "BUSINESS";
  taxCode?: string;
  businessName?: string;
  businessAddress?: string;
  businessLicenseUrl?: string;
  identityFullName?: string;
  identityNumber?: string;
  identityIssueDate?: string;
  identityIssuePlace?: string;
  idCardFrontUrl?: string;
  idCardBackUrl?: string;
  status: "SUBMITTED" | "UNDER_REVIEW" | "NEEDS_REVISION" | "APPROVED" | "REJECTED" | "DRAFT";
  submittedAt?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

type DocumentType = "front" | "back" | "license";

type Tab = "users" | "products" | "seller-applications";

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<UserItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sellerApplications, setSellerApplications] = useState<SellerApplication[]>([]);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ productName: "", price: "", quantity: "100", categoryId: "", description: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [categories, setCategories] = useState<{id: number; name: string}[]>([]);
  const [selectedSellerApplication, setSelectedSellerApplication] = useState<SellerApplication | null>(null);
  const [documentPreviewUrls, setDocumentPreviewUrls] = useState<Record<DocumentType, string>>({
    front: "",
    back: "",
    license: "",
  });
  const [documentMimeTypes, setDocumentMimeTypes] = useState<Record<DocumentType, string>>({
    front: "",
    back: "",
    license: "",
  });

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    if (!hasRole("ADMIN")) { toast.error("Bạn không có quyền truy cập"); router.push("/"); return; }
    loadData();
    categoryApi.getAll().then((res) => {
      const cats = res.data?.data || res.data || [];
      setCategories(Array.isArray(cats) ? cats : []);
    }).catch(() => {});
  }, [tab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === "users") {
        const res = await adminApi.getUsers();
        const data = res.data?.data || res.data || [];
        setUsers(Array.isArray(data) ? data : []);
      } else if (tab === "seller-applications") {
        const res = await adminApi.getSellerApplications();
        const data = res.data?.data || res.data || [];
        setSellerApplications(Array.isArray(data) ? data : []);
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

  const handleReviewSellerApplication = async (id: number, action: "APPROVE" | "NEEDS_REVISION" | "REJECT") => {
    const currentApp = sellerApplications.find((item) => item.id === id);
    const note = action === "APPROVE" ? "" : prompt("Nhập ghi chú cho người dùng:") || "";
    if (action !== "APPROVE" && !note.trim()) {
      toast.error("Vui lòng nhập ghi chú");
      return;
    }
    setReviewingId(id);
    try {
      if (currentApp?.status === "SUBMITTED") {
        await adminApi.startReviewSellerApplication(id);
      }
      await adminApi.reviewSellerApplication(id, action, note);
      toast.success("Đã cập nhật trạng thái hồ sơ");
      await loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Không thể duyệt hồ sơ");
    } finally {
      setReviewingId(null);
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
    if (!newProduct.productName.trim() || !newProduct.price) {
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
        productName: newProduct.productName,
        price: Number(newProduct.price),
        quantity: Number(newProduct.quantity) || 100,
        categoryId: Number(newProduct.categoryId),
        description: newProduct.description,
      }, imageFile);
      toast.success("Đã tạo sản phẩm");
      setShowCreateProduct(false);
      setNewProduct({ productName: "", price: "", quantity: "100", categoryId: "", description: "" });
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

  useEffect(() => {
    let disposed = false;
    const createdUrls: string[] = [];

    setDocumentPreviewUrls({ front: "", back: "", license: "" });
    setDocumentMimeTypes({ front: "", back: "", license: "" });

    if (!selectedSellerApplication) {
      return () => {
        disposed = true;
      };
    }

    (async () => {
      const nextUrls: Record<DocumentType, string> = { front: "", back: "", license: "" };
      const nextMimes: Record<DocumentType, string> = { front: "", back: "", license: "" };

      const tasks: Array<{ type: DocumentType; url?: string }> = [
        { type: "front", url: selectedSellerApplication.idCardFrontUrl },
        { type: "back", url: selectedSellerApplication.idCardBackUrl },
        { type: "license", url: selectedSellerApplication.businessLicenseUrl },
      ];

      for (const task of tasks) {
        if (!task.url) continue;
        try {
          const res = await adminApi.getSellerApplicationDocument(selectedSellerApplication.id, task.type);
          const blob = res.data as Blob;
          const objectUrl = URL.createObjectURL(blob);
          createdUrls.push(objectUrl);
          nextUrls[task.type] = objectUrl;
          nextMimes[task.type] = blob.type || "";
        } catch {
          nextUrls[task.type] = "";
          nextMimes[task.type] = "";
        }
      }

      if (disposed) {
        createdUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      setDocumentPreviewUrls(nextUrls);
      setDocumentMimeTypes(nextMimes);
    })();

    return () => {
      disposed = true;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedSellerApplication]);

  const isImageFile = (url?: string, mimeType?: string) => {
    if (mimeType?.startsWith("image/")) return true;
    if (!url) return false;
    const lowered = url.toLowerCase();
    return lowered.includes(".jpg") || lowered.includes(".jpeg") || lowered.includes(".png") || lowered.includes(".webp");
  };

  const renderDocumentPreview = (label: string, originalUrl: string | undefined, type: DocumentType) => {
    const previewUrl = documentPreviewUrls[type];
    const mimeType = documentMimeTypes[type];
    const displayUrl = previewUrl || originalUrl;

    if (!displayUrl) {
      return (
        <div className="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-400">
          {label}: Chưa có tài liệu
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-gray-200 p-3">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-sm font-medium text-gray-700">{label}</p>
          <a
            href={displayUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 hover:text-blue-700 underline"
          >
            Mở tài liệu
          </a>
        </div>
        {isImageFile(displayUrl, mimeType) ? (
          <img src={displayUrl} alt={label} className="w-full h-48 object-cover rounded-lg border border-gray-100" />
        ) : (
          <div className="h-20 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-sm text-gray-500">
            Tài liệu PDF - bấm "Mở tài liệu" để xem
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-7 h-7 text-primary-600" />
        <h1 className="text-2xl font-bold text-gray-800">Quản trị hệ thống</h1>
        <Link href="/admin/analytics" className="ml-auto flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
          📊 Thống kê & Phân tích
        </Link>
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
        <button
          onClick={() => setTab("seller-applications")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
            tab === "seller-applications" ? "bg-white text-primary-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <BadgeCheck className="w-4 h-4" /> Duyệt người bán
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
                          user.roles?.includes("ADMIN") ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
                        }`}>
                          {user.roles?.includes("ADMIN") ? "ADMIN" : user.roles?.includes("SELLER") ? "SELLER" : "USER"}
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
      ) : tab === "products" ? (
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
                    value={newProduct.productName}
                    onChange={(e) => setNewProduct({ ...newProduct, productName: e.target.value })}
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
                    type="number"
                    value={newProduct.quantity}
                    onChange={(e) => setNewProduct({ ...newProduct, quantity: e.target.value })}
                    placeholder="Số lượng"
                    className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
                  />
                  <select
                    value={newProduct.categoryId}
                    onChange={(e) => setNewProduct({ ...newProduct, categoryId: e.target.value })}
                    className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
                  >
                    <option value="">Chọn danh mục</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
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
                                <img src={product.imageUrl} alt={product.productName} className="w-full h-full object-cover" />
                              ) : (
                                <Leaf className="w-4 h-4 text-gray-300" />
                              )}
                            </div>
                            <span className="font-medium text-gray-800">{product.productName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-gray-700">{formatPrice(product.price)}</td>
                        <td className="py-3 px-4 text-gray-500">{product.categoryName || "—"}</td>
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
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="text-left py-3 px-4 font-semibold">#</th>
                  <th className="text-left py-3 px-4 font-semibold">Người dùng</th>
                  <th className="text-left py-3 px-4 font-semibold">Shop</th>
                  <th className="text-left py-3 px-4 font-semibold">Loại hình</th>
                  <th className="text-left py-3 px-4 font-semibold">Trạng thái</th>
                  <th className="text-left py-3 px-4 font-semibold">Ghi chú</th>
                  <th className="text-center py-3 px-4 font-semibold">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {sellerApplications.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-gray-400">Chưa có hồ sơ đăng ký người bán</td>
                  </tr>
                ) : (
                  sellerApplications.map((app) => (
                    <tr key={app.id} className="border-t hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-500">#{app.id}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-800">{app.userEmail}</div>
                        <div className="text-xs text-gray-400">UID: {app.userId}</div>
                      </td>
                      <td className="py-3 px-4 text-gray-700">{app.shopName}</td>
                      <td className="py-3 px-4 text-gray-600">{app.sellerType === "BUSINESS" ? "Doanh nghiệp" : "Cá nhân"}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          app.status === "APPROVED"
                            ? "bg-green-100 text-green-700"
                            : app.status === "REJECTED"
                            ? "bg-red-100 text-red-700"
                            : app.status === "NEEDS_REVISION"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {app.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-xs max-w-xs">{app.reviewNote || "-"}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedSellerApplication(app)}
                            className="px-2 py-1 text-xs rounded bg-slate-600 text-white hover:bg-slate-700"
                          >
                            Xem hồ sơ
                          </button>
                          <button
                            disabled={reviewingId === app.id || app.status === "APPROVED"}
                            onClick={() => handleReviewSellerApplication(app.id, "APPROVE")}
                            className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            Duyệt
                          </button>
                          <button
                            disabled={reviewingId === app.id || app.status === "APPROVED"}
                            onClick={() => handleReviewSellerApplication(app.id, "NEEDS_REVISION")}
                            className="px-2 py-1 text-xs rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                          >
                            Bổ sung
                          </button>
                          <button
                            disabled={reviewingId === app.id || app.status === "APPROVED"}
                            onClick={() => handleReviewSellerApplication(app.id, "REJECT")}
                            className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Từ chối
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
      )}

      {selectedSellerApplication && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedSellerApplication(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg">Chi tiết hồ sơ người bán #{selectedSellerApplication.id}</h3>
              <button onClick={() => setSelectedSellerApplication(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Thông tin shop</p>
                <p className="text-sm text-gray-700"><span className="font-medium">Shop:</span> {selectedSellerApplication.shopName}</p>
                <p className="text-sm text-gray-700"><span className="font-medium">Email:</span> {selectedSellerApplication.contactEmail || selectedSellerApplication.userEmail}</p>
                <p className="text-sm text-gray-700"><span className="font-medium">SĐT:</span> {selectedSellerApplication.contactPhone || "-"}</p>
                <p className="text-sm text-gray-700"><span className="font-medium">Địa chỉ lấy hàng:</span> {selectedSellerApplication.pickupAddress || "-"}</p>
                <p className="text-sm text-gray-700"><span className="font-medium">Đơn vị VC:</span> {selectedSellerApplication.shippingProvider || "-"}</p>
              </div>

              <div className="rounded-xl bg-gray-50 p-4 border border-gray-100">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Thông tin định danh</p>
                <p className="text-sm text-gray-700"><span className="font-medium">Họ tên:</span> {selectedSellerApplication.identityFullName || "-"}</p>
                <p className="text-sm text-gray-700"><span className="font-medium">Số giấy tờ:</span> {selectedSellerApplication.identityNumber || "-"}</p>
                <p className="text-sm text-gray-700"><span className="font-medium">Ngày cấp:</span> {selectedSellerApplication.identityIssueDate ? new Date(selectedSellerApplication.identityIssueDate).toLocaleDateString("vi-VN") : "-"}</p>
                <p className="text-sm text-gray-700"><span className="font-medium">Nơi cấp:</span> {selectedSellerApplication.identityIssuePlace || "-"}</p>
                <p className="text-sm text-gray-700"><span className="font-medium">Trạng thái:</span> {selectedSellerApplication.status}</p>
              </div>

              <div className="rounded-xl bg-gray-50 p-4 border border-gray-100 md:col-span-2">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Thông tin thuế/doanh nghiệp</p>
                <p className="text-sm text-gray-700"><span className="font-medium">Loại hình:</span> {selectedSellerApplication.sellerType === "BUSINESS" ? "Doanh nghiệp" : "Cá nhân"}</p>
                <p className="text-sm text-gray-700"><span className="font-medium">MST:</span> {selectedSellerApplication.taxCode || "-"}</p>
                <p className="text-sm text-gray-700"><span className="font-medium">Tên doanh nghiệp:</span> {selectedSellerApplication.businessName || "-"}</p>
                <p className="text-sm text-gray-700"><span className="font-medium">Địa chỉ doanh nghiệp:</span> {selectedSellerApplication.businessAddress || "-"}</p>
                <p className="text-sm text-gray-700"><span className="font-medium">Ghi chú admin:</span> {selectedSellerApplication.reviewNote || "-"}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {renderDocumentPreview("CCCD mặt trước", selectedSellerApplication.idCardFrontUrl, "front")}
              {renderDocumentPreview("CCCD mặt sau", selectedSellerApplication.idCardBackUrl, "back")}
              {renderDocumentPreview("Giấy phép kinh doanh", selectedSellerApplication.businessLicenseUrl, "license")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
