"use client";
import { useEffect, useState } from "react";
import { getReturnEvidenceMediaSrc, isVideoEvidenceUrl, parseEvidenceUrls, returnApi } from "@/lib/api";
import Link from "next/link";

interface ReturnRequest {
  id: number;
  orderId: number;
  buyerId: number;
  buyerName: string;
  sellerId: number;
  sellerName: string;
  reasonCode: string;
  description: string;
  evidenceUrls: string | null;
  refundAmount: number;
  status: string;
  sellerResponse: string | null;
  createdAt: string;
  updatedAt: string;
  deadline: string;
}

interface OrderSummary {
  id: number;
  status: string;
  totalAmount: number;
}

const REASON_CODES = [
  { value: "DAMAGED", label: "Hàng bị dập nát do vận chuyển" },
  { value: "WRONG_ITEM", label: "Không đúng mô tả" },
  { value: "MISSING_QUANTITY", label: "Giao thiếu số lượng" },
  { value: "SPOILED", label: "Hàng biến chất / hỏng" },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Đã gửi yêu cầu", color: "bg-yellow-100 text-yellow-700" },
  SELLER_REVIEWING: { label: "Nông hộ đang xem xét", color: "bg-blue-100 text-blue-700" },
  APPROVED: { label: "Đã chấp nhận", color: "bg-green-100 text-green-700" },
  REJECTED: { label: "Bị từ chối", color: "bg-red-100 text-red-700" },
  REJECTED_ACCEPTED: { label: "Đã chấp nhận từ chối", color: "bg-slate-100 text-slate-700" },
  ESCALATED: { label: "Đã khiếu nại lên sàn", color: "bg-amber-100 text-amber-800" },
  REFUNDED: { label: "Đã hoàn tiền", color: "bg-green-200 text-green-800" },
};

function splitResolutionResponse(rawResponse?: string | null): {
  sellerMessage: string;
  adminMessage: string;
} {
  const normalized = (rawResponse || "").trim();
  if (!normalized) {
    return { sellerMessage: "", adminMessage: "" };
  }

  const markerIndex = normalized.indexOf("[Admin");
  if (markerIndex === -1) {
    return { sellerMessage: normalized, adminMessage: "" };
  }

  const sellerMessage = normalized.slice(0, markerIndex).trim();
  const adminChunk = normalized.slice(markerIndex).trim();
  const closingBracketIndex = adminChunk.indexOf("]");
  const adminMessage = closingBracketIndex >= 0
    ? adminChunk.slice(closingBracketIndex + 1).trim()
    : adminChunk.replace(/^\[.*?\]\s*/, "").trim();
  return { sellerMessage, adminMessage };
}

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReturns();
  }, []);

  async function loadReturns() {
    try {
      const res = await returnApi.getMyRequests();
      setReturns(res.data);
    } catch {
      // endpoint may not exist yet
    } finally {
      setLoading(false);
    }
  }

  async function handleBuyerDecision(returnId: number, action: "ACCEPT_REJECTION" | "ESCALATE") {
    try {
      await returnApi.buyerDecision(returnId, action);
      await loadReturns();
    } catch (err: any) {
      alert(err.response?.data?.message || "Không thể cập nhật quyết định");
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
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Hoàn trả & Khiếu nại</h1>
          <Link href="/orders" className="px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50">
            ← Đơn hàng
          </Link>
        </div>

        {/* Returns list */}
        {returns.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center text-gray-500">
            <p className="mb-4">Bạn chưa có yêu cầu hoàn trả nào</p>
            <p className="text-sm">Nếu sản phẩm nhận được bị hư hỏng, bạn có thể tạo yêu cầu hoàn trả trong vòng 24h kể từ khi nhận hàng.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {returns.map((ret) => (
              <div id={`order-${ret.orderId}`} key={ret.id} className="bg-white rounded-lg shadow p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-800">Phiếu #{ret.id}</span>
                    <Link
                      href={`/orders/${ret.orderId}`}
                      className="text-sm text-blue-500 hover:underline"
                    >
                      Đơn #{ret.orderId}
                    </Link>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_MAP[ret.status]?.color || "bg-gray-100"}`}>
                      {STATUS_MAP[ret.status]?.label || ret.status}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(ret.createdAt).toLocaleDateString("vi-VN")}
                  </span>
                </div>

                <div className="text-sm space-y-1 mb-3">
                  <div><span className="text-gray-500">Shop:</span> {ret.sellerName}</div>
                  <div><span className="text-gray-500">Lý do:</span> {REASON_CODES.find(r => r.value === ret.reasonCode)?.label || ret.reasonCode}</div>
                  <div><span className="text-gray-500">Mô tả:</span> {ret.description}</div>
                  <div>
                    <span className="text-gray-500">Số tiền hoàn:</span>{" "}
                    <span className="font-medium text-red-600">{Number(ret.refundAmount).toLocaleString("vi-VN")}₫</span>
                  </div>
                </div>

                {ret.evidenceUrls && (
                  <div className="mb-3 rounded-lg bg-gray-50 p-3 text-sm">
                    <p className="mb-2 font-medium text-gray-700">Bằng chứng</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {parseEvidenceUrls(ret.evidenceUrls).map((url) => {
                        const mediaSrc = getReturnEvidenceMediaSrc(url);
                        const fileName = url.split("/").pop() || url;

                        return (
                          <div key={url} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                            <div className="h-44 bg-gray-100">
                              {isVideoEvidenceUrl(url) ? (
                                <video src={mediaSrc} controls className="h-full w-full object-cover" />
                              ) : (
                                <img src={mediaSrc} alt={fileName} className="h-full w-full object-cover" />
                              )}
                            </div>
                            <div className="px-3 py-2 text-xs text-gray-600">
                              <p className="truncate font-medium text-gray-700">{fileName}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(() => {
                  const { sellerMessage, adminMessage } = splitResolutionResponse(ret.sellerResponse);

                  if (!sellerMessage && !adminMessage) {
                    return null;
                  }

                  return (
                    <div className="space-y-2">
                      {sellerMessage && (
                        <div className="rounded-lg bg-gray-50 p-3 text-sm">
                          <span className="font-medium text-gray-700">Phản hồi từ nông hộ:</span>{" "}
                          <span className="text-gray-800">{sellerMessage}</span>
                        </div>
                      )}

                      {adminMessage && (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                          <p className="font-semibold text-emerald-700">Admin</p>
                          <p className="mt-1 text-emerald-900">{adminMessage}</p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {ret.status === "REJECTED" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleBuyerDecision(ret.id, "ACCEPT_REJECTION")}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      Chấp nhận quyết định từ chối
                    </button>
                    <button
                      onClick={() => handleBuyerDecision(ret.id, "ESCALATE")}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                    >
                      Khiếu nại lên sàn
                    </button>
                  </div>
                )}

                {ret.deadline && ret.status === "PENDING" && (
                  <div className="text-xs text-orange-500 mt-2">
                    ⏱ Thời hạn phản hồi: {new Date(ret.deadline).toLocaleString("vi-VN")}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
