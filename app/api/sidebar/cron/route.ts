import { NextResponse } from "next/server";
import { readCronConfig, writeCronConfig } from "@/lib/cron-config";

// Add a new cron job
export async function POST(req: Request) {
  const body = await req.json();
  const config = await readCronConfig();

  const id = body.name
    ? body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36)
    : "job-" + Date.now().toString(36);

  config.jobs.push({
    id,
    name: body.name ?? "Untitled job",
    description: body.description ?? "",
    schedule: body.schedule ?? "0 * * * *",
    enabled: body.enabled ?? true,
  });

  await writeCronConfig(config);
  return NextResponse.json({ ok: true, id });
}

// Update an existing cron job
export async function PATCH(req: Request) {
  const body = await req.json();
  const config = await readCronConfig();
  const job = config.jobs.find((j) => j.id === body.id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (body.name !== undefined) job.name = body.name;
  if (body.description !== undefined) job.description = body.description;
  if (body.schedule !== undefined) job.schedule = body.schedule;
  if (typeof body.enabled === "boolean") job.enabled = body.enabled;

  await writeCronConfig(config);
  return NextResponse.json({ ok: true });
}

// Delete a cron job
export async function DELETE(req: Request) {
  const body = await req.json();
  const config = await readCronConfig();
  config.jobs = config.jobs.filter((j) => j.id !== body.id);
  await writeCronConfig(config);
  return NextResponse.json({ ok: true });
}
