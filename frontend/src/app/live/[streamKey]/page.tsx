"use client";

/**
 * ══════════════════════════════════════════════════════════════
 * Trang Xem Livestream — Viewer Page
 * ══════════════════════════════════════════════════════════════
 */

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import LivePlayer from "@/components/LivePlayer";
import LiveChat from "@/components/LiveChat";
import {
  ShoppingBag, Package, Sparkles, TrendingUp, Store,
  Eye, WifiOff, Tag, Minus, Plus, ArrowLeft, CheckCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";

interface LiveProduct {
  id: number;
  name: string;
  price: number;
  imageUrl?: string;
}

interface StreamInfo {
  title?: string;
  sellerName?: string;
  status?: string;
  products?: LiveProduct[];
  viewerCount?: number;
}

export default function LiveViewerPage() {
  const params = useParams();
  const router = useRouter();
  const streamKey = params.streamKey as string;
  const whepUrl = `${process.env.NEXT_PUBLIC_WHEP_URL || "http://localhost:8889"}/${streamKey}/whep`;
  const hlsUrl = `${process.env.NEXT_PUBLIC_HLS_URL || "http://localhost:8888"}/${streamKey}-aac/index.m3u8`;

  const [streamInfo, setStreamInfo] = useState<StreamInfo>({});
  const [streamStatus, setStreamStatus] = useState<string>("LIVE");
  const [products, setProducts] = useState<LiveProduct[]>([]);
  const [viewerCount, setViewerCount] = useState(0);

  // ── State per-product: số lượng & trạng thái đang đặt ──
  const [qtys, setQtys] = useState<Record<number, number>>({});
  const [orderingIds, setOrderingIds] = useState<Set<number>>(new Set());
  const [doneIds, setDoneIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const fetchStream = async () => {
      try {
        const res = await api.get(`/api/livestream/${streamKey}`);
        const data = res.data?.data || res.data?.session || res.data;
        setStreamInfo(data);
        setStreamStatus(data.status || "LIVE");
        if (data.products) setProducts(data.products);
      } catch { /* ignore */ }
    };
    fetchStream();
  }, [streamKey]);

  const handleStreamStatus = useCallback((data: { status: string; products?: LiveProduct[] }) => {
    setStreamStatus(data.status);
    if (data.products) setProducts(data.products);
  }, []);

  const handleProductsUpdate = useCallback((prods: LiveProduct[]) => {
    setProducts(prods);
  }, []);

  const handleViewerCount = useCallback((count: number) => {
    setViewerCount(count);
  }, []);

  const handleLiveOrder = useCallback((order: { buyerName: string; productId: number; quantity: number }) => {
    toast(
      <span className="text-sm">
        🛒 <b>{order.buyerName}</b> vừa chốt SP#{order.productId} x{order.quantity}
      </span>,
      { icon: "🔥", duration: 3000 }
    );
  }, []);

  // ── Helpers ──
  const getQty = (id: number) => qtys[id] ?? 1;
  const adjustQty = (id: number, delta: number) =>
    setQtys((prev) => ({ ...prev, [id]: Math.max(1, Math.min(99, (prev[id] ?? 1) + delta)) }));

  const getUserName = () => {
    if (typeof window === "undefined") return "Khách Mua";
    try {
      const stored = localStorage.getItem("hqs_user");
      if (stored) {
        const user = JSON.parse(stored);
        return user.name || user.fullName || "Khách Mua";
      }
    } catch { /* ignore */ }
    return "Khách Mua";
  };

  // ══════════════════════════════════════════════════════════════
  // QUICK ORDER — Chốt đơn trực tiếp từ product card
  // ══════════════════════════════════════════════════════════════
  const orderProduct = async (product: LiveProduct) => {
    if (typeof window !== "undefined" && !localStorage.getItem("hqs_token")) {
      toast.error("Vui lòng đăng nhập để chốt đơn!");
      return;
    }
    const qty = getQty(product.id);
    setOrderingIds((prev) => new Set(prev).add(product.id));
    try {
      await api.post(`/api/livestream/${streamKey}/order`, {
        productId: product.id,
        quantity: qty,
      });
      // Hiệu ứng "done" nhất thời
      setDoneIds((prev) => new Set(prev).add(product.id));
      setTimeout(() => setDoneIds((prev) => { const s = new Set(prev); s.delete(product.id); return s; }), 2000);
      setQtys((prev) => ({ ...prev, [product.id]: 1 }));
      toast.success(
        <div>
          <span className="font-bold">Chốt thành công!</span>
          <span className="block text-sm">{product.name} x{qty} đã vào giỏ hàng</span>
        </div>
      );
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) toast.error("Sản phẩm đã hết hàng!");
      else toast.error("Lỗi khi chốt đơn, thử lại!");
    } finally {
      setOrderingIds((prev) => { const s = new Set(prev); s.delete(product.id); return s; });
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      <div className="max-w-[1600px] mx-auto p-4 sm:p-6">
        {/* Stream Info Bar (moved from header) */}
          <div className="flex items-center gap-4 mb-4 text-sm">
          <button
            onClick={() => router.push("/live")}
            className="flex items-center gap-2 text-slate-600 hover:text-primary-600 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại
          </button>

          <div className="h-4 w-px bg-slate-200" />

          {streamInfo.sellerName && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center">
                <Store className="w-3.5 h-3.5 text-primary-600" />
              </div>
              <span className="font-medium text-slate-800">
                {streamInfo.sellerName} {streamInfo.title && <span className="text-slate-500 font-normal">— {streamInfo.title}</span>}
              </span>
            </div>
          )}

          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-slate-600 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-sm">
              <Eye className="w-3.5 h-3.5" />
              <span className="font-medium">{viewerCount}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-[calc(100vh-140px)] min-h-[700px]">

          {/* ════════════════════════════════════════════════════
              CỘT TRÁI (9 col): Player + Products
              ════════════════════════════════════════════════════ */}
          <div className="xl:col-span-9 flex flex-col gap-6">

            {/* ── Video Player ── */}
            <div className="relative flex-1 glass-panel rounded-3xl overflow-hidden border border-slate-200 shadow-xl flex flex-col">
              <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
                {streamStatus === "LIVE" && (
                  <div className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-red-500/20 backdrop-blur-md border border-red-400/30">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    TRỰC TIẾP
                  </div>
                )}
                {streamStatus === "OFFLINE" && (
                  <div className="bg-slate-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 backdrop-blur-md border border-slate-400/30">
                    <WifiOff className="w-3 h-3" /> GIÁN ĐOẠN
                  </div>
                )}
                {streamStatus === "ENDED" && (
                  <div className="bg-slate-400 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md">
                    ĐÃ KẾT THÚC
                  </div>
                )}
              </div>
              <div className="flex-1 bg-black flex items-center justify-center">
                <LivePlayer
                  whepUrl={whepUrl}
                  streamKey={streamKey}
                  hlsUrl={hlsUrl}
                  streamStatus={streamStatus}
                />
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════
                DANH SÁCH SẢN PHẨM — Chốt đơn trực tiếp
                ═══════════════════════════════════════════════════ */}
            {products.length > 0 ? (
              <div className="glass-panel rounded-3xl border border-slate-200 p-5">
                <h3 className="font-bold text-lg flex items-center gap-2 mb-4">
                  <Tag className="w-5 h-5 text-accent-500" />
                  Sản phẩm đang bán
                  <span className="text-slate-400 font-normal text-sm">({products.length})</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {products.map((p) => {
                    const isOrdering = orderingIds.has(p.id);
                    const isDone = doneIds.has(p.id);
                    const qty = getQty(p.id);
                    return (
                      <div
                        key={p.id}
                        className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col gap-3 transition-all hover:border-accent-400/50 hover:shadow-md"
                      >
                        {/* Tên + Giá */}
                        <div>
                          <p className="font-semibold text-sm text-slate-800 line-clamp-2 leading-snug">{p.name}</p>
                          <p className="text-accent-600 font-bold text-base mt-1">
                            {Number(p.price).toLocaleString("vi-VN")}đ
                          </p>
                        </div>

                        {/* Bộ chỉnh số lượng */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => adjustQty(p.id, -1)}
                            disabled={qty <= 1 || isOrdering}
                            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center disabled:opacity-40 transition"
                          >
                            <Minus className="w-3.5 h-3.5 text-slate-600" />
                          </button>
                          <span className="w-8 text-center font-bold text-slate-700">{qty}</span>
                          <button
                            onClick={() => adjustQty(p.id, +1)}
                            disabled={qty >= 99 || isOrdering}
                            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center disabled:opacity-40 transition"
                          >
                            <Plus className="w-3.5 h-3.5 text-slate-600" />
                          </button>
                        </div>

                        {/* Nút Chốt Đơn */}
                        <button
                          onClick={() => orderProduct(p)}
                          disabled={isOrdering || isDone || streamStatus === "ENDED"}
                          className={`w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${isDone
                              ? "bg-green-100 text-green-600 border border-green-200"
                              : isOrdering
                                ? "bg-accent-200 text-accent-700 cursor-wait"
                                : streamStatus === "ENDED"
                                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                  : "bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-400 hover:to-accent-500 text-white shadow-lg shadow-accent-500/10 hover:-translate-y-0.5"
                            }`}
                        >
                          {isDone ? (
                            <><CheckCircle className="w-4 h-4" /> Đã chốt!</>
                          ) : isOrdering ? (
                            <><Package className="w-4 h-4 animate-spin" /> Đang xử lý...</>
                          ) : (
                            <><ShoppingBag className="w-4 h-4" /> Chốt Đơn</>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : streamStatus === "LIVE" ? (
              <div className="glass-panel rounded-3xl border border-slate-200 p-6 flex items-center gap-4 text-slate-500">
                <Package className="w-8 h-8 opacity-40 shrink-0" />
                <div>
                  <p className="font-medium text-slate-600">Chưa có sản phẩm</p>
                  <p className="text-sm">Người bán chưa thêm sản phẩm — hãy chờ một chút!</p>
                </div>
              </div>
            ) : null}
          </div>

          {/* ════════════════════════════════════════════════════
              CỘT PHẢI (3 col): Chat realtime
              ════════════════════════════════════════════════════ */}
          <div className="xl:col-span-3 flex flex-col gap-6 h-full">
            <div className="glass-panel rounded-3xl border border-slate-200 overflow-hidden flex-1 flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 bg-white flex items-center justify-between">
                <span className="font-semibold flex items-center gap-2 text-slate-800">
                  <Sparkles className="w-5 h-5 text-primary-500" />
                  Khung Trò Chuyện
                </span>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                  <TrendingUp className="w-3 h-3 text-green-600" /> Đang hot
                </div>
              </div>
              <div className="flex-1 bg-white">
                <LiveChat
                  streamKey={streamKey}
                  userName={getUserName()}
                  onStreamStatus={handleStreamStatus}
                  onProductsUpdate={handleProductsUpdate}
                  onViewerCount={handleViewerCount}
                  onLiveOrder={handleLiveOrder}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
