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
    <div className="min-h-screen bg-surface-darker text-white">
      {/* ── Header ── */}
      <div className="h-16 border-b border-white/10 bg-black/40 backdrop-blur-md flex items-center px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3 w-full max-w-[1600px] mx-auto">
          {/* Nút thoát phòng live */}
          <button
            onClick={() => router.push("/live")}
            className="flex items-center gap-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-all text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Thoát
          </button>

          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent-500 to-primary-500 flex items-center justify-center ml-1">
            <Store className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">
            Hoa Qua Son <span className="text-primary-400">Live</span>
          </span>
          {streamInfo.sellerName && (
            <span className="ml-2 text-sm text-slate-400 hidden sm:block">
              🌾 {streamInfo.sellerName}
              {streamInfo.title && ` — ${streamInfo.title}`}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2 text-sm text-slate-400">
            <Eye className="w-4 h-4" />
            <span>{viewerCount} đang xem</span>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-[calc(100vh-120px)] min-h-[700px]">

          {/* ════════════════════════════════════════════════════
              CỘT TRÁI (9 col): Player + Products
              ════════════════════════════════════════════════════ */}
          <div className="xl:col-span-9 flex flex-col gap-6">

            {/* ── Video Player ── */}
            <div className="relative flex-1 dark-glass-panel rounded-3xl overflow-hidden border border-white/5 shadow-2xl flex flex-col">
              <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
                {streamStatus === "LIVE" && (
                  <div className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-red-500/20 backdrop-blur-md border border-red-400/30">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    TRỰC TIẾP
                  </div>
                )}
                {streamStatus === "OFFLINE" && (
                  <div className="bg-yellow-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 backdrop-blur-md border border-yellow-400/30">
                    <WifiOff className="w-3 h-3" /> GIÁN ĐOẠN
                  </div>
                )}
                {streamStatus === "ENDED" && (
                  <div className="bg-gray-600 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md border border-gray-400/30">
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
              <div className="dark-glass-panel rounded-3xl border border-white/10 p-5">
                <h3 className="font-bold text-lg flex items-center gap-2 mb-4">
                  <Tag className="w-5 h-5 text-accent-400" />
                  Sản phẩm đang bán
                  <span className="text-slate-500 font-normal text-sm">({products.length})</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {products.map((p) => {
                    const isOrdering = orderingIds.has(p.id);
                    const isDone = doneIds.has(p.id);
                    const qty = getQty(p.id);
                    return (
                      <div
                        key={p.id}
                        className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3 transition-all hover:border-accent-400/30"
                      >
                        {/* Tên + Giá */}
                        <div>
                          <p className="font-semibold text-sm text-white line-clamp-2 leading-snug">{p.name}</p>
                          <p className="text-accent-400 font-bold text-base mt-1">
                            {Number(p.price).toLocaleString("vi-VN")}đ
                          </p>
                        </div>

                        {/* Bộ chỉnh số lượng */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => adjustQty(p.id, -1)}
                            disabled={qty <= 1 || isOrdering}
                            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center disabled:opacity-40 transition"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center font-bold text-white">{qty}</span>
                          <button
                            onClick={() => adjustQty(p.id, +1)}
                            disabled={qty >= 99 || isOrdering}
                            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center disabled:opacity-40 transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Nút Chốt Đơn */}
                        <button
                          onClick={() => orderProduct(p)}
                          disabled={isOrdering || isDone || streamStatus === "ENDED"}
                          className={`w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                            isDone
                              ? "bg-green-500/20 text-green-400 border border-green-500/30"
                              : isOrdering
                              ? "bg-accent-500/50 text-white cursor-wait"
                              : streamStatus === "ENDED"
                              ? "bg-white/5 text-slate-500 cursor-not-allowed"
                              : "bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-400 hover:to-accent-500 text-white shadow-lg shadow-accent-500/20 hover:-translate-y-0.5"
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
              <div className="dark-glass-panel rounded-3xl border border-white/10 p-6 flex items-center gap-4 text-slate-500">
                <Package className="w-8 h-8 opacity-40 shrink-0" />
                <div>
                  <p className="font-medium text-slate-400">Chưa có sản phẩm</p>
                  <p className="text-sm">Người bán chưa thêm sản phẩm — hãy chờ một chút!</p>
                </div>
              </div>
            ) : null}
          </div>

          {/* ════════════════════════════════════════════════════
              CỘT PHẢI (3 col): Chat realtime
              ════════════════════════════════════════════════════ */}
          <div className="xl:col-span-3 flex flex-col gap-6 h-full">
            <div className="dark-glass-panel rounded-3xl border border-white/10 overflow-hidden flex-1 flex flex-col">
              <div className="px-5 py-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                <span className="font-semibold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary-400" />
                  Khung Trò Chuyện
                </span>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-black/40 px-2 py-1 rounded-md">
                  <TrendingUp className="w-3 h-3 text-green-400" /> Đang hot
                </div>
              </div>
              <div className="flex-1" style={{ filter: "invert(0.9) hue-rotate(180deg)", background: "#fff" }}>
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
