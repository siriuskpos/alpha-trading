import { fail } from "@/lib/http";
import { logTrade } from "@/lib/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      netuid?: number;
      side?: "buy" | "sell";
      amount?: string;
      reason?: string;
      confirmRisk?: boolean;
    };
    if (body.side !== "buy" && body.side !== "sell") {
      return Response.json({ error: "Side must be buy or sell." }, { status: 400 });
    }
    const result = await logTrade({
      netuid: Number(body.netuid),
      side: body.side,
      amount: String(body.amount ?? ""),
      reason: String(body.reason ?? ""),
      confirmRisk: Boolean(body.confirmRisk),
    });
    return Response.json({ ok: true, id: result.id, quote: result.quote });
  } catch (error) {
    return fail(error);
  }
}
