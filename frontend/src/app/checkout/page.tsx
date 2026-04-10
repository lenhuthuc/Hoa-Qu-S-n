"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShoppingBag,
  Loader2,
  CreditCard,
  Banknote,
  Leaf,
  MapPin,
  ChevronLeft,
} from "lucide-react";
import { cartApi, orderApi, paymentApi, userApi, parseToken } from "@/lib/api";
import toast from "react-hot-toast";

interface CartItem {
  id: number;
  productId: number;
  productName: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<number>(1);
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [ward, setWard] = useState("");
  const [streetDetail, setStreetDetail] = useState("");

  const [voucherCode, setVoucherCode] = useState("");
  const [discount, setDiscount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [cartRes, profileRes] = await Promise.all([
          cartApi.getItems(),
          userApi.getProfile(),
        ]);
        const items = cartRes.data?.data || cartRes.data || [];
        setCartItems(Array.isArray(items) ? items : []);
        const profile = profileRes.data?.data || profileRes.data;
        if (profile?.address) {
          setProvince(profile.address.province || "");
          setDistrict(profile.address.district || "");
          setWard(profile.address.ward || "");
          setStreetDetail(profile.address.streetDetail || "");
        }
      } catch {
        toast.error("Không thể tải giỏ hàng");
        router.push("/cart");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingFee = subtotal >= 500000 ? 0 : 30000;
  const total = subtotal + shippingFee - discount;

  const handleSubmit = async () => {
    if (cartItems.length === 0) return;
    if (!province.trim() || !district.trim() || !ward.trim()) {
      toast.error("Vui lòng nhập địa chỉ giao hàng");
      return;
    }

    setSubmitting(true);
    try {
      const userInfo = parseToken();
      if (userInfo?.id) {
        await userApi.update(userInfo.id, {
          province: province.trim(),
          district: district.trim(),
          ward: ward.trim(),
          streetDetail: streetDetail.trim(),
        });
      }

      const res = await orderApi.create(paymentMethod, voucherCode);
      const order = res.data?.data || res.data;

      if (paymentMethod === 2 && order?.paymentUrl) {
        window.location.href = order.paymentUrl;
        return;
      }

      toast.success("Đặt hàng thành công!");
      router.push(`/orders/${order?.id || ""}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Đặt hàng thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShoppingBag className="w-16 h-16 text-gray-300" />
        <p className="text-gray-500">Giỏ hàng trống</p>
        <Link href="/search" className="text-primary-600 hover:underline">Tiếp tục mua sắm</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <button onClick={() => router.push("/cart")} className="flex items-center gap-1 text-gray-500 hover:text-primary-600 mb-6 text-sm">
        <ChevronLeft className="w-4 h-4" /> Quay lại giỏ hàng
      </button>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Thanh toán</h1>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="lg:col-span-2 space-y-6">
          {/* Address */}
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary-600" /> Địa chỉ giao hàng
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                placeholder="Tỉnh/Thành phố"
                className="border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
              />
              <input
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="Quận/Huyện"
                className="border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <input
                value={ward}
                onChange={(e) => setWard(e.target.value)}
                placeholder="Phường/Xã"
                className="border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
              />
              <input
                value={streetDetail}
                onChange={(e) => setStreetDetail(e.target.value)}
                placeholder="Số nhà, tên đường"
                className="border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
              />
            </div>
          </div>

          {/* Payment method */}
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary-600" /> Phương thức thanh toán
            </h2>
            <div className="space-y-2">
              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${paymentMethod === 1 ? "border-primary-500 bg-primary-50" : "hover:bg-gray-50"}`}>
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 1}
                  onChange={() => setPaymentMethod(1)}
                  className="accent-primary-600"
                />
                <Banknote className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="font-medium text-sm">Thanh toán khi nhận hàng (COD)</p>
                  <p className="text-xs text-gray-400">Trả tiền mặt khi nhận hàng</p>
                </div>
              </label>
              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${paymentMethod === 2 ? "border-primary-500 bg-primary-50" : "hover:bg-gray-50"}`}>
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 2}
                  onChange={() => setPaymentMethod(2)}
                  className="accent-primary-600"
                />
                <CreditCard className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-sm">VNPay</p>
                  <p className="text-xs text-gray-400">Thanh toán qua ví VNPay, ngân hàng</p>
                </div>
              </label>
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="font-semibold text-gray-800 mb-3">Sản phẩm ({cartItems.length})</h2>
            <div className="space-y-3">
              {cartItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                    ) : (
                      <Leaf className="w-5 h-5 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.productName}</p>
                    <p className="text-xs text-gray-400">x{item.quantity}</p>
                  </div>
                  <span className="text-sm font-bold text-gray-700">{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border p-6 sticky top-28">
            <h2 className="font-semibold text-gray-800 mb-4">Tóm tắt đơn hàng</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Tạm tính</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Phí vận chuyển</span>
                {shippingFee === 0 ? (
                  <span className="text-green-600 font-medium">Miễn phí</span>
                ) : (
                  <span>{formatPrice(shippingFee)}</span>
                )}
              </div>

              {/* Voucher Section */}
              <div className="pt-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value)}
                    placeholder="Mã giảm giá"
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 outline-none"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                        if (voucherCode.trim()) toast.success("Đã áp dụng mã. Giá sẽ được cập nhật khi đặt hàng.");
                    }}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    Áp dụng
                  </button>
                </div>
              </div>

              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Giảm giá</span>
                  <span>-{formatPrice(discount)}</span>
                </div>
              )}

              {shippingFee === 0 && (
                <p className="text-xs text-green-600">Miễn phí vận chuyển cho đơn từ 500.000₫</p>
              )}
              <hr />
              <div className="flex justify-between font-bold text-lg">
                <span>Tổng cộng</span>
                <span className="text-primary-600">{formatPrice(total)}</span>
              </div>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting || cartItems.length === 0}
              className="w-full mt-6 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : paymentMethod === 2 ? (
                <>
                  <CreditCard className="w-5 h-5" /> Thanh toán VNPay
                </>
              ) : (
                <>
                  <ShoppingBag className="w-5 h-5" /> Đặt hàng
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
