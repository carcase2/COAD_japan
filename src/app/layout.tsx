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
  title: "COAD 견적 전 가격 계산",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <footer className="mt-8 border-t border-slate-200/80 py-6 text-center text-sm text-slate-400">
          v{packageJson.version}
        </footer>
      </body>
    </html>
  );
}
