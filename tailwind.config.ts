import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app: "var(--color-bg)",
        sidebar: "var(--color-bg-sidebar)",
        elevated: "var(--color-bg-elevated)",
        card: "var(--color-bg-card)",
        hover: "var(--color-bg-hover)",
        line: "var(--color-line)",
        subtle: "var(--color-line-subtle)",
        ink: "var(--color-text)",
        muted: "var(--color-muted)",
        faint: "var(--color-faint)",
        gain: "var(--color-green)",
        "gain-dim": "var(--color-green-dim)",
        loss: "var(--color-red)",
        "loss-dim": "var(--color-red-dim)",
        warn: "var(--color-amber)",
        "warn-dim": "var(--color-amber-dim)",
        gold: "var(--color-gold)",
        "gold-fg": "var(--color-gold-fg)",
        virtual: "var(--color-teal)",
        "virtual-dim": "var(--color-teal-dim)",
        real: "var(--color-real)",
        "real-dim": "var(--color-real-dim)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "var(--font-plex-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        label: ["10.5px", { lineHeight: "1.2", letterSpacing: "0.06em" }],
        kpi: ["20px", { lineHeight: "1.2" }],
        title: ["22px", { lineHeight: "1.2", letterSpacing: "-0.03em" }],
      },
      borderRadius: { ctl: "8px", card: "12px" },
      maxWidth: { desktop: "1440px" },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 24px rgba(0,0,0,0.25)",
      },
    },
  },
} satisfies Config;
