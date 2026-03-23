import { getTrace, listTraces } from "@/lib/trace-store";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const trace = getTrace(id);
    if (!trace) {
      return NextResponse.json({ error: "Trace not found" }, { status: 404 });
    }
    return NextResponse.json(trace);
  }

  // Return list of all traces (most recent first)
  return NextResponse.json(listTraces());
}
