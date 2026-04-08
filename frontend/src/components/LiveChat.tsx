"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Send } from "lucide-react";

interface Message {
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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = io(`${process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3000"}/live`, {
      transports: ["websocket"],
      path: "/ws",
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

    setSocket(s);
    return () => {
      s.emit("leave-room", streamKey);
      s.disconnect();
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

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <span className="font-semibold text-green-700">Trò chuyện trực tiếp</span>
        <span className="text-xs text-gray-500">{viewerCount} đang xem</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-2 min-h-0">
        {messages.map((m, i) => (
          <div key={i} className="text-sm">
            <span className="font-medium text-green-700">{m.user}: </span>
            <span className="text-gray-700">{m.text}</span>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-gray-400 text-sm text-center mt-8">Chưa có tin nhắn nào</p>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t flex gap-2">
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
  );
}
