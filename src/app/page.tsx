"use client";

import { useEffect, useState } from "react";
import { DailyChart, EquityChart, SubnetBarChart } from "@/components/Charts";
import { useApp } from "@/components/Shell";
import { Empty, Kpi, ModeToggle, Notice, PageTitle, Pill, Signed, Tao, card, label } from "@/components/ui";
import { formatPrice, formatTao, num, toneOf } from "@/lib/format";
import { formatEt } from "@/lib/time";
import type { BookMode, DashboardPayload } from "@/lib/types";

export default function DashboardPage() {
  const { version, refresh } = useApp();
  const [mode, setMode] = useState<BookMode>("virtual");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setData(null);
    setError(null);
    fetch(`/api/dashboard?mode=${mode}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Dashboard failed.");
        if (!cancel) setData(body as DashboardPayload);
      })
      .catch((reason: unknown) => {
        if (!cancel) {
          setData(null);
          setError(reason instanceof Error ? reason.message : "Dashboard failed.");
        }
      });
    return () => {
      cancel = true;
    };
  }, [mode, version]);

  const title = mode === "virtual" ? "Dashboard · Virtual" : "Dashboard · Real";

  return (
    <div>
      <PageTitle title={title}>
        <ModeToggle mode={mode} onChange={setMode} />
        <button type="button" onClick={refresh} className="rounded-ctl border border-line bg-hover px-3 py-[7px] text-[12px] font-semibold">
          Refresh
        </button>
      </PageTitle>
      {mode === "virtual" ? <Pill kind="virtual">Paper</Pill> : <Pill kind="real">Real</Pill>}
      {data?.fetchedAt ? <span className="ml-2 text-[11px] text-faint">Quotes as of {formatEt(data.fetchedAt)}</span> : null}
      {mode === "real" ? (
        <p className="mt-3 text-[12px] text-real">Real mode is read-only. Figures come from the public coldkey. This app never signs or sends an order.</p>
      ) : data?.cashTao ? (
        <p className="mt-3 text-[12px] text-virtual">
          Virtual cash left <span className="num">{formatTao(num(data.cashTao), 4)}</span> τ of{" "}
          <span className="num">{formatTao(num(data.startingTao), 4)}</span> τ starting.
        </p>
      ) : null}

      {!data && !error ? <div className={`${card} mt-4`}><Empty>Loading this book.</Empty></div> : null}
      {error ? <div className={`${card} mt-4`}><Empty>{error}</Empty></div> : null}
      {!error && data?.mode === "real" && !data.coldkey ? (
        <div className={`${card} mt-4`}><Empty>No coldkey in Settings — Real mode is empty.</Empty></div>
      ) : null}

      {data && !(data.mode === "real" && !data.coldkey) && !error ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-6">
            <Kpi label="TAO invested" value={<Tao value={data.investedTao} />} caption="Gross buys since start" />
            <Kpi label="TAO gained" value={<Signed value={data.gainedTao} />} tone={toneOf(num(data.gainedTao))} />
            <Kpi label="TAO lost" value={<Signed value={data.lostTao} />} tone={toneOf(num(data.lostTao))} />
            <Kpi label="TAO price" value={data.taoUsd ? `$${formatPrice(num(data.taoUsd))}` : "—"} caption="USD" />
            <Kpi label="Realized P/L" value={<Signed value={data.realizedTao} />} tone={toneOf(num(data.realizedTao))} caption="Closed" />
            <Kpi label="Unrealized P/L" value={<Signed value={data.unrealizedTao} />} tone={toneOf(num(data.unrealizedTao))} caption="Open, marked at mid" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-5">
            <Kpi label="Win rate" value={data.winRate ? `${data.winRate}%` : "—"} caption={`n = ${data.winSample} · ${data.wins} wins`} />
            <Kpi label="Avg win" value={<Signed value={data.avgWinTao} />} tone="gain" />
            <Kpi label="Avg loss" value={<Signed value={data.avgLossTao} />} tone="loss" />
            <Kpi label="Best trade" value={data.best ? <Signed value={data.best.tao} /> : "—"} caption={data.best?.label} />
            <Kpi label="Worst trade" value={data.worst ? <Signed value={data.worst.tao} /> : "—"} caption={data.worst?.label} />
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            <section className={`${card} p-4`}>
              <div className={label}>Balance</div>
              <h2 className="mb-2 mt-1 text-[15px] font-[650]">Equity over time · τ</h2>
              {data.equity.length === 0 ? <Empty>{mode === "virtual" ? "No virtual trades yet." : "No closed fills to plot yet."}</Empty> : <EquityChart data={data.equity} />}
            </section>
            <section className={`${card} p-4`}>
              <div className={label}>Realized</div>
              <h2 className="mb-2 mt-1 text-[15px] font-[650]">Daily P/L · τ</h2>
              {data.daily.length === 0 ? <Empty>No realized P/L yet.</Empty> : <DailyChart data={data.daily} />}
            </section>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-5">
            <section className={`${card} xl:col-span-3`}>
              <div className="border-b border-subtle px-4 py-3">
                <div className={label}>Holdings</div>
                <h2 className="text-[15px] font-[650]">Open alpha</h2>
              </div>
              {data.holdings.length === 0 ? <Empty>{mode === "virtual" ? "No virtual trades yet." : "No open alpha for this coldkey."}</Empty> : (
                <table className="w-full text-[12.5px]">
                  <thead className="bg-elevated text-label font-[650] uppercase text-muted">
                    <tr>
                      <th className="px-3 py-2 text-left">Subnet</th>
                      <th className="px-3 py-2 text-right">Alpha</th>
                      <th className="px-3 py-2 text-right">Value τ</th>
                      <th className="px-3 py-2 text-right">Value USD</th>
                      <th className="px-3 py-2 text-right">Unrealized</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.holdings.map((row) => (
                      <tr key={row.netuid} className="border-t border-subtle">
                        <td className="px-3 py-2">SN {row.netuid} {row.name}</td>
                        <td className="num px-3 py-2 text-right">{row.alpha}</td>
                        <td className="num px-3 py-2 text-right">{row.valueTao ?? "—"}</td>
                        <td className="num px-3 py-2 text-right">{row.valueUsd ? `$${row.valueUsd}` : "—"}</td>
                        <td className="px-3 py-2 text-right"><Signed value={row.unrealizedTao} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
            <section className={`${card} p-4 xl:col-span-2`}>
              <div className={label}>By subnet</div>
              <h2 className="mb-2 mt-1 text-[15px] font-[650]">P/L · τ</h2>
              {data.bySubnet.length === 0 ? <Empty>No P/L by subnet yet.</Empty> : <SubnetBarChart data={data.bySubnet.map((row) => ({ name: `SN ${row.netuid}`, tao: row.tao }))} />}
            </section>
          </div>
          {data.warning ? <Notice tone="loss">{data.warning}</Notice> : null}
          <details className="mt-3 text-[12px] text-faint">
            <summary className="cursor-pointer">How these numbers are built</summary>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {data.notes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </details>
        </>
      ) : null}
    </div>
  );
}
