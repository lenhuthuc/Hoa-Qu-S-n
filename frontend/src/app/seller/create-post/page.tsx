"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Upload, Sparkles, Loader2, Check, ArrowRight, ImageIcon, Leaf, Tag, TrendingUp, BarChart3, QrCode } from "lucide-react";
import { aiApi, searchApi, categoryApi, facebookApi, isLoggedIn } from "@/lib/api";
import toast from "react-hot-toast";

interface AIResult {
  product_name: string;
  title: string;
  description: string;
  category: string;
  estimated_weight?: string;
  freshness?: string;
  suggested_price_per_kg: number;
  price_reasoning: string;
  market_comparison?: {
    market_avg: number;
    market_min: number;
    market_max: number;
    ai_suggested: number;
    vs_market: string;
  };
}

interface EditableFields {
  product_name: string;
  title: string;
  description: string;
  categoryId: number;
  suggested_price_per_kg: number;
  unitWeightGrams: number;
  totalStockWeightKg: number;
  shelfLifeDays: number;
  batchId: string;
  origin: string;
}

interface CategoryOption {
  id: number;
  name: string;
  slug: string;
}

interface FacebookPage {
  pageId: string;
  pageName: string;
  connectedAt: string;
}

export default function CreatePostPage() {
  const router = useRouter();
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AIResult | null>(null);
  const [editable, setEditable] = useState<EditableFields | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [facebookPages, setFacebookPages] = useState<FacebookPage[]>([]);
  const [postToFacebook, setPostToFacebook] = useState(false);
  const [facebookPageId, setFacebookPageId] = useState("");
  const [facebookMessage, setFacebookMessage] = useState("");
  const [connectingFacebook, setConnectingFacebook] = useState(false);
  const prevPreviewRef = useRef<string | null>(null);

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
    if (!isLoggedIn()) { router.push("/login"); }
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
  }, [router, loadCategories]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) return;

    const connect = async () => {
      try {
        const redirectUri = `${window.location.origin}/seller/create-post`;
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
        router.replace("/seller/create-post");
      }
    };

    connect();
  }, [router]);

  const handleConnectFacebook = async () => {
    try {
      setConnectingFacebook(true);
      const redirectUri = `${window.location.origin}/seller/create-post`;
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

  const handleImage = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Revoke previous object URL to prevent memory leak
      if (prevPreviewRef.current) {
        URL.revokeObjectURL(prevPreviewRef.current);
      }
      const url = URL.createObjectURL(file);
      prevPreviewRef.current = url;
      setImage(file);
      setPreview(url);
      setResult(null);
      setEditable(null);
    }
  }, []);

  const handleGenerate = async () => {
    if (!image) return toast.error("Vui lòng chọn ảnh sản phẩm");
    setLoading(true);
    try {
      const res = await aiApi.generatePost(image);
      if (res.data.success) {
        const data: AIResult = res.data.data;
        setResult(data);
        // Auto-match AI category name to a categoryId
        const matchedCat = categories.find(
          (c) => c.name.toLowerCase() === data.category?.toLowerCase()
        );
        setEditable({
          product_name: data.product_name,
          title: data.title,
          description: data.description,
          categoryId: matchedCat?.id || (categories[0]?.id ?? 0),
          suggested_price_per_kg: data.suggested_price_per_kg,
          unitWeightGrams: 500,
          totalStockWeightKg: 100,
          shelfLifeDays: 30,
          batchId: "",
          origin: "",
        });
        toast.success("AI đã phân tích xong!");
      } else {
        toast.error(res.data.error || "Không thể phân tích ảnh");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Lỗi kết nối AI service");
    } finally {
      setLoading(false);
    }
  };

  const calculateInventoryQuantity = (unitWeightGrams: number, totalStockWeightKg: number) => {
    if (!unitWeightGrams || !totalStockWeightKg || unitWeightGrams <= 0 || totalStockWeightKg <= 0) {
      return 0;
    }
    return Math.floor((totalStockWeightKg * 1000) / unitWeightGrams);
  };

  const handleSubmit = async () => {
    if (!editable || !image) return;
    const computedQuantity = calculateInventoryQuantity(editable.unitWeightGrams, editable.totalStockWeightKg);
    if (computedQuantity <= 0) {
      toast.error("Thông số trọng lượng chưa hợp lệ để tạo tồn kho");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        productName: editable.product_name,
        price: editable.suggested_price_per_kg,
        quantity: computedQuantity,
        unitWeightGrams: editable.unitWeightGrams,
        totalStockWeightKg: editable.totalStockWeightKg,
        shelfLifeDays: editable.shelfLifeDays,
        categoryId: editable.categoryId,
        description: editable.description,
        batchId: editable.batchId || undefined,
        origin: editable.origin || undefined,
      };

      let productId = Date.now();
      let dbSuccess = true;

      if (postToFacebook) {
        if (!facebookPageId) {
          toast.error("Vui lòng chọn Facebook Page trước khi đăng đồng bộ");
          return;
        }

        const createRes = await aiApi.createProductWithFacebook(
          payload,
          image,
          facebookPageId,
          facebookMessage || editable.title
        );

        dbSuccess = Boolean(createRes.data?.databaseSuccess);
        const facebookSuccess = Boolean(createRes.data?.facebookSuccess);
        const createdProduct = createRes.data?.database?.data;
        productId = createdProduct?.productId || productId;

        if (dbSuccess && facebookSuccess) {
          toast.success("Đã đăng sản phẩm và đồng bộ Facebook thành công");
        } else if (dbSuccess && !facebookSuccess) {
          toast.success("Đã tạo sản phẩm, nhưng Facebook đăng bài thất bại");
        } else if (!dbSuccess && facebookSuccess) {
          toast.error("Facebook đăng bài thành công, nhưng lưu DB thất bại");
        } else {
          toast.error("Cả lưu DB và đăng Facebook đều thất bại");
          return;
        }
      } else {
        const createRes = await aiApi.createProduct(payload, image);
        if (createRes.status !== 200) {
          toast.error("Không thể tạo sản phẩm");
          return;
        }
        const createdProduct = createRes.data?.data || createRes.data;
        productId = createdProduct?.productId || productId;
        toast.success("Đã tạo sản phẩm thành công!");
      }

      // 2. Embed product into Qdrant for semantic search
      if (dbSuccess) {
        try {
        await searchApi.embedProduct({
          product_id: productId,
          product_name: editable.product_name,
          description: editable.description,
          category: categories.find((c) => c.id === editable.categoryId)?.name || "",
          price: editable.suggested_price_per_kg,
        });
        } catch {
          // Embedding is non-critical; product was already created
          console.warn("Embed product failed — semantic search may not include this item");
        }
      }

      router.push("/seller/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Lỗi khi đăng sản phẩm");
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);

  return (
    <div className="min-h-screen relative overflow-hidden bg-blobs py-12 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-10 text-center animate-float relative">
        <button 
          onClick={() => router.push("/seller/dashboard")}
          className="absolute left-0 top-0 text-gray-500 hover:text-primary-600 flex items-center gap-1 font-medium bg-white/60 px-4 py-2 rounded-xl backdrop-blur-md border border-white/50"
        >
          <ArrowRight className="w-4 h-4 rotate-180" /> Quay lại
        </button>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 backdrop-blur-md border border-white/50 text-primary-700 shadow-sm mb-4">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-medium tracking-wide uppercase">AI Assistant</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-4 tracking-tight">
          Tạo bài đăng với <span className="text-gradient">Trí Tuệ Nhân Tạo</span>
        </h1>
        <p className="text-slate-600 max-w-2xl mx-auto text-lg">
          Chỉ cần tải ảnh lên, AI của Gemini sẽ tự động nhận diện nông sản, viết tiêu đề thu hút và gợi ý mức giá bán tối ưu nhất.
        </p>
      </div>

      <div className="max-w-6xl mx-auto grid lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Upload */}
        <div className="lg:col-span-5 w-full">
          <div className="glass-panel rounded-3xl p-8 relative overflow-hidden group transition-all duration-300 hover:shadow-xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-400 to-accent-400"></div>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600">
                <span className="font-bold text-lg">1</span>
              </div>
              <h2 className="text-xl font-semibold text-slate-800">Tải ảnh sản phẩm</h2>
            </div>

            <label className={`relative block w-full aspect-square md:aspect-auto md:h-80 rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden ${preview ? 'border-primary-400 bg-black/5' : 'border-slate-300 bg-white/50 hover:bg-white hover:border-primary-400'}`}>
              <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
              {preview ? (
                <>
                  <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                    <p className="text-white font-medium flex items-center gap-2">
                       <ImageIcon className="w-5 h-5"/> Đổi ảnh khác
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

            <button
              onClick={handleGenerate}
              disabled={!image || loading}
              className={`w-full mt-6 py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-3 transition-all duration-300 overflow-hidden relative ${
                !image || loading 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 hover:-translate-y-1'
              }`}
            >
              {!image || loading ? null : <div className="absolute inset-0 bg-white/20 w-full h-full -translate-x-full group-hover:animate-shine"></div>}
              {loading ? (
                <><Loader2 className="w-6 h-6 animate-spin" /> Đang phân tích bằng AI...</>
              ) : (
                <><Sparkles className="w-6 h-6" /> Bắt đầu phân tích</>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: AI Results */}
        <div className="lg:col-span-7 w-full">
          <div className="glass-panel rounded-3xl p-8 min-h-[500px] transition-all duration-500">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-full bg-accent-100 flex items-center justify-center text-accent-600">
                <span className="font-bold text-lg">2</span>
              </div>
              <h2 className="text-xl font-semibold text-slate-800">Kết quả được tối ưu</h2>
            </div>

            {result ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                
                {/* Form Fields */}
                <div className="space-y-5">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
                         <BarChart3 className="w-4 h-4" /> Trọng lượng / sản phẩm (gram)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={editable?.unitWeightGrams ?? 500}
                        onChange={(e) => setEditable((prev) => prev ? { ...prev, unitWeightGrams: parseInt(e.target.value) || 0 } : prev)}
                        className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium focus:ring-2 focus:ring-primary-400 focus:border-transparent outline-none transition-all shadow-sm"
                      />
                    </div>

                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
                         <BarChart3 className="w-4 h-4" /> Tổng trọng lượng hàng có (kg)
                      </label>
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={editable?.totalStockWeightKg ?? 100}
                        onChange={(e) => setEditable((prev) => prev ? { ...prev, totalStockWeightKg: parseFloat(e.target.value) || 0 } : prev)}
                        className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium focus:ring-2 focus:ring-primary-400 focus:border-transparent outline-none transition-all shadow-sm"
                      />
                    </div>

                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
                         <BarChart3 className="w-4 h-4" /> Tồn kho tự tính (đơn vị)
                      </label>
                      <input
                        readOnly
                        value={calculateInventoryQuantity(editable?.unitWeightGrams ?? 0, editable?.totalStockWeightKg ?? 0)}
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
                        value={editable?.shelfLifeDays ?? 30}
                        onChange={(e) => setEditable((prev) => prev ? { ...prev, shelfLifeDays: parseInt(e.target.value) || 30 } : prev)}
                        className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium focus:ring-2 focus:ring-primary-400 focus:border-transparent outline-none transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="group">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
                       <Tag className="w-4 h-4" /> Tên sản phẩm
                    </label>
                    <input 
                      value={editable?.product_name ?? ""}
                      onChange={(e) => setEditable((prev) => prev ? { ...prev, product_name: e.target.value } : prev)}
                      className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium focus:ring-2 focus:ring-primary-400 focus:border-transparent outline-none transition-all shadow-sm"
                    />
                  </div>
                </div>

                  <div>

                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
                         <Leaf className="w-4 h-4" /> Phân loại
                      </label>
                      <select
                        value={editable?.categoryId ?? 0}
                        onChange={(e) => setEditable((prev) => prev ? { ...prev, categoryId: Number(e.target.value) } : prev)}
                        className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-primary-400 outline-none transition-all shadow-sm"
                      >
                        <option value={0}>Chọn danh mục</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
                         <Sparkles className="w-4 h-4" /> Độ tươi
                      </label>
                      <input 
                        defaultValue={result.freshness || ""} 
                        readOnly
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none cursor-default"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
                      Mô tả chi tiết
                    </label>
                    <textarea 
                      value={editable?.description ?? ""}
                      onChange={(e) => setEditable((prev) => prev ? { ...prev, description: e.target.value } : prev)}
                      rows={4} 
                      className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 leading-relaxed focus:ring-2 focus:ring-primary-400 focus:border-transparent outline-none transition-all shadow-sm resize-none"
                    />
                  </div>

                  {/* Traceability Fields */}
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
                        <QrCode className="w-4 h-4" /> Mã lô hàng
                      </label>
                      <input
                        value={editable?.batchId ?? ""}
                        onChange={(e) => setEditable((prev) => prev ? { ...prev, batchId: e.target.value } : prev)}
                        placeholder="VD: LO-DUAHAU-2026-001"
                        className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-primary-400 outline-none transition-all shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
                        <Leaf className="w-4 h-4" /> Xuất xứ
                      </label>
                      <input
                        value={editable?.origin ?? ""}
                        onChange={(e) => setEditable((prev) => prev ? { ...prev, origin: e.target.value } : prev)}
                        placeholder="VD: Bình Dương, Việt Nam"
                        className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-primary-400 outline-none transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Facebook Sync Fields */}
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
                </div>

                {/* Price Intelligence Card */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-xl mt-8">
                  <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-accent-500/20 rounded-full blur-2xl"></div>
                  <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-32 h-32 bg-primary-500/20 rounded-full blur-2xl"></div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-300 uppercase tracking-wider">
                        <TrendingUp className="w-4 h-4 text-accent-400" /> Giá đề xuất (VNĐ/kg)
                      </label>
                      <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-medium backdrop-blur-md">AI Intelligence</span>
                    </div>
                    
                    <div className="flex items-end gap-4 mb-3">
                      <p className="text-4xl md:text-5xl font-bold text-white tracking-tight">{formatPrice(result.suggested_price_per_kg)}</p>
                    </div>
                    
                    <p className="text-sm text-slate-300 bg-white/5 p-3 rounded-lg border border-white/10 leading-relaxed mb-4">
                      <span className="text-accent-400 font-semibold">Lý do: </span>{result.price_reasoning}
                    </p>

                    {result.market_comparison && (
                      <div className="flex flex-wrap gap-4 pt-4 border-t border-white/10 text-sm">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-400">Giá TT:</span> 
                          <span className="font-semibold text-white">{formatPrice(result.market_comparison.market_min)} - {formatPrice(result.market_comparison.market_max)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">Trung bình:</span> 
                          <span className="font-semibold text-white">{formatPrice(result.market_comparison.market_avg)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 text-right">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className={`px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 inline-flex items-center gap-2 ${
                      submitting
                        ? 'bg-slate-400 text-white cursor-not-allowed'
                        : 'bg-slate-900 text-white hover:bg-slate-800 hover:shadow-xl hover:-translate-y-1'
                    }`}
                  >
                    {submitting ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Đang đăng bán...</>
                    ) : (
                      <><Check className="w-5 h-5 text-primary-400" /> Đăng bán sản phẩm này ngay</>
                    )}
                  </button>
                </div>

              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-20">
                <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center mb-6 shadow-inner relative">
                  <div className="absolute inset-0 rounded-full border-2 border-dashed border-slate-200 animate-[spin_10s_linear_infinite]"></div>
                  <Sparkles className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-xl font-semibold text-slate-800 mb-2">Chưa có kết quả phân tích</h3>
                <p className="text-slate-500 max-w-sm">
                  Hãy chọn hình ảnh tinh hoa nông sản của bạn và bấm nút phân tích. Gemini AI sẽ lo phần còn lại.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
