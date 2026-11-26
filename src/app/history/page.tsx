"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/Shell";
import { Empty, ModeToggle, PageTitle, Pct, Pill, Price, Signed, btn, card, field } from "@/components/ui";
import { formatEt } from "@/lib/time";
import type { BookMode, HistoryPayload } from "@/lib/types";

export default function HistoryPage() {
  const { version } = useApp();
  const [mode, setMode] = useState<BookMode>("virtual");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<HistoryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setData(null);
    const params = new URLSearchParams({ mode });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/history?${params}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "History failed.");
        if (!cancel) {
          setData(body as HistoryPayload);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (!cancel) setError(reason instanceof Error ? reason.message : "History failed.");
      });
    return () => {
      cancel = true;
    };
  }, [mode, from, to, version]);

  const exportHref = `/api/history/export?mode=${mode}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`;

  return (
    <div>
      <PageTitle title={mode === "virtual" ? "History · Virtual" : "History · Real"}>
        <ModeToggle mode={mode} onChange={setMode} />
        <label className="text-[11px] text-muted">
          From <input type="date" className={`${field} ml-1 inline-block w-auto`} value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="text-[11px] text-muted">
          To <input type="date" className={`${field} ml-1 inline-block w-auto`} value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <a className={btn} href={exportHref}>Export CSV</a>
      </PageTitle>
      {error ? <div className={card}><Empty>{error}</Empty></div> : null}
      {data && data.rows.length === 0 && !error ? (
        <div className={card}>
          <Empty>
            {mode === "real" && !data.rows.length && data.warning?.includes("coldkey")
              ? data.warning
              : mode === "virtual"
                ? "No virtual trades yet."
                : "No stake or unstake trades for this coldkey."}
          </Empty>
        </div>
      ) : null}
      {data && data.rows.length > 0 ? (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full min-w-[980px] text-[12.5px]">
            <thead className="bg-elevated text-label font-[650] uppercase text-muted">
              <tr>
                <th className="px-2 py-2 text-left">Time (ET)</th>
                <th className="px-2 py-2 text-left">Side</th>
                <th className="px-2 py-2 text-left">Subnet</th>
                <th className="px-2 py-2 text-right">Size τ</th>
                <th className="px-2 py-2 text-right">Size α</th>
                <th className="px-2 py-2 text-right">Price at trade</th>
                <th className="px-2 py-2 text-right">Current</th>
                <th className="px-2 py-2 text-right">P/L τ</th>
                <th className="px-2 py-2 text-right">P/L %</th>
                <th className="px-2 py-2 text-left">Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id} className="border-t border-subtle hover:bg-hover">
                  <td className="num px-2 py-1.5 text-muted">{formatEt(row.at)}</td>
                  <td className={`px-2 py-1.5 ${row.side === "buy" ? "text-gain" : "text-loss"}`}>{row.side}</td>
                  <td className="px-2 py-1.5">
                    SN {row.netuid} <span className="text-muted">{row.name}</span>
                    {row.status === "open" ? <span className="ml-2"><Pill kind="open">Open</Pill></span> : null}
                  </td>
                  <td className="num px-2 py-1.5 text-right">{row.sizeTao}</td>
                  <td className="num px-2 py-1.5 text-right">{row.sizeAlpha}</td>
                  <td className="px-2 py-1.5 text-right"><Price value={row.priceTao} /></td>
                  <td className="px-2 py-1.5 text-right"><Price value={row.currentPriceTao} /></td>
                  <td className="px-2 py-1.5 text-right">
                    {row.plTao ? <Signed value={row.plTao} /> : "—"}
                    {row.unrealized && row.plTao ? <span className="ml-1 text-[10px] uppercase text-virtual">Unrealized</span> : null}
                  </td>
                  <td className="px-2 py-1.5 text-right"><Pct value={row.plPct} /></td>
                  <td className="max-w-[240px] truncate px-2 py-1.5 text-muted" title={row.reason}>{row.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="mt-3 space-y-1 text-[11px] text-faint">
        <p>Timezone America/New_York. {mode === "virtual" ? "P/L on open buys is unrealized. Sell P/L is realized. The column is not a total." : "Realized tile on the Dashboard comes from the portfolio endpoint. Row P/L is FIFO on these events."}</p>
        {data?.notes.map((note) => <p key={note}>{note}</p>)}
        {data?.warning && !data.warning.includes("coldkey") ? <p className="text-loss">{data.warning}</p> : null}
      </div>
    </div>
  );
}
