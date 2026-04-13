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

  const [discountVoucherCode, setDiscountVoucherCode] = useState("");
  const [shippingVoucherCode, setShippingVoucherCode] = useState("");
  const [deliveryType, setDeliveryType] = useState<"STANDARD" | "EXPRESS">("STANDARD");
  const [preview, setPreview] = useState<OrderPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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

  const refreshPreview = async () => {
    if (cartItems.length === 0) {
      setPreview(null);
      return;
    }
    if (!selectedDistrictId || !selectedWardCode) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await orderApi.preview({
        discountVoucherCode: discountVoucherCode.trim() || undefined,
        shippingVoucherCode: shippingVoucherCode.trim() || undefined,
        deliveryType,
        toDistrictId: selectedDistrictId,
        toWardCode: selectedWardCode,
      });
      const data = res.data?.data || res.data;
      setPreview(data);
      if (data?.deliveryType && data.deliveryType !== deliveryType) {
        setDeliveryType(data.deliveryType);
      }
    } catch (err: any) {
      setPreview(null);
      toast.error(err.response?.data?.message || "Không thể tính toán đơn hàng");
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
        discountVoucherCode: discountVoucherCode.trim() || undefined,
        shippingVoucherCode: shippingVoucherCode.trim() || undefined,
        deliveryType,
        toDistrictId: selectedDistrictId,
        toWardCode: selectedWardCode,
      });
      const latestPreview = latestPreviewRes.data?.data || latestPreviewRes.data;
      if (!latestPreview?.canCheckout) {
        toast.error("Không có phương thức vận chuyển phù hợp cho giỏ hàng");
        return;
      }

      const res = await orderApi.create(
        paymentMethod,
        undefined,
        discountVoucherCode.trim() || undefined,
        shippingVoucherCode.trim() || undefined,
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
                className="border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
              >
                <option value="">Tỉnh/Thành phố</option>
                {provinces.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
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
                className="border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-300 outline-none disabled:bg-gray-100"
              >
                <option value="">Quận/Huyện</option>
                {districts.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <select
                value={selectedWardCode}
                onChange={(e) => {
                  const code = e.target.value;
                  const selected = wards.find((w) => w.code === code);
                  setSelectedWardCode(code);
                  setWard(selected?.name || "");
                }}
                disabled={!selectedDistrictId}
                className="border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-300 outline-none disabled:bg-gray-100"
              >
                <option value="">Phường/Xã</option>
                {wards.map((item) => (
                  <option key={item.code} value={item.code}>{item.name}</option>
                ))}
              </select>
              <input
                value={streetDetail}
                onChange={(e) => setStreetDetail(e.target.value)}
                disabled={!selectedWardCode}
                placeholder="Số nhà, tên đường"
                className="border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-300 outline-none disabled:bg-gray-100"
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

          <div className="bg-white rounded-2xl border p-6">
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary-600" /> Hình thức giao hàng
            </h2>
            <div className="space-y-2">
              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${deliveryType === "STANDARD" ? "border-primary-500 bg-primary-50" : "hover:bg-gray-50"}`}>
                <input
                  type="radio"
                  name="deliveryType"
                  checked={deliveryType === "STANDARD"}
                  onChange={() => setDeliveryType("STANDARD")}
                  disabled={previewLoading || (!!preview && !preview.availableDeliveryTypes?.includes("STANDARD"))}
                  className="accent-primary-600"
                />
                <div>
                  <p className="font-medium text-sm">Giao tiêu chuẩn</p>
                  <p className="text-xs text-gray-400">Phù hợp đa số đơn hàng nông sản</p>
                </div>
              </label>
              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${deliveryType === "EXPRESS" ? "border-primary-500 bg-primary-50" : "hover:bg-gray-50"}`}>
                <input
                  type="radio"
                  name="deliveryType"
                  checked={deliveryType === "EXPRESS"}
                  onChange={() => setDeliveryType("EXPRESS")}
                  disabled={previewLoading || (!!preview && !preview.availableDeliveryTypes?.includes("EXPRESS"))}
                  className="accent-primary-600"
                />
                <div>
                  <p className="font-medium text-sm">Giao hỏa tốc</p>
                  <p className="text-xs text-gray-400">Chỉ áp dụng nội tỉnh và trong bán kính cho phép</p>
                </div>
              </label>
            </div>
            {preview?.shippingWarnings?.length ? (
              <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                {preview.shippingWarnings.map((warning, index) => (
                  <p key={`${warning}-${index}`}>{warning}</p>
                ))}
              </div>
            ) : null}
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
                    value={discountVoucherCode}
                    onChange={(e) => setDiscountVoucherCode(e.target.value)}
                    placeholder="Mã giảm giá đơn hàng"
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={shippingVoucherCode}
                    onChange={(e) => setShippingVoucherCode(e.target.value)}
                    placeholder="Mã freeship"
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 outline-none"
                  />
                </div>
                <button
                    type="button"
                    onClick={async () => {
                      await refreshPreview();
                      toast.success("Đã cập nhật mã ưu đãi");
                    }}
                    className="mt-2 w-full px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    Áp dụng ưu đãi
                  </button>
                </div>

              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Giảm giá đơn</span>
                  <span>-{formatPrice(discount)}</span>
                </div>
              )}

              {shippingDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Giảm phí ship</span>
                  <span>-{formatPrice(shippingDiscount)}</span>
                </div>
              )}

              {shippingFee === 0 && (
                <p className="text-xs text-green-600">Miễn phí vận chuyển cho đơn từ 500.000₫</p>
              )}
              {previewLoading && (
                <p className="text-xs text-gray-500">Đang tính toán phí và ưu đãi...</p>
              )}
              <hr />
              <div className="flex justify-between font-bold text-lg">
                <span>Tổng cộng</span>
                <span className="text-primary-600">{formatPrice(total)}</span>
              </div>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting || cartItems.length === 0 || previewLoading || (preview ? !preview.canCheckout : false)}
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
