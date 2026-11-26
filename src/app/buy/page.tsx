"use client";

import { useEffect, useMemo, useState } from "react";
import { PriceChart } from "@/components/Charts";
import { useApp } from "@/components/Shell";
import { Empty, ExternalLink, Notice, PageTitle, Pill, Price, Signed, card, field, label, btn, btnPrimary } from "@/components/ui";
import { backpropSubnetUrl, formatCompact, num, taostatsSubnetUrl } from "@/lib/format";
import type { QuotePayload, SubnetCard } from "@/lib/types";

export default function BuyPage() {
  const { market, marketError, loadingMarket, settings, version, refresh } = useApp();
  const subnets = market?.subnets ?? [];
  const [query, setQuery] = useState("");
  const [netuid, setNetuid] = useState<number | null>(null);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [quote, setQuote] = useState<QuotePayload | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [logged, setLogged] = useState<string | null>(null);

  useEffect(() => {
    if (netuid != null || subnets.length === 0) return;
    const ridges = subnets.find((row) => row.netuid === 62);
    const favorite = subnets.find((row) => row.favorite);
    setNetuid(ridges?.netuid ?? favorite?.netuid ?? subnets[0].netuid);
  }, [subnets, netuid]);

  const selected = subnets.find((row) => row.netuid === netuid) ?? null;
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subnets.slice(0, 8);
    return subnets.filter((row) => row.name.toLowerCase().includes(q) || String(row.netuid) === q || `sn ${row.netuid}` === q).slice(0, 12);
  }, [query, subnets]);

  useEffect(() => {
    if (netuid == null) return;
    let cancel = false;
    const handle = setTimeout(() => {
      const params = new URLSearchParams({ netuid: String(netuid), side, amount });
      fetch(`/api/quote?${params}`)
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || "Quote failed.");
          if (!cancel) {
            setQuote(body as QuotePayload);
            setQuoteError(null);
          }
        })
        .catch((reasonError: unknown) => {
          if (!cancel) setQuoteError(reasonError instanceof Error ? reasonError.message : "Quote failed.");
        });
    }, 400);
    return () => {
      cancel = true;
      clearTimeout(handle);
    };
  }, [netuid, side, amount, version]);

  async function submit(confirmRisk: boolean) {
    if (netuid == null) return;
    setBusy(true);
    setLogged(null);
    const response = await fetch("/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ netuid, side, amount, reason, confirmRisk }),
    });
    const body = await response.json();
    setBusy(false);
    if (response.status === 409) {
      setConfirm(body.error || "Confirm this fill.");
      return;
    }
    if (!response.ok) {
      setQuoteError(body.error || "The trade was not logged.");
      return;
    }
    setConfirm(null);
    setReason("");
    setAmount("");
    setLogged("Logged at the latest runtime quote. The reason is locked in History.");
    refresh();
  }

  const flow = num(selected?.netFlowTao);
  const thinLine = settings?.thinPoolTao ?? quote?.thresholdTao ?? "100";

  return (
    <div>
      <PageTitle title="Buy & Sell">
        <Pill kind="virtual">Virtual only</Pill>
      </PageTitle>
      {marketError && !market ? <div className={card}><Empty>{marketError}</Empty></div> : null}
      {loadingMarket && !market ? <Empty>Loading subnets.</Empty> : null}

      <div className="grid gap-3 xl:grid-cols-12">
        <section className={`${card} p-4 xl:col-span-7`}>
          <div className={label}>Ticket</div>
          <h2 className="mt-1 text-[15px] font-[650]">{selected ? `${selected.name} · SN ${selected.netuid}` : "Pick a subnet"}</h2>
          <input className={`${field} mt-3`} placeholder="Search name or SN" value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className="mt-2 max-h-40 overflow-auto rounded-ctl border border-subtle">
            {matches.map((row) => (
              <button
                key={row.netuid}
                type="button"
                onClick={() => { setNetuid(row.netuid); setQuery(""); }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[13px] hover:bg-hover ${row.netuid === netuid ? "bg-elevated" : ""}`}
              >
                <span>{row.name}</span>
                <span className="num text-muted">SN {row.netuid}</span>
              </button>
            ))}
            {matches.length === 0 ? <Empty>No subnet matches that search.</Empty> : null}
          </div>

          <div className="mt-3 inline-flex h-8 overflow-hidden rounded-ctl border border-line">
            <button type="button" className={`px-3 text-[12px] font-semibold ${side === "buy" ? "bg-gain-dim text-gain" : "text-muted"}`} onClick={() => setSide("buy")}>Buy</button>
            <button type="button" className={`border-l border-line px-3 text-[12px] font-semibold ${side === "sell" ? "bg-loss-dim text-loss" : "text-muted"}`} onClick={() => setSide("sell")}>Sell</button>
          </div>
          <label className={`${label} mt-3 block`}>{side === "buy" ? "TAO in" : "Alpha in"}</label>
          <input className={`${field} num mt-1`} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={side === "buy" ? "0.10" : "100"} />

          <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
            <Stat label="Mid" value={quote?.quote ? <Price value={quote.quote.midPriceTao} /> : "—"} />
            <Stat label="Quote" value={quote?.quote ? <Price value={quote.quote.fillPriceTao} /> : "—"} />
            <Stat label="Runtime slippage" value={quote?.quote ? `${quote.quote.slippagePct}%` : "—"} />
            <Stat label="Mid vs fill" value={quote?.quote?.gapPct ? `${quote.quote.gapPct}%` : "—"} />
          </div>
          <p className="mt-2 text-[11px] text-faint">The fill is the impact-aware runtime quote from Taostats slippage, not the mid price. A thin pool or slippage of 1% or more asks for confirmation.</p>

          <label className={`${label} mt-3 block`}>Reason</label>
          <textarea className={`${field} mt-1 min-h-[72px] font-sans`} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why this trade" />
          <p className="mt-1 text-[11px] text-warn">Locked after submit.</p>
          {quoteError ? <p className="mt-2 text-[12px] text-loss">{quoteError}</p> : null}
          {logged ? <p className="mt-2 text-[12px] text-gain">{logged}</p> : null}
          <button type="button" className={`${btnPrimary} mt-3`} disabled={busy || !amount || !reason.trim()} onClick={() => void submit(false)}>
            {busy ? "Logging" : "Log virtual trade"}
          </button>
        </section>

        <section className={`${card} p-4 xl:col-span-5`}>
          <div className={label}>Quote</div>
          <h2 className="mt-1 text-[15px] font-[650]">{side === "buy" ? "Alpha out" : "TAO out"}</h2>
          <p className="num mt-2 text-kpi font-semibold">
            {quote?.quote ? (side === "buy" ? quote.quote.outputAlpha : quote.quote.outputTao) : "—"}
          </p>
          <dl className="mt-3 space-y-2 text-[13px]">
            <Row k="Fee τ" v={quote?.quote?.feeTao ?? "—"} />
            <Row k="Fee α" v={quote?.quote?.feeAlpha ?? "—"} />
            <Row k="Block" v={quote?.quote ? String(quote.quote.blockNumber) : "—"} />
            <Row k="Cash left" v={quote ? `${quote.cashTao} τ` : "—"} />
            <Row k="Position α" v={quote?.position.alpha ?? "—"} />
            <Row k="Avg entry" v={quote?.position.avgPriceTao ?? "—"} />
            <Row k="Unrealized" v={<Signed value={quote?.position.unrealizedTao ?? null} />} />
          </dl>
          {quote?.quote?.exceedsReserve ? <Notice tone="loss">This size is larger than the pool reserve.</Notice> : null}
          {quote?.quote?.thin ? <div className="mt-3"><Pill kind="thin">Thin</Pill></div> : null}
          {quote?.quote?.highSlippage ? <p className="mt-2 text-[12px] text-warn">Slippage is at least 1%.</p> : null}
        </section>
      </div>

      {selected ? <SubnetBand subnet={selected} thinLine={thinLine} flow={flow} /> : null}

      <p className="mt-4 text-[12px] text-muted">
        Real trades are placed on official sites, not here.{" "}
        {selected ? <ExternalLink href={taostatsSubnetUrl(selected.netuid)}>Taostats SN {selected.netuid}</ExternalLink> : null}
        {selected ? " · " : null}
        {selected ? <ExternalLink href={backpropSubnetUrl(selected.netuid, selected.name)}>Backprop</ExternalLink> : null}
      </p>

      {confirm ? (
        <div className="fixed inset-0 z-20 grid place-items-center bg-black/60 p-6" role="dialog" aria-modal="true">
          <div className={`${card} max-w-md p-4`}>
            <h2 className="text-[15px] font-[650]">Confirm virtual fill</h2>
            <p className="mt-2 text-[13px] text-warn">{confirm}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={btn} onClick={() => setConfirm(null)}>Cancel</button>
              <button type="button" className={btnPrimary} onClick={() => void submit(true)}>Log virtual trade</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label: k, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-ctl border border-subtle bg-elevated px-3 py-2">
      <div className={label}>{k}</div>
      <div className="num mt-1">{value}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-subtle pb-1">
      <dt className="text-muted">{k}</dt>
      <dd className="num">{v}</dd>
    </div>
  );
}

function SubnetBand({ subnet, thinLine, flow }: { subnet: SubnetCard; thinLine: string; flow: number | null }) {
  const pool = num(subnet.poolTao);
  const thin = pool != null && pool < Number(thinLine);
  return (
    <section className={`${card} mt-3 p-4`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className={label}>Selected subnet</div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="num text-kpi font-semibold"><Price value={subnet.priceTao} /></span>
            <span className="text-[12px] text-muted">τ</span>
          </div>
        </div>
        <div className="flex gap-4 text-[12px]">
          <span>1h <Signedish value={subnet.change1h} /></span>
          <span>24h <Signedish value={subnet.change24h} /></span>
          <span>7d <Signedish value={subnet.change7d} /></span>
        </div>
        <div className="flex items-center gap-2">
          {thin ? <Pill kind="thin">Thin</Pill> : <Pill kind="deep">Deep</Pill>}
          {flow != null ? (
            <Pill kind={flow >= 0 ? "deep" : "thin"}>{flow >= 0 ? "Net in" : "Net out"} {formatCompact(flow)} τ</Pill>
          ) : null}
        </div>
      </div>
      <div className="mt-3">
        {subnet.sparkline.length > 1 ? <PriceChart data={subnet.sparkline} /> : <Empty>No 7-day price sample for this subnet.</Empty>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Mini k="Pool τ" v={subnet.poolTao} />
        <Mini k="Pool α" v={subnet.poolAlpha} />
        <Mini k="24h in τ" v={subnet.taoIn24h} />
        <Mini k="24h out τ" v={subnet.taoOut24h} />
        <Mini k="24h volume τ" v={subnet.volume24hTao} />
        <Mini k="Emission share" v={subnet.emissionSharePct ? `${Number(subnet.emissionSharePct).toFixed(2)}%` : "—"} />
        <Mini k="Market cap τ" v={subnet.marketCapTao ? formatCompact(num(subnet.marketCapTao)) : "—"} />
        <Mini k="FDV τ" v={subnet.fdvTao ? formatCompact(num(subnet.fdvTao)) : "—"} />
      </div>
      {subnet.priceNote ? <p className="mt-2 text-[12px] text-warn">{subnet.priceNote}</p> : null}
      {subnet.marketCapNote ? <p className="mt-1 text-[12px] text-warn">{subnet.marketCapNote}</p> : null}
    </section>
  );
}

function Signedish({ value }: { value: string | null }) {
  const n = num(value);
  const text = n == null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(2)}%`;
  const cls = n == null || n === 0 ? "text-ink" : n > 0 ? "text-gain" : "text-loss";
  return <span className={`num ${cls}`}>{text}</span>;
}

function Mini({ k, v }: { k: string; v: string | null }) {
  return (
    <div>
      <div className={label}>{k}</div>
      <div className="num mt-1">{v ?? "—"}</div>
    </div>
  );
}
