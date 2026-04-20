"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImagePlus, Loader2, Save, Store } from "lucide-react";
import toast from "react-hot-toast";
import { hasRole, isLoggedIn, sellerApi, shippingApi } from "@/lib/api";

interface ShopSettingsForm {
  shopName: string;
  avatar: string;
  province: string;
  district: string;
  ward: string;
  streetDetail: string;
  ghnProvinceId: number;
  ghnDistrictId: number;
  ghnWardCode: string;
}

interface ProvinceOption {
  id: number;
  name: string;
}

interface DistrictOption {
  id: number;
  name: string;
}

interface WardOption {
  code: string;
  name: string;
}

function normalizeAvatarUrl(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return "";
  if (value.startsWith("/api/reviews/media")) return value;
  if (value.startsWith("local:") || value.startsWith("review-media/") || value.startsWith("reviews/") || value.includes(".r2.cloudflarestorage.com/")) {
    return `/api/reviews/media?url=${encodeURIComponent(value)}`;
  }
  return value;
}

export default function SellerShopSettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [wards, setWards] = useState<WardOption[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<ShopSettingsForm>({
    shopName: "",
    avatar: "",
    province: "",
    district: "",
    ward: "",
    streetDetail: "",
    ghnProvinceId: 0,
    ghnDistrictId: 0,
    ghnWardCode: "",
  });

  const loadProvinces = async (): Promise<ProvinceOption[]> => {
    try {
      const res = await shippingApi.provinces();
      const data = res.data?.data || res.data || [];
      const list = Array.isArray(data) ? data : [];
      setProvinces(list);
      return list;
    } catch {
      setProvinces([]);
      toast.error("Không thể tải danh sách tỉnh/thành");
      return [];
    }
  };

  const loadDistricts = async (provinceId: number): Promise<DistrictOption[]> => {
    try {
      const res = await shippingApi.districts(provinceId);
      const data = res.data?.data || res.data || [];
      const list = Array.isArray(data) ? data : [];
      setDistricts(list);
      return list;
    } catch {
      setDistricts([]);
      toast.error("Không thể tải danh sách quận/huyện");
      return [];
    }
  };

  const loadWards = async (districtId: number): Promise<WardOption[]> => {
    try {
      const res = await shippingApi.wards(districtId);
      const data = res.data?.data || res.data || [];
      const list = Array.isArray(data) ? data : [];
      setWards(list);
      return list;
    } catch {
      setWards([]);
      toast.error("Không thể tải danh sách phường/xã");
      return [];
    }
  };

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    if (!hasRole("SELLER") && !hasRole("ADMIN")) {
      router.replace("/seller/register");
      return;
    }

    (async () => {
      try {
        const res = await sellerApi.getShopSettings();
        const data = res.data || {};

        let resolvedProvinceId = Number(data.ghnProvinceId || 0);
        let resolvedDistrictId = Number(data.ghnDistrictId || 0);
        let resolvedWardCode = typeof data.ghnWardCode === "string" ? data.ghnWardCode : "";
        let resolvedProvinceName = typeof data.province === "string" ? data.province : "";
        let resolvedDistrictName = typeof data.district === "string" ? data.district : "";
        let resolvedWardName = typeof data.ward === "string" ? data.ward : "";

        const provinceList = await loadProvinces();
        if (!resolvedProvinceId && resolvedProvinceName) {
          resolvedProvinceId = provinceList.find((p) => p.name.toLowerCase() === resolvedProvinceName.toLowerCase())?.id || 0;
        }

        let districtList: DistrictOption[] = [];
        if (resolvedProvinceId) {
          districtList = await loadDistricts(resolvedProvinceId);
          if (!resolvedDistrictId && resolvedDistrictName) {
            resolvedDistrictId = districtList.find((d) => d.name.toLowerCase() === resolvedDistrictName.toLowerCase())?.id || 0;
          }
        }

        let wardList: WardOption[] = [];
        if (resolvedDistrictId) {
          wardList = await loadWards(resolvedDistrictId);
          if (!resolvedWardCode && resolvedWardName) {
            resolvedWardCode = wardList.find((w) => w.name.toLowerCase() === resolvedWardName.toLowerCase())?.code || "";
          }
          if (!resolvedWardName && resolvedWardCode) {
            resolvedWardName = wardList.find((w) => w.code === resolvedWardCode)?.name || "";
          }
        }

        if (!resolvedProvinceName && resolvedProvinceId) {
          resolvedProvinceName = provinceList.find((p) => p.id === resolvedProvinceId)?.name || "";
        }
        if (!resolvedDistrictName && resolvedDistrictId) {
          resolvedDistrictName = districtList.find((d) => d.id === resolvedDistrictId)?.name || "";
        }

        setForm({
          shopName: typeof data.shopName === "string" ? data.shopName : "",
          avatar: normalizeAvatarUrl(data.avatar),
          province: resolvedProvinceName,
          district: resolvedDistrictName,
          ward: resolvedWardName,
          streetDetail: typeof data.streetDetail === "string" ? data.streetDetail : "",
          ghnProvinceId: resolvedProvinceId,
          ghnDistrictId: resolvedDistrictId,
          ghnWardCode: resolvedWardCode,
        });
      } catch (err: any) {
        toast.error(err?.response?.data?.message || "Không thể tải thông tin shop");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    try {
      const res = await sellerApi.uploadShopAvatar(file);
      const avatarUrl = res.data?.avatarUrl;
      if (!avatarUrl) {
        throw new Error("Không nhận được URL avatar");
      }
      setForm((prev) => ({ ...prev, avatar: normalizeAvatarUrl(avatarUrl) }));
      toast.success("Tải avatar thành công");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Không thể tải avatar");
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.shopName.trim()) {
      toast.error("Vui lòng nhập tên shop");
      return;
    }
    if (!form.ghnProvinceId || !form.ghnDistrictId || !form.ghnWardCode) {
      toast.error("Vui lòng chọn đầy đủ địa chỉ 3 cấp đã xác thực");
      return;
    }

    setSaving(true);
    try {
      await sellerApi.updateShopSettings({
        shopName: form.shopName.trim(),
        avatar: form.avatar.trim() || undefined,
        province: form.province.trim(),
        district: form.district.trim(),
        ward: form.ward.trim(),
        streetDetail: form.streetDetail.trim() || undefined,
        ghnProvinceId: form.ghnProvinceId,
        ghnDistrictId: form.ghnDistrictId,
        ghnWardCode: form.ghnWardCode,
      });
      toast.success("Đã cập nhật thông tin shop");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Không thể cập nhật thông tin shop");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
          <Store className="h-6 w-6 text-green-600" />
          Chỉnh sửa thông tin shop
        </h1>
        <Link
          href="/seller/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Về Dashboard
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-semibold text-gray-700">Tên shop *</span>
            <input
              type="text"
              value={form.shopName}
              onChange={(e) => setForm((prev) => ({ ...prev, shopName: e.target.value }))}
              maxLength={60}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-green-500"
              placeholder="Ví dụ: Vườn Rau Hữu Cơ"
            />
          </label>

          <div className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">Avatar shop (upload ảnh)</span>
            <div className="flex items-center gap-3 rounded-xl border border-gray-300 p-3">
              <div className="h-14 w-14 overflow-hidden rounded-full bg-gray-100 ring-1 ring-gray-200">
                {form.avatar ? (
                  <img src={form.avatar} alt="Avatar shop" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-gray-500">No avatar</div>
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {avatarUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  {avatarUploading ? "Đang tải ảnh..." : "Tải ảnh avatar"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarFileChange}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-sm font-semibold text-gray-700">Tỉnh/Thành phố *</span>
            <select
              required
              value={form.ghnProvinceId || ""}
              onChange={async (e) => {
                const provinceId = Number(e.target.value || 0);
                const selected = provinces.find((p) => p.id === provinceId);
                setForm((prev) => ({
                  ...prev,
                  ghnProvinceId: provinceId,
                  province: selected?.name || "",
                  ghnDistrictId: 0,
                  district: "",
                  ghnWardCode: "",
                  ward: "",
                }));
                setWards([]);
                if (provinceId) {
                  await loadDistricts(provinceId);
                } else {
                  setDistricts([]);
                }
              }}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-green-500"
            >
              <option value="">Chọn tỉnh/thành</option>
              {provinces.map((province) => (
                <option key={province.id} value={province.id}>{province.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <span className="text-sm font-semibold text-gray-700">Quận/Huyện *</span>
            <select
              required
              disabled={!form.ghnProvinceId}
              value={form.ghnDistrictId || ""}
              onChange={async (e) => {
                const districtId = Number(e.target.value || 0);
                const selected = districts.find((d) => d.id === districtId);
                setForm((prev) => ({
                  ...prev,
                  ghnDistrictId: districtId,
                  district: selected?.name || "",
                  ghnWardCode: "",
                  ward: "",
                }));
                if (districtId) {
                  await loadWards(districtId);
                } else {
                  setWards([]);
                }
              }}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-green-500 disabled:bg-gray-100"
            >
              <option value="">Chọn quận/huyện</option>
              {districts.map((districtOption) => (
                <option key={districtOption.id} value={districtOption.id}>{districtOption.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <span className="text-sm font-semibold text-gray-700">Phường/Xã *</span>
            <select
              required
              disabled={!form.ghnDistrictId}
              value={form.ghnWardCode}
              onChange={(e) => {
                const wardCode = e.target.value;
                const selected = wards.find((w) => w.code === wardCode);
                setForm((prev) => ({
                  ...prev,
                  ghnWardCode: wardCode,
                  ward: selected?.name || "",
                }));
              }}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-green-500 disabled:bg-gray-100"
            >
              <option value="">Chọn phường/xã</option>
              {wards.map((wardOption) => (
                <option key={wardOption.code} value={wardOption.code}>{wardOption.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <span className="text-sm font-semibold text-gray-700">Địa chỉ chi tiết</span>
            <input
              type="text"
              value={form.streetDetail}
              onChange={(e) => setForm((prev) => ({ ...prev, streetDetail: e.target.value }))}
              disabled={!form.ghnWardCode}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-green-500 disabled:bg-gray-100"
              placeholder="Số nhà, đường..."
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Lưu thay đổi
          </button>
        </div>
      </form>
    </div>
  );
}
