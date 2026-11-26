"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Sparkline } from "@/components/Sparkline";
import { useApp } from "@/components/Shell";
import { Compact, Empty, PageTitle, Pct, Price, btn, card, field } from "@/components/ui";
import { formatAge } from "@/lib/time";
import { num } from "@/lib/format";
import type { SubnetCard } from "@/lib/types";

type SortKey = "rank" | "name" | "price" | "age" | "mcap" | "emission" | "h1" | "h24" | "d7" | "fdv" | "vol";

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "rank", label: "#", numeric: true },
  { key: "name", label: "Subnet", numeric: false },
  { key: "price", label: "Price (τ)", numeric: true },
  { key: "age", label: "Age", numeric: true },
  { key: "mcap", label: "MCAP", numeric: true },
  { key: "emission", label: "Emissions %", numeric: true },
  { key: "h1", label: "1h %", numeric: true },
  { key: "h24", label: "24h %", numeric: true },
  { key: "d7", label: "7d %", numeric: true },
  { key: "fdv", label: "FDV", numeric: true },
  { key: "vol", label: "24h vol", numeric: true },
];

function valueOf(row: SubnetCard, key: SortKey): number | string {
  switch (key) {
    case "rank": return row.rank;
    case "name": return row.name.toLowerCase();
    case "price": return num(row.priceTao) ?? Number.NEGATIVE_INFINITY;
    case "age": return row.registeredAt ? Date.parse(row.registeredAt) : 0;
    case "mcap": return num(row.marketCapTao) ?? Number.NEGATIVE_INFINITY;
    case "emission": return num(row.emissionSharePct) ?? Number.NEGATIVE_INFINITY;
    case "h1": return num(row.change1h) ?? Number.NEGATIVE_INFINITY;
    case "h24": return num(row.change24h) ?? Number.NEGATIVE_INFINITY;
    case "d7": return num(row.change7d) ?? Number.NEGATIVE_INFINITY;
    case "fdv": return num(row.fdvTao) ?? Number.NEGATIVE_INFINITY;
    case "vol": return num(row.volume24hTao) ?? Number.NEGATIVE_INFINITY;
  }
}

export default function AnalystPage() {
  const router = useRouter();
  const { market, marketError, loadingMarket, refresh, setFavorite } = useApp();
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "mcap", dir: "desc" });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = market?.subnets ?? [];
    if (favoritesOnly) list = list.filter((row) => row.favorite);
    if (q) {
      list = list.filter((row) => row.name.toLowerCase().includes(q) || String(row.netuid).includes(q) || `sn ${row.netuid}`.includes(q));
    }
    const sorted = [...list].sort((a, b) => {
      const av = valueOf(a, sort.key);
      const bv = valueOf(b, sort.key);
      const cmp = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv) : Number(av) - Number(bv);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    const fav = sorted.filter((row) => row.favorite);
    const rest = sorted.filter((row) => !row.favorite);
    return favoritesOnly ? sorted : [...fav, ...rest];
  }, [market, query, favoritesOnly, sort]);

  function toggleSort(key: SortKey) {
    setSort((current) => current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" ? "asc" : "desc" });
  }

  async function favoriteRidges() {
    const ridges = market?.subnets.find((row) => row.netuid === 62);
    if (!ridges) {
      window.alert("SN62 is not in the current Taostats pool list.");
      return;
    }
    await setFavorite(62, true);
  }

  return (
    <div>
      <PageTitle title="Analyst">
        <input className={`${field} w-48`} placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
        <button type="button" className={btn} onClick={() => setFavoritesOnly((value) => !value)}>
          {favoritesOnly ? "Showing favorites" : "Favorites"}
        </button>
        <button type="button" className={btn} onClick={() => void favoriteRidges()}>Favorite SN62</button>
        <button type="button" className={btn} onClick={refresh}>Refresh</button>
      </PageTitle>
      <p className="mb-3 text-[12px] text-faint">
        {market ? `${market.subnets.length} subnets · rank is by market cap · cache ${market.cacheSeconds}s` : "Waiting on Taostats"}
        {market?.stale ? " · showing a cached snapshot" : ""}
      </p>
      {marketError && !market ? <div className={card}><Empty>{marketError}</Empty></div> : null}
      {loadingMarket && !market ? <Empty>Loading the screener.</Empty> : null}
      {market ? (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full min-w-[1180px] text-[12.5px]">
            <thead className="bg-elevated text-label font-[650] uppercase text-muted">
              <tr>
                {COLUMNS.slice(0, 2).map((column) => (
                  <SortTh key={column.key} column={column} sort={sort} onSort={toggleSort} />
                ))}
                <th className="px-2 py-2 text-center">★</th>
                {COLUMNS.slice(2, 6).map((column) => (
                  <SortTh key={column.key} column={column} sort={sort} onSort={toggleSort} />
                ))}
                <th className="px-2 py-2 text-right">7d</th>
                {COLUMNS.slice(6).map((column) => (
                  <SortTh key={column.key} column={column} sort={sort} onSort={toggleSort} />
                ))}
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={14}><Empty>{favoritesOnly ? "No favorites yet." : "No subnets match that search."}</Empty></td></tr>
              ) : rows.map((row) => (
                <tr
                  key={row.netuid}
                  className={`cursor-pointer border-t border-subtle hover:bg-hover ${row.favorite ? "bg-[#C9A44C14]" : ""}`}
                  onClick={() => router.push(`/analyst/${row.netuid}`)}
                >
                  <td className="num px-2 py-1.5 text-right text-muted">{row.rank}</td>
                  <td className="px-2 py-1.5">
                    <span className="flex items-center gap-2">
                      <Logo url={row.logoUrl} name={row.name} />
                      <span>
                        <span className="block leading-tight">{row.name}</span>
                        <span className="num text-[11px] text-faint">SN {row.netuid}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-2 text-center">
                    <button
                      type="button"
                      className={row.favorite ? "text-gold" : "text-faint"}
                      aria-label={row.favorite ? "Unfavorite" : "Favorite"}
                      onClick={(event) => {
                        event.stopPropagation();
                        void setFavorite(row.netuid, !row.favorite);
                      }}
                    >
                      {row.favorite ? "★" : "☆"}
                    </button>
                  </td>
                  <td className="px-2 text-right">{row.priceTao ? <Price value={row.priceTao} /> : "—"}</td>
                  <td className="num px-2 text-right text-muted" title={row.registeredAt ? formatAge(row.registeredAt) : ""}>{row.ageLabel}</td>
                  <td className="px-2 text-right" title={row.marketCapNote ?? undefined}><Compact value={row.marketCapTao} /></td>
                  <td className="num px-2 text-right">{row.emissionSharePct ? `${Number(row.emissionSharePct).toFixed(2)}` : "—"}</td>
                  <td className="px-2 text-right"><Sparkline values={row.sparkline.map((point) => point.v)} /></td>
                  <td className="px-2 text-right"><Pct value={row.change1h} /></td>
                  <td className="px-2 text-right"><Pct value={row.change24h} /></td>
                  <td className="px-2 text-right"><Pct value={row.change7d} /></td>
                  <td className="px-2 text-right"><Compact value={row.fdvTao} /></td>
                  <td className="px-2 text-right"><Compact value={row.volume24hTao} /></td>
                  <td className="px-2 text-right">
                    <button type="button" className={btn} onClick={(event) => { event.stopPropagation(); router.push(`/analyst/${row.netuid}`); }}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {market?.notes?.length ? (
        <p className="mt-3 text-[11px] leading-relaxed text-faint">{market.notes.join(" ")}</p>
      ) : null}
      <p className="mt-2 text-[11px] text-faint">Screener cache is 90 seconds so the free Taostats limit is left alone. Refresh sooner and you will see the cached snapshot.</p>
    </div>
  );
}

function SortTh({
  column,
  sort,
  onSort,
}: {
  column: { key: SortKey; label: string; numeric: boolean };
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === column.key;
  return (
    <th className={`px-2 py-2 ${column.numeric ? "text-right" : "text-left"}`}>
      <button type="button" className="inline-flex items-center gap-1 uppercase" onClick={() => onSort(column.key)}>
        {column.label}
        <span className={active ? "text-ink" : "text-faint"}>{active ? (sort.dir === "asc" ? "▲" : "▼") : "▾"}</span>
      </button>
    </th>
  );
}

function Logo({ url, name }: { url: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!url || broken) {
    return <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-elevated text-[9px] text-muted">{name.slice(0, 2).toUpperCase()}</span>;
  }
  return <img src={url} alt="" width={22} height={22} className="h-[22px] w-[22px] shrink-0 rounded-full object-cover" onError={() => setBroken(true)} />;
}
