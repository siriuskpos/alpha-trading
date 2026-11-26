export const TZ = "America/New_York";

export function etDateKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatEt(iso: string, withTime = true): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime
      ? { hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "short" }
      : {}),
  }).format(date);
}

export function formatAge(iso: string | null, now = Date.now()): string {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";
  const days = Math.floor((now - then) / 86_400_000);
  if (days < 0) return "—";
  if (days < 1) return "<1d";
  if (days < 60) return `${days}d`;
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years < 1) return `${Math.max(1, months)}mo`;
  return months > 0 ? `${years}y ${months}mo` : `${years}y`;
}

/** Inclusive ET calendar-day filter. `to` is the end date, still included. */
export function inEtRange(iso: string, from: string | null, to: string | null): boolean {
  const key = etDateKey(iso);
  if (!key) return false;
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}
