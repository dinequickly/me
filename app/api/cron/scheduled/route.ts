import { NextResponse } from "next/server";
import { readCronConfig, markJobRan } from "@/lib/cron-config";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await readCronConfig();
  const enabledJobs = config.jobs.filter((j) => j.enabled);

  const results: Array<{ id: string; name: string; status: string }> = [];

  for (const job of enabledJobs) {
    try {
      console.log(`[scheduled] Running job "${job.name}" (${job.id})`, job.payload);

      // TODO: dispatch to actual job handlers based on job.id or job.payload
      // For now, just log and mark as ran
      await markJobRan(job.id);

      results.push({ id: job.id, name: job.name, status: "ok" });
    } catch (error) {
      console.error(`[scheduled] Job "${job.name}" failed:`, error);
      results.push({ id: job.id, name: job.name, status: "error" });
    }
  }

  return NextResponse.json({
    ran_at: new Date().toISOString(),
    jobs_executed: results.length,
    results,
  });
}
