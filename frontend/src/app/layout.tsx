import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Artemis II Mission Tracker",
  description: "Real-time tracking of NASA's Artemis II mission",
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
