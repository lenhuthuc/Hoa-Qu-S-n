"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Leaf, Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { authApi } from "@/lib/api";
import toast from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Vui lòng nhập email và mật khẩu");
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      const data = res.data;
      if (data?.token?.access) {
        localStorage.setItem("hqs_token", data.token.access);
        if (data.token.refresh) localStorage.setItem("hqs_refresh_token", data.token.refresh);
        toast.success("Đăng nhập thành công!");
        router.push("/");
      } else {
        toast.error(data?.message || "Sai email hoặc mật khẩu");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Đăng nhập thất bại");
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
          <p className="text-gray-500">Đăng nhập để tiếp tục mua sắm</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
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
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-gray-600">
              <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              Ghi nhớ đăng nhập
            </label>
            <Link href="/forgot-password" className="text-primary-600 hover:text-primary-700 font-medium">
              Quên mật khẩu?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2 transition"
          >
            {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Đang đăng nhập...</> : "Đăng nhập"}
          </button>

          <p className="text-center text-sm text-gray-500">
            Chưa có tài khoản?{" "}
            <Link href="/register" className="text-primary-600 hover:text-primary-700 font-medium">
              Đăng ký ngay
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
