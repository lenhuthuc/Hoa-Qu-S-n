import type { Metadata } from "next";
import Script from "next/script";
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
      <head>
        <meta property="fb:app_id" content="26493368110313419" />
      </head>
      <body>
        {/* Facebook SDK */}
        <div id="fb-root"></div>
        <Script 
          src="https://connect.facebook.net/vi_VN/sdk.js"
          strategy="afterInteractive"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.fbAsyncInit = function() {
                FB.init({
                  appId: '26493368110313419',
                  version: 'v19.0',
                  xfbml: false,
                });
              };
            `,
          }}
        />
        <Toaster position="top-right" />
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
