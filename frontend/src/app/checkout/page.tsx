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
  Truck,
} from "lucide-react";
import { cartApi, orderApi, userApi, parseToken, shippingApi } from "@/lib/api";
import toast from "react-hot-toast";

interface CartItem {
  id: number;
  productId: number;
  productName: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

interface OrderPreview {
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  shippingDiscountAmount: number;
  totalAmount: number;
  deliveryType: "STANDARD" | "EXPRESS";
  availableDeliveryTypes: Array<"STANDARD" | "EXPRESS">;
  shippingWarnings: string[];
  canCheckout: boolean;
}

interface ProvinceOption {
  id: number;
  name: string;
}

interface DistrictOption {
  id: number;
  name: string;
  provinceId?: number;
}

interface WardOption {
  code: string;
  name: string;
  districtId?: number;
}

interface ProfileAddress {
  province?: string;
  district?: string;
  ward?: string;
  streetDetail?: string;
  ghnProvinceId?: number;
  ghnDistrictId?: number;
  ghnWardCode?: string;
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
  const [selectedProvinceId, setSelectedProvinceId] = useState<number | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>("");
  const [selectedWardCode, setSelectedWardCode] = useState<string>("");
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [wards, setWards] = useState<WardOption[]>([]);

  const [deliveryType, setDeliveryType] = useState<"STANDARD" | "EXPRESS">("STANDARD");
  const [preview, setPreview] = useState<OrderPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const loadProvinces = async () => {
    try {
      const res = await shippingApi.provinces();
      const data = res.data?.data || res.data || [];
      setProvinces(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Không thể tải danh sách tỉnh/thành");
    }
  };

  const loadDistricts = async (provinceId: number) => {
    try {
      const res = await shippingApi.districts(provinceId);
      const data = res.data?.data || res.data || [];
      setDistricts(Array.isArray(data) ? data : []);
    } catch {
      setDistricts([]);
      toast.error("Không thể tải danh sách quận/huyện");
    }
  };

  const loadWards = async (districtId: number) => {
    try {
      const res = await shippingApi.wards(districtId);
      const data = res.data?.data || res.data || [];
      setWards(Array.isArray(data) ? data : []);
    } catch {
      setWards([]);
      toast.error("Không thể tải danh sách phường/xã");
    }
  };

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
        const address: ProfileAddress | undefined = profile?.address;
        if (address) {
          setProvince(address.province || "");
          setDistrict(address.district || "");
          setWard(address.ward || "");
          setStreetDetail(address.streetDetail || "");
          if (address.ghnProvinceId) {
            setSelectedProvinceId(address.ghnProvinceId);
            await loadDistricts(address.ghnProvinceId);
          }
          if (address.ghnDistrictId) {
            setSelectedDistrictId(String(address.ghnDistrictId));
            await loadWards(address.ghnDistrictId);
          }
          if (address.ghnWardCode) {
            setSelectedWardCode(address.ghnWardCode);
          }
        }
        await loadProvinces();
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

  const subtotal = preview?.subtotal ?? cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingFee = preview?.shippingFee ?? (subtotal >= 500000 ? 0 : 30000);
  const discount = preview?.discountAmount ?? 0;
  const shippingDiscount = preview?.shippingDiscountAmount ?? 0;
  const total = preview?.totalAmount ?? (subtotal + shippingFee - discount - shippingDiscount);
  const hasSelectedShippingAddress = Boolean(selectedDistrictId && selectedWardCode);
  const isShippingBlocked = Boolean(preview && !preview.canCheckout);
  const isStandardDisabled = Boolean(preview && !preview.availableDeliveryTypes?.includes("STANDARD"));
  const isExpressDisabled = Boolean(preview && !preview.availableDeliveryTypes?.includes("EXPRESS"));
  const standardHint = isStandardDisabled
    ? "Không khả dụng cho một số sản phẩm trong giỏ hàng do không đảm bảo độ tươi sống."
    : "Phù hợp đa số đơn hàng nông sản";
  const expressHint = isExpressDisabled
    ? "Hiện GHN chưa hỗ trợ hỏa tốc cho tuyến giao này."
    : "Chỉ áp dụng nội tỉnh và trong bán kính cho phép";
  const shippingBlockMessage = isShippingBlocked
    ? "Không thể giao vì không đảm bảo độ tươi sống của sản phẩm tại địa chỉ này. Vui lòng đổi địa chỉ nhận hoặc điều chỉnh giỏ hàng."
    : (!previewLoading && hasSelectedShippingAddress && !preview && previewError)
      ? previewError
      : null;

  const refreshPreview = async () => {
    if (cartItems.length === 0) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    if (!selectedDistrictId || !selectedWardCode) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await orderApi.preview({
        deliveryType,
        toDistrictId: selectedDistrictId,
        toWardCode: selectedWardCode,
      });
      const data = res.data?.data || res.data;
      setPreview(data);
      setPreviewError(null);
      if (data?.deliveryType && data.deliveryType !== deliveryType) {
        setDeliveryType(data.deliveryType);
      }
    } catch (err: any) {
      setPreview(null);
      const message = err.response?.data?.message
        || err.response?.data?.error
        || "Không thể tính toán đơn hàng";
      setPreviewError(message);
      toast.error(message);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      void refreshPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, deliveryType, selectedDistrictId, selectedWardCode]);

  useEffect(() => {
    if (selectedProvinceId || !province || provinces.length === 0) return;
    const matched = provinces.find((p) =>
      p.name.toLowerCase().includes(province.toLowerCase()) || province.toLowerCase().includes(p.name.toLowerCase())
    );
    if (matched) {
      setSelectedProvinceId(matched.id);
      void loadDistricts(matched.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provinces, province, selectedProvinceId]);

  useEffect(() => {
    if (!selectedProvinceId || selectedDistrictId || !district || districts.length === 0) return;
    const matched = districts.find((d) =>
      d.name.toLowerCase().includes(district.toLowerCase()) || district.toLowerCase().includes(d.name.toLowerCase())
    );
    if (matched) {
      setSelectedDistrictId(String(matched.id));
      void loadWards(matched.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [districts, district, selectedProvinceId, selectedDistrictId]);

  useEffect(() => {
    if (!selectedDistrictId || selectedWardCode || !ward || wards.length === 0) return;
    const matched = wards.find((w) =>
      w.name.toLowerCase().includes(ward.toLowerCase()) || ward.toLowerCase().includes(w.name.toLowerCase())
    );
    if (matched) {
      setSelectedWardCode(matched.code);
    }
  }, [wards, ward, selectedDistrictId, selectedWardCode]);

  const handleSubmit = async () => {
    if (cartItems.length === 0) return;
    if (!province.trim() || !district.trim() || !ward.trim() || !selectedDistrictId || !selectedWardCode) {
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
          ghnProvinceId: selectedProvinceId || undefined,
          ghnDistrictId: selectedDistrictId ? Number(selectedDistrictId) : undefined,
          ghnWardCode: selectedWardCode || undefined,
        });
      }

      const latestPreviewRes = await orderApi.preview({
        deliveryType,
        toDistrictId: selectedDistrictId,
        toWardCode: selectedWardCode,
      });
      const latestPreview = latestPreviewRes.data?.data || latestPreviewRes.data;
      if (!latestPreview?.canCheckout) {
        const blockedMessage = latestPreview?.shippingWarnings?.[0]
          || "Không thể giao vì không đảm bảo độ tươi sống của sản phẩm";
        toast.error(blockedMessage);
        return;
      }

      const res = await orderApi.create(
        paymentMethod,
        undefined,
        undefined,
        undefined,
        latestPreview.deliveryType || deliveryType,
        selectedDistrictId,
        selectedWardCode
      );
      const order = res.data?.data || res.data;

      if (paymentMethod === 2 && order?.paymentUrl) {
        window.location.href = order.paymentUrl;
        return;
      }

      toast.success("Đặt hàng thành công!");
      router.push(`/orders/${order?.id || ""}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.response?.data?.error || "Đặt hàng thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-green-700" />
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShoppingBag className="w-16 h-16 text-gray-300" />
        <p className="text-gray-500">Giỏ hàng trống</p>
        <Link href="/search" className="text-green-700 hover:underline">Tiếp tục mua sắm</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 py-8 lg:py-12">
        <button onClick={() => router.push("/cart")} className="flex items-center gap-2 text-gray-600 hover:text-green-700 mb-6 text-sm font-medium transition">
          <ChevronLeft className="w-4 h-4" /> Quay lại giỏ hàng
        </button>
        <div className="mb-8">
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-2">Thanh toán</h1>
          <p className="text-gray-600 font-medium text-lg">Hoàn tất đơn hàng của bạn</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Forms (7 cols) */}
          <div className="lg:col-span-7 space-y-8">
            {/* Shipping Address Section */}
            <section className="bg-white rounded-2xl p-6 lg:p-8 border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-green-700" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Địa chỉ giao hàng</h2>
                  <p className="text-sm text-gray-500">Chọn nơi nhận hàng của bạn</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Tỉnh/Thành phố</label>
                  <select
                    value={selectedProvinceId ?? ""}
                    onChange={async (e) => {
                      const id = Number(e.target.value);
                      const selected = provinces.find((p) => p.id === id);
                      setSelectedProvinceId(id || null);
                      setProvince(selected?.name || "");
                      setSelectedDistrictId("");
                      setSelectedWardCode("");
                      setDistrict("");
                      setWard("");
                      setWards([]);
                      if (id) await loadDistricts(id);
                    }}
                    className="bg-gray-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-green-600 focus:ring-offset-0 outline-none font-medium"
                  >
                    <option value="">Chọn tỉnh/thành phố</option>
                    {provinces.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Quận/Huyện</label>
                  <select
                    value={selectedDistrictId}
                    onChange={async (e) => {
                      const id = e.target.value;
                      const selected = districts.find((d) => String(d.id) === id);
                      setSelectedDistrictId(id);
                      setDistrict(selected?.name || "");
                      setSelectedWardCode("");
                      setWard("");
                      if (id) {
                        await loadWards(Number(id));
                      } else {
                        setWards([]);
                      }
                    }}
                    disabled={!selectedProvinceId}
                    className="bg-gray-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-green-600 focus:ring-offset-0 outline-none font-medium disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">Chọn quận/huyện</option>
                    {districts.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Phường/Xã</label>
                  <select
                    value={selectedWardCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      const selected = wards.find((w) => w.code === code);
                      setSelectedWardCode(code);
                      setWard(selected?.name || "");
                    }}
                    disabled={!selectedDistrictId}
                    className="bg-gray-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-green-600 focus:ring-offset-0 outline-none font-medium disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">Chọn phường/xã</option>
                    {wards.map((item) => (
                      <option key={item.code} value={item.code}>{item.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Địa chỉ cụ thể</label>
                  <input
                    value={streetDetail}
                    onChange={(e) => setStreetDetail(e.target.value)}
                    disabled={!selectedWardCode}
                    placeholder="Số nhà, tên đường"
                    className="bg-gray-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-green-600 focus:ring-offset-0 outline-none font-medium disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
              </div>
            </section>

            {/* Shipping Method Section */}
            <section className="bg-white rounded-2xl p-6 lg:p-8 border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <Truck className="w-6 h-6 text-green-700" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Phương thức vận chuyển</h2>
                  <p className="text-sm text-gray-500">Chọn cách bạn muốn nhận hàng</p>
                </div>
              </div>

              <div className="space-y-3">
                <label className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition ${deliveryType === "STANDARD" ? "border-green-600 bg-green-50" : "border-gray-200 hover:border-gray-300 bg-white"}`}>
                  <div className="flex items-center gap-4 flex-1">
                    <input
                      type="radio"
                      name="deliveryType"
                      checked={deliveryType === "STANDARD"}
                      onChange={() => setDeliveryType("STANDARD")}
                      disabled={previewLoading || (!!preview && !preview.availableDeliveryTypes?.includes("STANDARD"))}
                      className="accent-green-600 w-5 h-5"
                    />
                    <div>
                      <p className="font-bold text-gray-900">Giao tiêu chuẩn</p>
                      <p className={`text-xs font-medium ${isStandardDisabled ? "text-orange-600" : "text-gray-500"}`}>{standardHint}</p>
                    </div>
                  </div>
                  {preview?.availableDeliveryTypes?.includes("STANDARD") && (
                    <span className="text-right flex-shrink-0 font-bold text-gray-900">{formatPrice(preview?.shippingFee || 0)}</span>
                  )}
                </label>

                <label className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition ${deliveryType === "EXPRESS" ? "border-green-600 bg-green-50" : "border-gray-200 hover:border-gray-300 bg-white"}`}>
                  <div className="flex items-center gap-4 flex-1">
                    <input
                      type="radio"
                      name="deliveryType"
                      checked={deliveryType === "EXPRESS"}
                      onChange={() => setDeliveryType("EXPRESS")}
                      disabled={previewLoading || (!!preview && !preview.availableDeliveryTypes?.includes("EXPRESS"))}
                      className="accent-green-600 w-5 h-5"
                    />
                    <div>
                      <p className="font-bold text-gray-900">Giao hỏa tốc</p>
                      <p className={`text-xs font-medium ${isExpressDisabled ? "text-orange-600" : "text-gray-500"}`}>{expressHint}</p>
                    </div>
                  </div>
                  {preview?.availableDeliveryTypes?.includes("EXPRESS") && (
                    <span className="text-right flex-shrink-0 font-bold text-gray-900">{formatPrice(preview?.shippingFee || 0)}</span>
                  )}
                </label>
              </div>

              {shippingBlockMessage ? (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm font-bold text-red-900 mb-1">Không thể hoàn tất đơn hàng</p>
                  <p className="text-sm text-red-700">{shippingBlockMessage}</p>
                </div>
              ) : null}
            </section>

            {/* Payment Method Section */}
            <section className="bg-white rounded-2xl p-6 lg:p-8 border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-green-700" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Phương thức thanh toán</h2>
                  <p className="text-sm text-gray-500">Chọn cách thanh toán</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setPaymentMethod(1)}
                  className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition ${paymentMethod === 1 ? "border-green-600 bg-green-50" : "border-gray-200 hover:border-gray-300 bg-white"}`}
                >
                  <Banknote className={`w-8 h-8 mb-2 ${paymentMethod === 1 ? "text-green-600" : "text-gray-400"}`} />
                  <span className="text-sm font-bold text-center text-gray-900">Thanh toán khi nhận hàng</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod(2)}
                  className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition ${paymentMethod === 2 ? "border-green-600 bg-green-50" : "border-gray-200 hover:border-gray-300 bg-white"}`}
                >
                  <CreditCard className={`w-8 h-8 mb-2 ${paymentMethod === 2 ? "text-green-600" : "text-gray-400"}`} />
                  <span className="text-sm font-bold text-center text-gray-900">Thanh toán online</span>
                </button>
              </div>

              {paymentMethod === 2 && (
                <div className="space-y-4 pt-6 mt-6 border-t border-gray-200">
                  <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="w-5 h-5 text-gray-400" />
                    <p className="text-sm font-medium text-gray-600">Thông tin thanh toán</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">Phương thức thanh toán</label>
                    <select className="bg-gray-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-green-600 focus:ring-offset-0 outline-none font-medium">
                      <option>VNPay</option>
                      <option>Ngân hàng điện tử</option>
                    </select>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">Bạn sẽ được chuyển hướng đến ngân hàng để thanh toán an toàn</p>
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Order Summary (5 cols, sticky) */}
          <div className="lg:col-span-5">
            <div className="sticky top-24 bg-white rounded-2xl border border-gray-200 p-6 lg:p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Tóm tắt đơn hàng</h2>

              {/* Product List */}
              <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto pr-2">
                {cartItems.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                      ) : (
                        <Leaf className="w-5 h-5 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 text-sm truncate">{item.productName}</h3>
                      <p className="text-xs text-gray-500 mb-1">x{item.quantity}</p>
                      <span className="font-bold text-green-700">{formatPrice(item.price * item.quantity)}</span>
                    </div>
                  </div>
                ))}
                {cartItems.length > 5 && (
                  <p className="text-xs text-gray-500 italic pt-2">+ {cartItems.length - 5} sản phẩm khác...</p>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="space-y-3 pt-6 border-t border-gray-200 mb-6">
                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="text-gray-500">Tạm tính</span>
                  <span className="text-gray-900">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="text-gray-500">Phí vận chuyển</span>
                  <span className={`${shippingFee === 0 ? "text-green-700" : "text-gray-900"}`}>
                    {shippingFee === 0 ? "Miễn phí" : formatPrice(shippingFee)}
                  </span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-gray-500">Giảm giá đơn</span>
                    <span className="text-green-700">-{formatPrice(discount)}</span>
                  </div>
                )}

                {shippingDiscount > 0 && (
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-gray-500">Giảm phí ship</span>
                    <span className="text-green-700">-{formatPrice(shippingDiscount)}</span>
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="mb-6 pb-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">Tổng cộng</span>
                  <span className="text-3xl font-bold text-green-700">{formatPrice(total)}</span>
                </div>
              </div>

              {/* Messages */}
              {previewLoading && (
                <p className="text-xs text-gray-500 text-center mb-3">Đang tính toán phí và ưu đãi...</p>
              )}

              {shippingFee === 0 && !previewLoading && (
                <p className="text-xs text-green-700 text-center mb-3 font-medium">✓ Miễn phí vận chuyển</p>
              )}

              {/* Submit Button */}
              <button
                onClick={async () => {
                  await refreshPreview();
                  await handleSubmit();
                }}
                disabled={submitting || cartItems.length === 0 || previewLoading || isShippingBlocked || Boolean(shippingBlockMessage)}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-green-600 to-green-700 text-white font-bold text-lg hover:from-green-700 hover:to-green-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-95"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Đang xử lý...
                  </>
                ) : paymentMethod === 2 ? (
                  <>
                    <CreditCard className="w-5 h-5" /> Thanh toán
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-5 h-5" /> Đặt hàng
                  </>
                )}
              </button>

              <p className="mt-4 text-center text-xs text-gray-500">
                Bằng cách đặt hàng, bạn đồng ý với <a className="text-green-700 hover:underline" href="#">Điều khoản dịch vụ</a> của chúng tôi.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
