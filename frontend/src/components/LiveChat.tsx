"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Send, Pin, ShoppingCart, AlertTriangle } from "lucide-react";

interface Message {
  user: string;
  text: string;
  ts: number;
  type?: "order" | "chat";
}

interface PinnedMessage {
  user: string;
  text: string;
  ts: number;
}

interface LiveChatProps {
  streamKey: string;
  userName: string;
}

export default function LiveChat({ streamKey, userName }: LiveChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [pinned, setPinned] = useState<PinnedMessage | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [orderConfirm, setOrderConfirm] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("hqs_token") : null;

    const s = io(`${process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3000"}/live`, {
      transports: ["websocket"],
      path: "/ws",
      auth: token ? { token } : {},
    });

    s.on("connect", () => {
      s.emit("join-room", streamKey);
    });

    s.on("chat-message", (msg: Message) => {
      setMessages((prev) => [...prev.slice(-200), msg]);
    });

    s.on("viewer-count", (count: number) => {
      setViewerCount(count);
    });

    // Pinned message events
    s.on("chat-pin", (data: PinnedMessage) => {
      setPinned(data);
    });
    s.on("chat-unpin", () => {
      setPinned(null);
    });

    // Moderation / rate-limit errors
    s.on("chat-error", (data: { message: string }) => {
      setChatError(data.message);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setChatError(null), 4000);
    });

    // /order command confirmation
    s.on("chat-order-confirm", (data: { productName: string; quantity: number; price: number }) => {
      setOrderConfirm(`Đã đặt: ${data.productName} x${data.quantity} — ${Number(data.price || 0).toLocaleString("vi-VN")}đ`);
      if (orderTimerRef.current) clearTimeout(orderTimerRef.current);
      orderTimerRef.current = setTimeout(() => setOrderConfirm(null), 5000);
    });

    setSocket(s);
    return () => {
      s.emit("leave-room", streamKey);
      s.disconnect();
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      if (orderTimerRef.current) clearTimeout(orderTimerRef.current);
    };
  }, [streamKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text || !socket) return;
    socket.emit("chat-message", { room: streamKey, user: userName, text });
    setInput("");
  };

  const isOrderMsg = (m: Message) => m.type === "order" || m.text.startsWith("🛒");

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <span className="font-semibold text-green-700">Trò chuyện trực tiếp</span>
        <span className="text-xs text-gray-500">{viewerCount} đang xem</span>
      </div>

      {/* Pinned message banner */}
      {pinned && (
        <div className="mx-3 mt-2 flex items-start gap-2 bg-yellow-50 border border-yellow-300 rounded-lg px-3 py-2">
          <Pin className="w-3.5 h-3.5 text-yellow-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-yellow-700 uppercase tracking-wide">Tin ghim</p>
            <p className="text-xs text-yellow-900 break-words">{pinned.text}</p>
          </div>
        </div>
      )}

      {/* Order confirm banner */}
      {orderConfirm && (
        <div className="mx-3 mt-2 flex items-center gap-2 bg-green-50 border border-green-300 rounded-lg px-3 py-2">
          <ShoppingCart className="w-3.5 h-3.5 text-green-600 shrink-0" />
          <p className="text-xs text-green-800">{orderConfirm}</p>
        </div>
      )}

      {/* Chat error banner */}
      {chatError && (
        <div className="mx-3 mt-2 flex items-center gap-2 bg-red-50 border border-red-300 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          <p className="text-xs text-red-700">{chatError}</p>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-2 min-h-0">
        {messages.map((m, i) => (
          <div key={i} className={`text-sm ${isOrderMsg(m) ? "bg-green-50 rounded px-2 py-1" : ""}`}>
            <span className={`font-medium ${isOrderMsg(m) ? "text-green-600" : "text-green-700"}`}>
              {m.user}:{" "}
            </span>
            <span className="text-gray-700">{m.text}</span>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-gray-400 text-sm text-center mt-8">Chưa có tin nhắn nào</p>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t flex flex-col gap-1">
        <p className="text-[10px] text-gray-400">Gõ <span className="font-mono bg-gray-100 px-1 rounded">/order [tên SP]</span> để đặt hàng qua chat</p>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Nhập tin nhắn..."
            maxLength={500}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={send}
            className="bg-green-600 text-white rounded-lg px-3 py-2 hover:bg-green-700 transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
