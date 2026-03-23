import { NextResponse } from "next/server";
import { readCronConfig, writeCronConfig } from "@/lib/cron-config";

export async function PATCH(req: Request) {
  const body = await req.json();
  const config = await readCronConfig();

  if (typeof body.heartbeatEnabled === "boolean") {
    config.heartbeatEnabled = body.heartbeatEnabled;
  }
  if (typeof body.heartbeatIntervalMinutes === "number" && body.heartbeatIntervalMinutes > 0) {
    config.heartbeatIntervalMinutes = body.heartbeatIntervalMinutes;
  }
  if (typeof body.heartbeatPrompt === "string" && body.heartbeatPrompt.trim()) {
    config.heartbeatPrompt = body.heartbeatPrompt.trim();
  }

  await writeCronConfig(config);
  return NextResponse.json({ ok: true });
}
