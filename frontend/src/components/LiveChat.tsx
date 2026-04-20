"use client";

/**
 * ══════════════════════════════════════════════════════════════
 * LiveChat — Chat realtime trong phòng livestream
 * ══════════════════════════════════════════════════════════════
 * 
 * KIẾN TRÚC REDIS PUB/SUB (giải quyết vấn đề scale):
 * ┌─────────────────────────────────────────────────────────┐
 * │ Khi có nhiều WS Server:                                │
 * │ User A (Server 1) gửi tin nhắn                         │
 * │ → Server 1 PUBLISH lên Redis channel                   │
 * │ → Redis forward đến TẤT CẢ server đang SUBSCRIBE      │
 * │ → Mỗi server broadcast đến client trong room           │
 * │ → User B (Server 2) NHẬN ĐƯỢC tin nhắn                 │
 * └─────────────────────────────────────────────────────────┘
 * 
 * LUỒNG MỘT TIN NHẮN (End-to-End, < 100ms):
 * 1. User A gõ tin nhắn → Socket.io client emit "chat-message"
 * 2. WS Server nhận event → xác thực user trong phòng
 * 3. Server lưu vào Redis List: LPUSH chat:{roomId}
 * 4. Server publish lên Redis: PUBLISH live:chat
 * 5. Redis forward đến tất cả WS Server đang SUBSCRIBE  
 * 6. Mỗi WS Server broadcast đến tất cả client trong room
 * 7. React app nhận event → render tin nhắn mới trong chat box
 * 
 * TÍNH NĂNG:
 * - Lọc ngôn từ xấu (banned words list)
 * - Rate limiting (5 tin/10 giây)
 * - /order [sản phẩm] — Đặt hàng qua chat
 * - Ghim tin nhắn quan trọng
 * - Lịch sử chat (50 tin gần nhất khi vào phòng)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { Send, Pin, PinOff, ShoppingCart, AlertTriangle, History, WifiOff } from "lucide-react";

interface Message {
  user: string;
  text: string;
  ts: number;
  type?: "order" | "chat";
  senderId?: string | number;
}

interface PinnedMessage {
  user: string;
  text: string;
  ts: number;
}

interface StreamStatus {
  status: string;
  title?: string;
  sellerName?: string;
  products?: Array<{ id: number; name: string; price: number }>;
}

interface LiveChatProps {
  streamKey: string;
  userName: string;
  /** Có phải chủ phòng (farmer/seller) không */
  isOwner?: boolean;
  /** Callback khi nhận stream status từ server */
  onStreamStatus?: (status: StreamStatus) => void;
  /** Callback khi nhận products update */
  onProductsUpdate?: (products: Array<{ id: number; name: string; price: number }>) => void;
  /** Callback khi nhận viewer count */
  onViewerCount?: (count: number) => void;
  /** Callback khi nhận live order notification */
  onLiveOrder?: (order: { buyerName: string; productId: number; quantity: number }) => void;
}

export default function LiveChat({
  streamKey,
  userName,
  isOwner = false,
  onStreamStatus,
  onProductsUpdate,
  onViewerCount,
  onLiveOrder,
}: LiveChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [pinned, setPinned] = useState<PinnedMessage | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [orderConfirm, setOrderConfirm] = useState<string | null>(null);
  const [streamStatus, setStreamStatusLocal] = useState<string>("LIVE");
  const [isConnected, setIsConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ══════════════════════════════════════════════════════════════
  // SOCKET.IO CONNECTION — Kết nối WebSocket đến WS Server
  // Giao thức: WebSocket (persistent TCP, 2 chiều)
  // Path: /ws namespace: /live
  // ══════════════════════════════════════════════════════════════
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("hqs_token") : null;

    const s = io(`${process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3000"}/live`, {
      transports: ["websocket"],
      path: "/ws",
      auth: token ? { token } : {},
      reconnection: true,           // Tự động reconnect khi mất kết nối
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    // ── Kết nối thành công → join room ──
    s.on("connect", () => {
      setIsConnected(true);
      s.emit("join-room", streamKey);
    });

    s.on("disconnect", () => {
      setIsConnected(false);
    });

    // ── Reconnect tự động (Socket.io auto-reconnect) ──
    s.on("reconnect", () => {
      setIsConnected(true);
      s.emit("join-room", streamKey);
    });

    // ════════════════════════════════════════════════════════
    // NHẬN TIN NHẮN CHAT — Realtime từ Redis Pub/Sub
    // ════════════════════════════════════════════════════════
    s.on("chat-message", (msg: Message) => {
      setMessages((prev) => [...prev.slice(-200), msg]);
    });

    // ── Lịch sử chat (50 tin gần nhất khi vào phòng) ──
    s.on("chat-history", (history: Message[]) => {
      setMessages(history);
    });

    // ── Viewer count update ──
    s.on("viewer-count", (count: number) => {
      setViewerCount(count);
      onViewerCount?.(count);
    });

    // ════════════════════════════════════════════════════════
    // GHIM TIN NHẮN — Pin/Unpin quan trọng
    // ════════════════════════════════════════════════════════
    s.on("chat-pin", (data: PinnedMessage) => {
      setPinned(data);
    });
    s.on("chat-unpin", () => {
      setPinned(null);
    });

    // ════════════════════════════════════════════════════════
    // MODERATION — Lỗi vi phạm / rate-limit
    // ════════════════════════════════════════════════════════
    s.on("chat-error", (data: { message: string }) => {
      setChatError(data.message);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setChatError(null), 4000);
    });

    // ════════════════════════════════════════════════════════
    // /order — Xác nhận đặt hàng qua chat
    // ════════════════════════════════════════════════════════
    s.on("chat-order-confirm", (data: { productName: string; quantity: number; price: number }) => {
      setOrderConfirm(
        `Đã đặt: ${data.productName} x${data.quantity} — ${Number(data.price || 0).toLocaleString("vi-VN")}đ`
      );
      if (orderTimerRef.current) clearTimeout(orderTimerRef.current);
      orderTimerRef.current = setTimeout(() => setOrderConfirm(null), 5000);
    });

    // ════════════════════════════════════════════════════════
    // STREAM STATUS — LIVE / OFFLINE / ENDED
    // Phát hiện farmer mất mạng → hiển thị "Stream đang gián đoạn"
    // ════════════════════════════════════════════════════════
    s.on("stream-status", (data: StreamStatus) => {
      setStreamStatusLocal(data.status);
      onStreamStatus?.(data);
    });

    // ── Cập nhật sản phẩm trong phòng ──
    s.on("products-update", (data: { products: Array<{ id: number; name: string; price: number }> }) => {
      onProductsUpdate?.(data.products);
    });

    // ── Live order notification (ai đó vừa đặt hàng) ──
    s.on("live-order", (data: { buyerName: string; productId: number; quantity: number }) => {
      onLiveOrder?.(data);
    });

    setSocket(s);
    return () => {
      s.emit("leave-room", streamKey);
      s.disconnect();
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      if (orderTimerRef.current) clearTimeout(orderTimerRef.current);
    };
  }, [streamKey]);

  // ── Auto-scroll tin nhắn mới ──
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // ══════════════════════════════════════════════════════════════
  // GỬI TIN NHẮN — Emit qua Socket.io
  // ══════════════════════════════════════════════════════════════
  const send = useCallback(() => {
    const text = input.trim();
    if (!text || !socket) return;
    socket.emit("chat-message", { room: streamKey, user: userName, text });
    setInput("");
  }, [input, socket, streamKey, userName]);

  // ── Ghim tin nhắn (chỉ chủ phòng) ──
  const pinMessage = useCallback(
    (text: string) => {
      if (!socket || !isOwner) return;
      socket.emit("chat-pin", { roomId: streamKey, message: text, user: userName });
    },
    [socket, streamKey, userName, isOwner]
  );

  // ── Bỏ ghim ──
  const unpinMessage = useCallback(() => {
    if (!socket || !isOwner) return;
    socket.emit("chat-unpin", { roomId: streamKey });
  }, [socket, streamKey, isOwner]);

  const isOrderMsg = (m: Message) => m.type === "order" || m.text.startsWith("🛒");

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border">
      {/* ── Header với viewer count ── */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-green-700">Trò chuyện trực tiếp</span>
          {!isConnected && (
            <WifiOff className="w-3.5 h-3.5 text-red-500 animate-pulse" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {streamStatus === "OFFLINE" && (
            <span className="text-[10px] text-yellow-600 font-medium bg-yellow-50 px-2 py-0.5 rounded">
              Gián đoạn
            </span>
          )}
          <span className="text-xs text-gray-500">{viewerCount} đang xem</span>
        </div>
      </div>

      {/* ── Tin nhắn ghim (Farmer pin thông báo quan trọng) ── */}
      {pinned && (
        <div className="mx-3 mt-2 flex items-start gap-2 bg-yellow-50 border border-yellow-300 rounded-lg px-3 py-2">
          <Pin className="w-3.5 h-3.5 text-yellow-600 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-yellow-700 uppercase tracking-wide">Tin ghim</p>
            <p className="text-xs text-yellow-900 break-words">{pinned.text}</p>
          </div>
          {isOwner && (
            <button
              onClick={unpinMessage}
              className="text-yellow-500 hover:text-yellow-700 shrink-0"
              title="Bỏ ghim"
            >
              <PinOff className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* ── Xác nhận đặt hàng ── */}
      {orderConfirm && (
        <div className="mx-3 mt-2 flex items-center gap-2 bg-green-50 border border-green-300 rounded-lg px-3 py-2">
          <ShoppingCart className="w-3.5 h-3.5 text-green-600 shrink-0" />
          <p className="text-xs text-green-800">{orderConfirm}</p>
        </div>
      )}

      {/* ── Lỗi moderation / rate-limit ── */}
      {chatError && (
        <div className="mx-3 mt-2 flex items-center gap-2 bg-red-50 border border-red-300 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          <p className="text-xs text-red-700">{chatError}</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          KHUNG TIN NHẮN — Render realtime messages
          ══════════════════════════════════════════════════════ */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-2 min-h-0">
        {messages.map((m, i) => (
          <div
            key={`${m.ts}-${i}`}
            className={`text-sm group/msg ${isOrderMsg(m) ? "bg-green-50 rounded px-2 py-1" : ""}`}
          >
            <span className={`font-medium ${isOrderMsg(m) ? "text-green-600" : "text-green-700"}`}>
              {m.user}:{" "}
            </span>
            <span className="text-gray-700">{m.text}</span>
            {/* ── Nút ghim (chỉ hiện cho chủ phòng khi hover) ── */}
            {isOwner && !isOrderMsg(m) && (
              <button
                onClick={() => pinMessage(m.text)}
                className="ml-1 opacity-0 group-hover/msg:opacity-100 text-gray-400 hover:text-yellow-600 transition-opacity inline"
                title="Ghim tin nhắn"
              >
                <Pin className="w-3 h-3 inline" />
              </button>
            )}
          </div>
        ))}
        {messages.length === 0 && (
          <div className="text-center mt-8">
            <History className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Chưa có tin nhắn nào</p>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          INPUT — Gửi tin nhắn / Lệnh đặt hàng qua chat
          Gõ /order [tên sản phẩm] để đặt hàng
          ══════════════════════════════════════════════════════ */}
      <div className="px-3 py-2 border-t flex flex-col gap-1">
        <p className="text-[10px] text-gray-400">
          Gõ <span className="font-mono bg-gray-100 px-1 rounded">/order [tên SP]</span> để đặt
          hàng qua chat
        </p>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Nhập tin nhắn..."
            maxLength={500}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-white placeholder-gray-400"
          />
          <button
            onClick={send}
            disabled={!isConnected}
            className="bg-green-600 text-white rounded-lg px-3 py-2 hover:bg-green-700 transition disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
