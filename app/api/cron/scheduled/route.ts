import { NextResponse } from "next/server";
import { readCronConfig, markJobRan } from "@/lib/cron-config";
import { runBackgroundTask } from "@/lib/background-agent";

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
    const prompt = (job.payload?.prompt as string) || job.description || job.name;
    try {
      await runBackgroundTask(prompt, "cron", job.name);
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
