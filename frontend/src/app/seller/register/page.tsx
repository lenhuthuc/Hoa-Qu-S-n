"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileCheck2, Loader2, Store, Truck, UserCheck } from "lucide-react";
import { isLoggedIn, parseToken, sellerOnboardingApi, shippingApi, userApi } from "@/lib/api";
import toast from "react-hot-toast";

type SellerType = "INDIVIDUAL" | "BUSINESS";

type ApplicationStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "NEEDS_REVISION" | "APPROVED" | "REJECTED";

interface SellerApplicationResponse {
  id: number;
  status: ApplicationStatus;
  reviewNote?: string;
  submittedAt?: string;
  shopName?: string;
  contactEmail?: string;
  contactPhone?: string;
  pickupAddress?: string;
  pickupProvince?: string;
  pickupDistrict?: string;
  pickupWard?: string;
  pickupStreetDetail?: string;
  pickupGhnProvinceId?: number;
  pickupGhnDistrictId?: number;
  pickupGhnWardCode?: string;
  shippingProvider?: string;
  sellerType?: SellerType;
  taxCode?: string;
  businessName?: string;
  businessAddress?: string;
  businessLicenseUrl?: string;
  identityFullName?: string;
  identityNumber?: string;
  identityIssueDate?: string;
  identityIssuePlace?: string;
  idCardFrontUrl?: string;
  idCardBackUrl?: string;
  agreedToTerms?: boolean;
}

interface SellerDocumentUploadResponse {
  idCardFrontUrl: string;
  idCardBackUrl: string;
  businessLicenseUrl?: string;
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

const initialForm = {
  shopName: "",
  contactEmail: "",
  contactPhone: "",
  pickupAddress: "",
  pickupProvince: "",
  pickupDistrict: "",
  pickupWard: "",
  pickupStreetDetail: "",
  pickupGhnProvinceId: 0,
  pickupGhnDistrictId: 0,
  pickupGhnWardCode: "",
  shippingProvider: "GHN",
  sellerType: "INDIVIDUAL" as SellerType,
  taxCode: "",
  businessName: "",
  businessAddress: "",
  businessLicenseUrl: "",
  identityFullName: "",
  identityNumber: "",
  identityIssueDate: "",
  identityIssuePlace: "",
  idCardFrontUrl: "",
  idCardBackUrl: "",
  agreedToTerms: false,
};

export default function SellerRegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState<SellerApplicationResponse | null>(null);
  const [form, setForm] = useState(initialForm);
  const [idCardFrontFile, setIdCardFrontFile] = useState<File | null>(null);
  const [idCardBackFile, setIdCardBackFile] = useState<File | null>(null);
  const [businessLicenseFile, setBusinessLicenseFile] = useState<File | null>(null);
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [wards, setWards] = useState<WardOption[]>([]);

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

  const parsed = useMemo(() => parseToken(), []);
  const isSeller = parsed?.roles?.includes("SELLER") || parsed?.roles?.includes("ADMIN");

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/login");
      return;
    }
    if (isSeller) {
      router.push("/seller/dashboard");
      return;
    }

    (async () => {
      try {
        const [profileRes, appRes] = await Promise.allSettled([
          userApi.getProfile(),
          sellerOnboardingApi.getMine(),
        ]);

        let resolvedProvinceId = 0;
        let resolvedDistrictId = 0;
        let resolvedWardCode = "";
        let resolvedProvinceName = "";
        let resolvedDistrictName = "";
        let resolvedWardName = "";
        let resolvedStreetDetail = "";

        if (profileRes.status === "fulfilled") {
          const profile = profileRes.value.data || {};
          setForm((prev) => ({
            ...prev,
            contactEmail: profile.email || prev.contactEmail,
            contactPhone: profile.phone || prev.contactPhone,
            identityFullName: profile.fullName || prev.identityFullName,
          }));
          const addr = profile.address;
          if (addr) {
            resolvedProvinceId = Number(addr.ghnProvinceId || 0);
            resolvedDistrictId = Number(addr.ghnDistrictId || 0);
            resolvedWardCode = String(addr.ghnWardCode || "");
            resolvedProvinceName = addr.province || "";
            resolvedDistrictName = addr.district || "";
            resolvedWardName = addr.ward || "";
            resolvedStreetDetail = addr.streetDetail || "";
          }
        }

        if (appRes.status === "fulfilled") {
          const app: SellerApplicationResponse = appRes.value.data;
          setApplication(app);
          setForm((prev) => ({
            ...prev,
            shopName: app.shopName || prev.shopName,
            contactEmail: app.contactEmail || prev.contactEmail,
            contactPhone: app.contactPhone || prev.contactPhone,
            pickupAddress: app.pickupAddress || prev.pickupAddress,
            pickupProvince: app.pickupProvince || prev.pickupProvince,
            pickupDistrict: app.pickupDistrict || prev.pickupDistrict,
            pickupWard: app.pickupWard || prev.pickupWard,
            pickupStreetDetail: app.pickupStreetDetail || prev.pickupStreetDetail,
            pickupGhnProvinceId: app.pickupGhnProvinceId || prev.pickupGhnProvinceId,
            pickupGhnDistrictId: app.pickupGhnDistrictId || prev.pickupGhnDistrictId,
            pickupGhnWardCode: app.pickupGhnWardCode || prev.pickupGhnWardCode,
            shippingProvider: app.shippingProvider || prev.shippingProvider,
            sellerType: app.sellerType || prev.sellerType,
            taxCode: app.taxCode || prev.taxCode,
            businessName: app.businessName || prev.businessName,
            businessAddress: app.businessAddress || prev.businessAddress,
            businessLicenseUrl: app.businessLicenseUrl || prev.businessLicenseUrl,
            identityFullName: app.identityFullName || prev.identityFullName,
            identityNumber: app.identityNumber || prev.identityNumber,
            identityIssueDate: app.identityIssueDate || prev.identityIssueDate,
            identityIssuePlace: app.identityIssuePlace || prev.identityIssuePlace,
            idCardFrontUrl: app.idCardFrontUrl || prev.idCardFrontUrl,
            idCardBackUrl: app.idCardBackUrl || prev.idCardBackUrl,
            agreedToTerms: !!app.agreedToTerms,
          }));

          resolvedProvinceId = app.pickupGhnProvinceId || resolvedProvinceId;
          resolvedDistrictId = app.pickupGhnDistrictId || resolvedDistrictId;
          resolvedWardCode = app.pickupGhnWardCode || resolvedWardCode;
          resolvedProvinceName = app.pickupProvince || resolvedProvinceName;
          resolvedDistrictName = app.pickupDistrict || resolvedDistrictName;
          resolvedWardName = app.pickupWard || resolvedWardName;
          resolvedStreetDetail = app.pickupStreetDetail || resolvedStreetDetail;
        }

        const provinceList = await loadProvinces();
        let provinceId = resolvedProvinceId;
        if (!provinceId && resolvedProvinceName) {
          provinceId = provinceList.find((p) => p.name.toLowerCase() === resolvedProvinceName.toLowerCase())?.id || 0;
        }

        let districtId = resolvedDistrictId;
        let districtList: DistrictOption[] = [];
        let wardList: WardOption[] = [];
        if (provinceId) {
          districtList = await loadDistricts(provinceId);
          if (!districtId && resolvedDistrictName) {
            districtId = districtList.find((d) => d.name.toLowerCase() === resolvedDistrictName.toLowerCase())?.id || 0;
          }
          if (districtId) {
            wardList = await loadWards(districtId);
            if (!resolvedDistrictName) {
              resolvedDistrictName = districtList.find((d) => d.id === districtId)?.name || "";
            }
            if (!resolvedWardCode && resolvedWardName) {
              resolvedWardCode = wardList.find((w) => w.name.toLowerCase() === resolvedWardName.toLowerCase())?.code || "";
            }
            if (!resolvedWardName && resolvedWardCode) {
              resolvedWardName = wardList.find((w) => w.code === resolvedWardCode)?.name || "";
            }
          }
        }

        if (provinceId) {
          const foundProvince = provinceList.find((p) => p.id === provinceId);
          setForm((prev) => ({
            ...prev,
            pickupGhnProvinceId: provinceId,
            pickupProvince: foundProvince?.name || resolvedProvinceName || prev.pickupProvince,
          }));
        }
        if (districtId) {
          setForm((prev) => ({
            ...prev,
            pickupGhnDistrictId: districtId,
            pickupDistrict: resolvedDistrictName || prev.pickupDistrict,
          }));
        }
        if (resolvedWardCode) {
          setForm((prev) => ({
            ...prev,
            pickupGhnWardCode: resolvedWardCode,
            pickupWard: resolvedWardName || prev.pickupWard,
            pickupStreetDetail: resolvedStreetDetail || prev.pickupStreetDetail,
          }));
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [router, isSeller]);

  const waitingReview = application && ["SUBMITTED", "UNDER_REVIEW"].includes(application.status);

  const canEdit = !application || ["NEEDS_REVISION", "REJECTED", "DRAFT"].includes(application.status);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    if (!form.agreedToTerms) {
      toast.error("Bạn cần đồng ý điều khoản trước khi gửi hồ sơ");
      return;
    }
    if (!form.pickupGhnProvinceId || !form.pickupGhnDistrictId || !form.pickupGhnWardCode) {
      toast.error("Vui lòng chọn đầy đủ địa chỉ lấy hàng theo danh sách xác thực");
      return;
    }

    setSubmitting(true);
    try {
      let idCardFrontUrl = form.idCardFrontUrl;
      let idCardBackUrl = form.idCardBackUrl;
      let businessLicenseUrl = form.businessLicenseUrl;

      const shouldUpload = !!idCardFrontFile || !!idCardBackFile || !!businessLicenseFile;

      if (shouldUpload) {
        if (!idCardFrontFile || !idCardBackFile) {
          toast.error("Cần chọn đủ ảnh CCCD mặt trước và mặt sau");
          return;
        }

        const documentForm = new FormData();
        documentForm.append("idCardFront", idCardFrontFile);
        documentForm.append("idCardBack", idCardBackFile);
        if (businessLicenseFile) {
          documentForm.append("businessLicense", businessLicenseFile);
        }

        const uploadRes = await sellerOnboardingApi.uploadDocuments(documentForm);
        const uploaded: SellerDocumentUploadResponse = uploadRes.data;
        idCardFrontUrl = uploaded.idCardFrontUrl;
        idCardBackUrl = uploaded.idCardBackUrl;
        businessLicenseUrl = uploaded.businessLicenseUrl || businessLicenseUrl;
      }

      if (!idCardFrontUrl || !idCardBackUrl) {
        toast.error("Vui lòng tải ảnh CCCD trước khi gửi hồ sơ");
        return;
      }

      if (form.sellerType === "BUSINESS" && !businessLicenseUrl) {
        toast.error("Doanh nghiệp cần tải giấy phép kinh doanh");
        return;
      }

      const pickupAddressLine = [
        form.pickupStreetDetail?.trim(),
        form.pickupWard?.trim(),
        form.pickupDistrict?.trim(),
        form.pickupProvince?.trim(),
      ]
        .filter((part) => part && part.length > 0)
        .join(", ");

      const payload = {
        ...form,
        pickupAddress: pickupAddressLine,
        idCardFrontUrl,
        idCardBackUrl,
        taxCode: form.taxCode || null,
        businessName: form.businessName || null,
        businessAddress: form.businessAddress || null,
        businessLicenseUrl: businessLicenseUrl || null,
      };
      const res = await sellerOnboardingApi.submit(payload);
      setApplication(res.data);
      setIdCardFrontFile(null);
      setIdCardBackFile(null);
      setBusinessLicenseFile(null);
      toast.success("Đã gửi hồ sơ đăng ký bán hàng, vui lòng chờ xét duyệt");
    } catch (err: any) {
      const respData = err?.response?.data;
      let message = respData?.message || "Không thể gửi hồ sơ";
      if (respData?.errors) {
        message += ": " + Object.values(respData.errors).join(", ");
      }
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 via-white to-green-50 px-4 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white border border-green-100 rounded-2xl p-6 md:p-8 shadow-sm mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Đăng ký người bán</h1>
          <p className="mt-2 text-gray-600">
            Form đăng ký yêu cầu 4 nhóm thông tin chính. Hãy chuẩn bị kỹ trước khi bắt đầu để tránh gián đoạn.
          </p>

          {application && (
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm">
              <p className="font-semibold text-green-800">Trạng thái hiện tại: {application.status}</p>
              {application.submittedAt && (
                <p className="text-green-700 mt-1">Gửi lúc: {new Date(application.submittedAt).toLocaleString("vi-VN")}</p>
              )}
              {application.reviewNote && (
                <p className="text-green-700 mt-1">Ghi chú từ admin: {application.reviewNote}</p>
              )}
            </div>
          )}

          {waitingReview && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 text-sm flex items-start gap-3">
              <FileCheck2 className="w-5 h-5 mt-0.5" />
              <div>
                <p className="font-semibold">Hồ sơ đã gửi thành công</p>
                <p>Hệ thống đã ghi nhận đăng ký của bạn. Vui lòng chờ admin xét duyệt trước khi đăng bán sản phẩm.</p>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
              <Store className="w-5 h-5 text-green-600" /> Thông tin Shop (Gian hàng)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Tên Shop" required disabled={!canEdit} value={form.shopName} onChange={(v) => setForm((p) => ({ ...p, shopName: v }))} placeholder="VD: Vườn Rau Hữu Cơ Chú Ba" />
              <Input label="Email liên hệ" required type="email" disabled={!canEdit} value={form.contactEmail} onChange={(v) => setForm((p) => ({ ...p, contactEmail: v }))} placeholder="email@domain.com" />
              <Input label="Số điện thoại" required disabled={!canEdit} value={form.contactPhone} onChange={(v) => setForm((p) => ({ ...p, contactPhone: v }))} placeholder="09xxxxxxxx" />
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
              <Truck className="w-5 h-5 text-green-600" /> Thông tin Vận chuyển
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Tỉnh/Thành phố *</label>
                <select
                  required
                  disabled={!canEdit}
                  value={form.pickupGhnProvinceId || ""}
                  onChange={async (e) => {
                    const provinceId = Number(e.target.value);
                    const selected = provinces.find((p) => p.id === provinceId);
                    setForm((prev) => ({
                      ...prev,
                      pickupGhnProvinceId: provinceId || 0,
                      pickupProvince: selected?.name || "",
                      pickupGhnDistrictId: 0,
                      pickupDistrict: "",
                      pickupGhnWardCode: "",
                      pickupWard: "",
                    }));
                    setWards([]);
                    if (provinceId) {
                      await loadDistricts(provinceId);
                    } else {
                      setDistricts([]);
                    }
                  }}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-green-400 outline-none disabled:bg-gray-50"
                >
                  <option value="">Chọn tỉnh/thành phố</option>
                  {provinces.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Quận/Huyện *</label>
                <select
                  required
                  disabled={!canEdit || !form.pickupGhnProvinceId}
                  value={form.pickupGhnDistrictId || ""}
                  onChange={async (e) => {
                    const districtId = Number(e.target.value);
                    const selected = districts.find((d) => d.id === districtId);
                    setForm((prev) => ({
                      ...prev,
                      pickupGhnDistrictId: districtId || 0,
                      pickupDistrict: selected?.name || "",
                      pickupGhnWardCode: "",
                      pickupWard: "",
                    }));
                    if (districtId) {
                      await loadWards(districtId);
                    } else {
                      setWards([]);
                    }
                  }}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-green-400 outline-none disabled:bg-gray-50"
                >
                  <option value="">Chọn quận/huyện</option>
                  {districts.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Phường/Xã *</label>
                <select
                  required
                  disabled={!canEdit || !form.pickupGhnDistrictId}
                  value={form.pickupGhnWardCode}
                  onChange={(e) => {
                    const wardCode = e.target.value;
                    const selected = wards.find((w) => w.code === wardCode);
                    setForm((prev) => ({
                      ...prev,
                      pickupGhnWardCode: wardCode,
                      pickupWard: selected?.name || "",
                    }));
                  }}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-green-400 outline-none disabled:bg-gray-50"
                >
                  <option value="">Chọn phường/xã</option>
                  {wards.map((item) => (
                    <option key={item.code} value={item.code}>{item.name}</option>
                  ))}
                </select>
              </div>
              <Input
                label="Số nhà, tên đường"
                disabled={!canEdit || !form.pickupGhnWardCode}
                value={form.pickupStreetDetail}
                onChange={(v) => setForm((p) => ({ ...p, pickupStreetDetail: v }))}
                placeholder="VD: 123 Lý Thường Kiệt"
              />
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Cài đặt vận chuyển</label>
                <select
                  disabled={!canEdit}
                  value={form.shippingProvider}
                  onChange={(e) => setForm((p) => ({ ...p, shippingProvider: e.target.value }))}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-green-400 outline-none disabled:bg-gray-50"
                >
                  <option value="GHN">GHN</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Địa chỉ lấy hàng (xác thực)</label>
                <input
                  disabled
                  value={[
                    form.pickupStreetDetail,
                    form.pickupWard,
                    form.pickupDistrict,
                    form.pickupProvince,
                  ].filter((x) => x && x.trim().length > 0).join(", ")}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 text-gray-600"
                  placeholder="Chọn đủ tỉnh/quận/phường để tạo địa chỉ lấy hàng"
                />
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-green-600" /> Thông tin Thuế
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Loại hình người bán</label>
                <select
                  disabled={!canEdit}
                  value={form.sellerType}
                  onChange={(e) => setForm((p) => ({ ...p, sellerType: e.target.value as SellerType }))}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-green-400 outline-none disabled:bg-gray-50"
                >
                  <option value="INDIVIDUAL">Cá nhân</option>
                  <option value="BUSINESS">Doanh nghiệp</option>
                </select>
              </div>
              {form.sellerType === "BUSINESS" && (
                <>
                  <Input label="Mã số thuế" required disabled={!canEdit} value={form.taxCode} onChange={(v) => setForm((p) => ({ ...p, taxCode: v }))} placeholder="Nhập mã số thuế" />
                  <Input label="Tên doanh nghiệp" required disabled={!canEdit} value={form.businessName} onChange={(v) => setForm((p) => ({ ...p, businessName: v }))} placeholder="Tên pháp lý công ty" />
                  <Input label="Địa chỉ trụ sở" required disabled={!canEdit} value={form.businessAddress} onChange={(v) => setForm((p) => ({ ...p, businessAddress: v }))} placeholder="Địa chỉ đăng ký kinh doanh" />
                  <DocumentFileInput
                    label="Giấy phép kinh doanh"
                    required
                    disabled={!canEdit}
                    accept="image/*,.pdf"
                    file={businessLicenseFile}
                    existingUrl={form.businessLicenseUrl}
                    onChange={setBusinessLicenseFile}
                  />
                </>
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
              <UserCheck className="w-5 h-5 text-green-600" /> Thông tin Định danh
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Họ và tên (theo CMND/CCCD)" required disabled={!canEdit} value={form.identityFullName} onChange={(v) => setForm((p) => ({ ...p, identityFullName: v }))} placeholder="Nguyễn Văn A" />
              <Input label="Số CMND/CCCD" required disabled={!canEdit} value={form.identityNumber} onChange={(v) => setForm((p) => ({ ...p, identityNumber: v }))} placeholder="012345678901" />
              <Input label="Ngày cấp" required type="date" disabled={!canEdit} value={form.identityIssueDate} onChange={(v) => setForm((p) => ({ ...p, identityIssueDate: v }))} />
              <Input label="Nơi cấp" required disabled={!canEdit} value={form.identityIssuePlace} onChange={(v) => setForm((p) => ({ ...p, identityIssuePlace: v }))} placeholder="Cục CSQLHC về TTXH" />
              <DocumentFileInput
                label="Ảnh CCCD mặt trước"
                required
                disabled={!canEdit}
                accept="image/*,.pdf"
                file={idCardFrontFile}
                existingUrl={form.idCardFrontUrl}
                onChange={setIdCardFrontFile}
              />
              <DocumentFileInput
                label="Ảnh CCCD mặt sau"
                required
                disabled={!canEdit}
                accept="image/*,.pdf"
                file={idCardBackFile}
                existingUrl={form.idCardBackUrl}
                onChange={setIdCardBackFile}
              />
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <label className="flex items-start gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.agreedToTerms}
                disabled={!canEdit}
                onChange={(e) => setForm((p) => ({ ...p, agreedToTerms: e.target.checked }))}
                className="mt-1"
              />
              <span>Tôi đồng ý với Điều khoản sử dụng và Chính sách bảo mật của nền tảng.</span>
            </label>

            <button
              type="submit"
              disabled={!canEdit || submitting}
              className="mt-4 w-full md:w-auto px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Hoàn tất đăng ký
            </button>
          </section>
        </form>
      </div>
    </div>
  );
}

function DocumentFileInput({
  label,
  file,
  onChange,
  existingUrl,
  required = false,
  disabled = false,
  accept,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  existingUrl?: string;
  required?: boolean;
  disabled?: boolean;
  accept?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required ? " *" : ""}
      </label>
      <input
        type="file"
        required={required && !existingUrl && !file}
        disabled={disabled}
        accept={accept}
        onChange={(e) => onChange(e.target.files?.[0] || null)}
        className="mt-1 w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-green-100 file:text-green-700 hover:file:bg-green-200 disabled:opacity-60"
      />
      <p className="mt-1 text-xs text-gray-500">
        {file ? `Đã chọn: ${file.name}` : existingUrl ? "Đã có file trước đó, chọn file mới để thay thế" : "Hỗ trợ JPG, PNG hoặc PDF (tối đa 5MB)"}
      </p>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required ? " *" : ""}
      </label>
      <input
        type={type}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-green-400 outline-none disabled:bg-gray-50"
      />
    </div>
  );
}
