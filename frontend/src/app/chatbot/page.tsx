"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Send, User, Loader2, Trash2, Leaf } from "lucide-react";
import { chatbotApi } from "@/lib/api";
import toast from "react-hot-toast";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Xin chào! Tôi là trợ lý AI chuyên về nông sản Việt Nam 🌿. Bạn có thể hỏi tôi về:\n\n• Kỹ thuật trồng trọt, chăm sóc cây\n• Giá cả thị trường nông sản\n• Mùa vụ, thời điểm thu hoạch\n• Bảo quản, chế biến nông sản\n• Tư vấn sản phẩm trên hệ thống\n\nHãy đặt câu hỏi nhé!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await chatbotApi.sendMessage(text);
      const reply = res.data?.data?.response || res.data?.response || res.data?.data || res.data || "Xin lỗi, tôi không thể trả lời lúc này.";
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: typeof reply === "string" ? reply : JSON.stringify(reply),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      toast.error("Không thể kết nối chatbot");
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Xin lỗi, có lỗi xảy ra. Vui lòng thử lại sau.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Cuộc trò chuyện đã được xóa. Bạn cần hỏi gì?",
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col" style={{ height: "calc(100vh - 80px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
            <Leaf className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h1 className="font-bold text-gray-800">Trợ lý nông sản AI</h1>
            <p className="text-xs text-gray-400">Powered by LLaMA 3.1 · Hỏi đáp nông nghiệp</p>
          </div>
        </div>
        <button
          onClick={clearChat}
          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
          title="Xóa lịch sử"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.role === "user" ? "bg-blue-100" : "bg-primary-100"
            }`}>
              {msg.role === "user" ? (
                <User className="w-4 h-4 text-blue-600" />
              ) : (
                <Bot className="w-4 h-4 text-primary-600" />
              )}
            </div>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-gray-100 text-gray-800 rounded-bl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-primary-600" />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="border-t pt-4">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nhập câu hỏi về nông sản..."
            rows={1}
            className="flex-1 border rounded-xl px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-primary-300 outline-none max-h-32"
            style={{ minHeight: "44px" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="p-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          AI có thể mắc sai sót. Hãy kiểm tra thông tin quan trọng.
        </p>
      </div>
    </div>
  );
}
