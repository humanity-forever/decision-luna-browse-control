import { BrowserSession, observe } from "../dist/src/browser.js";
import { appendFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const existing = new Set(
  readFileSync(".runtime/architecture-study/rows.jsonl", "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((s) => JSON.parse(s).id),
);
const sha = createHash("sha256")
  .update(readFileSync(new URL(import.meta.url)))
  .digest("hex");
for (let round = 0; round < 3; round++)
  for (const policy of ["enabled_only", "full_snapshot"]) {
    if (existing.has(`freshness-noise-${policy}-${round}`)) continue;
    const s = await BrowserSession.open();
    let rejected = false,
      success = false,
      wallMs = 0;
    try {
      await s.page.setContent(
        '<p>Synthetic target Alpha</p><time>10:00:00</time><button>Save record</button><script>document.querySelector("button").onclick=()=>document.body.dataset.saved="Alpha";</script>',
      );
      const o = await observe(s.page, "dom"),
        e = o.elements.find((e) => e.label === "Save record");
      await s.page
        .locator("time")
        .evaluate((node) => (node.textContent = "10:00:01"));
      const started = performance.now();
      if (policy === "full_snapshot")
        rejected = (await observe(s.page, "dom")).hash !== o.hash;
      if (!rejected)
        await s.execute(
          { operation: "click", target: e.id, value: "none", fine: "f0" },
          o,
          "dom",
          {},
        );
      success =
        (await s.page.evaluate(() => document.body.dataset.saved)) === "Alpha";
      wallMs = performance.now() - started;
    } finally {
      await s.close();
    }
    appendFileSync(
      ".runtime/architecture-study/rows.jsonl",
      JSON.stringify({
        id: `freshness-noise-${policy}-${round}`,
        suite: "freshness_noise",
        policy,
        round,
        status: "ok",
        success,
        validActionRejected: rejected,
        wallMs,
        wrongTargetAction: false,
        apiCalls: 0,
        apiMs: 0,
        costs: { openai: 0, typesafe: 0 },
        scriptHash: sha,
      }) + "\n",
    );
  }
console.log(
  "Measured six harmless-clock freshness samples with zero API calls.",
);
