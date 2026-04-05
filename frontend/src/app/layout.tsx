import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://artemis.nyoyapoya.cc";

export const metadata: Metadata = {
  title: "Artemis II Mission Tracker | Real-Time Orion Spacecraft Position | アルテミスII リアルタイム追跡",
  description:
    "Real-time tracking of NASA's Artemis II Orion spacecraft — live position, velocity, and trajectory powered by JPL Horizons. | NASAのアルテミスII オリオン宇宙船をリアルタイムで追跡。月周回軌道・飛行経路・速度をライブ表示。",
  keywords: [
    // English
    "Artemis II",
    "NASA",
    "Orion spacecraft",
    "real-time tracking",
    "mission tracker",
    "lunar flyby",
    "Moon orbit",
    "JPL Horizons",
    "space",
    "Moon",
    "trajectory",
    "spacecraft position",
    "live tracking",
    "cislunar",
    "deep space",
    // Japanese
    "アルテミスII",
    "アルテミス2",
    "NASA",
    "オリオン宇宙船",
    "リアルタイム追跡",
    "宇宙船追跡",
    "月周回",
    "月フライバイ",
    "宇宙ミッション",
    "軌道",
    "飛行経路",
    "宇宙",
    "月",
    "有人月探査",
    "ライブ追跡",
  ],
  authors: [{ name: "Artemis II Tracker" }],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "Artemis II Mission Tracker | アルテミスII リアルタイム追跡",
    description:
      "Real-time tracking of NASA's Artemis II Orion spacecraft. Live position, velocity, and trajectory powered by JPL Horizons. | NASAのアルテミスII オリオン宇宙船をリアルタイムで追跡。",
    siteName: "Artemis II Mission Tracker",
    locale: "en_US",
    alternateLocale: ["ja_JP"],
  },
  twitter: {
    card: "summary",
    title: "Artemis II Mission Tracker | アルテミスII リアルタイム追跡",
    description:
      "Real-time tracking of NASA's Artemis II Orion spacecraft. Live position, velocity, and trajectory powered by JPL Horizons.",
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      "en": SITE_URL,
      "ja": SITE_URL,
      "x-default": SITE_URL,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#030712] text-slate-200 antialiased">
        {children}
      </body>
    </html>
  );
}
