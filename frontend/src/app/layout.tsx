import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Hoa Quả Sơn — Nông sản Việt",
  description: "Nền tảng thương mại điện tử nông sản Việt Nam",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <Toaster position="top-right" />
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
