"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera,
  ChevronRight,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  MapPinned,
  Phone,
  Save,
  ShoppingBag,
  Store,
  User,
} from "lucide-react";
import { shippingApi, userApi } from "@/lib/api";
import toast from "react-hot-toast";

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

interface UserProfile {
  id: number;
  email: string;
  fullName?: string;
  phone?: string;
  avatar?: string;
  address?: {
    id?: number;
    province?: string;
    district?: string;
    ward?: string;
    streetDetail?: string;
    ghnProvinceId?: number;
    ghnDistrictId?: number;
    ghnWardCode?: string;
  };
  role?: string;
  createdAt?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [ward, setWard] = useState("");
  const [streetDetail, setStreetDetail] = useState("");

  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [wards, setWards] = useState<WardOption[]>([]);

  const [selectedProvinceId, setSelectedProvinceId] = useState<number | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | null>(null);
  const [selectedWardCode, setSelectedWardCode] = useState<string>("");
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);

  const profileName = profile?.fullName?.trim() || profile?.email || "Tài khoản của tôi";
  const avatarText = profileName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const addressSummary = [streetDetail, ward, district, province]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");

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
    (async () => {
      try {
        const res = await userApi.getProfile();
        const data = res.data?.data || res.data;
        setProfile(data);
        setFullName(data.fullName || "");
        setPhone(data.phone || "");
        setProvince(data.address?.province || "");
        setDistrict(data.address?.district || "");
        setWard(data.address?.ward || "");
        setStreetDetail(data.address?.streetDetail || "");

        const provinceList = await loadProvinces();
        const savedProvinceId = data.address?.ghnProvinceId;
        const savedDistrictId = data.address?.ghnDistrictId;
        const savedWardCode = data.address?.ghnWardCode;

        if (savedProvinceId) {
          setSelectedProvinceId(savedProvinceId);
          const districtList = await loadDistricts(savedProvinceId);
          if (savedDistrictId) {
            setSelectedDistrictId(savedDistrictId);
            await loadWards(savedDistrictId);
          } else if (data.address?.district) {
            const foundDistrict = districtList.find((d) => d.name.toLowerCase() === data.address.district.toLowerCase());
            if (foundDistrict) {
              setSelectedDistrictId(foundDistrict.id);
              await loadWards(foundDistrict.id);
            }
          }
          if (savedWardCode) {
            setSelectedWardCode(savedWardCode);
          }
        } else if (data.address?.province) {
          const foundProvince = provinceList.find((p) => p.name.toLowerCase() === data.address.province.toLowerCase());
          if (foundProvince) {
            setSelectedProvinceId(foundProvince.id);
            const districtList = await loadDistricts(foundProvince.id);
            if (data.address?.district) {
              const foundDistrict = districtList.find((d) => d.name.toLowerCase() === data.address.district.toLowerCase());
              if (foundDistrict) {
                setSelectedDistrictId(foundDistrict.id);
                const wardList = await loadWards(foundDistrict.id);
                if (data.address?.ward) {
                  const foundWard = wardList.find((w) => w.name.toLowerCase() === data.address.ward.toLowerCase());
                  if (foundWard) {
                    setSelectedWardCode(foundWard.code);
                  }
                }
              }
            }
          }
        }
      } catch {
        toast.error("Vui lòng đăng nhập");
        router.push("/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!selectedProvinceId || !selectedDistrictId || !selectedWardCode || !province || !district || !ward) {
      toast.error("Vui lòng chọn đầy đủ địa chỉ theo danh sách xác thực");
      return;
    }

    setSaving(true);
    try {
      await userApi.update(profile.id, {
        fullName,
        phone,
        province,
        district,
        ward,
        streetDetail,
        ghnProvinceId: selectedProvinceId,
        ghnDistrictId: selectedDistrictId,
        ghnWardCode: selectedWardCode,
      });
      toast.success("Cập nhật thành công!");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Lỗi khi cập nhật");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("hqs_token");
    localStorage.removeItem("hqs_refresh_token");
    router.push("/login");
  };

  const handleAvatarFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!profile) return;
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn file ảnh hợp lệ");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ảnh không được vượt quá 5MB");
      return;
    }

    setSavingAvatar(true);
    try {
      const res = await userApi.uploadAvatar(file);
      const nextAvatar = res.data?.avatarUrl || res.data?.data?.avatarUrl;
      if (!nextAvatar) {
        throw new Error("Không nhận được URL avatar");
      }
      setProfile((prev) => (prev ? { ...prev, avatar: nextAvatar } : prev));
      setEditingAvatar(false);
      toast.success("Cập nhật avatar thành công!");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Không thể cập nhật avatar");
    } finally {
      setSavingAvatar(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-gradient-to-br from-emerald-50 to-white">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50">
      <div className="max-w-7xl mx-auto px-4 py-8 lg:py-12">
        <div className="mb-8 rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-lime-600 px-6 py-7 lg:px-8 lg:py-9 text-white shadow-lg shadow-emerald-900/10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm uppercase tracking-[0.28em] text-emerald-100 mb-3">Hồ sơ tài khoản</p>
              <h1 className="text-3xl lg:text-5xl font-bold tracking-tight">{profileName}</h1>
              <p className="mt-3 text-emerald-50/90 text-sm lg:text-base">
                Quản lý thông tin cá nhân, địa chỉ giao hàng và đơn mua.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/orders"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
              >
                <ShoppingBag className="w-4 h-4" />
                Đơn mua
              </Link>
              <Link
                href="/search"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                <Store className="w-4 h-4" />
                Tiếp tục mua sắm
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-12 items-start">
          <aside className="lg:col-span-3">
            <div className="sticky top-24 space-y-5">
              <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-4 border-b border-emerald-50 pb-5">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-100 text-emerald-700">
                    {profile?.avatar ? (
                      <img src={profile.avatar} alt={profileName} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold">{avatarText || "H"}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold text-gray-900">{profileName}</h2>
                    <p className="truncate text-sm text-gray-500">{profile?.email}</p>
                    {profile?.role && (
                      <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        {profile.role}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 border-b border-emerald-50 pb-5">
                  <button
                    type="button"
                    onClick={() => setEditingAvatar((prev) => !prev)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    <Camera className="h-4 w-4" />
                    {editingAvatar ? "Đóng" : "Chỉnh avatar"}
                  </button>

                  {editingAvatar && (
                    <div className="mt-3 space-y-2">
                      <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700">
                        {savingAvatar ? "Đang tải ảnh..." : "Chọn ảnh từ máy"}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarFileChange}
                          disabled={savingAvatar}
                          className="hidden"
                        />
                      </label>
                      <p className="text-xs text-gray-500">Hỗ trợ JPG/PNG/WEBP/GIF, tối đa 5MB.</p>
                    </div>
                  )}
                </div>

                <div className="mt-5 space-y-2">
                  <Link href="/orders" className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100">
                    <span className="flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> Đơn mua</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                  <Link href="/search" className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-100">
                    <span className="flex items-center gap-2"><Store className="w-4 h-4" /> Mua sắm</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-gray-500">Thông tin nhanh</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 w-4 h-4 text-emerald-600" />
                    <div>
                      <p className="font-semibold text-gray-900">Email</p>
                      <p className="text-gray-500">{profile?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="mt-0.5 w-4 h-4 text-emerald-600" />
                    <div>
                      <p className="font-semibold text-gray-900">Số điện thoại</p>
                      <p className="text-gray-500">{phone || "Chưa cập nhật"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPinned className="mt-0.5 w-4 h-4 text-emerald-600" />
                    <div>
                      <p className="font-semibold text-gray-900">Địa chỉ</p>
                      <p className="text-gray-500">{addressSummary || "Chưa có địa chỉ"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <main className="lg:col-span-9 space-y-6">
            <form onSubmit={handleSave} className="space-y-6">
              <section className="rounded-3xl border border-emerald-100 bg-white p-6 lg:p-7 shadow-sm">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Thông tin cá nhân</h2>
                    <p className="mt-1 text-sm text-gray-500">Tên, email và số điện thoại liên hệ.</p>
                  </div>
                  <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <User className="w-6 h-6" />
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 w-5 h-5 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        value={profile?.email || ""}
                        disabled
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-gray-500 outline-none cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Họ và tên</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 w-5 h-5 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Nguyễn Văn A"
                        className="w-full rounded-2xl border border-gray-200 py-3 pl-10 pr-4 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Số điện thoại</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 w-5 h-5 -translate-y-1/2 text-gray-400" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0912 345 678"
                        className="w-full rounded-2xl border border-gray-200 py-3 pl-10 pr-4 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Trạng thái hồ sơ</label>
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      {profile?.role ? `Vai trò: ${profile.role}` : "Khách hàng"}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-emerald-100 bg-white p-6 lg:p-7 shadow-sm">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Địa chỉ giao hàng</h2>
                  </div>
                  <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <MapPin className="w-6 h-6" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Tỉnh/Thành phố</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 w-5 h-5 -translate-y-1/2 text-gray-400" />
                        <select
                          value={selectedProvinceId ?? ""}
                          onChange={async (e) => {
                            const id = Number(e.target.value);
                            const selected = provinces.find((p) => p.id === id);
                            setSelectedProvinceId(id || null);
                            setProvince(selected?.name || "");
                            setSelectedDistrictId(null);
                            setSelectedWardCode("");
                            setDistrict("");
                            setWard("");
                            setWards([]);
                            if (id) {
                              await loadDistricts(id);
                            } else {
                              setDistricts([]);
                            }
                          }}
                          className="w-full appearance-none rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-4 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        >
                          <option value="">Tỉnh/Thành phố</option>
                          {provinces.map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Quận/Huyện</label>
                      <select
                        value={selectedDistrictId ?? ""}
                        onChange={async (e) => {
                          const id = Number(e.target.value);
                          const selected = districts.find((d) => d.id === id);
                          setSelectedDistrictId(id || null);
                          setDistrict(selected?.name || "");
                          setSelectedWardCode("");
                          setWard("");
                          if (id) {
                            await loadWards(id);
                          } else {
                            setWards([]);
                          }
                        }}
                        disabled={!selectedProvinceId}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        <option value="">Quận/Huyện</option>
                        {districts.map((item) => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Phường/Xã</label>
                      <select
                        value={selectedWardCode}
                        onChange={(e) => {
                          const code = e.target.value;
                          const selected = wards.find((w) => w.code === code);
                          setSelectedWardCode(code);
                          setWard(selected?.name || "");
                        }}
                        disabled={!selectedDistrictId}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        <option value="">Phường/Xã</option>
                        {wards.map((item) => (
                          <option key={item.code} value={item.code}>{item.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Địa chỉ cụ thể</label>
                      <input
                        type="text"
                        value={streetDetail}
                        onChange={(e) => setStreetDetail(e.target.value)}
                        disabled={!selectedWardCode}
                        placeholder="Số nhà, tên đường"
                        className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-gray-50 disabled:text-gray-400"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-lime-600 px-5 py-3.5 font-semibold text-white shadow-sm transition hover:from-emerald-700 hover:to-lime-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Lưu thay đổi
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-5 py-3.5 font-semibold text-rose-600 transition hover:bg-rose-50"
                >
                  <LogOut className="w-5 h-5" />
                  Đăng xuất
                </button>
              </div>
            </form>
          </main>
        </div>
      </div>
    </div>
  );
}
