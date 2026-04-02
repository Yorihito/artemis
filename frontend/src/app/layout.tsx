import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://happy-beach-012009f00.1.azurestaticapps.net";

export const metadata: Metadata = {
  title: "Artemis II Mission Tracker | Real-Time Orion Spacecraft Position",
  description:
    "Real-time tracking of NASA's Artemis II Orion spacecraft. Live position, velocity, and trajectory data powered by JPL Horizons.",
  keywords: [
    "Artemis II",
    "NASA",
    "Orion spacecraft",
    "real-time tracking",
    "mission tracker",
    "lunar flyby",
    "JPL Horizons",
    "space",
    "Moon",
    "trajectory",
  ],
  authors: [{ name: "Artemis II Tracker" }],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "Artemis II Mission Tracker",
    description:
      "Real-time tracking of NASA's Artemis II Orion spacecraft. Live position, velocity, and trajectory powered by JPL Horizons.",
    siteName: "Artemis II Mission Tracker",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Artemis II Mission Tracker",
    description:
      "Real-time tracking of NASA's Artemis II Orion spacecraft. Live position, velocity, and trajectory powered by JPL Horizons.",
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
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#030712] text-slate-200 antialiased">
        {children}
      </body>
    </html>
  );
}
