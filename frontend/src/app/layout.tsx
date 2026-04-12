import type { Metadata } from "next";
import "./globals.css";
import { LocaleProvider } from "@/contexts/LocaleContext";

const SITE_URL = "https://artemis.nyoyapoya.cc";

export const metadata: Metadata = {
  title: "Artemis II Mission Tracker | Mission Complete — Orion Splashdown April 10, 2026 | アルテミスII ミッション完了",
  description:
    "NASA's Artemis II mission is complete. The Orion spacecraft splashed down on April 10, 2026 after a 212-hour crewed lunar flyby — the first humans to travel to the Moon since Apollo 17 in 1972. Full trajectory archive, telemetry, and mission timeline. | アルテミスII ミッション完了。2026年4月10日、オリオン宇宙船がスプラッシュダウン。1972年のアポロ17号以来初の有人月探査。全飛行軌跡・テレメトリ・タイムラインをアーカイブ。",
  keywords: [
    // Mission complete / post-flight
    "Artemis II splashdown",
    "Artemis II mission complete",
    "Artemis II results",
    "Orion splashdown 2026",
    "Orion spacecraft return",
    "lunar flyby 2026",
    "Artemis II archive",
    "Artemis mission tracker",
    // Crew
    "Reid Wiseman",
    "Victor Glover",
    "Christina Koch",
    "Jeremy Hansen",
    "Artemis II crew",
    "Artemis II astronauts",
    // General
    "Artemis II",
    "NASA",
    "Orion spacecraft",
    "mission tracker",
    "Moon orbit",
    "JPL Horizons",
    "trajectory",
    "cislunar",
    "deep space",
    "Artemis III",
    // Japanese — post-mission
    "アルテミスII ミッション完了",
    "アルテミスII スプラッシュダウン",
    "アルテミスII 着水",
    "アルテミス2 着水",
    "オリオン宇宙船 帰還",
    "オリオン宇宙船 着水",
    "アルテミスII 乗組員",
    "有人月探査 2026",
    "アルテミスII 軌跡",
    // Japanese — general
    "アルテミスII",
    "アルテミス2",
    "NASA",
    "オリオン宇宙船",
    "宇宙船追跡",
    "月周回",
    "月フライバイ",
    "宇宙ミッション",
    "軌道",
    "飛行経路",
    "有人月探査",
    "アルテミスIII",
  ],
  authors: [{ name: "Artemis Mission Tracker" }],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "Artemis II Mission Tracker | Mission Complete | アルテミスII ミッション完了",
    description:
      "NASA's Artemis II Orion spacecraft splashed down April 10, 2026 — the first crewed lunar mission since Apollo 17. Full trajectory archive and telemetry. | アルテミスII ミッション完了。2026年4月10日スプラッシュダウン。全飛行軌跡・テレメトリをアーカイブ。",
    siteName: "Artemis Mission Tracker",
    locale: "en_US",
    alternateLocale: ["ja_JP"],
  },
  twitter: {
    card: "summary",
    title: "Artemis II Mission Tracker | Mission Complete | アルテミスII ミッション完了",
    description:
      "NASA's Artemis II Orion spacecraft splashed down April 10, 2026 — the first crewed lunar mission since Apollo 17. Full trajectory archive and telemetry.",
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

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      "name": "Artemis Mission Tracker",
      "url": SITE_URL,
      "description": "NASA Artemis mission tracking dashboard with trajectory archive, telemetry, and mission timeline.",
    },
    {
      "@type": "Event",
      "@id": `${SITE_URL}/#artemis2`,
      "name": "NASA Artemis II Mission",
      "startDate": "2026-04-01T22:35:12Z",
      "endDate": "2026-04-10T17:00:00Z",
      "eventStatus": "https://schema.org/EventScheduled",
      "description":
        "First crewed lunar flyby mission since Apollo 17 in 1972. The Orion spacecraft — callsign Integrity — carried four astronauts on a free-return trajectory around the Moon, reaching approximately 400,000 km from Earth before splashing down in the Pacific Ocean.",
      "location": {
        "@type": "Place",
        "name": "Cislunar Space / Pacific Ocean",
      },
      "organizer": {
        "@type": "Organization",
        "name": "NASA",
        "url": "https://www.nasa.gov",
      },
      "performer": [
        { "@type": "Person", "name": "Reid Wiseman", "jobTitle": "Commander" },
        { "@type": "Person", "name": "Victor Glover", "jobTitle": "Pilot" },
        { "@type": "Person", "name": "Christina Koch", "jobTitle": "Mission Specialist" },
        { "@type": "Person", "name": "Jeremy Hansen", "jobTitle": "Mission Specialist" },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-[#030712] text-slate-200 antialiased">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
