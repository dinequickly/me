"use client";

import { useEffect, useState, useCallback } from "react";
import {
  MessageSquareIcon,
  ClockIcon,
  HeartPulseIcon,
  ZapIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshCwIcon,
  BriefcaseIcon,
  ArrowLeftIcon,
  XIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  SaveIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
  PlugZapIcon,
  LogInIcon,
  LogOutIcon,
  CheckCircle2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession, signIn, signOut } from "next-auth/react";

type Chat = { id: string; startedAt: string };
type CronJob = {
  id: string;
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
  lastRun?: string;
};
type Skill = { name: string; description: string; content: string };

type SidebarData = {
  chats: Chat[];
  cron: {
    heartbeatEnabled: boolean;
    heartbeatIntervalMinutes: number;
    jobs: CronJob[];
  };
  heartbeat: {
    lastBeat: { timestamp: string; uptime: number; source: string } | null;
    totalBeats: number;
  };
  skills: Skill[];
};

type Tab = "chats" | "jobs" | "skills" | "integrations";
type FullscreenView =
  | null
  | "jobs"
  | "skills"
  | { type: "skill-detail"; skill: Skill }
  | { type: "skill-edit"; skill: Skill | null }
  | { type: "cron-edit"; job: CronJob | null };

export function Sidebar() {
  const [data, setData] = useState<SidebarData | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("chats");
  const [fullscreen, setFullscreen] = useState<FullscreenView>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/sidebar");
      const json = await res.json();
      setData(json);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const closeFullscreen = useCallback(() => {
    setFullscreen(null);
    setActiveTab("chats");
  }, []);

  if (collapsed) {
    return (
      <div className="flex h-full w-10 shrink-0 flex-col items-center border-r border-zinc-800 bg-zinc-950 pt-3">
        <button
          className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          onClick={() => setCollapsed(false)}
          type="button"
        >
          <ChevronRightIcon className="size-4" />
        </button>
      </div>
    );
  }

  // Determine fullscreen header
  const fsTitle = (() => {
    if (!fullscreen) return null;
    if (fullscreen === "jobs") return { icon: BriefcaseIcon, label: "Jobs", back: null };
    if (fullscreen === "skills") return { icon: ZapIcon, label: "Skills", back: null };
    if (typeof fullscreen === "object") {
      if (fullscreen.type === "skill-detail")
        return { icon: ZapIcon, label: fullscreen.skill.name, back: () => setFullscreen("skills") };
      if (fullscreen.type === "skill-edit")
        return { icon: ZapIcon, label: fullscreen.skill ? `Edit: ${fullscreen.skill.name}` : "New Skill", back: () => setFullscreen("skills") };
      if (fullscreen.type === "cron-edit")
        return { icon: ClockIcon, label: fullscreen.job ? `Edit: ${fullscreen.job.name}` : "New Job", back: () => setFullscreen("jobs") };
    }
    return null;
  })();

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 text-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2.5">
        <span className="font-semibold text-zinc-200">Dashboard</span>
        <div className="flex items-center gap-1">
          <button
            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            onClick={fetchData}
            type="button"
          >
            <RefreshCwIcon className={cn("size-3.5", loading && "animate-spin")} />
          </button>
          <button
            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            onClick={() => setCollapsed(true)}
            type="button"
          >
            <ChevronLeftIcon className="size-4" />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-zinc-800">
        <TabButton active={activeTab === "chats"} icon={MessageSquareIcon} label="Chats" onClick={() => { setActiveTab("chats"); setFullscreen(null); }} />
        <TabButton active={activeTab === "jobs"} icon={BriefcaseIcon} label="Jobs" onClick={() => { setActiveTab("jobs"); setFullscreen("jobs"); }} />
        <TabButton active={activeTab === "skills"} icon={ZapIcon} label="Skills" onClick={() => { setActiveTab("skills"); setFullscreen("skills"); }} />
        <TabButton active={activeTab === "integrations"} icon={PlugZapIcon} label="" onClick={() => { setActiveTab("integrations"); setFullscreen(null); }} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "chats" && <ChatsPanel data={data} />}
        {activeTab === "integrations" && <IntegrationsPanel />}
      </div>

      {/* Fullscreen overlay */}
      {fullscreen && fsTitle && (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-sm">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <div className="flex items-center gap-2">
              {fsTitle.back && (
                <button className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300" onClick={fsTitle.back} type="button">
                  <ArrowLeftIcon className="size-4" />
                </button>
              )}
              <fsTitle.icon className="size-4 text-zinc-400" />
              <span className="font-semibold text-zinc-200">{fsTitle.label}</span>
            </div>
            <button className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300" onClick={closeFullscreen} type="button">
              <XIcon className="size-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {fullscreen === "jobs" && (
              <JobsPanelFull
                data={data}
                onRefresh={fetchData}
                onEditJob={(job) => setFullscreen({ type: "cron-edit", job })}
                onNewJob={() => setFullscreen({ type: "cron-edit", job: null })}
              />
            )}
            {fullscreen === "skills" && (
              <SkillsPanelFull
                data={data}
                onOpenSkill={(skill) => setFullscreen({ type: "skill-detail", skill })}
                onEditSkill={(skill) => setFullscreen({ type: "skill-edit", skill })}
                onNewSkill={() => setFullscreen({ type: "skill-edit", skill: null })}
                onRefresh={fetchData}
              />
            )}
            {typeof fullscreen === "object" && fullscreen.type === "skill-detail" && (
              <SkillDetailFull
                skill={fullscreen.skill}
                onEdit={() => setFullscreen({ type: "skill-edit", skill: fullscreen.skill })}
              />
            )}
            {typeof fullscreen === "object" && fullscreen.type === "skill-edit" && (
              <SkillEditForm
                skill={fullscreen.skill}
                onSaved={() => { fetchData(); setFullscreen("skills"); }}
                onCancel={() => setFullscreen("skills")}
              />
            )}
            {typeof fullscreen === "object" && fullscreen.type === "cron-edit" && (
              <CronEditForm
                job={fullscreen.job}
                onSaved={() => { fetchData(); setFullscreen("jobs"); }}
                onCancel={() => setFullscreen("jobs")}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Integrations panel
// ---------------------------------------------------------------------------

function IntegrationsPanel() {
  const { data: session, status } = useSession();
  const connected = !!(session as unknown as { accessToken?: string } | null)?.accessToken;

  return (
    <div className="p-4 space-y-3">
      <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Connected accounts</p>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {/* Google G logo */}
            <svg className="size-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <div>
              <p className="text-sm font-medium text-zinc-200">Google</p>
              <p className="text-xs text-zinc-500">
                {status === "loading" ? "Loading…" : connected ? (session?.user?.email ?? "Connected") : "Gmail · Calendar · Drive · Docs · Slides"}
              </p>
            </div>
          </div>

          {connected ? (
            <div className="flex items-center gap-2">
              <CheckCircle2Icon className="size-4 text-emerald-500 shrink-0" />
              <button
                className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
                onClick={() => signOut()}
                type="button"
              >
                <LogOutIcon className="size-3.5" />
              </button>
            </div>
          ) : (
            <button
              className="flex items-center gap-1.5 rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
              onClick={() => signIn("google")}
              type="button"
            >
              <LogInIcon className="size-3.5" />
              Connect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab button
// ---------------------------------------------------------------------------

function TabButton({ active, icon: Icon, label, onClick }: {
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors",
        active ? "border-b-2 border-zinc-300 text-zinc-200" : "border-b-2 border-transparent text-zinc-500 hover:text-zinc-400"
      )}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Chats panel
// ---------------------------------------------------------------------------

function ChatsPanel({ data }: { data: SidebarData | null }) {
  if (!data) return <PanelSkeleton />;
  if (data.chats.length === 0) return <EmptyState>No chat history</EmptyState>;
  return (
    <div className="p-2 space-y-0.5">
      {data.chats.map((chat) => (
        <div key={chat.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300 cursor-default">
          <MessageSquareIcon className="size-3 shrink-0 text-zinc-600" />
          <div className="min-w-0 flex-1">
            <div className="text-xs truncate">{formatDateTime(chat.startedAt)}</div>
            <div className="text-[10px] text-zinc-600 truncate font-mono">{chat.id.slice(-8)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fullscreen Jobs panel
// ---------------------------------------------------------------------------

function JobsPanelFull({ data, onRefresh, onEditJob, onNewJob }: {
  data: SidebarData | null;
  onRefresh: () => void;
  onEditJob: (job: CronJob) => void;
  onNewJob: () => void;
}) {
  const [saving, setSaving] = useState(false);

  if (!data) return <PanelSkeleton />;

  const toggleHeartbeat = async () => {
    setSaving(true);
    await fetch("/api/sidebar/heartbeat", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ heartbeatEnabled: !data.cron.heartbeatEnabled }),
    });
    await onRefresh();
    setSaving(false);
  };

  const deleteJob = async (id: string) => {
    setSaving(true);
    await fetch("/api/sidebar/cron", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await onRefresh();
    setSaving(false);
  };

  const toggleJob = async (job: CronJob) => {
    setSaving(true);
    await fetch("/api/sidebar/cron", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: job.id, enabled: !job.enabled }),
    });
    await onRefresh();
    setSaving(false);
  };

  return (
    <div className={cn("mx-auto max-w-2xl p-6 space-y-6", saving && "pointer-events-none opacity-60")}>
      {/* Heartbeat */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <HeartPulseIcon className="size-4" />
            Heartbeat
          </div>
          <button onClick={toggleHeartbeat} className="text-zinc-400 hover:text-zinc-200 transition-colors" type="button">
            {data.cron.heartbeatEnabled
              ? <ToggleRightIcon className="size-5 text-green-400" />
              : <ToggleLeftIcon className="size-5" />
            }
          </button>
        </div>
        <div className="space-y-2">
          <StatusRow
            label="Status"
            value={
              <span className={cn("flex items-center gap-1.5", data.cron.heartbeatEnabled ? "text-green-400" : "text-zinc-500")}>
                <span className={cn("inline-block size-2 rounded-full", data.cron.heartbeatEnabled ? "bg-green-400" : "bg-zinc-600")} />
                {data.cron.heartbeatEnabled ? "Active" : "Disabled"}
              </span>
            }
          />
          <HeartbeatIntervalEditor
            value={data.cron.heartbeatIntervalMinutes}
            onSave={async (v) => {
              await fetch("/api/sidebar/heartbeat", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ heartbeatIntervalMinutes: v }),
              });
              onRefresh();
            }}
          />
          <StatusRow label="Total beats" value={<span className="text-zinc-400">{data.heartbeat.totalBeats}</span>} />
          {data.heartbeat.lastBeat && (
            <StatusRow label="Last beat" value={<span className="text-zinc-400">{formatTime(data.heartbeat.lastBeat.timestamp)}</span>} />
          )}
        </div>
      </div>

      {/* Cron Jobs */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <ClockIcon className="size-4" />
            Cron Jobs
          </div>
          <button onClick={onNewJob} className="flex items-center gap-1 rounded-md bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors" type="button">
            <PlusIcon className="size-3" />
            Add Job
          </button>
        </div>
        {data.cron.jobs.length === 0 ? (
          <p className="text-zinc-600 text-sm">No scheduled jobs</p>
        ) : (
          <div className="space-y-3">
            {data.cron.jobs.map((job) => (
              <div key={job.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-zinc-200">{job.name}</span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => toggleJob(job)} className="text-zinc-500 hover:text-zinc-300 transition-colors" type="button">
                      {job.enabled
                        ? <ToggleRightIcon className="size-4 text-green-400" />
                        : <ToggleLeftIcon className="size-4" />
                      }
                    </button>
                    <button onClick={() => onEditJob(job)} className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300" type="button">
                      <PencilIcon className="size-3" />
                    </button>
                    <button onClick={() => deleteJob(job.id)} className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400" type="button">
                      <Trash2Icon className="size-3" />
                    </button>
                  </div>
                </div>
                {job.description && <p className="mt-1 text-sm text-zinc-400">{job.description}</p>}
                <div className="mt-2 text-xs text-zinc-500">
                  <span>{cronToHuman(job.schedule)}</span>
                  {job.lastRun && <span className="ml-3">Last run: {formatTime(job.lastRun)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Heartbeat interval inline editor
// ---------------------------------------------------------------------------

function HeartbeatIntervalEditor({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">Interval</span>
        <button onClick={() => { setDraft(value); setEditing(true); }} className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200" type="button">
          {value}m
          <PencilIcon className="size-2.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-zinc-500">Interval</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={1}
          max={60}
          value={draft}
          onChange={(e) => setDraft(Number(e.target.value))}
          className="w-12 rounded bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 text-xs text-zinc-200 text-center"
        />
        <span className="text-zinc-500">min</span>
        <button onClick={() => { onSave(draft); setEditing(false); }} className="rounded bg-zinc-700 px-1.5 py-0.5 text-zinc-200 hover:bg-zinc-600" type="button">
          <SaveIcon className="size-2.5" />
        </button>
        <button onClick={() => setEditing(false)} className="text-zinc-500 hover:text-zinc-300" type="button">
          <XIcon className="size-3" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cron edit form with pretty schedule builder
// ---------------------------------------------------------------------------

type Frequency = "everyMin" | "hourly" | "daily" | "weekly" | "custom";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseCronToSchedule(cron: string): { freq: Frequency; minute: number; hour: number; dayOfWeek: number; everyMinutes: number; raw: string } {
  const parts = cron.split(/\s+/);
  if (parts.length !== 5) return { freq: "custom", minute: 0, hour: 0, dayOfWeek: 0, everyMinutes: 5, raw: cron };

  const [min, hr, , , dow] = parts;

  // */N * * * *
  if (min.startsWith("*/") && hr === "*" && dow === "*") {
    return { freq: "everyMin", minute: 0, hour: 0, dayOfWeek: 0, everyMinutes: parseInt(min.slice(2)) || 5, raw: cron };
  }
  // N * * * * (hourly at minute N)
  if (/^\d+$/.test(min) && hr === "*" && dow === "*") {
    return { freq: "hourly", minute: parseInt(min), hour: 0, dayOfWeek: 0, everyMinutes: 5, raw: cron };
  }
  // N N * * * (daily)
  if (/^\d+$/.test(min) && /^\d+$/.test(hr) && dow === "*") {
    return { freq: "daily", minute: parseInt(min), hour: parseInt(hr), dayOfWeek: 0, everyMinutes: 5, raw: cron };
  }
  // N N * * N (weekly)
  if (/^\d+$/.test(min) && /^\d+$/.test(hr) && /^\d+$/.test(dow)) {
    return { freq: "weekly", minute: parseInt(min), hour: parseInt(hr), dayOfWeek: parseInt(dow), everyMinutes: 5, raw: cron };
  }

  return { freq: "custom", minute: 0, hour: 0, dayOfWeek: 0, everyMinutes: 5, raw: cron };
}

function scheduleToCron(s: { freq: Frequency; minute: number; hour: number; dayOfWeek: number; everyMinutes: number; raw: string }): string {
  switch (s.freq) {
    case "everyMin": return `*/${s.everyMinutes} * * * *`;
    case "hourly": return `${s.minute} * * * *`;
    case "daily": return `${s.minute} ${s.hour} * * *`;
    case "weekly": return `${s.minute} ${s.hour} * * ${s.dayOfWeek}`;
    case "custom": return s.raw;
  }
}

function CronEditForm({ job, onSaved, onCancel }: { job: CronJob | null; onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState(job?.name ?? "");
  const [description, setDescription] = useState(job?.description ?? "");
  const [enabled, setEnabled] = useState(job?.enabled ?? true);
  const [schedule, setSchedule] = useState(() => parseCronToSchedule(job?.schedule ?? "0 * * * *"));
  const [saving, setSaving] = useState(false);

  const cronExpr = scheduleToCron(schedule);

  const save = async () => {
    setSaving(true);
    if (job) {
      await fetch("/api/sidebar/cron", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: job.id, name, description, schedule: cronExpr, enabled }),
      });
    } else {
      await fetch("/api/sidebar/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, schedule: cronExpr, enabled }),
      });
    }
    onSaved();
  };

  return (
    <div className="mx-auto max-w-lg p-6 space-y-5">
      <FormField label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My scheduled job" className={inputClass} />
      </FormField>

      <FormField label="Description">
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this job do?" className={inputClass} />
      </FormField>

      <FormField label="Enabled">
        <button onClick={() => setEnabled(!enabled)} className="text-zinc-400 hover:text-zinc-200" type="button">
          {enabled ? <ToggleRightIcon className="size-5 text-green-400" /> : <ToggleLeftIcon className="size-5" />}
        </button>
      </FormField>

      {/* Schedule builder */}
      <FormField label="Schedule">
        <div className="space-y-3">
          {/* Frequency selector */}
          <div className="flex flex-wrap gap-1.5">
            {([["everyMin", "Every N min"], ["hourly", "Hourly"], ["daily", "Daily"], ["weekly", "Weekly"], ["custom", "Custom"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSchedule((s) => ({ ...s, freq: key }))}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  schedule.freq === key ? "bg-zinc-200 text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                )}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Frequency-specific inputs */}
          {schedule.freq === "everyMin" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Every</span>
              <input
                type="number" min={1} max={59}
                value={schedule.everyMinutes}
                onChange={(e) => setSchedule((s) => ({ ...s, everyMinutes: parseInt(e.target.value) || 5 }))}
                className="w-14 rounded bg-zinc-800 border border-zinc-700 px-2 py-1 text-xs text-zinc-200 text-center"
              />
              <span className="text-xs text-zinc-500">minutes</span>
            </div>
          )}

          {schedule.freq === "hourly" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">At minute</span>
              <input
                type="number" min={0} max={59}
                value={schedule.minute}
                onChange={(e) => setSchedule((s) => ({ ...s, minute: parseInt(e.target.value) || 0 }))}
                className="w-14 rounded bg-zinc-800 border border-zinc-700 px-2 py-1 text-xs text-zinc-200 text-center"
              />
              <span className="text-xs text-zinc-500">of every hour</span>
            </div>
          )}

          {(schedule.freq === "daily" || schedule.freq === "weekly") && (
            <div className="space-y-3">
              {schedule.freq === "weekly" && (
                <div className="flex items-center gap-1.5">
                  {DAYS.map((day, i) => (
                    <button
                      key={day}
                      onClick={() => setSchedule((s) => ({ ...s, dayOfWeek: i }))}
                      className={cn(
                        "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                        schedule.dayOfWeek === i ? "bg-zinc-200 text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                      )}
                      type="button"
                    >
                      {day}
                    </button>
                  ))}
                </div>
              )}
              <TimeInput
                hour={schedule.hour}
                minute={schedule.minute}
                onChange={(h, m) => setSchedule((s) => ({ ...s, hour: h, minute: m }))}
              />
            </div>
          )}

          {schedule.freq === "custom" && (
            <input
              value={schedule.raw}
              onChange={(e) => setSchedule((s) => ({ ...s, raw: e.target.value }))}
              placeholder="* * * * *"
              className={cn(inputClass, "font-mono")}
            />
          )}

          {/* Preview */}
          <div className="rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Preview</div>
            <div className="text-xs text-zinc-300">{cronToHuman(cronExpr)}</div>
            <code className="text-[11px] text-zinc-500 mt-0.5 block">{cronExpr}</code>
          </div>
        </div>
      </FormField>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={save}
          disabled={saving || !name.trim()}
          className="flex items-center gap-1.5 rounded-md bg-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-40 transition-colors"
          type="button"
        >
          <SaveIcon className="size-3" />
          {job ? "Save Changes" : "Create Job"}
        </button>
        <button onClick={onCancel} className="rounded-md px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200" type="button">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time input (hour:minute with AM/PM)
// ---------------------------------------------------------------------------

function TimeInput({ hour, minute, onChange }: { hour: number; minute: number; onChange: (h: number, m: number) => void }) {
  const isPM = hour >= 12;
  const display12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-500">At</span>
      <input
        type="number" min={1} max={12}
        value={display12}
        onChange={(e) => {
          let h = parseInt(e.target.value) || 12;
          if (h > 12) h = 12;
          if (h < 1) h = 1;
          onChange(isPM ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h), minute);
        }}
        className="w-12 rounded bg-zinc-800 border border-zinc-700 px-2 py-1 text-xs text-zinc-200 text-center"
      />
      <span className="text-zinc-500">:</span>
      <input
        type="number" min={0} max={59}
        value={String(minute).padStart(2, "0")}
        onChange={(e) => {
          let m = parseInt(e.target.value) || 0;
          if (m > 59) m = 59;
          if (m < 0) m = 0;
          onChange(hour, m);
        }}
        className="w-12 rounded bg-zinc-800 border border-zinc-700 px-2 py-1 text-xs text-zinc-200 text-center"
      />
      <div className="flex rounded-md overflow-hidden border border-zinc-700">
        <button
          onClick={() => {
            if (isPM) onChange(hour - 12, minute);
          }}
          className={cn("px-2 py-1 text-xs font-medium transition-colors", !isPM ? "bg-zinc-200 text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700")}
          type="button"
        >AM</button>
        <button
          onClick={() => {
            if (!isPM) onChange(hour + 12, minute);
          }}
          className={cn("px-2 py-1 text-xs font-medium transition-colors", isPM ? "bg-zinc-200 text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700")}
          type="button"
        >PM</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fullscreen Skills panel
// ---------------------------------------------------------------------------

function SkillsPanelFull({ data, onOpenSkill, onEditSkill, onNewSkill, onRefresh }: {
  data: SidebarData | null;
  onOpenSkill: (skill: Skill) => void;
  onEditSkill: (skill: Skill) => void;
  onNewSkill: () => void;
  onRefresh: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  if (!data) return <PanelSkeleton />;

  const deleteSkill = async (skill: Skill) => {
    setDeleting(true);
    const slug = skill.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    await fetch("/api/sidebar/skills", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    await onRefresh();
    setDeleting(false);
  };

  return (
    <div className={cn("mx-auto max-w-2xl p-6", deleting && "pointer-events-none opacity-60")}>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {data.skills.length} skill{data.skills.length !== 1 ? "s" : ""}
        </div>
        <button onClick={onNewSkill} className="flex items-center gap-1 rounded-md bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors" type="button">
          <PlusIcon className="size-3" />
          Add Skill
        </button>
      </div>
      {data.skills.length === 0 ? (
        <p className="text-zinc-600 text-sm">No skills installed</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.skills.map((skill) => (
            <div key={skill.name} className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 group">
              <div className="flex items-center justify-between">
                <button onClick={() => onOpenSkill(skill)} className="flex items-center gap-2 text-left min-w-0" type="button">
                  <ZapIcon className="size-4 shrink-0 text-amber-500" />
                  <span className="font-medium text-zinc-200 truncate">{skill.name}</span>
                </button>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onEditSkill(skill)} className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300" type="button">
                    <PencilIcon className="size-3" />
                  </button>
                  <button onClick={() => deleteSkill(skill)} className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400" type="button">
                    <Trash2Icon className="size-3" />
                  </button>
                </div>
              </div>
              <button onClick={() => onOpenSkill(skill)} className="mt-1.5 text-sm text-zinc-500 line-clamp-3 pl-6 text-left" type="button">
                {skill.description}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fullscreen Skill detail
// ---------------------------------------------------------------------------

function SkillDetailFull({ skill, onEdit }: { skill: Skill; onEdit: () => void }) {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-zinc-400">{skill.description}</p>
        <button onClick={onEdit} className="flex items-center gap-1 rounded-md bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors shrink-0 ml-4" type="button">
          <PencilIcon className="size-3" />
          Edit
        </button>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
          {skill.content}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skill edit form
// ---------------------------------------------------------------------------

function SkillEditForm({ skill, onSaved, onCancel }: { skill: Skill | null; onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState(skill?.name ?? "");
  const [description, setDescription] = useState(skill?.description ?? "");
  const [content, setContent] = useState(skill?.content ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    if (skill) {
      const originalSlug = skill.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await fetch("/api/sidebar/skills", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalSlug, name, description, content }),
      });
    } else {
      await fetch("/api/sidebar/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, content }),
      });
    }
    onSaved();
  };

  return (
    <div className="mx-auto max-w-lg p-6 space-y-5">
      <FormField label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-skill" className={inputClass} />
      </FormField>

      <FormField label="Description">
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this skill does..." className={inputClass} />
      </FormField>

      <FormField label="Instructions">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={12}
          placeholder="Markdown instructions for the agent when this skill is loaded..."
          className={cn(inputClass, "resize-y min-h-[200px]")}
        />
      </FormField>

      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={save}
          disabled={saving || !name.trim()}
          className="flex items-center gap-1.5 rounded-md bg-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-40 transition-colors"
          type="button"
        >
          <SaveIcon className="size-3" />
          {skill ? "Save Changes" : "Create Skill"}
        </button>
        <button onClick={onCancel} className="rounded-md px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200" type="button">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

const inputClass = "w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500";

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-zinc-500">{label}</span>
      {value}
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="p-3 space-y-2">
      <div className="h-3 w-3/4 animate-pulse rounded bg-zinc-800" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-800" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-800" />
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="p-3 text-zinc-600 text-xs">{children}</p>;
}

// ---------------------------------------------------------------------------
// Cron expression -> human readable
// ---------------------------------------------------------------------------

function cronToHuman(cron: string): string {
  const parts = cron.split(/\s+/);
  if (parts.length !== 5) return cron;
  const [min, hr, , , dow] = parts;

  if (min.startsWith("*/") && hr === "*") {
    return `Every ${min.slice(2)} minutes`;
  }
  if (/^\d+$/.test(min) && hr === "*" && dow === "*") {
    return `Hourly at :${min.padStart(2, "0")}`;
  }
  if (/^\d+$/.test(min) && /^\d+$/.test(hr) && dow === "*") {
    return `Daily at ${formatHourMin(parseInt(hr), parseInt(min))}`;
  }
  if (/^\d+$/.test(min) && /^\d+$/.test(hr) && /^\d+$/.test(dow)) {
    return `${DAYS[parseInt(dow)] ?? dow} at ${formatHourMin(parseInt(hr), parseInt(min))}`;
  }
  return cron;
}

function formatHourMin(h: number, m: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return `Today ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
