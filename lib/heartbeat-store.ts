export type Beat = {
  timestamp: string;
  uptime: number;
  source: "local" | "vercel";
};

const MAX_BEATS = 50;
const beats: Beat[] = [];

export function recordBeat(source: Beat["source"]): Beat {
  const beat: Beat = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    source,
  };
  beats.unshift(beat);
  if (beats.length > MAX_BEATS) beats.length = MAX_BEATS;
  return beat;
}

export function getBeats(): Beat[] {
  return [...beats];
}
