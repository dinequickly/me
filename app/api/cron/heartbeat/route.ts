import { NextResponse } from "next/server";
import { readCronConfig } from "@/lib/cron-config";
import { recordBeat, getBeats } from "@/lib/heartbeat-store";
import { startLocalCron } from "@/lib/local-cron";

// Start local cron when this module loads in dev
if (process.env.NODE_ENV === "development") {
  startLocalCron();
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  // GET /api/cron/heartbeat?history=true — return recent beats
  if (searchParams.get("history") === "true") {
    return NextResponse.json({ beats: getBeats() });
  }

  const config = await readCronConfig();

  if (!config.heartbeatEnabled) {
    return NextResponse.json({ skipped: true, reason: "Heartbeat disabled" });
  }

  const beat = recordBeat(process.env.VERCEL ? "vercel" : "local");

  return NextResponse.json({ ...beat, intervalMinutes: config.heartbeatIntervalMinutes });
}
