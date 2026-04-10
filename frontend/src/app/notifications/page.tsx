"use client";
import { useEffect, useState } from "react";
import { notificationApi } from "@/lib/api";
import Link from "next/link";

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  referenceId: number | null;
  isRead: boolean;
  createdAt: string;
}

const TYPE_ICON: Record<string, string> = {
  ORDER_PLACED: "🛒",
  ORDER_SHIPPED: "🚚",
  ORDER_COMPLETED: "✅",
  ORDER_CANCELLED: "❌",
  RETURN_REQUESTED: "↩️",
  RETURN_APPROVED: "✅",
  RETURN_REJECTED: "❌",
  RETURN_REFUNDED: "💰",
  REVIEW_RECEIVED: "⭐",
  LIVESTREAM_STARTED: "📺",
  SYSTEM: "🔔",
};

function getLink(type: string, referenceId: number | null): string | null {
  if (!referenceId) return null;
  if (type.startsWith("ORDER_")) return `/orders/${referenceId}`;
  if (type.startsWith("RETURN_")) return `/returns`;
  return null;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    loadNotifications();
  }, [page]);

  async function loadNotifications() {
    try {
      const res = await notificationApi.getAll(page, 20);
      setNotifications(res.data.content || []);
      setTotalPages(res.data.totalPages || 0);
    } catch {
      // empty
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkAllRead() {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {}
  }

  async function handleMarkRead(id: number) {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch {}
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Thông báo</h1>
          {notifications.some((n) => !n.isRead) && (
            <button
              onClick={handleMarkAllRead}
              className="text-sm text-green-600 hover:underline"
            >
              Đánh dấu tất cả đã đọc
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center text-gray-500">
            Bạn chưa có thông báo nào
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => {
              const link = getLink(n.type, n.referenceId);
              const content = (
                <div
                  className={`bg-white rounded-lg p-4 flex items-start gap-3 transition ${
                    !n.isRead ? "border-l-4 border-green-500 bg-green-50/50" : ""
                  } ${link ? "hover:shadow-md cursor-pointer" : ""}`}
                  onClick={() => !n.isRead && handleMarkRead(n.id)}
                >
                  <span className="text-2xl">{TYPE_ICON[n.type] || "🔔"}</span>
                  <div className="flex-1">
                    <p className={`text-sm ${!n.isRead ? "font-semibold" : ""} text-gray-800`}>
                      {n.title}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(n.createdAt).toLocaleString("vi-VN")}
                    </p>
                  </div>
                  {!n.isRead && (
                    <span className="w-2.5 h-2.5 bg-green-500 rounded-full mt-1.5 flex-shrink-0" />
                  )}
                </div>
              );

              return link ? (
                <Link key={n.id} href={link}>
                  {content}
                </Link>
              ) : (
                <div key={n.id}>{content}</div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 bg-white border rounded disabled:opacity-50"
            >
              ← Trước
            </button>
            <span className="px-3 py-1 text-sm text-gray-500">
              Trang {page + 1}/{totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 bg-white border rounded disabled:opacity-50"
            >
              Sau →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
