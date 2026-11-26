import { fail } from "@/lib/http";
import { getSubnetDetail } from "@/lib/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ netuid: string }> }) {
  try {
    const { netuid } = await context.params;
    const id = Number(netuid);
    if (!Number.isInteger(id) || id < 0) {
      return Response.json({ error: "That subnet number is not valid." }, { status: 400 });
    }
    return Response.json(await getSubnetDetail(id));
  } catch (error) {
    return fail(error);
  }
}
