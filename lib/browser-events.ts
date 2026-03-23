import { EventEmitter } from "events";

/** Shared event bus for browser state. Emits "open", "close", "frame" (base64 jpeg). */
export const browserEvents = new EventEmitter();
browserEvents.setMaxListeners(20);

let _open = false;

export function setBrowserOpen(open: boolean) {
  _open = open;
}

export function isBrowserOpen() {
  return _open;
}

// ---------------------------------------------------------------------------
// Session recording
// ---------------------------------------------------------------------------

export interface RecordedFrame {
  /** Milliseconds since session start */
  t: number;
  /** base64 jpeg */
  data: string;
}

export interface BrowserSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  frames: RecordedFrame[];
}

const MAX_SESSIONS = 20;
const sessions: BrowserSession[] = [];
let activeSession: BrowserSession | null = null;

/** Called when browser opens — starts a new recording session. */
export function startRecording() {
  const session: BrowserSession = {
    id: `session-${Date.now().toString(36)}`,
    startedAt: new Date().toISOString(),
    endedAt: null,
    frames: [],
  };
  activeSession = session;
  sessions.unshift(session);
  // Trim old sessions
  while (sessions.length > MAX_SESSIONS) {
    sessions.pop();
  }
}

/** Called on each screencast frame. */
export function recordFrame(data: string) {
  if (!activeSession) return;
  const t = Date.now() - new Date(activeSession.startedAt).getTime();
  activeSession.frames.push({ t, data });
}

/** Called when browser closes — finalizes the session. */
export function stopRecording() {
  if (activeSession) {
    activeSession.endedAt = new Date().toISOString();
    activeSession = null;
  }
}

/** Get list of sessions (without frame data for the listing). */
export function listSessions(): Array<Omit<BrowserSession, "frames"> & { frameCount: number; durationMs: number }> {
  return sessions.map((s) => ({
    id: s.id,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    frameCount: s.frames.length,
    durationMs: s.frames.length > 0 ? s.frames[s.frames.length - 1].t : 0,
  }));
}

/** Get a specific session with all frames. */
export function getSession(id: string): BrowserSession | undefined {
  return sessions.find((s) => s.id === id);
}
