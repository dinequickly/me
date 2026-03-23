import { NextResponse } from "next/server";
import { listSessions, getSession } from "@/lib/browser-events";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const session = getSession(id);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json(session);
  }

  return NextResponse.json({ sessions: listSessions() });
}
