"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Phone, Loader2, Save, LogOut, MapPin } from "lucide-react";
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-6">
        <User className="w-6 h-6 text-primary-600" />
        Tài khoản của tôi
      </h1>

      <div className="bg-white rounded-2xl border p-6 mb-6">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">{profile?.fullName || profile?.email}</h2>
            <p className="text-sm text-gray-500">{profile?.email}</p>
            {profile?.role && (
              <span className="inline-block mt-1 text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                {profile.role}
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={profile?.email || ""}
                disabled
                className="w-full pl-10 pr-4 py-3 border rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Họ và tên</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Số điện thoại</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912 345 678"
                className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Địa chỉ xác thực</label>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
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
                    className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  >
                    <option value="">Tỉnh/Thành phố</option>
                    {provinces.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>
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
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none disabled:bg-gray-100"
                >
                  <option value="">Quận/Huyện</option>
                  {districts.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={selectedWardCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    const selected = wards.find((w) => w.code === code);
                    setSelectedWardCode(code);
                    setWard(selected?.name || "");
                  }}
                  disabled={!selectedDistrictId}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none disabled:bg-gray-100"
                >
                  <option value="">Phường/Xã</option>
                  {wards.map((item) => (
                    <option key={item.code} value={item.code}>{item.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={streetDetail}
                  onChange={(e) => setStreetDetail(e.target.value)}
                  disabled={!selectedWardCode}
                  placeholder="Số nhà, tên đường"
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none disabled:bg-gray-100"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2 transition"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Lưu thay đổi
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="py-3 px-6 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 font-medium flex items-center gap-2 transition"
            >
              <LogOut className="w-5 h-5" /> Đăng xuất
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
