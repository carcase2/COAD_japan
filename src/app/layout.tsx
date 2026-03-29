import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import packageJson from "../../package.json";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "COAD Japan · 견적 전 가격 산출",
  description: "일본에서 견적서 작성 전, 폭·높이로 미리 예상 가격을 계산합니다. 단가 테이블 보기 및 수정",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-[#eceef2] font-sans text-slate-900 antialiased`}
      >
        {children}
        <footer className="mt-0 border-t border-slate-300/80 bg-[#e2e5eb] py-6 text-center text-slate-600">
          <p className="text-xs font-semibold text-slate-700">COAD Japan · 견적 전 가격 산출</p>
          <p className="mt-1.5 text-[11px] font-medium tracking-widest text-slate-500 uppercase">
            버전 v{packageJson.version}
          </p>
        </footer>
      </body>
    </html>
  );
}
