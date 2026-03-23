import cron from "node-cron";
import { readCronConfig, markJobRan } from "./cron-config";
import { recordBeat } from "./heartbeat-store";
import { runBackgroundTask } from "./background-agent";

let started = false;
let lastHeartbeatRun = 0;

// Map of jobId -> scheduled task, so we can stop/replace them when config changes
type ScheduledTask = ReturnType<typeof cron.schedule>;
const jobTasks = new Map<string, ScheduledTask>();

async function syncJobSchedules() {
  const config = await readCronConfig();
  const enabledJobs = config.jobs.filter((j) => j.enabled && cron.validate(j.schedule));

  // Stop tasks for jobs that no longer exist or are disabled
  for (const [id, task] of jobTasks) {
    if (!enabledJobs.find((j) => j.id === id)) {
      task.stop();
      jobTasks.delete(id);
    }
  }

  // Add tasks for new enabled jobs
  for (const job of enabledJobs) {
    if (jobTasks.has(job.id)) continue;

    console.log(`[local-cron] scheduling job "${job.name}" → ${job.schedule} (next run at :${job.schedule.split(" ")[0]} of each hour)`);
    const task = cron.schedule(job.schedule, async () => {
      // Re-read config each time in case it changed
      const current = await readCronConfig();
      const currentJob = current.jobs.find((j) => j.id === job.id);
      if (!currentJob?.enabled) return;

      const prompt = (currentJob.payload?.prompt as string) || currentJob.description || currentJob.name;
      console.log(`[local-cron] running job "${currentJob.name}"`);
      await runBackgroundTask(prompt, "cron", currentJob.name).catch(console.error);
      await markJobRan(currentJob.id);
    });

    jobTasks.set(job.id, task);
    console.log(`[local-cron] scheduled job "${job.name}" → ${job.schedule}`);
  }
}

export function startLocalCron() {
  if (started) return;
  started = true;

  // Every minute: heartbeat + sync job schedules
  cron.schedule("* * * * *", async () => {
    const config = await readCronConfig();

    // Heartbeat agent
    if (config.heartbeatEnabled) {
      const intervalMs = (config.heartbeatIntervalMinutes ?? 5) * 60 * 1000;
      const now = Date.now();
      if (now - lastHeartbeatRun >= intervalMs) {
        lastHeartbeatRun = now;
        const beat = recordBeat("local");
        console.log("[local-cron] heartbeat firing:", beat.timestamp);
        runBackgroundTask(config.heartbeatPrompt, "heartbeat", "Heartbeat").catch(console.error);
      }
    }

    // Re-sync job schedules in case config changed
    await syncJobSchedules();
  });

  // Initial job sync on startup
  syncJobSchedules().catch(console.error);

  console.log("[local-cron] started");
}
