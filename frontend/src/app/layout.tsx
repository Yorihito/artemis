import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://happy-beach-012009f00.1.azurestaticapps.net";

export const metadata: Metadata = {
  title: "Artemis II リアルタイム追跡 | Artemis II Mission Tracker",
  description:
    "NASA アルテミス II（Artemis II）宇宙船の現在位置・速度・軌跡をリアルタイムで可視化。JPL Horizons データを使用した軌道トラッカー。",
  keywords: [
    "Artemis II",
    "アルテミス2",
    "NASA",
    "Orion",
    "オリオン宇宙船",
    "リアルタイム追跡",
    "軌道",
    "月フライバイ",
    "宇宙",
    "JPL Horizons",
  ],
  authors: [{ name: "Artemis II Tracker" }],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "Artemis II リアルタイム追跡",
    description:
      "NASA アルテミス II 宇宙船の現在位置・速度・軌跡をリアルタイムで可視化。",
    siteName: "Artemis II Mission Tracker",
    locale: "ja_JP",
  },
  twitter: {
    card: "summary",
    title: "Artemis II リアルタイム追跡",
    description:
      "NASA アルテミス II 宇宙船の現在位置・速度・軌跡をリアルタイムで可視化。",
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className="dark">
      <body className="min-h-screen bg-[#030712] text-slate-200 antialiased">
        {children}
      </body>
    </html>
  );
}
