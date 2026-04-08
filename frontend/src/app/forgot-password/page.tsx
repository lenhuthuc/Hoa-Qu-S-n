"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Leaf, Mail, Loader2, KeyRound, ShieldCheck } from "lucide-react";
import { userApi } from "@/lib/api";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "otp" | "newpass">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error("Vui lòng nhập email");
    setLoading(true);
    try {
      await userApi.resetPassword(email);
      toast.success("Mã OTP đã được gửi đến email của bạn");
      setStep("otp");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Không thể gửi OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return toast.error("Vui lòng nhập mã OTP");
    setLoading(true);
    try {
      await userApi.verifyOtp(email, otp);
      toast.success("Xác minh thành công!");
      setStep("newpass");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Mã OTP không đúng");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) return toast.error("Mật khẩu mới phải có ít nhất 6 ký tự");
    setLoading(true);
    try {
      await userApi.changePassword(email, newPassword, otp);
      toast.success("Đổi mật khẩu thành công! Vui lòng đăng nhập lại.");
      router.push("/login");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Không thể đổi mật khẩu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-white px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-primary-700 font-bold text-2xl mb-2">
            <Leaf className="w-8 h-8" />
            Hoa Quả Sơn
          </Link>
          <p className="text-gray-500">Khôi phục mật khẩu tài khoản</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-8">
          {/* Steps indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {[
              { key: "email", label: "Email", icon: Mail },
              { key: "otp", label: "OTP", icon: KeyRound },
              { key: "newpass", label: "Mật khẩu mới", icon: ShieldCheck },
            ].map((s, i) => (
              <div key={s.key} className="flex items-center gap-2">
                {i > 0 && <div className={`w-8 h-0.5 ${step === s.key || (step === "newpass" && i <= 2) ? "bg-primary-400" : "bg-gray-200"}`} />}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === s.key ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-400"
                }`}>
                  {i + 1}
                </div>
              </div>
            ))}
          </div>

          {step === "email" && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <p className="text-sm text-gray-600 text-center mb-4">Nhập email đã đăng ký để nhận mã OTP</p>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null} Gửi mã OTP
              </button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <p className="text-sm text-gray-600 text-center mb-4">Nhập mã OTP đã gửi đến <strong>{email}</strong></p>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Nhập mã OTP"
                  maxLength={6}
                  className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-center text-2xl tracking-widest"
                />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null} Xác minh
              </button>
            </form>
          )}

          {step === "newpass" && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <p className="text-sm text-gray-600 text-center mb-4">Nhập mật khẩu mới của bạn</p>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mật khẩu mới (ít nhất 6 ký tự)"
                  className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null} Đổi mật khẩu
              </button>
            </form>
          )}

          <p className="text-center text-sm text-gray-500 mt-6">
            <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
              Quay lại đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
