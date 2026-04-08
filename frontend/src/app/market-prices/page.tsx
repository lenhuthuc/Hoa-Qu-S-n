"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Search, Loader2, Leaf, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { marketPriceApi } from "@/lib/api";
import toast from "react-hot-toast";

interface MarketPrice {
  id: number;
  productName: string;
  price: number;
  previousPrice?: number;
  unit?: string;
  market?: string;
  region?: string;
  updatedAt?: string;
}

export default function MarketPricesPage() {
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);

  const fetchPrices = async () => {
    setLoading(true);
    try {
      const res = await marketPriceApi.getAll();
      const data = res.data?.data || res.data || [];
      setPrices(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Không thể tải giá thị trường");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
  }, []);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      fetchPrices();
      return;
    }
    setSearching(true);
    try {
      const res = await marketPriceApi.search(searchTerm);
      const data = res.data?.data || res.data || [];
      setPrices(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Lỗi tìm kiếm");
    } finally {
      setSearching(false);
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);

  const getPriceChange = (item: MarketPrice) => {
    if (!item.previousPrice || item.previousPrice === 0) return null;
    const diff = item.price - item.previousPrice;
    const percent = ((diff / item.previousPrice) * 100).toFixed(1);
    return { diff, percent, up: diff > 0 };
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp className="w-7 h-7 text-primary-600" />
        <h1 className="text-2xl font-bold text-gray-800">Giá thị trường nông sản</h1>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Tìm nông sản... (VD: xoài, thanh long, sầu riêng)"
            className="w-full pl-10 pr-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-primary-300 outline-none"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={searching}
          className="px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Tìm
        </button>
      </div>

      {/* Price Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : prices.length === 0 ? (
        <div className="text-center py-20">
          <Leaf className="w-16 h-16 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500">Không tìm thấy dữ liệu giá</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="text-left py-3 px-4 font-semibold">Nông sản</th>
                  <th className="text-right py-3 px-4 font-semibold">Giá</th>
                  <th className="text-right py-3 px-4 font-semibold">Biến động</th>
                  <th className="text-left py-3 px-4 font-semibold">Đơn vị</th>
                  <th className="text-left py-3 px-4 font-semibold">Thị trường</th>
                  <th className="text-left py-3 px-4 font-semibold">Cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((item) => {
                  const change = getPriceChange(item);
                  return (
                    <tr key={item.id} className="border-t hover:bg-gray-50 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Leaf className="w-4 h-4 text-primary-500 flex-shrink-0" />
                          <span className="font-medium text-gray-800">{item.productName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-gray-800">
                        {formatPrice(item.price)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {change ? (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${change.up ? "text-red-500" : "text-green-600"}`}>
                            {change.up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                            {change.percent}%
                          </span>
                        ) : (
                          <span className="text-gray-400 inline-flex items-center gap-1 text-xs">
                            <Minus className="w-3 h-3" /> —
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-500">{item.unit || "kg"}</td>
                      <td className="py-3 px-4 text-gray-500">{item.market || item.region || "—"}</td>
                      <td className="py-3 px-4 text-gray-400 text-xs">
                        {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("vi-VN") : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
