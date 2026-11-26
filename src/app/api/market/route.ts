import { fail } from "@/lib/http";
import { getMarket } from "@/lib/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const fresh = new URL(request.url).searchParams.get("fresh") === "1";
    return Response.json(await getMarket(fresh));
  } catch (error) {
    return fail(error);
  }
}
