import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Budget, BudgetExceeded } from "../src/budget.js";
import { redactRequest, normalize, ApiFailure } from "../src/api.js";
import { FixtureWorld } from "../src/world.js";
import { goals, oracle } from "../src/runner.js";
test("provider ceilings retain uncertain reservations and isolate providers", () => {
  const b = new Budget(
    join(mkdtempSync(join(tmpdir(), "lab-budget-")), "ledger.json"),
    1,
  );
  const id = b.reserve("openai", "extra", 0.7);
  b.uncertain(id);
  assert.throws(() => b.reserve("openai", "extra", 0.4), BudgetExceeded);
  b.reserve("typesafe", "extra", 0.9);
  assert.equal(b.totals().openai, 0.7);
  assert.equal(b.totals().typesafe, 0.9);
});
test("redaction preserves protocol choice IDs while removing free-text secrets", () => {
  const x = redactRequest(
    {
      model: "gpt-6-luna",
      input: "SECRET_VALUE",
      questions: [
        {
          name: "same_choice",
          choices: [{ value: "same_id", description: "SECRET_VALUE" }],
        },
      ],
    },
    ["same", "SECRET_VALUE"],
  );
  assert.equal(x.input, "[REDACTED]");
  assert.equal(x.questions[0].name, "same_choice");
  assert.equal(x.questions[0].choices[0].value, "same_id");
  assert.equal(x.questions[0].choices[0].description, "[REDACTED]");
});
test("fixture oracle rejects duplicate creation and unsaved changes", async () => {
  const w = await new FixtureWorld().start();
  try {
    w.newRun("test", "contacts");
    const task = goals("contacts", 1)[0];
    const state = w.states.get("test")!;
    assert.equal(oracle(w, "test", task), false);
    state.records.push({
      id: "r",
      fields: { ...task.expected },
      status: task.status,
    });
    assert.equal(oracle(w, "test", task), false);
    state.events.push({
      operation: "create",
      id: "r",
      fields: { ...task.expected },
      status: task.status,
    });
    assert.equal(oracle(w, "test", task), true);
    state.records.push({ ...state.records[0], id: "duplicate" });
    assert.equal(oracle(w, "test", task), false);
  } finally {
    await w.close();
  }
});

test("all generated application scripts compile without browser execution", async () => {
  const { Script } = await import("node:vm");
  const w = await new FixtureWorld().start();
  try {
    for (const kind of ["contacts", "rooms", "support"] as const) {
      const url =
        w.newRun("syntax-" + kind, kind) + (kind === "rooms" ? "/inner" : "");
      const html = await (await fetch(url)).text();
      const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
      assert.ok(script);
      assert.doesNotThrow(() => new Script(script!));
    }
  } finally {
    await w.close();
  }
});
