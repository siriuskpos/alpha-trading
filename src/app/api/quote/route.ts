import { fail } from "@/lib/http";
import { quoteFor } from "@/lib/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const netuid = Number(url.searchParams.get("netuid"));
    const side = url.searchParams.get("side");
    const amount = url.searchParams.get("amount");
    if (!Number.isInteger(netuid) || (side !== "buy" && side !== "sell")) {
      return Response.json({ error: "Pick a subnet and a side." }, { status: 400 });
    }
    return Response.json(await quoteFor(netuid, side, amount));
  } catch (error) {
    return fail(error);
  }
}
