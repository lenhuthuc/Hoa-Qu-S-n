"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2, Package, Tag, Leaf, QrCode, ImageIcon } from "lucide-react";
import { sellerApi, categoryApi } from "@/lib/api";
import { shareToFacebookDialog } from "@/lib/facebookShare";
import toast from "react-hot-toast";

interface CategoryOption {
  id: number;
  name: string;
}

export default function ManualCreateProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [postToFacebook, setPostToFacebook] = useState(false);
  
  const [formData, setFormData] = useState({
    productName: "",
    price: 0,
    unitWeightGrams: 500,
    totalStockWeightKg: 100,
    categoryId: 0,
    description: "",
    batchId: "",
    origin: "",
    shelfLifeDays: 30
  });

  const calculatedQuantity =
    formData.unitWeightGrams > 0 && formData.totalStockWeightKg > 0
      ? Math.floor((formData.totalStockWeightKg * 1000) / formData.unitWeightGrams)
      : 0;

  const loadCategories = useCallback(async (maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await categoryApi.getAll();
        const cats = res.data?.data || res.data || [];
        setCategories(Array.isArray(cats) ? cats : []);
        return;
      } catch {
        if (attempt === maxRetries) {
          toast.error("Không tải được danh mục. Vui lòng tải lại trang.");
          setCategories([]);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 600));
      }
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productName || formData.price <= 0 || !formData.categoryId) {
      toast.error("Vui lòng nhập đầy đủ thông tin bắt buộc");
      return;
    }
    if (formData.unitWeightGrams <= 0 || formData.totalStockWeightKg <= 0 || calculatedQuantity <= 0) {
      toast.error("Thông tin trọng lượng chưa hợp lệ để tạo tồn kho");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        quantity: calculatedQuantity,
        batchId: formData.batchId || undefined,
        origin: formData.origin || undefined
      };

      // Bước 1: Tạo sản phẩm (không publish lên Facebook)
      const createRes = await sellerApi.createProduct(payload, image || undefined);
      const createdProduct = createRes.data?.data || createRes.data;
      const productId = createdProduct?.productId || Date.now();
      
      toast.success("✅ Tạo sản phẩm thành công!");

      // Bước 2: Nếu user tick "Đăng cùng Facebook", mở Share Dialog
      if (postToFacebook) {
        const shared = await shareToFacebookDialog({
          productId,
          productName: formData.productName,
          price: formData.price,
        });

        if (shared) {
          toast.success("✅ Đã share lên Facebook thành công!");
        } else {
          toast.success("✅ Bỏ qua share Facebook - sản phẩm đã được tạo");
        }
      }
      
      router.push("/seller/products");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Lỗi khi tạo sản phẩm");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-500 hover:text-green-600 mb-6 font-medium transition"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-green-600 px-8 py-6 text-white">
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Package className="w-7 h-7" /> Tạo sản phẩm thủ công
            </h1>
            <p className="text-green-100 mt-1">Nhập thông tin chi tiết cho nông sản của bạn</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {/* Image Upload Area */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Hình ảnh sản phẩm
              </label>
              <label className="relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:bg-gray-50 transition overflow-hidden">
                {preview ? (
                  <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center">
                    <ImageIcon className="w-10 h-10 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500">Chọn hoặc kéo ảnh vào đây</span>
                  </div>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setImage(file);
                      setPreview(URL.createObjectURL(file));
                    }
                  }}
                />
              </label>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Basic Info */}
              <div className="space-y-4 md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wider">
                  Tên sản phẩm *
                </label>
                <div className="relative">
                  <Tag className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    required
                    type="text"
                    value={formData.productName}
                    onChange={(e) => setFormData({...formData, productName: e.target.value})}
                    placeholder="VD: Dưa hấu Long An loại 1"
                    className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wider">
                  Giá bán (VNĐ/kg) *
                </label>
                <input
                  required
                  type="number"
                  min={0}
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: parseInt(e.target.value) || 0})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition"
                />
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wider">
                  Trọng lượng mỗi sản phẩm (gram) *
                </label>
                <input
                  required
                  type="number"
                  min={1}
                  value={formData.unitWeightGrams}
                  onChange={(e) => setFormData({...formData, unitWeightGrams: parseInt(e.target.value) || 0})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition"
                />
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wider">
                  Tổng trọng lượng hàng có (kg) *
                </label>
                <input
                  required
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={formData.totalStockWeightKg}
                  onChange={(e) => setFormData({...formData, totalStockWeightKg: parseFloat(e.target.value) || 0})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition"
                />
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wider">
                  Tồn kho tự tính (đơn vị)
                </label>
                <input
                  readOnly
                  value={calculatedQuantity}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-700 font-semibold outline-none"
                />
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wider">
                  Danh mục *
                </label>
                <select
                  required
                  value={formData.categoryId}
                  onChange={(e) => setFormData({...formData, categoryId: parseInt(e.target.value)})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition bg-white"
                >
                  <option value={0}>Chọn danh mục</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wider">
                  Hạn sử dụng (Ngày)
                </label>
                <input
                  type="number"
                  min={1}
                  value={formData.shelfLifeDays}
                  onChange={(e) => setFormData({...formData, shelfLifeDays: parseInt(e.target.value) || 30})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition"
                />
              </div>

              <div className="space-y-4 md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wider">
                  Mô tả sản phẩm
                </label>
                <textarea
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Mô tả đặc điểm, cách bảo quản..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition resize-none"
                />
              </div>

              {/* Traceability */}
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 uppercase tracking-wider">
                  <QrCode className="w-4 h-4" /> Mã lô hàng
                </label>
                <input
                  type="text"
                  value={formData.batchId}
                  onChange={(e) => setFormData({...formData, batchId: e.target.value})}
                  placeholder="Mã truy xuất (tùy chọn)"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition"
                />
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 uppercase tracking-wider">
                  <Leaf className="w-4 h-4" /> Xuất xứ
                </label>
                <input
                  type="text"
                  value={formData.origin}
                  onChange={(e) => setFormData({...formData, origin: e.target.value})}
                  placeholder="Vùng trồng (tùy chọn)"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition"
                />
              </div>
            </div>

            {/* Facebook Sync Section */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-6 space-y-4">
              <label className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer hover:text-slate-900">
                <input
                  type="checkbox"
                  checked={postToFacebook}
                  onChange={(e) => setPostToFacebook(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="font-semibold">Đăng bài lên Facebook sau khi tạo sản phẩm</span>
              </label>
              {postToFacebook && (
                <p className="text-xs text-blue-600 ml-7">
                  ℹ️ Sau khi lưu sản phẩm, bạn sẽ được mở popup để share lên Facebook
                </p>
              )}
            </div>

            <div className="pt-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition flex items-center justify-center gap-2 shadow-lg shadow-green-100 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                Tạo sản phẩm ngay
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
