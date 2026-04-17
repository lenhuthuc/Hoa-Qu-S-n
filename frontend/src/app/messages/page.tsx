"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageCircle, Send, ArrowLeft, Loader2, Check, CheckCheck, Trash2 } from "lucide-react";
import { io, Socket } from "socket.io-client";
import { messageApi, isLoggedIn, parseToken } from "@/lib/api";
import toast from "react-hot-toast";

// Module-level singleton — đảm bảo chỉ có 1 socket connection dù component remount bao nhiêu lần
let _dmSocket: Socket | null = null;

interface Conversation {
  id: number;
  otherUserId: number;
  otherUserName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

function MessagesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeConvRef = useRef<Conversation | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = parseToken()?.id;

  // Keep a ref to activeConv so socket callbacks can read the latest value
  useEffect(() => { activeConvRef.current = activeConv; }, [activeConv]);

  // ─── Socket setup ───
  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }

    // Dùng singleton — nếu socket đã được tạo (dù đang connecting hay connected) thì tái sử dụng
    if (_dmSocket) {
      console.log("[socket] reusing existing socket, id:", _dmSocket.id);
      setSocket(_dmSocket);
      loadConversations(_dmSocket);
      return;
    }
    console.log("[socket] creating NEW socket");

    const token = typeof window !== "undefined" ? localStorage.getItem("hqs_token") : null;

    const s = io(
      `${process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3000"}/dm`,
      { transports: ["websocket"], path: "/ws", auth: token ? { token } : {} }
    );
    _dmSocket = s;

    // dm:message — CHỈ dành cho người NHẬN (bỏ qua nếu là tin mình gửi)
    s.on("dm:message", (msg: Message) => {
      console.log("[dm:message] fired", msg.id, "senderId:", msg.senderId, "userId:", userId);
      if (Number(msg.senderId) === Number(userId)) return;
      if (activeConvRef.current?.id === msg.conversationId) {
        setMessages((prev) => [...prev, msg]);
      }
      setConversations((prev) =>
        prev.map((c) =>
          c.id === msg.conversationId
            ? {
                ...c,
                lastMessage: msg.content,
                lastMessageAt: msg.createdAt,
                unreadCount: activeConvRef.current?.id === msg.conversationId ? 0 : c.unreadCount + 1,
              }
            : c
        )
      );
    });

    // dm:sent — CHỈ dành cho người GỬI (server xác nhận đã lưu DB)
    s.on("dm:sent", (msg: Message) => {
      console.log("[dm:sent] fired", msg.id);
      setMessages((prev) => [...prev, { ...msg, isRead: false }]);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === msg.conversationId
            ? { ...c, lastMessage: msg.content, lastMessageAt: msg.createdAt }
            : c
        )
      );
    });

    // Typing indicator from partner
    s.on("dm:typing", (data: { conversationId: number; senderId: number; isTyping: boolean }) => {
      if (activeConvRef.current?.id === data.conversationId && data.senderId !== userId) {
        setPartnerTyping(data.isTyping);
        if (data.isTyping) {
          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          typingTimerRef.current = setTimeout(() => setPartnerTyping(false), 3000);
        }
      }
    });

    setSocket(s);
    loadConversations(s);

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      // Không disconnect ở đây — singleton tồn tại xuyên suốt
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadConversations(_s?: Socket) {
    try {
      const res = await messageApi.getConversations();
      const convs: Conversation[] = res.data || [];
      setConversations(convs);

      // Auto-open conversation when coming from product/shop page (?sellerId=x)
      const sellerIdParam = searchParams?.get("sellerId");
      if (sellerIdParam) {
        const sellerId = Number(sellerIdParam);
        const existing = convs.find((c) => c.otherUserId === sellerId);
        if (existing) {
          openConversation(existing);
        } else {
          const resp = await messageApi.getOrCreateConversation(sellerId);
          const newConvId = resp.data?.conversationId;
          const refreshed = await messageApi.getConversations();
          const freshConvs: Conversation[] = refreshed.data || [];
          setConversations(freshConvs);
          const newConv = freshConvs.find((c) => c.id === newConvId);
          if (newConv) openConversation(newConv);
        }
      }
    } catch {
      // empty
    } finally {
      setLoading(false);
    }
  }

  async function openConversation(conv: Conversation) {
    setActiveConv(conv);
    setMessages([]); // clear ngay khi switch conversation
    setPartnerTyping(false);
    setMsgLoading(true);
    try {
      const res = await messageApi.getMessages(conv.id);
      const msgs: Message[] = res.data?.messages || res.data?.content || [];
      const fetched = [...msgs].reverse(); // oldest first
      const fetchedIds = new Set(fetched.map((m) => m.id));
      setMessages((prev) => {
        // Giữ lại các tin nhắn đến qua socket trong lúc API đang fetch (tránh ghi đè)
        const pending = prev.filter((m) => m.id && !fetchedIds.has(m.id));
        return [...fetched, ...pending];
      });
      setConversations((prev) =>
        prev.map((c) => c.id === conv.id ? { ...c, unreadCount: 0 } : c)
      );
    } catch (err) {
      console.error("[openConversation] failed to load messages:", err);
    } finally {
      setMsgLoading(false);
    }
  }

  async function handleDeleteConversation() {
    if (!activeConv) return;
    if (!confirm("Bạn có chắc chắn muốn xóa cuộc hội thoại này? Tất cả tin nhắn sẽ bị mất.")) return;

    try {
      await messageApi.deleteConversation(activeConv.id);
      toast.success("Đã xóa cuộc hội thoại");
      setConversations((prev) => prev.filter((c) => c.id !== activeConv.id));
      setActiveConv(null);
      setMessages([]);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Không thể xóa cuộc hội thoại");
    }
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMsg.trim() || !activeConv || !socket) return;
    socket.emit("dm:send", {
      conversationId: activeConv.id,
      recipientId: activeConv.otherUserId,
      content: newMsg.trim(),
    });
    socket.emit("dm:typing", { conversationId: activeConv.id, recipientId: activeConv.otherUserId, isTyping: false });
    setNewMsg("");
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setNewMsg(e.target.value);
    if (!socket || !activeConv) return;
    socket.emit("dm:typing", { conversationId: activeConv.id, recipientId: activeConv.otherUserId, isTyping: true });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket.emit("dm:typing", { conversationId: activeConv.id, recipientId: activeConv.otherUserId, isTyping: false });
    }, 2000);
  }

  function formatTime(dateStr: string) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-green-600" /> Tin nhắn
        </h1>

        <div className="bg-white rounded-lg shadow flex" style={{ height: "70vh" }}>
          {/* ── Conversation list (left panel) ── */}
          <div className={`w-full md:w-80 border-r flex flex-col ${activeConv ? "hidden md:flex" : "flex"}`}>
            <div className="px-4 py-3 border-b">
              <p className="text-sm font-medium text-gray-500">Hội thoại ({conversations.length})</p>
            </div>
            {conversations.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 p-4 text-center text-sm">
                <p>Chưa có cuộc trò chuyện nào</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => openConversation(conv)}
                    className={`w-full text-left px-4 py-3 border-b hover:bg-gray-50 transition-colors ${activeConv?.id === conv.id ? "bg-green-50 border-l-4 border-l-green-500" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-semibold text-gray-800 truncate ${conv.unreadCount > 0 ? "text-gray-900" : ""}`}>
                        {conv.otherUserName}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">{formatTime(conv.lastMessageAt)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5 gap-2">
                      <p className={`text-sm truncate ${conv.unreadCount > 0 ? "text-gray-800 font-medium" : "text-gray-500"}`}>
                        {conv.lastMessage || "..."}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 shrink-0">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Chat area (right panel) ── */}
          <div className={`flex-1 flex flex-col min-w-0 ${activeConv ? "flex" : "hidden md:flex"}`}>
            {activeConv ? (
              <>
                {/* Header */}
                <div className="px-4 py-3 border-b flex items-center justify-between gap-3 bg-gray-50">
                  <div className="flex items-center gap-3 min-w-0">
                    <button onClick={() => { setActiveConv(null); setMessages([]); }} className="md:hidden text-gray-500 shrink-0">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{activeConv.otherUserName}</p>
                      <p className={`text-xs transition-all duration-200 ${partnerTyping ? "text-green-500" : "text-transparent"}`}>
                        Đang nhập...
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleDeleteConversation}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-full border border-red-100 transition-all font-medium text-xs"
                    title="Xóa cuộc hội thoại"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Xóa Chat</span>
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                  {msgLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-6 h-6 animate-spin text-green-500" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                      <p>Hãy bắt đầu cuộc trò chuyện!</p>
                    </div>
                  ) : (
                    messages.map((msg, i) => {
                      const isMine = msg.senderId === userId;
                      const isLast = i === messages.length - 1;
                      return (
                        <div key={msg.id ?? i} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${isMine ? "bg-green-500 text-white" : "bg-gray-100 text-gray-800"}`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            <div className={`flex items-center gap-1 mt-0.5 ${isMine ? "justify-end" : "justify-start"}`}>
                              <span className={`text-xs ${isMine ? "text-green-100" : "text-gray-400"}`}>
                                {formatTime(msg.createdAt)}
                              </span>
                              {isMine && isLast && (
                                msg.isRead
                                  ? <CheckCheck className="w-3 h-3 text-green-100" />
                                  : <Check className="w-3 h-3 text-green-200" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSend} className="px-4 py-3 border-t flex gap-2">
                  <input
                    type="text"
                    value={newMsg}
                    onChange={handleInputChange}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e as any); } }}
                    placeholder="Nhập tin nhắn..."
                    maxLength={2000}
                    className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-green-500"
                  />
                  <button
                    type="submit"
                    disabled={!newMsg.trim()}
                    className="bg-green-500 hover:bg-green-600 text-white rounded-full p-2 disabled:opacity-50 transition-colors shrink-0"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">Chọn cuộc hội thoại để bắt đầu</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" /></div>}>
      <MessagesInner />
    </Suspense>
  );
}
