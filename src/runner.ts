import {
  mkdirSync,
  writeFileSync,
  appendFileSync,
  readFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { Api, Unsupported } from "./api.js";
import { Budget, BudgetExceeded } from "./budget.js";
import { BrowserSession, observe } from "./browser.js";
import { FieldBatch } from "./batch.js";
import { samplingDelay } from "./control.js";
import type { Action, Condition, Credentials, Observation } from "./types.js";
import type { FixtureWorld, AppKind } from "./world.js";
import { definition } from "./world.js";
export const runtime = resolve(process.env.LUNA_RUNTIME ?? ".runtime");
export interface Goal {
  operation: "create" | "update" | "close";
  goal: string;
  expected: Record<string, string>;
  status: string;
  values: Record<string, string>;
}
export function goals(kind: AppKind, index: number): Goal[] {
  const def = definition(kind),
    name = "Demo " + kind + " " + index;
  const initial: Record<string, string> =
    kind === "contacts"
      ? {
          Name: name,
          Email: "demo" + index + "@example.com",
          Phone: "2025550101",
        }
      : kind === "rooms"
        ? {
            Title: name,
            Room: "Studio A",
            Date: "2026-11-12",
            "Start time": "10:00",
          }
        : {
            Subject: name,
            "Requester email": "demo" + index + "@example.com",
            Priority: "Normal",
          };
  const updated = {
    ...initial,
    ...(kind === "contacts"
      ? { Phone: "2025550149" }
      : kind === "rooms"
        ? { Date: "2026-11-13", "Start time": "11:00" }
        : { Priority: "Urgent" }),
  };
  return [
    {
      operation: "create",
      goal: "Create exactly one new record with the supplied initial fields. Save it. Do not edit unrelated records.",
      expected: initial,
      status: def.open,
      values: { none: "", ...initial },
    },
    {
      operation: "update",
      goal: "Find the named saved record, change only fields that differ from the supplied expected fields, and save. Preserve the other fields.",
      expected: updated,
      status: def.open,
      values: { none: "", ...updated },
    },
    {
      operation: "close",
      goal:
        "Find the named saved record and set its retained status to " +
        def.closed +
        ". Keep it queryable; do not delete it.",
      expected: updated,
      status: def.closed,
      values: { none: "", ...updated },
    },
  ];
}
function catalog(obs: Observation, readOnly: boolean) {
  const result: { action: Action; description: string }[] = [];
  for (const e of obs.elements) {
    if (e.enabled === false || e.busy) continue;
    let operation = ["input", "textarea"].includes(e.tag)
      ? "type"
      : e.tag === "select"
        ? "select"
        : "click";
    if (operation !== "click" && e.readOnly) continue;
    if (
      readOnly &&
      (operation !== "click" ||
        /save|confirm|edit|new|archive|cancel booking|resolve/i.test(e.label))
    )
      continue;
    result.push({
      action: { operation, target: e.id, value: "none", fine: "" },
      description:
        operation + " " + e.id + " " + e.label + "; current=" + e.value,
    });
  }
  for (const operation of ["wait", "done", "stop"])
    result.push({
      action: { operation, target: "none", value: "none", fine: "" },
      description:
        operation === "done"
          ? "Done: hand off to saved-state requery, or finish read-only inspection."
          : operation,
    });
  return result;
}
export function unrelatedChanges(world: FixtureWorld, id: string): number {
  const state = world.states.get(id);
  return (state?.protectedRecords ?? []).filter((before) => {
    const now = state?.records.find((r) => r.id === before.id);
    return !now || JSON.stringify(now) !== JSON.stringify(before);
  }).length;
}
export function oracle(world: FixtureWorld, id: string, goal: Goal) {
  const state = world.states.get(id);
  if (
    !state ||
    state.records.length !== (state.protectedRecords?.length ?? 0) + 1 ||
    unrelatedChanges(world, id) > 0
  )
    return false;
  const targets = state.records.filter((r) =>
    Object.entries(goal.expected).every(([k, v]) => r.fields[k] === v),
  );
  if (targets.length !== 1) return false;
  const record = targets[0],
    event = state.events.at(-1);
  return (
    record.status === goal.status &&
    event?.operation === goal.operation &&
    event.id === record.id
  );
}
async function nativeSettle(session: BrowserSession) {
  const start = performance.now();
  await Promise.all(
    session.page.frames().map(async (frame) => {
      try {
        await frame.waitForLoadState("domcontentloaded", { timeout: 1500 });
        const busy = frame.locator("[aria-busy=true]:visible");
        if (await busy.count())
          await busy.first().waitFor({ state: "hidden", timeout: 1500 });
      } catch {}
    }),
  );
  return performance.now() - start;
}
export async function runGoal(
  credentials: Credentials,
  budget: Budget,
  world: FixtureWorld,
  kind: AppKind,
  worldId: string,
  url: string,
  goal: Goal,
  condition: Condition & { settle?: boolean },
  id: string,
) {
  const dir = join(runtime, "runs", id);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const api = new Api(credentials, budget, "extra"),
    before = budget.totals(),
    start = performance.now();
  api.deadline = start + 120000;
  const row: any = {
    id,
    kind,
    operation: goal.operation,
    condition,
    status: "failed",
    success: false,
    wallMs: 0,
    actions: 0,
    waitDecisions: 0,
    helperCalls: 0,
    batchCacheHits: 0,
    waitingMs: 0,
    observationMs: 0,
    executionMs: 0,
    requeryActions: 0,
    codeHash: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    promptHash: createHash("sha256")
      .update(readFileSync(new URL("./runner.js", import.meta.url)))
      .update(readFileSync(new URL("./api.js", import.meta.url)))
      .digest("hex"),
  };
  const session = await BrowserSession.open(),
    history: any[] = [],
    batch = new FieldBatch();
  let readOnly = false,
    lastAt = -Infinity,
    waits = 0;
  const origin = new URL(url).origin;
  try {
    if (condition.model === "jev" && condition.mode !== "dom")
      throw new Unsupported(
        "Jev is text-only; visual conditions are not substituted.",
      );
    await session.page.goto(url, { waitUntil: "domcontentloaded" });
    await session.startRecording(join(dir, "recording"));
    while (row.actions < 30 && performance.now() < api.deadline) {
      if (new URL(session.page.url()).origin !== origin)
        throw Error("Navigation outside authorized fixture origin");
      let wait = samplingDelay(lastAt, performance.now());
      if (wait > 0) {
        await session.page.waitForTimeout(wait);
        row.waitingMs += wait;
      }
      if (condition.settle) row.waitingMs += await nativeSettle(session);
      lastAt = performance.now();
      const obs = await observe(session.page, condition.mode);
      row.observationMs += obs.elapsedMs;
      const context =
        "One goal, one fresh observation, one action. " +
        (readOnly
          ? "READ-ONLY REQUERY: locate and open the saved target. Do not save or change anything."
          : "PERFORM: " + goal.goal) +
        "\nExpected fields: " +
        JSON.stringify(goal.expected) +
        "\nExpected status: " +
        goal.status +
        "\nSupplied values: " +
        JSON.stringify(goal.values) +
        "\nRecent actions: " +
        JSON.stringify(history.slice(-condition.history));
      let candidates = catalog(obs, readOnly),
        planned = new Map<string, string>(),
        advice = "";
      if (condition.assisted) {
        const cached =
          condition.planCadence === "batch"
            ? batch.take(obs, candidates, goal.values)
            : [];
        if (cached.length) {
          row.batchCacheHits++;
          candidates = cached.map((r) => r.candidate);
          for (const r of cached)
            planned.set(r.candidate.action.target, r.value);
          advice =
            "Retained independent field assignments, rematched to current controls.";
        } else {
          const keys = candidates.map((c) => ({
              key: c.action.operation + ":" + c.action.target,
              description: c.description,
            })),
            map = new Map(keys.map((k, i) => [k.key, candidates[i]]));
          const plan = await api.shortlist(
            obs,
            context,
            keys,
            goal.values,
            condition.planCadence === "batch",
          );
          row.helperCalls++;
          advice = JSON.stringify(plan);
          candidates = plan.choices.map((c) => ({
            ...map.get(c.action)!,
            action: { ...map.get(c.action)!.action },
          }));
          for (let i = 0; i < candidates.length; i++)
            planned.set(candidates[i].action.target, plan.choices[i].value);
          if (condition.planCadence === "batch")
            batch.seed(
              obs,
              candidates.map((c) => ({
                candidate: c,
                value: planned.get(c.action.target)!,
              })),
            );
        }
        for (const op of ["wait", "done", "stop"])
          if (!candidates.some((c) => c.action.operation === op))
            candidates.push({
              action: {
                operation: op,
                target: "none",
                value: "none",
                fine: "",
              },
              description: op,
            });
      }
      const decision = await api.decide(
        condition.model,
        obs,
        context + "\nPlanning advice: " + advice,
        [
          {
            name: "action",
            type: "choice",
            instructions:
              "Choose one next action from the current controls. Type/select only the appropriate supplied value. Done requires visible acceptance, or reopened saved-state evidence during requery.",
            choices: candidates.map((c, i) => ({
              value: "a" + i,
              description: c.description,
            })),
          },
          {
            name: "readiness",
            type: "choice",
            instructions:
              "Is the current screen ready for the next task action, or still rendering/loading/disabled?",
            choices: [
              { value: "ready", description: "Current controls are ready." },
              { value: "wait", description: "Wait for usable controls." },
            ],
          },
        ],
      );
      let action = {
        ...candidates[Number(decision.answers.action.choice!.slice(1))].action,
      };
      if (decision.answers.readiness.choice === "wait")
        action.operation = "wait";
      if (["type", "select"].includes(action.operation)) {
        const recommended = planned.get(action.target),
          choices = Object.entries(goal.values)
            .filter(([k]) => k !== "none")
            .map(([value, description]) => ({ value, description }));
        const selected = await api.decide(
          condition.model,
          obs,
          context +
            "\nChosen action: " +
            JSON.stringify(action) +
            "\nTarget: " +
            JSON.stringify(obs.elements.find((e) => e.id === action.target)),
          [
            {
              name: "value",
              type: "choice",
              instructions:
                "Choose the supplied value for this exact field; skip if none is suitable.",
              choices: [
                ...(recommended &&
                recommended !== "none" &&
                choices.some((c) => c.value === recommended)
                  ? choices.filter((c) => c.value === recommended)
                  : choices),
                {
                  value: "skip",
                  description: "Do not type or select this field.",
                },
              ],
            },
          ],
        );
        action.value = selected.answers.value.choice!;
        if (action.value === "skip") action.operation = "wait";
      }
      appendFileSync(
        join(dir, "trace.jsonl"),
        JSON.stringify({
          action,
          observationHash: obs.hash,
          readOnly,
          advice,
        }) + "\n",
        { mode: 0o600 },
      );
      if (action.operation === "stop") break;
      if (action.operation === "wait") {
        row.waitDecisions++;
        if (++waits >= 8) break;
        continue;
      }
      waits = 0;
      if (action.operation === "done") {
        batch.clear();
        if (!readOnly) {
          await session.page.reload({ waitUntil: "domcontentloaded" });
          readOnly = true;
          row.actions++;
          history.push({ operation: "reload_for_saved_state" });
          continue;
        }
        const wanted = Object.values(goal.expected).concat(goal.status);
        const actual = obs.text.toLowerCase();
        if (
          row.requeryActions >= 1 &&
          wanted.every((v) => actual.includes(v.toLowerCase())) &&
          oracle(world, worldId, goal)
        ) {
          row.status = "success";
          row.success = true;
          break;
        }
        history.push({
          error:
            "Saved-state inspection is incomplete; locate and open the target record.",
        });
        continue;
      }
      if (!["type", "select"].includes(action.operation)) batch.clear();
      batch.consumed(action.target, obs);
      const execStart = performance.now();
      try {
        await session.execute(action, obs, condition.mode, goal.values);
        row.actions++;
        if (readOnly) row.requeryActions++;
        history.push({ action });
      } catch {
        batch.clear();
        history.push({
          action,
          error: "Control became stale, busy or invalid; reobserve.",
        });
      }
      row.executionMs += performance.now() - execStart;
    }
  } catch (e) {
    row.status =
      e instanceof Unsupported
        ? "unsupported"
        : e instanceof BudgetExceeded
          ? "budget_exhausted"
          : "blocked";
    row.failureClass = e instanceof Error ? e.name : "runtime";
  } finally {
    row.wallMs = performance.now() - start;
    row.apiCalls = api.calls;
    row.apiMs = api.elapsedMs;
    row.apiStatistics = api.statistics;
    const after = budget.totals();
    row.costs = {
      openai: after.openai - before.openai,
      typesafe: after.typesafe - before.typesafe,
    };
    row.verifiedStoredRecord = oracle(world, worldId, goal);
    row.unrelatedRecordChanges = unrelatedChanges(world, worldId);
    row.recording = await session.finishRecording();
    await session.close();
    writeFileSync(join(dir, "result.json"), JSON.stringify(row, null, 2), {
      mode: 0o600,
    });
  }
  return row;
}
