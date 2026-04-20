"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageCircle, Send, ArrowLeft, Loader2, Check, CheckCheck, Trash2 } from "lucide-react";
import { io, Socket } from "socket.io-client";
import { messageApi, isLoggedIn, parseToken } from "@/lib/api";
import toast from "react-hot-toast";
import { formatDateTimeVi, formatShortDateVi } from "@/lib/datetime";

// Module-level singleton — đảm bảo chỉ có 1 socket connection dù component remount bao nhiêu lần
let _dmSocket: Socket | null = null;

interface Conversation {
  id: number;
  otherUserId: number;
  otherUserName: string;
  otherUserAvatar?: string | null;
  myAvatar?: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  senderAvatar?: string | null;
  content: string;
  isRead: boolean;
  createdAt: string;
  isPending?: boolean;
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
      setMessages((prev) => {
        const pendingIndex = prev.findIndex(
          (m) =>
            m.isPending &&
            m.conversationId === msg.conversationId &&
            Number(m.senderId) === Number(msg.senderId) &&
            m.content === msg.content
        );

        if (pendingIndex >= 0) {
          const next = [...prev];
          next[pendingIndex] = { ...msg, isRead: false, isPending: false };
          return next;
        }

        return [...prev, { ...msg, isRead: false, isPending: false }];
      });
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
      const convs: Conversation[] = (res.data?.data || res.data || []) as Conversation[];
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
          const newConvId = resp.data?.data?.conversationId || resp.data?.conversationId;
          const fallbackOtherUserName = resp.data?.data?.otherUserName || resp.data?.otherUserName || `Người bán #${sellerId}`;
          if (!newConvId) {
            toast.error("Không thể tạo cuộc trò chuyện với người bán");
            return;
          }
          const refreshed = await messageApi.getConversations();
          const freshConvs: Conversation[] = (refreshed.data?.data || refreshed.data || []) as Conversation[];
          setConversations(freshConvs);
          const newConv = freshConvs.find((c) => c.id === newConvId);
          if (newConv) {
            openConversation(newConv);
          } else {
            openConversation({
              id: newConvId,
              otherUserId: sellerId,
              otherUserName: fallbackOtherUserName,
              lastMessage: "",
              lastMessageAt: new Date().toISOString(),
              unreadCount: 0,
            });
          }
        }
      }
    } catch {
      toast.error("Không thể tải danh sách hội thoại");
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

    const content = newMsg.trim();
    const nowIso = new Date().toISOString();
    const tempId = -Date.now();

    // Optimistic UI: show sender message immediately so user does not need to reload.
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        conversationId: activeConv.id,
        senderId: Number(userId),
        senderName: "Bạn",
        senderAvatar: activeConv.myAvatar || null,
        content,
        isRead: false,
        createdAt: nowIso,
        isPending: true,
      },
    ]);

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConv.id ? { ...c, lastMessage: content, lastMessageAt: nowIso } : c
      )
    );

    socket.emit("dm:send", {
      conversationId: activeConv.id,
      recipientId: activeConv.otherUserId,
      content,
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
    const today = formatShortDateVi(new Date().toISOString());
    const messageDate = formatShortDateVi(dateStr);
    if (messageDate === today) {
      const full = formatDateTimeVi(dateStr);
      return full ? full.slice(0, 5) : "";
    }
    return messageDate;
  }

  function getInitials(name?: string) {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "U";
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("").slice(0, 2) || "U";
  }

  function getAvatarStyle(name?: string) {
    const seed = (name || "U").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const palettes = [
      "from-emerald-500 to-emerald-700",
      "from-lime-500 to-lime-700",
      "from-teal-500 to-teal-700",
      "from-green-500 to-green-700",
      "from-slate-500 to-slate-700",
    ];
    return palettes[seed % palettes.length];
  }

  function renderAvatar(name: string | undefined, avatarUrl: string | null | undefined, sizeClass: string, textClass: string, ringClass = "") {
    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={name || "Avatar"}
          className={`${sizeClass} shrink-0 rounded-full object-cover shadow-sm ${ringClass}`}
        />
      );
    }

    return (
      <div className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarStyle(name)} ${textClass} font-bold text-white shadow-sm ${ringClass}`}>
        {getInitials(name)}
      </div>
    );
  }

  function goToShopProfile(sellerId: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/shop/${sellerId}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[#f4f7f1] text-slate-800">
      <div className="mx-auto max-w-[1400px] px-4 py-4 lg:px-6">
        <div className="mb-4 flex items-center gap-2 text-3xl font-extrabold tracking-tight text-slate-900">
          <MessageCircle className="h-8 w-8 text-[#1b4332]" />
          <h1>Tin nhắn</h1>
        </div>

        <div className="grid h-[calc(100vh-120px)] min-h-0 overflow-hidden rounded-[28px] border border-white/60 bg-white/80 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur-sm lg:grid-cols-[360px_1fr]">
          {/* ── Conversation list (left panel) ── */}
          <aside className={`flex min-h-0 flex-col border-r border-slate-200/80 bg-[#fbfcf8] ${activeConv ? "hidden lg:flex" : "flex"}`}>
            <div className="border-b border-slate-200 px-5 py-5">
              <p className="text-2xl font-extrabold tracking-tight text-slate-900">Tin nhắn</p>
              <p className="mt-1 text-sm text-slate-500">Hội thoại ({conversations.length})</p>
            </div>
            {conversations.length === 0 ? (
              <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-400">
                <div>
                  <p className="font-medium">Chưa có cuộc trò chuyện nào</p>
                  <p className="mt-1 text-xs">Các hội thoại sẽ hiển thị ở đây.</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto p-3">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => openConversation(conv)}
                    className={`mb-2 flex w-full items-center gap-3 rounded-[22px] px-4 py-3 text-left transition-all duration-200 ${activeConv?.id === conv.id ? "bg-[#1b4332] text-white shadow-lg shadow-emerald-900/15" : "bg-transparent hover:bg-emerald-50"}`}
                  >
                    <div onClick={(e) => goToShopProfile(conv.otherUserId, e)} title="Xem trang nông hộ" className="cursor-pointer">
                      {renderAvatar(conv.otherUserName, conv.otherUserAvatar, "h-12 w-12", "text-sm", "ring-2 ring-white/70")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <span
                          onClick={(e) => goToShopProfile(conv.otherUserId, e)}
                          title="Xem trang nông hộ"
                          className={`truncate text-[15px] font-bold hover:underline ${activeConv?.id === conv.id ? "text-white" : "text-slate-900"}`}
                        >
                          {conv.otherUserName}
                        </span>
                        <span className={`shrink-0 text-[11px] ${activeConv?.id === conv.id ? "text-emerald-100" : "text-slate-400"}`}>
                          {formatTime(conv.lastMessageAt)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <p className={`truncate text-sm ${activeConv?.id === conv.id ? "text-emerald-50/90" : "text-slate-500"}`}>
                          {conv.lastMessage || "..."}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-xs font-bold text-white">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </aside>

          {/* ── Chat area (right panel) ── */}
          <section className={`flex min-h-0 min-w-0 flex-1 flex-col ${activeConv ? "flex" : "hidden lg:flex"}`}>
            {activeConv ? (
              <>
                {/* Header */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <button onClick={() => { setActiveConv(null); setMessages([]); }} className="shrink-0 rounded-full p-2 text-slate-500 transition hover:bg-slate-100 lg:hidden">
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div onClick={(e) => goToShopProfile(activeConv.otherUserId, e)} title="Xem trang nông hộ" className="cursor-pointer">
                      {renderAvatar(activeConv.otherUserName, activeConv.otherUserAvatar, "h-12 w-12", "text-sm")}
                    </div>
                    <div className="min-w-0">
                      <p
                        onClick={(e) => goToShopProfile(activeConv.otherUserId, e)}
                        title="Xem trang nông hộ"
                        className="truncate text-lg font-bold text-slate-900 hover:underline"
                      >
                        {activeConv.otherUserName}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleDeleteConversation}
                    className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-500 hover:text-white"
                    title="Xóa cuộc hội thoại"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Xóa Chat</span>
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 min-h-0 overflow-y-auto bg-[#f8faf6] px-4 py-5 lg:px-6">
                  {msgLoading ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-[#1b4332]" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-slate-400">
                      <div className="text-center">
                        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                          <MessageCircle className="h-8 w-8 text-slate-300" />
                        </div>
                        <p>Hãy bắt đầu cuộc trò chuyện!</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((msg, i) => {
                      const isMine = msg.senderId === userId;
                      const isLast = i === messages.length - 1;
                      return (
                        <div key={msg.id ?? i} className={`flex items-end gap-3 ${isMine ? "justify-end" : "justify-start"}`}>
                          {!isMine && (
                            renderAvatar(msg.senderName, msg.senderAvatar, "h-9 w-9", "text-[11px]")
                          )}
                          <div className={`max-w-[min(70%,34rem)] rounded-[24px] px-4 py-3 shadow-sm ${isMine ? "rounded-br-md bg-[#1b4332] text-white" : "rounded-bl-md bg-white text-slate-800 ring-1 ring-slate-200"} ${msg.isPending ? "opacity-80" : "opacity-100"}`}>
                            <p className="whitespace-pre-wrap text-sm leading-6">{msg.content}</p>
                            <div className={`mt-1 flex items-center gap-1 ${isMine ? "justify-end" : "justify-start"}`}>
                              <span className={`text-[11px] ${isMine ? "text-emerald-100" : "text-slate-400"}`}>
                                {formatTime(msg.createdAt)}
                              </span>
                              {isMine && isLast && (
                                msg.isRead
                                  ? <CheckCheck className="h-3 w-3 text-emerald-100" />
                                  : <Check className="h-3 w-3 text-emerald-200" />
                              )}
                            </div>
                          </div>
                          {isMine && (
                            renderAvatar("Bạn", activeConv?.myAvatar, "h-9 w-9", "text-[11px]")
                          )}
                        </div>
                      );
                      })}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSend} className="border-t border-slate-200 bg-white px-4 py-4 lg:px-6">
                  <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-[#f7faf6] px-4 py-2.5 shadow-sm focus-within:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-100">
                    <input
                      type="text"
                      value={newMsg}
                      onChange={handleInputChange}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e as any); } }}
                      placeholder="Nhập tin nhắn..."
                      maxLength={2000}
                      className="flex-1 bg-transparent px-1 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                    />
                    <button
                      type="submit"
                      disabled={!newMsg.trim()}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1b4332] text-white transition hover:bg-[#244f3d] disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Gửi tin nhắn"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center bg-[#f8faf6] text-slate-400">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                    <MessageCircle className="h-8 w-8 text-slate-300" />
                  </div>
                  <p className="text-sm font-medium">Chọn cuộc hội thoại để bắt đầu</p>
                </div>
              </div>
            )}
          </section>
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
