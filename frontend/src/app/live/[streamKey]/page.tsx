"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import LivePlayer from "@/components/LivePlayer";
import LiveChat from "@/components/LiveChat";
import { ShoppingBag, Package, Sparkles, TrendingUp, Store } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";

export default function LiveViewerPage() {
  const params = useParams();
  const streamKey = params.streamKey as string;
  const whepUrl = `${process.env.NEXT_PUBLIC_WHEP_URL || "http://localhost:8889"}/${streamKey}/whep`;

  const [orderProductId, setOrderProductId] = useState("");
  const [orderQty, setOrderQty] = useState(1);
  const [ordering, setOrdering] = useState(false);

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
        quantity: orderQty 
      });
      
      toast.success(
        <div className="flex flex-col">
           <span className="font-bold">Đã chốt siêu tốc!</span>
           <span className="text-sm">Sản phẩm #{orderProductId} đã được hệ thống ghi nhận.</span>
        </div>
      );
      setOrderProductId("");
    } catch {
      toast.error("Lỗi khi kết nối hoặc chốt đơn!");
    } finally {
      setOrdering(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-darker text-white">
      {/* Top Navigation / Header */}
      <div className="h-16 border-b border-white/10 bg-black/40 backdrop-blur-md flex items-center px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3 w-full max-w-[1600px] mx-auto">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent-500 to-primary-500 flex items-center justify-center">
            <Store className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">Hoa Qua Son <span className="text-primary-400">Live</span></span>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-[calc(100vh-120px)] min-h-[700px]">
          
          {/* Main Content: Player + Order Panel */}
          <div className="xl:col-span-9 flex flex-col gap-6">
            {/* Player Container */}
            <div className="relative flex-1 dark-glass-panel rounded-3xl overflow-hidden border border-white/5 shadow-2xl flex flex-col">
              <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
                 <div className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-red-500/20 backdrop-blur-md border border-red-400/30">
                   <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                   TRỰC TIẾP
                 </div>
                 <div className="bg-black/40 backdrop-blur-md border border-white/10 text-white/90 px-3 py-1 rounded-full text-xs font-medium">
                   Đang xem phiên bán hàng
                 </div>
              </div>
              <div className="flex-1 bg-black flex items-center justify-center">
                 {/* Placeholder for the player (LivePlayer component takes 100% width/height) */}
                 <LivePlayer whepUrl={whepUrl} streamKey={streamKey} />
              </div>
            </div>

            {/* Quick Order Action Panel */}
            <div className="h-28 dark-glass-panel rounded-3xl border border-white/10 flex items-center px-6 md:px-10 relative overflow-hidden">
               <div className="absolute right-0 top-0 w-64 h-64 bg-accent-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
               
               <div className="flex w-full items-center justify-between z-10">
                 <div className="hidden md:flex flex-col">
                   <h3 className="font-bold text-xl flex items-center gap-2 text-white">
                     <ShoppingBag className="w-6 h-6 text-accent-400" />
                     Chốt đơn siêu tốc
                   </h3>
                   <p className="text-slate-400 text-sm mt-1">Hệ thống sẻ tự động nhận diện và ghi lên màn hình live của chủ phòng.</p>
                 </div>

                 <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="flex items-center bg-black/40 border border-white/10 rounded-2xl p-2 w-full md:w-auto">
                      <div className="px-4 border-r border-white/10">
                         <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Mã Sản Phẩm</label>
                         <input
                           type="text"
                           inputMode="numeric"
                           value={orderProductId}
                           onChange={(e) => setOrderProductId(e.target.value)}
                           placeholder="VD: 01"
                           className="bg-transparent text-white text-xl font-bold w-20 outline-none placeholder-white/20"
                         />
                      </div>
                      <div className="px-4">
                         <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Số Lượng</label>
                         <input
                           type="number"
                           min={1}
                           max={99}
                           value={orderQty}
                           onChange={(e) => setOrderQty(Math.max(1, parseInt(e.target.value) || 1))}
                           className="bg-transparent text-white text-xl font-bold w-16 outline-none"
                         />
                      </div>
                    </div>

                    <button
                      onClick={quickOrder}
                      disabled={ordering}
                      className="h-16 px-8 rounded-2xl font-bold text-lg bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-400 hover:to-accent-500 text-white shadow-lg shadow-accent-500/20 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 whitespace-nowrap"
                    >
                      <Package className="w-6 h-6" />
                      {ordering ? "Chờ Tí..." : "Chốt Đơn!"}
                    </button>
                 </div>
               </div>
            </div>
          </div>

          {/* Right Sidebar: Chat */}
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
                
                <div className="flex-1" style={{ filter: 'invert(0.9) hue-rotate(180deg)', background: '#fff' }}>
                  <LiveChat streamKey={streamKey} userName="Khách Mua" />
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
