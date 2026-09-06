export function withTimestamp(url: string, at?: number | null) {
  if (!at) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}t=${at}`;
}

export function formatTimestamp(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}
