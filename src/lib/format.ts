export function toneOf(n: number | null): "gain" | "loss" | "flat" {
  if (n == null || !Number.isFinite(n) || n === 0) return "flat";
  return n > 0 ? "gain" : "loss";
}

export function toneClass(tone: "gain" | "loss" | "flat"): string {
  if (tone === "gain") return "text-gain";
  if (tone === "loss") return "text-loss";
  return "text-ink";
}

function group(n: number, min: number, max: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  });
}

/** Losses use a leading minus (−), never parentheses. */
export function formatSigned(n: number | null, digits: number): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const body = group(Math.abs(n), Math.min(2, digits), digits);
  if (n < 0) return `−${body}`;
  if (n > 0) return `+${body}`;
  return body;
}

export function formatTao(n: number | null, digits = 4): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return group(n, Math.min(2, digits), digits);
}

export function formatPrice(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const digits = abs >= 1 ? 4 : abs >= 0.01 ? 6 : 8;
  return group(n, 2, digits);
}

export function formatCompact(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const signed = (body: string) => (n < 0 ? `−${body}` : body);
  if (abs >= 1e9) return signed(`${(abs / 1e9).toFixed(2)}b`);
  if (abs >= 1e6) return signed(`${(abs / 1e6).toFixed(2)}m`);
  if (abs >= 1e3) return signed(`${(abs / 1e3).toFixed(2)}k`);
  return signed(abs.toFixed(2));
}

export function formatPct(n: number | null, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const body = `${Math.abs(n).toFixed(digits)}%`;
  if (n < 0) return `−${body}`;
  if (n > 0) return `+${body}`;
  return body;
}

export function formatPctString(raw: string | null): string {
  if (raw == null || raw.trim() === "") return "—";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "—";
  return formatPct(n);
}

export function num(raw: string | null | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function backpropSubnetUrl(netuid: number, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug
    ? `https://backprop.finance/subnets/${netuid}-${slug}`
    : `https://backprop.finance/subnets/${netuid}`;
}

export function taostatsSubnetUrl(netuid: number): string {
  return `https://taostats.io/subnets/${netuid}/chart`;
}

export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {
    return null;
  }
  return null;
}

export function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
