"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { formatEt } from "@/lib/time";
import type { MarketPayload, SettingsPayload } from "@/lib/types";
import { btn, btnPrimary, field, label } from "./ui";

type AppContextValue = {
  market: MarketPayload | null;
  marketError: string | null;
  loadingMarket: boolean;
  settings: SettingsPayload | null;
  version: number;
  refresh: () => void;
  reloadSettings: () => Promise<void>;
  setFavorite: (netuid: number, favorite: boolean) => Promise<void>;
  openSettings: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside the shell.");
  return value;
}

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/buy", label: "Buy & Sell" },
  { href: "/analyst", label: "Analyst" },
  { href: "/history", label: "History" },
  { href: "/help", label: "Help" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [market, setMarket] = useState<MarketPayload | null>(null);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [loadingMarket, setLoadingMarket] = useState(true);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [version, setVersion] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const reloadSettings = useCallback(async () => {
    const response = await fetch("/api/settings");
    const body = await response.json();
    if (response.ok) setSettings(body as SettingsPayload);
  }, []);

  useEffect(() => {
    void reloadSettings();
  }, [reloadSettings]);

  useEffect(() => {
    let cancel = false;
    setLoadingMarket(true);
    fetch(`/api/market?fresh=${version > 0 ? "1" : "0"}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Market data failed.");
        if (!cancel) {
          setMarket(body as MarketPayload);
          setMarketError(body.warning ?? null);
        }
      })
      .catch((error: unknown) => {
        if (!cancel) setMarketError(error instanceof Error ? error.message : "Market data failed.");
      })
      .finally(() => {
        if (!cancel) setLoadingMarket(false);
      });
    return () => {
      cancel = true;
    };
  }, [version]);

  const setFavorite = useCallback(async (netuid: number, favorite: boolean) => {
    setMarket((current) =>
      current
        ? {
            ...current,
            subnets: current.subnets.map((row) => (row.netuid === netuid ? { ...row, favorite } : row)),
          }
        : current,
    );
    const response = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ netuid, favorite }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: "Could not save the favorite." }));
      setMarketError(body.error || "Could not save the favorite.");
    } else {
      await reloadSettings();
    }
  }, [reloadSettings]);

  const refreshStamp = market?.fetchedAt ? formatEt(market.fetchedAt) : loadingMarket ? "Loading" : "—";

  return (
    <AppContext.Provider
      value={{
        market,
        marketError,
        loadingMarket,
        settings,
        version,
        refresh: () => setVersion((value) => value + 1),
        reloadSettings,
        setFavorite,
        openSettings: () => setSettingsOpen(true),
      }}
    >
      <div className="h-screen overflow-hidden bg-app text-ink">
        <div className="mx-auto flex h-full max-w-desktop">
          <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-line bg-sidebar">
            <div className="px-4 pb-3 pt-5">
              <div className="text-[15px] font-[650] tracking-tight">Alpha Trading</div>
              <div className="mt-1 text-[11px] text-faint">Local · paper first</div>
            </div>
            <nav className="flex flex-col gap-0.5 px-2">
              {NAV.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-ctl border-l-[3px] px-3 py-2 text-[13px] ${
                      active ? "border-gold bg-elevated text-ink" : "border-transparent text-muted hover:bg-hover hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-auto border-t border-line px-3 py-3">
              <button type="button" onClick={() => setSettingsOpen(true)} className={`${btn} w-full text-left`}>
                Settings
              </button>
              <p className="mt-3 text-[11px] leading-relaxed text-faint">
                Last refresh {refreshStamp}. Cache 60–120s. Times in ET.
              </p>
            </div>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-subtle px-7 py-2 text-[12px] text-muted">
              <span>Local · America/New_York</span>
              <span className={marketError ? "text-loss" : ""}>{marketError ?? `Last refresh ${refreshStamp}`}</span>
            </div>
            <main className="min-h-0 flex-1 overflow-auto px-7 py-6">{children}</main>
          </div>
        </div>
      </div>
      {settingsOpen ? (
        <SettingsDialog
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onSaved={async () => {
            await reloadSettings();
            setSettingsOpen(false);
          }}
        />
      ) : null}
    </AppContext.Provider>
  );
}

function SettingsDialog({
  settings,
  onClose,
  onSaved,
}: {
  settings: SettingsPayload | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [coldkey, setColdkey] = useState(settings?.coldkey ?? "");
  const [thin, setThin] = useState(settings?.thinPoolTao ?? "100");
  const [starting, setStarting] = useState(settings?.startingTao ?? "1");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const locked = (settings?.virtualTradeCount ?? 0) > 0;

  async function save() {
    setSaving(true);
    setError(null);
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coldkey, thinPoolTao: thin, startingTao: starting }),
    });
    const body = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(body.error || "Could not save settings.");
      return;
    }
    await onSaved();
  }

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/60 p-6" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="w-full max-w-md rounded-card border border-line bg-card p-4 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-[650]">Settings</h2>
          <button type="button" onClick={onClose} className="text-[12px] text-muted">
            Close
          </button>
        </div>
        <label className={label}>Public coldkey</label>
        <input className={`${field} num mt-1`} value={coldkey} onChange={(event) => setColdkey(event.target.value)} placeholder="SS58 address, starts with 5" spellCheck={false} />
        <p className="mb-3 mt-1 text-[11px] text-faint">Read-only. No seed phrase, no private key, no wallet.</p>
        <label className={label}>Thin-pool threshold (τ)</label>
        <input className={`${field} num mt-1`} value={thin} onChange={(event) => setThin(event.target.value)} />
        <p className="mb-3 mt-1 text-[11px] text-faint">Default 100 τ. A pool under this line asks you to confirm a virtual fill.</p>
        <label className={label}>Virtual starting TAO</label>
        <input className={`${field} num mt-1`} value={starting} onChange={(event) => setStarting(event.target.value)} disabled={locked} />
        <p className="mt-1 text-[11px] text-warn">Starting TAO can change only while the virtual book is empty.{locked ? " This book already has trades." : ""}</p>
        {error ? <p className="mt-3 text-[12px] text-loss">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={btnPrimary} onClick={() => void save()} disabled={saving}>
            {saving ? "Saving" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
