import { NextResponse } from "next/server";
import { AppError } from "./service";
import { TaostatsError } from "./taostats";

export function fail(error: unknown) {
  if (error instanceof AppError || error instanceof TaostatsError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return NextResponse.json({ error: message }, { status: 500 });
}
