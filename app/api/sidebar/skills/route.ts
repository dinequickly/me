import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const SKILLS_DIR = path.join(process.cwd(), ".agents/skills");

// Add a new skill
export async function POST(req: Request) {
  const body = await req.json();
  const name: string = body.name ?? "untitled-skill";
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const description: string = body.description ?? "";
  const content: string = body.content ?? "";

  const skillDir = path.join(SKILLS_DIR, slug);
  await fs.mkdir(skillDir, { recursive: true });

  const md = `---\nname: ${name}\ndescription: ${description}\n---\n\n${content}\n`;
  await fs.writeFile(path.join(skillDir, "SKILL.md"), md, "utf-8");

  return NextResponse.json({ ok: true, slug });
}

// Update an existing skill
export async function PATCH(req: Request) {
  const body = await req.json();
  const originalSlug: string = body.originalSlug;
  const name: string = body.name;
  const description: string = body.description;
  const content: string = body.content;

  if (!originalSlug) {
    return NextResponse.json({ error: "originalSlug required" }, { status: 400 });
  }

  const skillFile = path.join(SKILLS_DIR, originalSlug, "SKILL.md");
  try {
    await fs.access(skillFile);
  } catch {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  const newSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // If name changed, rename directory
  if (newSlug !== originalSlug) {
    const oldDir = path.join(SKILLS_DIR, originalSlug);
    const newDir = path.join(SKILLS_DIR, newSlug);
    await fs.rename(oldDir, newDir);
  }

  const md = `---\nname: ${name}\ndescription: ${description}\n---\n\n${content}\n`;
  await fs.writeFile(path.join(SKILLS_DIR, newSlug, "SKILL.md"), md, "utf-8");

  return NextResponse.json({ ok: true, slug: newSlug });
}

// Delete a skill
export async function DELETE(req: Request) {
  const body = await req.json();
  const slug: string = body.slug;
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const skillDir = path.join(SKILLS_DIR, slug);
  try {
    await fs.rm(skillDir, { recursive: true });
  } catch {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
