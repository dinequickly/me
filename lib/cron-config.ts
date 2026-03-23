import fs from "fs/promises";
import path from "path";

const CONFIG_PATH = path.join(process.cwd(), "cron-config.json");

export type CronJob = {
  id: string;
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
  payload?: Record<string, unknown>;
  lastRun?: string;
};

export type CronConfig = {
  heartbeatIntervalMinutes: number;
  heartbeatEnabled: boolean;
  heartbeatPrompt: string;
  jobs: CronJob[];
};

const DEFAULT_CONFIG: CronConfig = {
  heartbeatIntervalMinutes: 5,
  heartbeatEnabled: true,
  heartbeatPrompt: "Check if there's anything notable happening. If you have access to Gmail or Calendar, look for anything urgent or time-sensitive. Be brief.",
  jobs: [],
};

export async function readCronConfig(): Promise<CronConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function writeCronConfig(config: CronConfig): Promise<void> {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

export async function markJobRan(jobId: string): Promise<void> {
  const config = await readCronConfig();
  const job = config.jobs.find((j) => j.id === jobId);
  if (job) {
    job.lastRun = new Date().toISOString();
    await writeCronConfig(config);
  }
}
