import { fail } from "@/lib/http";
import { getSettings, saveSettings } from "@/lib/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(getSettings());
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { coldkey?: string; thinPoolTao?: string; startingTao?: string };
    return Response.json(
      saveSettings({
        coldkey: body.coldkey,
        thinPoolTao: body.thinPoolTao,
        startingTao: body.startingTao,
      }),
    );
  } catch (error) {
    return fail(error);
  }
}
