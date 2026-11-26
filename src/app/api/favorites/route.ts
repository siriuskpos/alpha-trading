import { fail } from "@/lib/http";
import { setFavorite } from "@/lib/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { netuid?: number; favorite?: boolean };
    const favorites = setFavorite(Number(body.netuid), Boolean(body.favorite));
    return Response.json({ favorites });
  } catch (error) {
    return fail(error);
  }
}
