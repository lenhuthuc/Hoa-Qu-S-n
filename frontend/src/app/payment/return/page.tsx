"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";

function PaymentReturnContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [orderId, setOrderId] = useState<string>("");

  useEffect(() => {
    const vnp_ResponseCode = searchParams.get("vnp_ResponseCode");
    const vnp_TxnRef = searchParams.get("vnp_TxnRef");
    const vnp_OrderInfo = searchParams.get("vnp_OrderInfo");

    // Check if it's VNPay return
    if (vnp_ResponseCode) {
      setOrderId(vnp_TxnRef || "");
      setStatus(vnp_ResponseCode === "00" ? "success" : "failed");
      return;
    }

    // Handle MoMo return
    const momo_OrderId = searchParams.get("orderId");
    const momo_ResultCode = searchParams.get("resultCode");
    const momo_Message = searchParams.get("message");

    if (momo_OrderId && momo_ResultCode) {
      setOrderId(momo_OrderId);
      setStatus(momo_ResultCode === "0" ? "success" : "failed");
      return;
    }

    // Unknown payment type
    setStatus("failed");
  }, [searchParams]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="bg-white rounded-2xl border p-8 max-w-md w-full text-center">
        {status === "success" ? (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Thanh toán thành công!</h1>
            <p className="text-gray-500 mb-6">
              Đơn hàng {orderId && `#${orderId}`} của bạn đã được thanh toán thành công.
            </p>
            <div className="flex gap-3 justify-center">
              {orderId && (
                <Link
                  href={`/orders/${orderId}`}
                  className="px-6 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition"
                >
                  Xem đơn hàng
                </Link>
              )}
              <Link
                href="/orders"
                className="px-6 py-2.5 border rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition"
              >
                Danh sách đơn
              </Link>
            </div>
          </>
        ) : (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Thanh toán thất bại</h1>
            <p className="text-gray-500 mb-6">
              Giao dịch không thành công. Vui lòng thử lại hoặc chọn phương thức thanh toán khác.
            </p>
            <div className="flex gap-3 justify-center">
              {orderId && (
                <Link
                  href={`/orders/${orderId}`}
                  className="px-6 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition"
                >
                  Xem đơn hàng
                </Link>
              )}
              <Link
                href="/cart"
                className="px-6 py-2.5 border rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition"
              >
                Quay lại giỏ hàng
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
        </div>
      }
    >
      <PaymentReturnContent />
    </Suspense>
  );
}
