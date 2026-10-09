import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Budget, BudgetExceeded } from "./budget.js";
import { loadCredentials } from "./security.js";
import { FixtureWorld, type AppKind } from "./world.js";
import { goals, runGoal, runtime } from "./runner.js";
import { shuffle } from "./design.js";
import type { Condition } from "./types.js";
const args = process.argv.slice(2),
  command = args[0] ?? "help";
function option(name: string, fallback: string) {
  const i = args.indexOf("--" + name);
  return i < 0 ? fallback : args[i + 1];
}
export const conditions: (Condition & { settle?: boolean })[] = [
  ...(["luna", "jev"] as const).flatMap((model) => [
    {
      model,
      mode: "dom" as const,
      assisted: false,
      history: 8 as const,
      bundled: true,
      recovery: 0 as const,
    },
    {
      model,
      mode: "dom" as const,
      assisted: true,
      guidance: "shortlist" as const,
      history: 8 as const,
      bundled: true,
      recovery: 0 as const,
    },
    {
      model,
      mode: "dom" as const,
      assisted: true,
      guidance: "shortlist" as const,
      history: 8 as const,
      bundled: true,
      recovery: 0 as const,
      settle: true,
    },
  ]),
  {
    model: "luna",
    mode: "combined",
    assisted: true,
    guidance: "shortlist",
    history: 8,
    bundled: true,
    recovery: 0,
    settle: true,
  },
  {
    model: "luna",
    mode: "dom",
    assisted: true,
    guidance: "shortlist",
    planCadence: "batch",
    history: 8,
    bundled: true,
    recovery: 0,
    settle: true,
  },
  {
    model: "jev",
    mode: "combined",
    assisted: true,
    guidance: "shortlist",
    history: 8,
    bundled: true,
    recovery: 0,
    settle: true,
  },
];
export function conditionId(c: Condition & { settle?: boolean }) {
  return `${c.model}-${c.mode}-${c.assisted ? "guided" : "solo"}-${c.settle ? "native" : "poll"}${c.planCadence ? "-batch" : ""}`;
}
if (command === "matrix") console.log(JSON.stringify(conditions, null, 2));
else if (command === "benchmark") {
  if (!args.includes("--paid"))
    throw Error("Use --paid to explicitly enable real API calls.");
  mkdirSync(runtime, { recursive: true, mode: 0o700 });
  const repeats = Number(option("repeats", "3")),
    seed = option("seed", "browser-lab-2026-10-09"),
    limit = Number(option("allowance", "2"));
  if (
    !Number.isInteger(repeats) ||
    repeats < 1 ||
    repeats > 5 ||
    !Number.isFinite(limit) ||
    limit <= 0 ||
    limit > 20
  )
    throw Error("Invalid repetitions or study allowance");
  const credentials = loadCredentials(),
    ledger = process.env.LUNA_LEDGER ?? join(runtime, "budget.json"),
    base = new Budget(ledger);
  const selectedKinds = option("apps", "contacts,rooms,support").split(
    ",",
  ) as AppKind[];
  const selectedConditions = conditions.filter(
    (c) =>
      option("conditions", "all") === "all" ||
      option("conditions", "all").split(",").includes(conditionId(c)),
  );
  if (
    !selectedKinds.every((k) => ["contacts", "rooms", "support"].includes(k)) ||
    !selectedConditions.length
  )
    throw Error("Unknown app or condition");
  const manifestPath = join(runtime, "manifest.json"),
    codeHash = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  const draft = {
    codeHash,
    seed,
    repeats,
    conditions,
    selectedApps: selectedKinds,
    selectedConditionIds: selectedConditions.map(conditionId),
    createdAt: new Date().toISOString(),
    budgetAtStart: base.totals(),
    studyAllowance: { openai: limit, typesafe: limit },
    scriptHash: createHash("sha256")
      .update(readFileSync(new URL(import.meta.url)))
      .digest("hex"),
  };
  const manifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, "utf8"))
    : draft;
  if (
    manifest.codeHash !== codeHash ||
    manifest.repeats !== repeats ||
    manifest.seed !== seed ||
    JSON.stringify(manifest.selectedApps) !== JSON.stringify(selectedKinds) ||
    JSON.stringify(manifest.selectedConditionIds) !==
      JSON.stringify(selectedConditions.map(conditionId))
  )
    throw Error("Frozen study changed; use a new runtime directory");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), {
    mode: 0o600,
  });
  class StudyBudget extends Budget {
    override reserve(provider: any, phase: any, estimate: number) {
      if (
        this.totals()[provider as "openai" | "typesafe"] + estimate >
        manifest.budgetAtStart[provider] + manifest.studyAllowance[provider]
      )
        throw new BudgetExceeded("Study allowance exhausted");
      return super.reserve(provider, phase, estimate);
    }
  }
  const budget = new StudyBudget(ledger),
    world = await new FixtureWorld().start();
  try {
    for (let repetition = 0; repetition < repeats; repetition++)
      for (const kind of selectedKinds)
        for (const condition of shuffle(
          selectedConditions,
          seed + "-" + kind + "-" + repetition,
        )) {
          const id = `b${repetition}-${kind}-${conditionId(condition)}`,
            tasks = goals(
              kind,
              repetition * 100 + conditions.indexOf(condition),
            );
          const paths = tasks.map((t) =>
            join(runtime, "runs", id + "-" + t.operation, "result.json"),
          );
          if (paths.every((p) => existsSync(p))) continue;
          if (paths.some((p) => existsSync(p)))
            throw Error(
              "Interrupted workflow must not be silently replayed with new state.",
            );
          if (condition.model === "jev" && condition.mode !== "dom") {
            for (const task of tasks) {
              const dir = join(runtime, "runs", id + "-" + task.operation);
              mkdirSync(dir, { recursive: true, mode: 0o700 });
              writeFileSync(
                join(dir, "result.json"),
                JSON.stringify(
                  {
                    id: id + "-" + task.operation,
                    kind,
                    operation: task.operation,
                    condition,
                    codeHash,
                    status: "unsupported",
                    success: false,
                    costs: { openai: 0, typesafe: 0 },
                    apiCalls: 0,
                  },
                  null,
                  2,
                ),
              );
            }
            continue;
          }
          const url = world.newRun(id, kind);
          let predecessor = true;
          for (const task of tasks) {
            const runId = id + "-" + task.operation;
            if (!predecessor) {
              const dir = join(runtime, "runs", runId);
              mkdirSync(dir, { recursive: true, mode: 0o700 });
              writeFileSync(
                join(dir, "result.json"),
                JSON.stringify(
                  {
                    id: runId,
                    kind,
                    operation: task.operation,
                    condition,
                    codeHash,
                    status: "dependency_failed",
                    success: false,
                    costs: { openai: 0, typesafe: 0 },
                    apiCalls: 0,
                  },
                  null,
                  2,
                ),
              );
              continue;
            }
            const result = await runGoal(
              credentials,
              budget,
              world,
              kind,
              id,
              url,
              task,
              condition,
              runId,
            );
            predecessor = result.success;
            console.log(
              JSON.stringify({
                id: runId,
                status: result.status,
                actions: result.actions,
                waits: result.waitDecisions,
                cacheHits: result.batchCacheHits,
                wallMs: Math.round(result.wallMs),
                costs: result.costs,
              }),
            );
          }
        }
  } finally {
    await world.close();
  }
} else
  console.log(
    "Commands: matrix | benchmark --paid --repeats 3 --allowance 2. Reports: npm run report.",
  );
