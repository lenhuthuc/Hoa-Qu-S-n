"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Coins, ArrowUpCircle, ArrowDownCircle, Loader2, Gift } from "lucide-react";
import { coinApi, isLoggedIn } from "@/lib/api";

interface CoinTransaction {
  id: number;
  amount: number;
  type: string;
  description: string;
  referenceId: string | null;
  createdAt: string;
}

const TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  REVIEW_REWARD: { label: "Thưởng đánh giá", icon: "⭐" },
  ORDER_REWARD: { label: "Thưởng đơn hàng", icon: "🛒" },
  REFERRAL_REWARD: { label: "Thưởng giới thiệu", icon: "🤝" },
  VOUCHER_REDEEM: { label: "Đổi voucher", icon: "🎟️" },
};

export default function CoinsPage() {
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    loadData();
  }, [page]);

  async function loadData() {
    try {
      const [balRes, histRes] = await Promise.all([
        coinApi.getBalance(),
        coinApi.getHistory(page, 20),
      ]);
      const balData = balRes.data;
      setBalance(balData.balance || 0);
      setTotalEarned(balData.totalEarned || 0);
      setTotalSpent(balData.totalSpent || 0);

      const histData = histRes.data;
      setTransactions(histData.transactions?.content || histData.transactions || []);
      setTotalPages(histData.transactions?.totalPages || 0);
    } catch {
      // empty
    } finally {
      setLoading(false);
    }
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
        <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Coins className="w-6 h-6 text-yellow-500" /> Ví AgriCoin
        </h1>

        {/* Balance Card */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white mb-6 shadow-lg">
          <p className="text-sm opacity-80">Số dư hiện tại</p>
          <p className="text-4xl font-bold mt-1">{balance.toLocaleString("vi-VN")} 🪙</p>
          <div className="flex gap-6 mt-4 text-sm">
            <div className="flex items-center gap-1">
              <ArrowUpCircle className="w-4 h-4" />
              <span>Đã nhận: {totalEarned.toLocaleString("vi-VN")}</span>
            </div>
            <div className="flex items-center gap-1">
              <ArrowDownCircle className="w-4 h-4" />
              <span>Đã dùng: {totalSpent.toLocaleString("vi-VN")}</span>
            </div>
          </div>
        </div>

        {/* How to earn */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Gift className="w-5 h-5 text-yellow-500" /> Cách kiếm AgriCoin
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 bg-yellow-50 rounded-lg p-3">
              <span>⭐</span>
              <span>Đánh giá sản phẩm: <strong>+10 coin</strong></span>
            </div>
            <div className="flex items-center gap-2 bg-yellow-50 rounded-lg p-3">
              <span>🛒</span>
              <span>Hoàn thành đơn hàng: <strong>+5 coin</strong></span>
            </div>
            <div className="flex items-center gap-2 bg-yellow-50 rounded-lg p-3">
              <span>🤝</span>
              <span>Giới thiệu bạn bè: <strong>+20 coin</strong></span>
            </div>
            <div className="flex items-center gap-2 bg-yellow-50 rounded-lg p-3">
              <span>🎟️</span>
              <span>Đổi voucher giảm giá khi mua hàng</span>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-800">Lịch sử giao dịch</h2>
          </div>

          {transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              Chưa có giao dịch nào
            </div>
          ) : (
            <div className="divide-y">
              {transactions.map((tx) => {
                const isPositive = tx.amount > 0;
                const typeInfo = TYPE_LABELS[tx.type] || { label: tx.type, icon: "💰" };
                return (
                  <div key={tx.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{typeInfo.icon}</span>
                      <div>
                        <p className="font-medium text-gray-800">{typeInfo.label}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(tx.createdAt).toLocaleDateString("vi-VN", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                        {tx.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{tx.description}</p>
                        )}
                      </div>
                    </div>
                    <span className={`font-bold text-lg ${isPositive ? "text-green-600" : "text-red-500"}`}>
                      {isPositive ? "+" : ""}{tx.amount}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50"
              >
                ←
              </button>
              <span className="text-sm text-gray-600">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50"
              >
                →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
