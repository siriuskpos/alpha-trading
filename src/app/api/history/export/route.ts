import { csvCell } from "@/lib/format";
import { fail } from "@/lib/http";
import { history } from "@/lib/service";
import { TZ, formatEt } from "@/lib/time";
import type { BookMode } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode");
    if (mode !== "virtual" && mode !== "real") {
      return Response.json({ error: "Mode must be virtual or real." }, { status: 400 });
    }
    const payload = await history(mode as BookMode, url.searchParams.get("from"), url.searchParams.get("to"));
    const header = [
      "time_et",
      "side",
      "netuid",
      "name",
      "size_tao",
      "size_alpha",
      "price_at_trade_tao",
      "current_price_tao",
      "pl_tao",
      "pl_pct",
      "status",
      "pl_kind",
      "reason",
    ];
    const lines = [
      `# Alpha Trading ${mode} history`,
      `# timezone=${TZ}`,
      `# generated=${new Date().toISOString()}`,
      `# Losing trades are included. This file is not a mix of virtual and real.`,
      header.join(","),
      ...payload.rows.map((row) =>
        [
          formatEt(row.at),
          row.side,
          String(row.netuid),
          row.name,
          row.sizeTao,
          row.sizeAlpha,
          row.priceTao ?? "",
          row.currentPriceTao ?? "",
          row.plTao ?? "",
          row.plPct ?? "",
          row.status,
          row.unrealized ? "unrealized" : row.plTao ? "realized" : "",
          row.reason,
        ]
          .map(csvCell)
          .join(","),
      ),
    ];
    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="alpha-trading-${mode}.csv"`,
      },
    });
  } catch (error) {
    return fail(error);
  }
}
