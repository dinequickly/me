import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { readCronConfig } from "@/lib/cron-config";
import { getBeats } from "@/lib/heartbeat-store";
import { discoverSkills } from "@/lib/agents";

export async function GET() {
  // Load all sidebar data in parallel
  const [cronConfig, skills, generations] = await Promise.all([
    readCronConfig(),
    discoverSkills([path.join(process.cwd(), ".agents/skills")]),
    loadGenerations(),
  ]);

  const beats = getBeats();

  return NextResponse.json({
    chats: generations,
    cron: {
      heartbeatEnabled: cronConfig.heartbeatEnabled,
      heartbeatIntervalMinutes: cronConfig.heartbeatIntervalMinutes,
      jobs: cronConfig.jobs,
    },
    heartbeat: {
      lastBeat: beats[0] ?? null,
      totalBeats: beats.length,
    },
    skills: skills.map((s) => ({ name: s.name, description: s.description, content: s.content })),
  });
}

async function loadGenerations() {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), ".devtools/generations.json"),
      "utf-8"
    );
    const data = JSON.parse(raw);
    const runs: Array<{ id: string; started_at: string }> = data.runs ?? [];
    // Return most recent first, limited to 50
    return runs
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
      .slice(0, 50)
      .map((r) => ({ id: r.id, startedAt: r.started_at }));
  } catch {
    return [];
  }
}
