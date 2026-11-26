"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PriceChart } from "@/components/Charts";
import { useApp } from "@/components/Shell";
import { Compact, Empty, ExternalLink, PageTitle, Pct, Pill, Price, btn, card, label } from "@/components/ui";
import { backpropSubnetUrl, num, taostatsSubnetUrl } from "@/lib/format";
import type { SubnetDetail } from "@/lib/types";

export default function SubnetPage() {
  const params = useParams<{ netuid: string }>();
  const netuid = Number(params.netuid);
  const { setFavorite, version, settings } = useApp();
  const [detail, setDetail] = useState<SubnetDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    fetch(`/api/subnet/${netuid}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Subnet failed.");
        if (!cancel) setDetail(body as SubnetDetail);
      })
      .catch((reason: unknown) => {
        if (!cancel) setError(reason instanceof Error ? reason.message : "Subnet failed.");
      });
    return () => {
      cancel = true;
    };
  }, [netuid, version]);

  if (error) {
    return (
      <div>
        <PageTitle title={`SN ${netuid}`} />
        <div className={card}><Empty>{error}</Empty></div>
      </div>
    );
  }
  if (!detail) return <Empty>Loading SN {netuid}.</Empty>;
  const pool = num(detail.poolTao);

  return (
    <div>
      <PageTitle title={`${detail.name}`}>
        <span className="num text-[13px] text-muted">SN {detail.netuid}</span>
        <button type="button" className={btn} onClick={() => void setFavorite(detail.netuid, !detail.favorite)}>
          {detail.favorite ? "★ Favorited" : "☆ Favorite"}
        </button>
        <Link href="/analyst" className={btn}>Back</Link>
      </PageTitle>
      <div className="mb-3 flex flex-wrap items-end gap-4">
        <span className="num text-kpi font-semibold"><Price value={detail.priceTao} /> <span className="text-[13px] text-muted">τ</span></span>
        <span className="text-[12px]">1h <Pct value={detail.change1h} /></span>
        <span className="text-[12px]">24h <Pct value={detail.change24h} /></span>
        <span className="text-[12px]">7d <Pct value={detail.change7d} /></span>
        {pool != null && pool < Number(settings?.thinPoolTao ?? 100) ? <Pill kind="thin">Thin</Pill> : <Pill kind="deep">Deep</Pill>}
      </div>
      <section className={`${card} p-4`}>
        <div className={label}>Price</div>
        <h2 className="mb-2 text-[15px] font-[650]">Hourly spot · τ</h2>
        {detail.series.length > 1 ? <PriceChart data={detail.series} /> : <Empty>No price series for this subnet.</Empty>}
        {detail.seriesNote ? <p className="mt-2 text-[12px] text-warn">{detail.seriesNote}</p> : null}
        {detail.priceNote ? <p className="mt-2 text-[12px] text-warn">{detail.priceNote}</p> : null}
      </section>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile k="Pool τ" v={detail.poolTao} />
        <Tile k="Pool α" v={detail.poolAlpha} />
        <Tile k="24h in τ" v={detail.taoIn24h} />
        <Tile k="24h out τ" v={detail.taoOut24h} />
        <Tile k="24h volume τ" v={detail.volume24hTao} />
        <Tile k="Emission share" v={detail.emissionSharePct ? `${Number(detail.emissionSharePct).toFixed(2)}%` : "—"} />
        <Tile k="Market cap τ" v={<Compact value={detail.marketCapTao} />} />
        <Tile k="FDV τ" v={<Compact value={detail.fdvTao} />} />
      </div>
      {detail.marketCapNote ? <p className="mt-2 text-[12px] text-warn">{detail.marketCapNote}</p> : null}
      <p className="mt-4 text-[12px] text-muted">
        Official sites, new tab:{" "}
        <ExternalLink href={taostatsSubnetUrl(detail.netuid)}>Taostats</ExternalLink>
        {" · "}
        <ExternalLink href={backpropSubnetUrl(detail.netuid, detail.name)}>Backprop</ExternalLink>
        {detail.subnetUrl ? <> · <ExternalLink href={detail.subnetUrl}>Subnet site</ExternalLink></> : null}
        {detail.github ? <> · <ExternalLink href={detail.github}>GitHub</ExternalLink></> : null}
      </p>
    </div>
  );
}

function Tile({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className={`${card} px-3 py-3`}>
      <div className={label}>{k}</div>
      <div className="num mt-1">{v ?? "—"}</div>
    </div>
  );
}
