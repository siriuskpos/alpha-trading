import { formatCompact, formatPct, formatPctString, formatPrice, formatSigned, formatTao, num, toneClass, toneOf } from "@/lib/format";

export const btn =
  "rounded-ctl border border-line bg-hover px-3 py-[7px] text-[12px] font-semibold text-ink hover:brightness-110 disabled:opacity-40";
export const btnPrimary = "rounded-ctl bg-gold px-3 py-[7px] text-[12px] font-semibold text-gold-fg disabled:opacity-40";
export const card = "rounded-card border border-line bg-card shadow-card";
export const label = "text-label font-[650] uppercase text-muted";
export const field =
  "w-full rounded-ctl border border-line bg-elevated px-3 py-2 text-[13px] text-ink outline-none focus:border-gold";

export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-title font-[650]">{title}</h1>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function Pill({ kind, children }: { kind: "virtual" | "real" | "thin" | "deep" | "open" | "warn"; children: React.ReactNode }) {
  const cls = {
    virtual: "bg-virtual-dim text-virtual",
    real: "bg-real-dim text-real",
    thin: "bg-warn-dim text-warn",
    deep: "bg-gain-dim text-gain",
    open: "text-virtual",
    warn: "bg-warn-dim text-warn",
  }[kind];
  return (
    <span className={`inline-flex h-5 items-center rounded-full px-[7px] text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {children}
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-8 text-center text-[13px] text-muted">{children}</p>;
}

export function Notice({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "loss" | "warn" }) {
  const cls = tone === "loss" ? "text-loss" : tone === "warn" ? "text-warn" : "text-muted";
  return <p className={`text-[12px] ${cls}`}>{children}</p>;
}

export function Signed({ value, digits = 4, suffix = "" }: { value: string | number | null; digits?: number; suffix?: string }) {
  const n = typeof value === "number" ? value : num(value);
  return (
    <span className={`num ${toneClass(toneOf(n))}`}>
      {formatSigned(n, digits)}
      {n == null ? "" : suffix}
    </span>
  );
}

export function Price({ value }: { value: string | number | null }) {
  const n = typeof value === "number" ? value : num(value);
  return <span className="num">{formatPrice(n)}</span>;
}

export function Tao({ value, digits = 4 }: { value: string | number | null; digits?: number }) {
  const n = typeof value === "number" ? value : num(value);
  return <span className="num">{formatTao(n, digits)}</span>;
}

export function Compact({ value }: { value: string | number | null }) {
  const n = typeof value === "number" ? value : num(value);
  return <span className="num">{formatCompact(n)}</span>;
}

export function Pct({ value }: { value: string | number | null }) {
  const text = typeof value === "number" ? formatPct(value) : formatPctString(value);
  const n = typeof value === "number" ? value : num(value);
  return <span className={`num ${toneClass(toneOf(n))}`}>{text}</span>;
}

export function ModeToggle({ mode, onChange }: { mode: "virtual" | "real"; onChange: (mode: "virtual" | "real") => void }) {
  return (
    <div className="inline-flex h-8 overflow-hidden rounded-ctl border border-line">
      <button
        type="button"
        onClick={() => onChange("virtual")}
        className={`px-3 text-[12px] font-semibold ${mode === "virtual" ? "bg-virtual-dim text-virtual" : "text-muted"}`}
      >
        Virtual
      </button>
      <button
        type="button"
        onClick={() => onChange("real")}
        className={`border-l border-line px-3 text-[12px] font-semibold ${mode === "real" ? "bg-real-dim text-real" : "text-muted"}`}
      >
        Real
      </button>
    </div>
  );
}

export function Kpi({ label, value, caption, tone }: { label: string; value: React.ReactNode; caption?: string; tone?: "gain" | "loss" | "flat" }) {
  return (
    <div className={`${card} px-[14px] py-3`}>
      <div className={label}>{label}</div>
      <div className={`num mt-2 text-kpi font-semibold ${tone ? toneClass(tone) : ""}`}>{value}</div>
      {caption ? <div className="mt-1 text-[11px] text-faint">{caption}</div> : null}
    </div>
  );
}

export function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-gold hover:underline">
      {children}
    </a>
  );
}
