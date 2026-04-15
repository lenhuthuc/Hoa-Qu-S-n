"use client";

/**
 * ══════════════════════════════════════════════════════════════
 * Trang Xem Livestream — Viewer Page
 * ══════════════════════════════════════════════════════════════
 *
 * LUỒNG VIEWER:
 * 1. User truy cập /live/[streamKey]
 * 2. Gọi API lấy thông tin phiên live (title, seller, products)
 * 3. Kết nối WebRTC/HLS player để xem video
 * 4. Socket.IO /live join-room để nhận chat & status
 * 5. Hiển thị danh sách sản phẩm → Quick order
 *
 * LAYOUT (Desktop xl):
 * ┌──────────────────────────┬──────────┐
 * │ Video Player (9 col)     │ Chat (3) │
 * │                          │          │
 * ├──────────────────────────┤          │
 * │ Quick Order Panel        │          │
 * ├──────────────────────────┤          │
 * │ Sản phẩm đang livestream │          │
 * └──────────────────────────┴──────────┘
 */

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import LivePlayer from "@/components/LivePlayer";
import LiveChat from "@/components/LiveChat";
import {
  ShoppingBag, Package, Sparkles, TrendingUp, Store,
  Eye, WifiOff, Tag, Minus, Plus,
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
  const streamKey = params.streamKey as string;
  // Kết nối thẳng vào stream gốc — đã có Opus native từ WebRTC, không cần path -opus đã transcode
  const whepUrl = `${process.env.NEXT_PUBLIC_WHEP_URL || "http://localhost:8889"}/${streamKey}/whep`;
  const hlsUrl = `${process.env.NEXT_PUBLIC_HLS_URL || "http://localhost:8888"}/${streamKey}-aac/index.m3u8`;

  // ── State: thông tin phiên live ──
  const [streamInfo, setStreamInfo] = useState<StreamInfo>({});
  const [streamStatus, setStreamStatus] = useState<string>("LIVE");
  const [products, setProducts] = useState<LiveProduct[]>([]);
  const [viewerCount, setViewerCount] = useState(0);

  // ── State: chốt đơn ──
  const [orderProductId, setOrderProductId] = useState("");
  const [orderQty, setOrderQty] = useState(1);
  const [ordering, setOrdering] = useState(false);

  // ══════════════════════════════════════════════════════════════
  // FETCH STREAM INFO — Lấy thông tin phiên từ API
  // ══════════════════════════════════════════════════════════════
  useEffect(() => {
    const fetchStream = async () => {
      try {
        const res = await api.get(`/api/livestream/${streamKey}`);
        const data = res.data?.session || res.data;
        setStreamInfo(data);
        setStreamStatus(data.status || "LIVE");
        if (data.products) setProducts(data.products);
      } catch {
        // Phiên chưa có hoặc lỗi → bỏ qua, dùng default
      }
    };
    fetchStream();
  }, [streamKey]);

  // ── Callbacks nhận event từ LiveChat socket ──
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
    // Hiệu ứng toast khi có người đặt hàng trong phòng
    toast(
      <span className="text-sm">
        🛒 <b>{order.buyerName}</b> vừa chốt đơn SP#{order.productId} x{order.quantity}
      </span>,
      { icon: "🔥", duration: 3000 }
    );
  }, []);

  // ══════════════════════════════════════════════════════════════
  // QUICK ORDER — Chốt đơn siêu tốc qua API
  // ══════════════════════════════════════════════════════════════
  const quickOrder = async () => {
    if (!orderProductId) {
      toast.error("Vui lòng nhập mã sản phẩm");
      return;
    }
    if (typeof window !== "undefined" && !localStorage.getItem("hqs_token")) {
      toast.error("Vui lòng đăng nhập để chốt đơn!");
      return;
    }
    setOrdering(true);
    try {
      await api.post(`/api/livestream/${streamKey}/order`, {
        productId: Number(orderProductId),
        quantity: orderQty,
      });
      toast.success(
        <div className="flex flex-col">
          <span className="font-bold">Đã chốt siêu tốc!</span>
          <span className="text-sm">Sản phẩm #{orderProductId} x{orderQty} đã được ghi nhận.</span>
        </div>
      );
      setOrderProductId("");
      setOrderQty(1);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        toast.error("Sản phẩm đã hết hàng!");
      } else {
        toast.error("Lỗi khi kết nối hoặc chốt đơn!");
      }
    } finally {
      setOrdering(false);
    }
  };

  // ── Quick order từ danh sách sản phẩm ──
  const quickOrderProduct = (product: LiveProduct) => {
    setOrderProductId(String(product.id));
    setOrderQty(1);
    toast(`Đã chọn: ${product.name}`, { icon: "🎯", duration: 1500 });
  };

  // ── Lấy tên user từ localStorage ──
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

  return (
    <div className="min-h-screen bg-surface-darker text-white">
      {/* ── Header Navigation ── */}
      <div className="h-16 border-b border-white/10 bg-black/40 backdrop-blur-md flex items-center px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3 w-full max-w-[1600px] mx-auto">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent-500 to-primary-500 flex items-center justify-center">
            <Store className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">
            Hoa Qua Son <span className="text-primary-400">Live</span>
          </span>
          {/* Thông tin seller */}
          {streamInfo.sellerName && (
            <span className="ml-4 text-sm text-slate-400">
              🌾 {streamInfo.sellerName}
              {streamInfo.title && ` — ${streamInfo.title}`}
            </span>
          )}
          {/* Viewer count */}
          <div className="ml-auto flex items-center gap-2 text-sm text-slate-400">
            <Eye className="w-4 h-4" />
            <span>{viewerCount} đang xem</span>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-[calc(100vh-120px)] min-h-[700px]">

          {/* ════════════════════════════════════════════════════
              CỘT TRÁI (9 col): Player + Order + Products
              ════════════════════════════════════════════════════ */}
          <div className="xl:col-span-9 flex flex-col gap-6">

            {/* ── Video Player Container ── */}
            <div className="relative flex-1 dark-glass-panel rounded-3xl overflow-hidden border border-white/5 shadow-2xl flex flex-col">
              {/* Badge trạng thái stream */}
              <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
                {streamStatus === "LIVE" && (
                  <div className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-red-500/20 backdrop-blur-md border border-red-400/30">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    TRỰC TIẾP
                  </div>
                )}
                {streamStatus === "OFFLINE" && (
                  <div className="bg-yellow-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 backdrop-blur-md border border-yellow-400/30">
                    <WifiOff className="w-3 h-3" />
                    GIÁN ĐOẠN
                  </div>
                )}
                {streamStatus === "ENDED" && (
                  <div className="bg-gray-600 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md border border-gray-400/30">
                    ĐÃ KẾT THÚC
                  </div>
                )}
                <div className="bg-black/40 backdrop-blur-md border border-white/10 text-white/90 px-3 py-1 rounded-full text-xs font-medium">
                  Đang xem phiên bán hàng
                </div>
              </div>

              {/* LivePlayer với HLS fallback */}
              <div className="flex-1 bg-black flex items-center justify-center">
                <LivePlayer
                  whepUrl={whepUrl}
                  streamKey={streamKey}
                  hlsUrl={hlsUrl}
                  streamStatus={streamStatus}
                />
              </div>
            </div>

            {/* ── Panel chốt đơn siêu tốc ── */}
            <div className="h-28 dark-glass-panel rounded-3xl border border-white/10 flex items-center px-6 md:px-10 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-64 h-64 bg-accent-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />

              <div className="flex w-full items-center justify-between z-10">
                <div className="hidden md:flex flex-col">
                  <h3 className="font-bold text-xl flex items-center gap-2 text-white">
                    <ShoppingBag className="w-6 h-6 text-accent-400" />
                    Chốt đơn siêu tốc
                  </h3>
                  <p className="text-slate-400 text-sm mt-1">
                    Nhập mã sản phẩm hoặc bấm vào SP bên dưới để chốt ngay!
                  </p>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="flex items-center bg-black/40 border border-white/10 rounded-2xl p-2 w-full md:w-auto">
                    <div className="px-4 border-r border-white/10">
                      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">
                        Mã Sản Phẩm
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={orderProductId}
                        onChange={(e) => setOrderProductId(e.target.value)}
                        placeholder="VD: 01"
                        className="bg-transparent text-white text-xl font-bold w-20 outline-none placeholder-white/20"
                      />
                    </div>
                    <div className="px-4 flex items-center gap-2">
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">
                          Số Lượng
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setOrderQty((q) => Math.max(1, q - 1))}
                            className="text-slate-400 hover:text-white transition"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={99}
                            value={orderQty}
                            onChange={(e) => setOrderQty(Math.max(1, parseInt(e.target.value) || 1))}
                            className="bg-transparent text-white text-xl font-bold w-10 outline-none text-center"
                          />
                          <button
                            onClick={() => setOrderQty((q) => Math.min(99, q + 1))}
                            className="text-slate-400 hover:text-white transition"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={quickOrder}
                    disabled={ordering || streamStatus === "ENDED"}
                    className="h-16 px-8 rounded-2xl font-bold text-lg bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-400 hover:to-accent-500 text-white shadow-lg shadow-accent-500/20 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 whitespace-nowrap"
                  >
                    <Package className="w-6 h-6" />
                    {ordering ? "Chờ Tí..." : "Chốt Đơn!"}
                  </button>
                </div>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════
                DANH SÁCH SẢN PHẨM ĐANG LIVESTREAM
                Farmer thêm sản phẩm → server push qua socket
                ═══════════════════════════════════════════════════ */}
            {products.length > 0 && (
              <div className="dark-glass-panel rounded-3xl border border-white/10 p-5">
                <h3 className="font-bold text-lg flex items-center gap-2 mb-4">
                  <Tag className="w-5 h-5 text-accent-400" />
                  Sản phẩm đang bán ({products.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => quickOrderProduct(p)}
                      className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-accent-400/50 rounded-2xl p-4 text-left transition-all hover:-translate-y-0.5 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs text-slate-500 font-mono">#{p.id}</span>
                        <ShoppingBag className="w-4 h-4 text-slate-500 group-hover:text-accent-400 transition" />
                      </div>
                      <p className="font-semibold text-sm mt-2 text-white line-clamp-2">{p.name}</p>
                      <p className="text-accent-400 font-bold mt-1">
                        {Number(p.price).toLocaleString("vi-VN")}đ
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
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
