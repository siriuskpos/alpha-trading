import { fail } from "@/lib/http";
import { history } from "@/lib/service";
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
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    return Response.json(await history(mode as BookMode, from, to));
  } catch (error) {
    return fail(error);
  }
}
