import { createHash } from "node:crypto";
export function shuffle<T>(items: T[], seed: string): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j =
      createHash("sha256")
        .update(seed + ":" + i)
        .digest()
        .readUInt32LE(0) %
      (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
