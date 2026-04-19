"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CheckCircle,
  ChevronRight,
  Clock3,
  Eye,
  Loader2,
  MessageCircle,
  Package,
  RefreshCcw,
  ShoppingBag,
  Store,
  Trash2,
  Truck,
  XCircle,
} from "lucide-react";
import { cartApi, orderApi } from "@/lib/api";
import toast from "react-hot-toast";

interface Order {
  id: number;
  totalAmount: number;
  status: string;
  paymentMethod?: string;
  createdAt: string;
  totalItems?: number;
  paymentUrl?: string;
  items?: Array<{
    productId?: number;
    productName: string;
    quantity: number;
    price: number;
    imageUrl?: string;
    sellerId?: number;
    sellerName?: string;
  }>;
}

interface OrderDetailItem {
  productId: number;
  productName: string;
  quantity: number;
  price: number;
  imageUrl?: string;
  sellerId?: number;
  sellerName?: string;
}

interface OrderDetail {
  id: number;
  totalAmount: number;
  shippingFee?: number;
  status: string;
  paymentMethod?: string;
  paymentUrl?: string;
  createdAt: string;
  buyerConfirmedAt?: string;
  items?: OrderDetailItem[];
}

const FILTERS: Array<{
  key: "ALL" | "WAIT_CONFIRM" | "WAIT_SHIP" | "FINISHED" | "CANCELLED";
  label: string;
  statuses: string[] | null;
}> = [
  { key: "ALL", label: "Tất cả", statuses: null },
  { key: "WAIT_CONFIRM", label: "Chờ xác nhận", statuses: ["PENDING", "PLACED", "PENDING_PAYMENT", "PAID"] },
  { key: "WAIT_SHIP", label: "Chờ giao hàng", statuses: ["PREPARING", "SHIPPED"] },
  { key: "FINISHED", label: "Hoàn thành", statuses: ["FINISHED"] },
  { key: "CANCELLED", label: "Đã hủy", statuses: ["CANCELLED"] },
];

type OrderFilterKey = (typeof FILTERS)[number]["key"];

const STATUS_META: Record<string, { label: string; className: string; icon: ReactNode }> = {
  PENDING: { label: "Chờ xác nhận", className: "bg-amber-100 text-amber-700", icon: <Clock3 className="w-4 h-4" /> },
  PLACED: { label: "Chờ xác nhận", className: "bg-amber-100 text-amber-700", icon: <Clock3 className="w-4 h-4" /> },
  PENDING_PAYMENT: { label: "Chờ thanh toán", className: "bg-amber-100 text-amber-700", icon: <Clock3 className="w-4 h-4" /> },
  PAID: { label: "Chờ giao hàng", className: "bg-sky-100 text-sky-700", icon: <Truck className="w-4 h-4" /> },
  PREPARING: { label: "Chờ giao hàng", className: "bg-sky-100 text-sky-700", icon: <Truck className="w-4 h-4" /> },
  SHIPPED: { label: "Đang giao", className: "bg-violet-100 text-violet-700", icon: <Truck className="w-4 h-4" /> },
  FINISHED: { label: "Hoàn thành", className: "bg-emerald-100 text-emerald-700", icon: <BadgeCheck className="w-4 h-4" /> },
  CANCELLED: { label: "Đã hủy", className: "bg-rose-100 text-rose-700", icon: <XCircle className="w-4 h-4" /> },
};

function isVnPayMethod(method?: string): boolean {
  if (!method) return false;
  const normalized = method.trim().toUpperCase();
  return normalized === "2" || normalized.includes("VNPAY");
}

function getPaymentMethodLabel(method?: string): string {
  return isVnPayMethod(method) ? "Thanh toán bằng VNPay" : "Tiền mặt khi nhận hàng (COD)";
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderDetails, setOrderDetails] = useState<Record<number, OrderDetail>>({});
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<OrderFilterKey>("ALL");
  const [savingOrderId, setSavingOrderId] = useState<number | null>(null);
  const inFlightDetailIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const res = await orderApi.getMyOrders();
        const list = res.data?.data || res.data || [];
        const normalizedOrders = Array.isArray(list) ? list : [];
        setOrders(normalizedOrders);
      } catch (err: any) {
        if (err.response?.status === 401 || err.response?.status === 403) {
          toast.error("Vui lòng đăng nhập");
          router.push("/login");
        } else {
          toast.error(err.response?.data?.message || "Không thể tải đơn hàng");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);

  const formatDate = (value: string) =>
    value
      ? new Date(value).toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  const getStatusMeta = (status: string) => STATUS_META[status] || {
    label: status,
    className: "bg-gray-100 text-gray-700",
    icon: <Clock3 className="w-4 h-4" />,
  };

  const filteredOrders = orders.filter((order) => {
    const filter = FILTERS.find((item) => item.key === activeFilter);
    return !filter?.statuses || filter.statuses.includes(order.status);
  });

  const getOrderDetail = useCallback(async (orderId: number): Promise<OrderDetail | null> => {
    if (orderDetails[orderId]) {
      return orderDetails[orderId];
    }

    if (inFlightDetailIdsRef.current.has(orderId)) {
      return null;
    }

    inFlightDetailIdsRef.current.add(orderId);
    try {
      const res = await orderApi.getById(orderId);
      const detail = res.data?.data || res.data;
      setOrderDetails((prev) => ({ ...prev, [orderId]: detail }));
      return detail;
    } catch {
      return null;
    } finally {
      inFlightDetailIdsRef.current.delete(orderId);
    }
  }, [orderDetails]);

  useEffect(() => {
    if (loading || filteredOrders.length === 0) return;

    let cancelled = false;
    const loadVisibleOrderDetails = async () => {
      for (const order of filteredOrders) {
        if (cancelled) return;
        if (orderDetails[order.id] || inFlightDetailIdsRef.current.has(order.id)) continue;
        await getOrderDetail(order.id);
      }
    };

    void loadVisibleOrderDetails();
    return () => {
      cancelled = true;
    };
  }, [filteredOrders, getOrderDetail, loading, orderDetails]);

  const handleCancel = async (id: number) => {
    if (!confirm("Bạn muốn hủy đơn hàng này?")) return;
    setSavingOrderId(id);
    try {
      await orderApi.updateStatus(id, "CANCELLED");
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "CANCELLED" } : o)));
      setOrderDetails((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], status: "CANCELLED" } } : prev));
      toast.success("Đã hủy đơn hàng");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Không thể hủy đơn hàng");
    } finally {
      setSavingOrderId(null);
    }
  };

  const handleConfirmReceived = async (id: number) => {
    if (!confirm("Xác nhận đã nhận hàng?")) return;
    setSavingOrderId(id);
    try {
      await orderApi.updateStatus(id, "FINISHED");
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "FINISHED" } : o)));
      setOrderDetails((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], status: "FINISHED" } } : prev));
      toast.success("Đã xác nhận nhận hàng");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Không thể cập nhật");
    } finally {
      setSavingOrderId(null);
    }
  };

  const handleRebuy = async (id: number) => {
    const detail = await getOrderDetail(id);
    if (!detail?.items?.length) {
      router.push("/search");
      return;
    }

    setSavingOrderId(id);
    try {
      await Promise.all(
        detail.items.map((item) =>
          cartApi.addItem({ productId: item.productId, quantity: Number(item.quantity || 1) })
        )
      );
      toast.success("Đã thêm lại sản phẩm vào giỏ hàng");
      router.push("/cart");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Không thể mua lại đơn hàng");
    } finally {
      setSavingOrderId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gradient-to-br from-emerald-50 to-white">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50">
      <div className="max-w-7xl mx-auto px-4 py-8 lg:py-12">
        <div className="mb-8 rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-lime-600 px-6 py-7 lg:px-8 lg:py-9 text-white shadow-lg shadow-emerald-900/10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm uppercase tracking-[0.28em] text-emerald-100 mb-3">Đơn mua</p>
              <h1 className="text-3xl lg:text-5xl font-bold tracking-tight">Lịch sử đơn hàng của bạn</h1>
              <p className="mt-3 text-emerald-50/90 text-sm lg:text-base">
                Theo dõi trạng thái, xem chi tiết từng đơn, liên hệ người bán hoặc mua lại chỉ với một nút bấm.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/profile"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                <Store className="w-4 h-4" />
                Hồ sơ
              </Link>
              <Link
                href="/search"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
              >
                <ShoppingBag className="w-4 h-4" />
                Tiếp tục mua sắm
              </Link>
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          {FILTERS.map((filter) => {
            const count = filter.statuses ? orders.filter((order) => filter.statuses?.includes(order.status)).length : orders.length;
            const active = activeFilter === filter.key;
            return (
              <button
                key={filter.key}
                onClick={() => setActiveFilter(filter.key)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                    : "border-emerald-100 bg-white text-gray-700 hover:border-emerald-200 hover:text-emerald-700"
                }`}
              >
                <span>{filter.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/15 text-white" : "bg-emerald-50 text-emerald-700"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        {filteredOrders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-emerald-200 bg-white/80 p-14 text-center shadow-sm">
            <ShoppingBag className="mx-auto mb-4 h-16 w-16 text-emerald-200" />
            <p className="text-lg font-semibold text-gray-900">Chưa có đơn hàng phù hợp</p>
            <p className="mt-2 text-sm text-gray-500">Hãy đổi bộ lọc hoặc quay lại mua sắm để tạo đơn mới.</p>
            <Link
              href="/search"
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <ShoppingBag className="w-4 h-4" />
              Khám phá sản phẩm
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredOrders.map((order) => {
              const detail = orderDetails[order.id];
              const items = detail?.items || order.items || [];
              const statusMeta = getStatusMeta(order.status);
              const sellerNames = Array.from(new Set(items.map((item) => item.sellerName).filter(Boolean) as string[]));
              const shopLabel = sellerNames.length === 1 ? sellerNames[0] : sellerNames.length > 1 ? "Nhiều shop" : "Shop nông sản";
              const sellerIds = Array.from(new Set(items.map((item) => item.sellerId).filter((value): value is number => typeof value === "number")));
              const contactSellerHref = sellerIds.length === 1 ? `/messages?sellerId=${sellerIds[0]}` : "/messages";
              const canCancel = ["PENDING", "PENDING_PAYMENT", "PLACED", "PREPARING"].includes(order.status);
              const canConfirm = order.status === "SHIPPED";
              const canRebuy = ["FINISHED", "CANCELLED"].includes(order.status);
              const paymentUrl = order.paymentUrl || detail?.paymentUrl;

              return (
                <article key={order.id} className="overflow-hidden rounded-3xl border border-emerald-100 bg-white/95 shadow-sm backdrop-blur">
                  <div className="border-b border-emerald-50 px-6 py-5 lg:px-7">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
                            <Store className="w-4 h-4" />
                            {shopLabel}
                          </span>
                          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${statusMeta.className}`}>
                            {statusMeta.icon}
                            {statusMeta.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                          <span className="font-mono text-gray-900">#{order.id}</span>
                          <span className="h-1 w-1 rounded-full bg-gray-300" />
                          <span>{formatDate(order.createdAt)}</span>
                          <span className="h-1 w-1 rounded-full bg-gray-300" />
                          <span>{order.totalItems ?? items.length ?? 0} sản phẩm</span>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-left lg:text-right">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700/80">Tổng tiền</p>
                        <p className="mt-1 text-2xl font-bold text-gray-900">{formatPrice(Number(order.totalAmount || 0))}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-5 px-6 py-6 lg:grid-cols-[1.3fr_0.7fr] lg:px-7">
                    <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4 lg:p-5">
                      <div className="mb-4 flex items-center gap-2">
                        <Package className="w-5 h-5 text-emerald-600" />
                        <h2 className="text-base font-bold text-gray-900">Danh sách sản phẩm</h2>
                      </div>

                      {items.length > 0 ? (
                        <div className="space-y-4">
                          {items.slice(0, 3).map((item, index) => (
                            <div key={`${order.id}-${item.productId}-${index}`} className="flex gap-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
                              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100">
                                {item.imageUrl ? (
                                  <img src={item.imageUrl} alt={item.productName} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-gray-300">
                                    <Package className="h-5 w-5" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-gray-900">{item.productName}</p>
                                    <p className="mt-1 text-xs text-gray-500">
                                      {item.sellerName ? `Shop: ${item.sellerName}` : "Shop: Hoa Quả Sơn"}
                                    </p>
                                  </div>
                                  <p className="text-sm font-bold text-gray-900">{formatPrice(Number(item.price || 0) * Number(item.quantity || 0))}</p>
                                </div>
                                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                                  <span>x{item.quantity}</span>
                                  <span>{formatPrice(Number(item.price || 0))}/sp</span>
                                </div>
                              </div>
                            </div>
                          ))}

                          {items.length > 3 && (
                            <p className="pl-1 text-sm text-gray-500">+ {items.length - 3} sản phẩm khác</p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3 rounded-2xl border border-dashed border-gray-200 bg-white p-4">
                          {[0, 1].map((row) => (
                            <div key={`${order.id}-skeleton-${row}`} className="flex items-center gap-3">
                              <div className="h-14 w-14 rounded-lg bg-gray-100 animate-pulse" />
                              <div className="flex-1 space-y-2">
                                <div className="h-3.5 w-3/5 rounded bg-gray-100 animate-pulse" />
                                <div className="h-3 w-2/5 rounded bg-gray-100 animate-pulse" />
                              </div>
                              <div className="h-3.5 w-16 rounded bg-gray-100 animate-pulse" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-white p-4 lg:p-5">
                      <div className="mb-4 flex items-center gap-2">
                        <Truck className="w-5 h-5 text-emerald-600" />
                        <h2 className="text-base font-bold text-gray-900">Thông tin đơn</h2>
                      </div>

                      <div className="space-y-3 text-sm text-gray-600">
                        <div className="flex items-center justify-between gap-3">
                          <span>Phương thức</span>
                          <span className="font-semibold text-gray-900">{getPaymentMethodLabel(order.paymentMethod || detail?.paymentMethod)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Trạng thái</span>
                          <span className="font-semibold text-gray-900">{statusMeta.label}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Sản phẩm</span>
                          <span className="font-semibold text-gray-900">{order.totalItems ?? items.length ?? 0}</span>
                        </div>
                      </div>

                      <div className="mt-5 space-y-2">
                        <Link
                          href={contactSellerHref}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Liên hệ người bán
                        </Link>

                        {canConfirm && (
                          <button
                            onClick={() => handleConfirmReceived(order.id)}
                            disabled={savingOrderId === order.id}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {savingOrderId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />}
                            Đã nhận hàng
                          </button>
                        )}

                        {canCancel && (
                          <button
                            onClick={() => handleCancel(order.id)}
                            disabled={savingOrderId === order.id}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {savingOrderId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            Hủy đơn
                          </button>
                        )}

                        {canRebuy && (
                          <button
                            onClick={() => handleRebuy(order.id)}
                            disabled={savingOrderId === order.id}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {savingOrderId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                            Mua lại
                          </button>
                        )}

                        {order.status === "PENDING_PAYMENT" && paymentUrl && (
                          <a
                            href={paymentUrl}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-lime-600 px-4 py-3 text-sm font-semibold text-white transition hover:from-emerald-700 hover:to-lime-700"
                          >
                            <BadgeCheck className="w-4 h-4" />
                            Thanh toán ngay
                          </a>
                        )}

                        <Link
                          href={`/orders/${order.id}`}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                        >
                          <Eye className="w-4 h-4" />
                          Xem chi tiết
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
