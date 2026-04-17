"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Save, Loader2, Tag, Leaf, QrCode, ImageIcon, Upload, BarChart3, Sparkles } from "lucide-react";
import { sellerApi, categoryApi, aiApi, facebookApi } from "@/lib/api";
import toast from "react-hot-toast";

interface CategoryOption {
  id: number;
  name: string;
}

interface FacebookPage {
  pageId: string;
  pageName: string;
  connectedAt: string;
}

export default function ManualCreateProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [facebookPages, setFacebookPages] = useState<FacebookPage[]>([]);
  const [postToFacebook, setPostToFacebook] = useState(false);
  const [facebookPageId, setFacebookPageId] = useState("");
  const [facebookMessage, setFacebookMessage] = useState("");
  const [connectingFacebook, setConnectingFacebook] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [unitWeightUnit, setUnitWeightUnit] = useState<"g" | "kg">("g");
  const [totalStockUnit, setTotalStockUnit] = useState<"g" | "kg">("kg");
  const [unitWeightInput, setUnitWeightInput] = useState("500");
  const [totalStockInput, setTotalStockInput] = useState("100");
  const prevPreviewRef = useRef<string | null>(null);
  
  const [formData, setFormData] = useState({
    productName: "",
    price: "",
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

  const parseDecimalInput = (value: string) => {
    const normalized = value.replace(",", ".").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const handleUnitWeightInputChange = (raw: string) => {
    if (!/^\d*([.,]\d*)?$/.test(raw)) return;
    setUnitWeightInput(raw);

    if (raw.trim() === "") {
      setFormData((prev) => ({ ...prev, unitWeightGrams: 0 }));
      return;
    }

    const parsed = parseDecimalInput(raw);
    if (parsed === null || parsed < 0) return;

    const grams = unitWeightUnit === "g" ? parsed : parsed * 1000;
    setFormData((prev) => ({ ...prev, unitWeightGrams: Math.max(0, Math.round(grams)) }));
  };

  const handleTotalStockInputChange = (raw: string) => {
    if (!/^\d*([.,]\d*)?$/.test(raw)) return;
    setTotalStockInput(raw);

    if (raw.trim() === "") {
      setFormData((prev) => ({ ...prev, totalStockWeightKg: 0 }));
      return;
    }

    const parsed = parseDecimalInput(raw);
    if (parsed === null || parsed < 0) return;

    const kilograms = totalStockUnit === "kg" ? parsed : parsed / 1000;
    setFormData((prev) => ({ ...prev, totalStockWeightKg: Math.max(0, Number(kilograms.toFixed(3))) }));
  };

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

    facebookApi.getPages()
      .then((res) => {
        const pages = res.data?.data || res.data || [];
        if (Array.isArray(pages)) {
          setFacebookPages(pages);
          if (pages.length > 0) {
            setFacebookPageId(pages[0].pageId);
          }
        }
      })
      .catch(() => {});
  }, [loadCategories]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) return;

    const connect = async () => {
      try {
        const redirectUri = `${window.location.origin}/seller/products/create`;
        await facebookApi.handleOAuthCallback(code, redirectUri);
        const pagesRes = await facebookApi.getPages();
        const pages = pagesRes.data?.data || pagesRes.data || [];
        if (Array.isArray(pages)) {
          setFacebookPages(pages);
          if (pages.length > 0) setFacebookPageId(pages[0].pageId);
        }
        toast.success("Kết nối Facebook Page thành công");
      } catch {
        toast.error("Không thể xử lý callback Facebook");
      } finally {
        router.replace("/seller/products/create");
      }
    };

    void connect();
  }, [router]);

  useEffect(() => {
    if (formData.categoryId || categories.length === 0) return;
    setFormData((prev) => ({ ...prev, categoryId: categories[0].id }));
  }, [categories, formData.categoryId]);

  useEffect(() => {
    const displayed = unitWeightUnit === "g"
      ? formData.unitWeightGrams
      : formData.unitWeightGrams / 1000;
    setUnitWeightInput(String(displayed));
  }, [unitWeightUnit, formData.unitWeightGrams]);

  useEffect(() => {
    const displayed = totalStockUnit === "kg"
      ? formData.totalStockWeightKg
      : formData.totalStockWeightKg * 1000;
    setTotalStockInput(String(displayed));
  }, [totalStockUnit, formData.totalStockWeightKg]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = Number(formData.price);
    const resolvedCategoryId = formData.categoryId || categories[0]?.id || 0;
    if (!formData.productName || !Number.isFinite(parsedPrice) || parsedPrice <= 0 || !resolvedCategoryId) {
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
        price: parsedPrice,
        categoryId: resolvedCategoryId,
        quantity: calculatedQuantity,
        batchId: formData.batchId || undefined,
        origin: formData.origin || undefined
      };

      if (postToFacebook) {
        if (!facebookPageId) {
          toast.error("Vui lòng chọn Facebook Page trước khi đăng đồng bộ");
          return;
        }
        if (!image) {
          toast.error("Cần ảnh sản phẩm để đăng đồng bộ Facebook");
          return;
        }

        const createRes = await aiApi.createProductWithFacebook(
          payload,
          image,
          facebookPageId,
          facebookMessage || formData.productName
        );

        const dbSuccess = Boolean(createRes.data?.databaseSuccess);
        const facebookSuccess = Boolean(createRes.data?.facebookSuccess);

        if (dbSuccess && facebookSuccess) {
          toast.success("Đã tạo sản phẩm và đồng bộ Facebook thành công");
        } else if (dbSuccess && !facebookSuccess) {
          toast.success("Đã tạo sản phẩm, nhưng Facebook đăng bài thất bại");
        } else if (!dbSuccess && facebookSuccess) {
          toast.error("Facebook đăng bài thành công, nhưng lưu DB thất bại");
          return;
        } else {
          toast.error("Cả lưu DB và đăng Facebook đều thất bại");
          return;
        }
      } else {
        await sellerApi.createProduct(payload, image || undefined);
        toast.success("Tạo sản phẩm thành công!");
      }
      router.push("/seller/products");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Lỗi khi tạo sản phẩm");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectFacebook = async () => {
    try {
      setConnectingFacebook(true);
      const redirectUri = `${window.location.origin}/seller/products/create`;
      const res = await facebookApi.getOAuthUrl(redirectUri);
      const oauthUrl = res.data?.oauthUrl || res.data?.data?.oauthUrl;
      if (!oauthUrl) {
        toast.error("Không lấy được URL xác thực Facebook");
        return;
      }
      window.location.href = oauthUrl;
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Không thể khởi tạo Facebook OAuth");
    } finally {
      setConnectingFacebook(false);
    }
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (prevPreviewRef.current) {
      URL.revokeObjectURL(prevPreviewRef.current);
    }

    const url = URL.createObjectURL(file);
    prevPreviewRef.current = url;
    setImage(file);
    setPreview(url);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-blobs py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto mb-10 text-center animate-float relative">
        <button
          onClick={() => router.back()}
          className="absolute left-0 top-0 text-gray-500 hover:text-primary-600 flex items-center gap-1 font-medium bg-white/60 px-4 py-2 rounded-xl backdrop-blur-md border border-white/50"
        >
          <ArrowRight className="w-4 h-4 rotate-180" /> Quay lại
        </button>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 backdrop-blur-md border border-white/50 text-primary-700 shadow-sm mb-4">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-medium tracking-wide uppercase">Manual Create</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-4 tracking-tight">
          Tạo sản phẩm <span className="text-gradient">Thủ Công</span>
        </h1>
        <p className="text-slate-600 max-w-2xl mx-auto text-lg">
          Điền thông tin đầy đủ và đăng bán ngay.
        </p>
      </div>

      <div className="max-w-6xl mx-auto grid lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 w-full">
          <div className="glass-panel rounded-3xl p-8 relative overflow-hidden group transition-all duration-300 hover:shadow-xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-400 to-accent-400"></div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600">
                <span className="font-bold text-lg">1</span>
              </div>
              <h2 className="text-xl font-semibold text-slate-800">Tải ảnh sản phẩm</h2>
            </div>

            <label className={`relative block w-full aspect-square md:aspect-auto md:h-80 rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden ${preview ? "border-primary-400 bg-black/5" : "border-slate-300 bg-white/50 hover:bg-white hover:border-primary-400"}`}>
              <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
              {preview ? (
                <>
                  <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                    <p className="text-white font-medium flex items-center gap-2">
                      <ImageIcon className="w-5 h-5" /> Đổi ảnh khác
                    </p>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                  <div className="w-20 h-20 rounded-full bg-primary-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                    <Upload className="w-8 h-8 text-primary-500" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-700 mb-1">Kéo thả ảnh vào đây</h3>
                  <p className="text-sm">Hỗ trợ JPG, PNG (tối đa 20MB)</p>
                </div>
              )}
            </label>
          </div>
        </div>

        <div className="lg:col-span-7 w-full">
          <div className="glass-panel rounded-3xl p-8 min-h-[500px] transition-all duration-500">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-full bg-accent-100 flex items-center justify-center text-accent-600">
                <span className="font-bold text-lg">2</span>
              </div>
              <h2 className="text-xl font-semibold text-slate-800">Thông tin sản phẩm</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="group">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
                  <Tag className="w-4 h-4" /> Tên sản phẩm *
                </label>
                <input
                  required
                  type="text"
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  placeholder="VD: Dưa hấu Long An loại 1"
                  className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium focus:ring-2 focus:ring-primary-400 focus:border-transparent outline-none transition-all shadow-sm"
                />
              </div>

              <div className="group">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
                  <Save className="w-4 h-4" /> Giá bán sản phẩm *
                </label>
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.price}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (!/^\d*$/.test(raw)) return;
                    setFormData({ ...formData, price: raw });
                  }}
                  placeholder="Nhập giá bán"
                  className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium focus:ring-2 focus:ring-primary-400 focus:border-transparent outline-none transition-all shadow-sm"
                />
              </div>

              <div className="group">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
                  <BarChart3 className="w-4 h-4" /> Trọng lượng / sản phẩm *
                </label>
                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <input
                    required
                    type="text"
                    inputMode="decimal"
                    value={unitWeightInput}
                    onChange={(e) => handleUnitWeightInputChange(e.target.value)}
                    placeholder={unitWeightUnit === "g" ? "VD: 500" : "VD: 0.5"}
                    className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium focus:ring-2 focus:ring-primary-400 focus:border-transparent outline-none transition-all shadow-sm"
                  />
                  <select
                    value={unitWeightUnit}
                    onChange={(e) => setUnitWeightUnit(e.target.value as "g" | "kg")}
                    className="w-28 bg-white/60 border border-slate-200 rounded-xl px-3 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-primary-400 outline-none transition-all shadow-sm"
                  >
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>

              <div className="group">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
                  <BarChart3 className="w-4 h-4" /> Hàng tồn kho (theo trọng lượng) *
                </label>
                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <input
                    required
                    type="text"
                    inputMode="decimal"
                    value={totalStockInput}
                    onChange={(e) => handleTotalStockInputChange(e.target.value)}
                    placeholder={totalStockUnit === "kg" ? "VD: 100" : "VD: 100000"}
                    className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium focus:ring-2 focus:ring-primary-400 focus:border-transparent outline-none transition-all shadow-sm"
                  />
                  <select
                    value={totalStockUnit}
                    onChange={(e) => setTotalStockUnit(e.target.value as "g" | "kg")}
                    className="w-28 bg-white/60 border border-slate-200 rounded-xl px-3 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-primary-400 outline-none transition-all shadow-sm"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
                    <BarChart3 className="w-4 h-4" /> Tồn kho tự tính (đơn vị)
                  </label>
                  <input
                    readOnly
                    value={calculatedQuantity}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-semibold outline-none cursor-default"
                  />
                </div>

                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
                    <Leaf className="w-4 h-4" /> Hạn sử dụng (ngày)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.shelfLifeDays}
                    onChange={(e) => setFormData({ ...formData, shelfLifeDays: parseInt(e.target.value, 10) || 30 })}
                    className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium focus:ring-2 focus:ring-primary-400 focus:border-transparent outline-none transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-semibold text-blue-700 uppercase tracking-wider">
                    Đồng bộ Facebook Page
                  </label>
                  <button
                    type="button"
                    onClick={handleConnectFacebook}
                    disabled={connectingFacebook}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-60"
                  >
                    {connectingFacebook ? "Đang kết nối..." : "Kết nối Facebook"}
                  </button>
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={postToFacebook}
                    onChange={(e) => setPostToFacebook(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Đăng bài cùng Facebook khi tạo sản phẩm
                </label>

                {postToFacebook && (
                  <div className="grid md:grid-cols-2 gap-3">
                    <select
                      value={facebookPageId}
                      onChange={(e) => setFacebookPageId(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 focus:ring-2 focus:ring-blue-400 outline-none"
                    >
                      <option value="">Chọn Facebook Page</option>
                      {facebookPages.map((p) => (
                        <option key={p.pageId} value={p.pageId}>{p.pageName} ({p.pageId})</option>
                      ))}
                    </select>
                    <input
                      value={facebookMessage}
                      onChange={(e) => setFacebookMessage(e.target.value)}
                      placeholder="Nội dung đăng FB (để trống sẽ tự tạo)"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 focus:ring-2 focus:ring-blue-400 outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="group">
                <label className="text-sm font-medium text-slate-500 mb-1.5 uppercase tracking-wider block">
                  Mô tả sản phẩm
                </label>
                <textarea
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Mô tả đặc điểm, cách bảo quản..."
                  className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 leading-relaxed focus:ring-2 focus:ring-primary-400 focus:border-transparent outline-none transition-all shadow-sm resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
                    <QrCode className="w-4 h-4" /> Mã lô hàng
                  </label>
                  <input
                    type="text"
                    value={formData.batchId}
                    onChange={(e) => setFormData({ ...formData, batchId: e.target.value })}
                    placeholder="Mã truy xuất (tùy chọn)"
                    className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-primary-400 outline-none transition-all shadow-sm"
                  />
                </div>

                <div className="group">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
                    <Leaf className="w-4 h-4" /> Xuất xứ
                  </label>
                  <input
                    type="text"
                    value={formData.origin}
                    onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                    placeholder="Vùng trồng (tùy chọn)"
                    className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-primary-400 outline-none transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="pt-4 text-right">
                <button
                  type="submit"
                  disabled={loading}
                  className={`px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 inline-flex items-center gap-2 ${
                    loading
                      ? "bg-slate-400 text-white cursor-not-allowed"
                      : "bg-slate-900 text-white hover:bg-slate-800 hover:shadow-xl hover:-translate-y-1"
                  }`}
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Đang tạo sản phẩm...</>
                  ) : (
                    <><Save className="w-5 h-5 text-primary-400" /> Tạo sản phẩm ngay</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
