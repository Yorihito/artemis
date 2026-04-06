export type Locale = "en" | "ja";

export const translations = {
  // MissionHeader
  "header.source":     { en: "Source:",       ja: "ソース:" },
  "header.updated":    { en: "Updated:",      ja: "更新:" },
  "header.error":      { en: "Error",         ja: "エラー" },
  "header.live":       { en: "Live",          ja: "ライブ" },
  "header.connecting": { en: "Connecting...", ja: "接続中..." },

  // Telemetry
  "telem.title":       { en: "Telemetry",       ja: "テレメトリ" },
  "telem.elapsed":     { en: "Mission Elapsed", ja: "経過時間" },
  "telem.velocity":    { en: "Velocity",        ja: "速度" },
  "telem.earthDist":   { en: "Earth Distance",  ja: "地球距離" },
  "telem.moonDist":    { en: "Moon Distance",   ja: "月距離" },
  "telem.phase":       { en: "Phase",           ja: "フェーズ" },
  "telem.source":      { en: "Source",          ja: "ソース" },
  "telem.approaching": { en: "⚠ APPROACHING",   ja: "⚠ 接近中" },

  // DSN
  "dsn.title":       { en: "DSN Ground Contact",                        ja: "DSN地上局交信" },
  "dsn.fetching":    { en: "FETCHING...",                               ja: "取得中..." },
  "dsn.tracking":    { en: "TRACKING",                                  ja: "追跡中" },
  "dsn.noContact":   { en: "NO CONTACT",                                ja: "交信なし" },
  "dsn.also":        { en: "Also tracking",                             ja: "同時追跡中" },
  "dsn.noWindow":    { en: "Orion not currently in DSN contact window", ja: "現在DSN交信ウィンドウ外" },
  "dsn.complexes":   { en: "DSN Complexes",                             ja: "DSN施設" },
  "dsn.oneWay":      { en: "one-way",                                   ja: "片道" },
  "dsn.updated":     { en: "DSN updated",                               ja: "DSN更新" },
  "dsn.dish":        { en: "dish",                                      ja: "基" },
  "dsn.dishes":      { en: "dishes",                                    ja: "基" },

  // Timeline
  "tl.title":   { en: "Mission Timeline", ja: "タイムライン" },
  "tl.plan":    { en: "Plan",             ja: "計画" },
  "tl.actual":  { en: "Actual",           ja: "実績" },
  "tl.planned": { en: "Planned:",         ja: "計画:" },
  "tl.actual2": { en: "Actual:",          ja: "実績:" },

  // Refresh
  "refresh.label":  { en: "Refresh:",   ja: "更新間隔:" },
  "refresh.manual": { en: "Manual",     ja: "手動" },
  "refresh.button": { en: "↻ Refresh", ja: "↻ 更新" },

  // Approach alert
  "approach.moon":     { en: "Moon",                                      ja: "月" },
  "approach.earth":    { en: "Earth",                                     ja: "地球" },
  "approach.subtitle": { en: "Consider increasing the polling frequency", ja: "更新頻度を上げることをお勧めします" },
  "approach.later":    { en: "Later",                                     ja: "後で" },

  // News
  "news.title":   { en: "Latest News",              ja: "最新ニュース" },
  "news.loading": { en: "LOADING...",               ja: "読み込み中..." },
  "news.empty":   { en: "No recent articles found.", ja: "最近の記事はありません" },
  "news.updated": { en: "updated",                  ja: "更新" },

  // Page tabs
  "tab.mission": { en: "MISSION", ja: "ミッション" },
  "tab.news":    { en: "NEWS",    ja: "ニュース" },

  // Visitor counter
  "visit.unique": { en: "UNIQUE VISITORS", ja: "ユニーク訪問者" },
  "visit.total":  { en: "TOTAL VISITS",    ja: "総訪問数" },
} as const;

export type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, locale: Locale): string {
  return translations[key][locale];
}

/** Translate phase labels returned by the API */
const PHASE_JA: Record<string, string> = {
  "Translunar Coast": "月遷移飛行",
  "Lunar Flyby":      "月フライバイ",
  "Return Coast":     "帰還飛行",
  "Reentry":          "再突入",
  "Ascent":           "上昇",
  "Complete":         "完了",
};
export function translatePhase(label: string, locale: Locale): string {
  return locale === "ja" ? (PHASE_JA[label] ?? label) : label;
}

/** Relative time string ("3m ago" / "3分前") */
export function relativeTime(iso: string, locale: Locale): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (locale === "ja") {
    if (m < 60)  return `${m}分前`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}時間前`;
    return `${Math.floor(h / 24)}日前`;
  }
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
