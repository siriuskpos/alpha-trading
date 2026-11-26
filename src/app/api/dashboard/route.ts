import { fail } from "@/lib/http";
import { dashboard } from "@/lib/service";
import type { BookMode } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const mode = new URL(request.url).searchParams.get("mode");
    if (mode !== "virtual" && mode !== "real") {
      return Response.json({ error: "Mode must be virtual or real." }, { status: 400 });
    }
    return Response.json(await dashboard(mode as BookMode));
  } catch (error) {
    return fail(error);
  }
}
