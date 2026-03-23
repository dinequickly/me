import fs from "fs/promises";
import path from "path";

const TOKEN_PATH = path.join(process.cwd(), "memory", "google-tokens.json");

export type StoredGoogleTokens = {
  refreshToken: string;
  accessToken: string;
  expiresAt: number; // unix seconds
};

export async function saveGoogleTokens(tokens: StoredGoogleTokens): Promise<void> {
  await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2), "utf-8");
}

export async function loadGoogleTokens(): Promise<StoredGoogleTokens | null> {
  try {
    const raw = await fs.readFile(TOKEN_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
