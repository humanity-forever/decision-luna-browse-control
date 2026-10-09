import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Credentials } from "./types.js";
export function redact(text: string, secrets: string[]): string {
  for (const secret of secrets
    .filter(Boolean)
    .sort((a, b) => b.length - a.length))
    text = text.split(secret).join("[REDACTED]");
  return text
    .replace(/sk-proj-[A-Za-z0-9_-]{25,}/g, "[REDACTED]")
    .replace(/apikey_[A-Za-z0-9_-]{25,}/g, "[REDACTED]");
}
export function loadCredentials(): Credentials {
  const path =
    process.env.LUNA_CREDENTIALS ??
    join(homedir(), ".config/decision-luna-browser-lab/credentials.json");
  if ((statSync(path).mode & 0o077) !== 0)
    throw Error("Credential file must be private (0600)");
  const data = JSON.parse(readFileSync(path, "utf8"));
  if (typeof data.openai !== "string" || typeof data.typesafe !== "string")
    throw Error("Both provider credentials required");
  return { openai: data.openai, typesafe: data.typesafe };
}
