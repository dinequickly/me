"use client";

import { useEffect, useState } from "react";

type Beat = {
  timestamp: string;
  uptime: number;
  source: "local" | "vercel";
};

export default function HeartbeatPage() {
  const [beats, setBeats] = useState<Beat[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBeats = async () => {
    try {
      const res = await fetch("/api/cron/heartbeat?history=true");
      const data = await res.json();
      setBeats(data.beats ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBeats();
    const interval = setInterval(fetchBeats, 5000); // poll every 5s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-8 font-mono">
      <h1 className="text-2xl font-bold mb-2">Heartbeat Monitor</h1>
      <p className="text-zinc-400 mb-6">
        Auto-refreshes every 5 seconds. Local cron fires every minute.
      </p>

      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : beats.length === 0 ? (
        <div className="text-zinc-500">
          <p>No heartbeats yet.</p>
          <p className="mt-2 text-sm">
            Trigger one manually:{" "}
            <code className="bg-zinc-800 px-2 py-1 rounded">
              curl http://localhost:3000/api/cron/heartbeat
            </code>
          </p>
          <p className="text-sm mt-1">Or wait ~1 minute for the local cron to fire.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-4">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
            </span>
            <span className="text-green-400 text-sm">
              {beats.length} beat{beats.length !== 1 ? "s" : ""} recorded
            </span>
          </div>

          <table className="w-full max-w-2xl text-sm">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800">
                <th className="text-left py-2 pr-4">#</th>
                <th className="text-left py-2 pr-4">Time</th>
                <th className="text-left py-2 pr-4">Source</th>
                <th className="text-left py-2">Uptime</th>
              </tr>
            </thead>
            <tbody>
              {beats.map((beat, i) => (
                <tr key={i} className="border-b border-zinc-900">
                  <td className="py-2 pr-4 text-zinc-600">{beats.length - i}</td>
                  <td className="py-2 pr-4 text-zinc-300">
                    {new Date(beat.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        beat.source === "local"
                          ? "bg-blue-900 text-blue-300"
                          : "bg-purple-900 text-purple-300"
                      }`}
                    >
                      {beat.source}
                    </span>
                  </td>
                  <td className="py-2 text-zinc-400">
                    {Math.floor(beat.uptime)}s
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
