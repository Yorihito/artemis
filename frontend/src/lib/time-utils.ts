export function formatMET(elapsedSeconds: number): string {
  if (elapsedSeconds < 0) return "T-" + formatMET(-elapsedSeconds);
  const d = Math.floor(elapsedSeconds / 86400);
  const h = Math.floor((elapsedSeconds % 86400) / 3600);
  const m = Math.floor((elapsedSeconds % 3600) / 60);
  const s = Math.floor(elapsedSeconds % 60);
  if (d > 0) return `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
  if (h > 0) return `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
  return `${pad(m)}m ${pad(s)}s`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function formatJST(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }) + " JST";
}

export function formatUTC(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().replace("T", " ").replace(".000Z", "") + " UTC";
}

export function formatDistance(km: number): string {
  if (km >= 1_000_000) return `${(km / 1_000_000).toFixed(3)} M km`;
  if (km >= 1_000) return `${(km / 1_000).toFixed(1)} k km`;
  return `${km.toFixed(0)} km`;
}
