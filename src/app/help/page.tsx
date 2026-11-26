import { card, label } from "@/components/ui";

export default function HelpPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-title font-[650]">Help</h1>
      <p className="mt-3 text-[13px] text-muted">
        Alpha Trading is a local app for one person. Market numbers are public Taostats data. Virtual buys and sells stay in a SQLite file on this computer. The app does not hold a wallet, does not ask for a seed phrase, and does not send a real order.
      </p>

      <h2 className="mb-2 mt-6 text-[15px] font-[650]">What each page does</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <Blurb title="Dashboard" body="Scorecards and charts for one book at a time. The Virtual / Real toggle changes the whole page. The two books are never added together." />
        <Blurb title="Buy & Sell" body="Paper only. You pick a subnet and a size, see a live impact-aware quote, write a reason, and log the fill. The reason locks. Real orders happen on official sites." />
        <Blurb title="Analyst" body="Every subnet pool Taostats returns, ranked by market cap, with a 7-day sparkline. Star a row, or favorite SN62 (Ridges) in one click. View opens the subnet." />
        <Blurb title="History" body="Every virtual fill, or every on-chain stake and unstake for the public coldkey. Export CSV for the mode you are looking at. Losing trades are kept." />
        <Blurb title="Settings" body="Public coldkey, thin-pool line (default 100 τ), and virtual starting TAO (default 1). Starting TAO changes only while the virtual book is empty." />
      </div>

      <h2 className="mb-2 mt-6 text-[15px] font-[650]">Where numbers come from</h2>
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-[12.5px]">
          <thead className="bg-elevated text-label font-[650] uppercase text-muted">
            <tr>
              <th className="px-3 py-2 text-left">Number</th>
              <th className="px-3 py-2 text-left">Source</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row[0]} className="border-t border-subtle">
                <td className="px-3 py-2">{row[0]}</td>
                <td className="px-3 py-2 text-muted">{row[1]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 mt-6 text-[15px] font-[650]">Architecture</h2>
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
        <Box title="Browser" body="Five pages and Settings. No API key in the page." />
        <Arrow />
        <Box title="Next.js routes" body="Quote, market, portfolio, and the virtual ledger. The key stays here." />
        <Arrow />
        <Box title="Taostats" body="Pools, aggregates, metrics, slippage, portfolio, stake events." />
      </div>
      <div className={`${card} mt-3 p-4 text-[13px] text-muted`}>
        SQLite on this computer stores settings, favorites, and virtual trades. Nothing in that file is a key. There is no wallet in the diagram because the app never has one.
      </div>

      <h2 className="mb-2 mt-6 text-[15px] font-[650]">Data flow</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <div className={`${card} p-4`}>
          <div className={label}>Virtual buy</div>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-[13px] text-muted">
            <li>Size in TAO.</li>
            <li>Runtime quote (fee, impact, slippage).</li>
            <li>Reason, then confirm if the pool is thin or slippage is high.</li>
            <li>SQLite.</li>
            <li>History and Dashboard, Virtual only.</li>
          </ol>
        </div>
        <div className={`${card} p-4`}>
          <div className={label}>Real mode</div>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-[13px] text-muted">
            <li>Public coldkey from Settings.</li>
            <li>Taostats portfolio and stake-events.</li>
            <li>History and Dashboard, Real only.</li>
            <li>Read-only. The chain is never signed.</li>
          </ol>
        </div>
      </div>

      <h2 className="mb-2 mt-6 text-[15px] font-[650]">Caveats</h2>
      <ul className="list-disc space-y-2 pl-4 text-[13px] text-muted">
        <li>A fill uses the Taostats slippage simulation, which is the runtime quote. The mid price is shown beside it and is not the fill.</li>
        <li>1 TAO = 1e9 rao. Amounts are stored in that unit and shown in TAO.</li>
        <li>Emission share is (SubnetTaoInEmission + SubnetExcessTao) divided by that sum across non-root subnets. Miner and validator percentages are a different split and are not shown as emission share. A subnet with emission switched off contributes zero.</li>
        <li>FDV is 21,000,000 alpha times the Taostats spot price, in TAO. That matches the hard cap used by explorers such as Backprop (their SN62 FDV in USD lines up with 21,000,000 × price × TAO/USD). It is not an EMA price. If a site shows an EMA-based FDV, the two figures will differ, and this app will not silently switch.</li>
        <li>Market cap is the Taostats pool field, shown only when the raw value matches spot times a supply between pool alpha and total alpha (either in TAO or in rao). If it does not, the cell is blank and the page says so.</li>
        <li>Open virtual P/L is marked at the spot, not at the price you would get by unwinding the whole position.</li>
        <li>Real per-trade P/L is FIFO on stake and unstake events. The realized and unrealized tiles use the portfolio endpoint. They can differ, and the page says when they do. Times are America/New_York.</li>
      </ul>
    </div>
  );
}

function Blurb({ title, body }: { title: string; body: string }) {
  return (
    <div className={`${card} p-4`}>
      <h3 className="text-[15px] font-[650]">{title}</h3>
      <p className="mt-1 text-[13px] text-muted">{body}</p>
    </div>
  );
}

function Box({ title, body }: { title: string; body: string }) {
  return (
    <div className={`${card} p-3`}>
      <div className="text-[13px] font-[650]">{title}</div>
      <p className="mt-1 text-[12px] text-muted">{body}</p>
    </div>
  );
}

function Arrow() {
  return <div className="hidden text-center text-faint md:block">→</div>;
}

const ROWS: [string, string][] = [
  ["Spot, reserves, market cap", "GET /v1/subnets/pools"],
  ["1h / 24h / 7d, volume, sparkline", "GET /v1/subnets/pools/aggregate"],
  ["Name and logo", "GET /v1/subnets/identities"],
  ["Emission and subnet age", "GET /v1/subnets/metrics"],
  ["Hourly price chart", "GET /v1/subnets/pools/history?frequency=by_hour"],
  ["TAO in USD", "GET /v1/price/simple"],
  ["Virtual fill", "GET /v1/subnets/slippage (runtime simulation)"],
  ["Real holdings and P/L tiles", "GET /v1/alpha/portfolio"],
  ["Real trade list", "GET /v1/subnets/stake-events?trades_only=true"],
];
