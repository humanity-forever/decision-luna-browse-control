import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  rmdirSync,
} from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { Provider, Stage } from "./types.js";
export const prices = {
  luna: { input: 0.1, output: 0 },
  jev: { input: 0.042, output: 0 },
  assistant: { input: 2, output: 10 },
};
export class BudgetExceeded extends Error {}
interface Entry {
  id: string;
  provider: Provider;
  stage: Stage;
  estimate: number;
  charged: number;
  state: "reserved" | "settled" | "uncertain";
  usage?: unknown;
}
export class Budget {
  constructor(
    readonly path: string,
    readonly limit = 100,
  ) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  }
  private change<T>(fn: (entries: Entry[]) => T): T {
    const lock = this.path + ".lock";
    try {
      mkdirSync(lock);
    } catch {
      throw new Error("Budget ledger is in use; fail closed");
    }
    try {
      const entries: Entry[] = existsSync(this.path)
        ? JSON.parse(readFileSync(this.path, "utf8"))
        : [];
      const result = fn(entries);
      const tmp = this.path + "." + randomUUID();
      writeFileSync(tmp, JSON.stringify(entries, null, 2), { mode: 0o600 });
      renameSync(tmp, this.path);
      return result;
    } finally {
      rmdirSync(lock);
    }
  }
  reserve(provider: Provider, stage: Stage, estimate: number): string {
    if (!Number.isFinite(estimate) || estimate <= 0)
      throw new Error("Invalid cost reservation");
    return this.change((entries) => {
      const spent = entries
        .filter((e) => e.provider === provider)
        .reduce((s, e) => s + e.charged, 0);
      const limitsPath = this.path + ".limits.json";
      const configured = existsSync(limitsPath)
        ? JSON.parse(readFileSync(limitsPath, "utf8"))
        : {};
      const providerLimit = configured[provider] ?? this.limit;
      if (!Number.isFinite(providerLimit) || providerLimit <= 0)
        throw new Error("Invalid provider budget limit");
      const ceiling = Math.min(
        providerLimit,
        stage === "pilot"
          ? 20
          : stage === "evaluation"
            ? Math.max(20, providerLimit - 10)
            : providerLimit,
      );
      if (spent + estimate > ceiling)
        throw new BudgetExceeded(`${provider} ${stage} budget exhausted`);
      const id = randomUUID();
      entries.push({
        id,
        provider,
        stage,
        estimate,
        charged: estimate,
        state: "reserved",
      });
      return id;
    });
  }
  settle(id: string, charged: number, usage?: unknown): void {
    this.change((entries) => {
      const e = entries.find((e) => e.id === id);
      if (!e) throw new Error("Unknown reservation");
      if (!Number.isFinite(charged) || charged < 0)
        throw new Error("Invalid charge");
      e.charged = charged;
      e.state = "settled";
      e.usage = usage;
    });
  }
  uncertain(id: string): void {
    this.change((entries) => {
      const e = entries.find((e) => e.id === id);
      if (e) e.state = "uncertain";
    });
  }
  totals(): Record<Provider, number> {
    const es: Entry[] = existsSync(this.path)
      ? JSON.parse(readFileSync(this.path, "utf8"))
      : [];
    return {
      openai: es
        .filter((e) => e.provider === "openai")
        .reduce((s, e) => s + e.charged, 0),
      typesafe: es
        .filter((e) => e.provider === "typesafe")
        .reduce((s, e) => s + e.charged, 0),
    };
  }
}
export function usageCost(kind: keyof typeof prices, usage: any): number {
  const input = usage?.input_tokens ?? usage?.prompt_tokens,
    output = usage?.output_tokens ?? usage?.completion_tokens ?? 0;
  if (
    !Number.isFinite(input) ||
    input < 0 ||
    !Number.isFinite(output) ||
    output < 0
  )
    throw new Error("Missing/invalid usage");
  // Deliberately charge uncached rates for a conservative estimate.
  return (input * prices[kind].input + output * prices[kind].output) / 1e6;
}
