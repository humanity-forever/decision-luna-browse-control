import test from "node:test";
import assert from "node:assert/strict";
import { BrowserSession, observe } from "../src/browser.js";
import { FixtureWorld } from "../src/world.js";
import { goals, oracle } from "../src/runner.js";
test("raster observation never requests frames or DOM", async () => {
  const s = await BrowserSession.open();
  try {
    await s.page.setContent("<button>Ready</button>");
    const original = s.page.frames;
    s.page.frames = () => {
      throw Error("DOM access forbidden");
    };
    const o = await observe(s.page, "screenshot");
    assert.equal(o.elements.length, 0);
    assert.ok(o.image);
    s.page.frames = original;
  } finally {
    await s.close();
  }
});
test("contact fixture works through shadow DOM and survives page reload", async () => {
  const w = await new FixtureWorld().start(),
    s = await BrowserSession.open();
  try {
    const errors: string[] = [];
    s.page.on("pageerror", (e) => errors.push(e.message));
    await s.page.goto(w.newRun("contact-test", "contacts"));
    await s.page
      .getByRole("button", { name: "New contact", exact: true })
      .click();
    const task = goals("contacts", 1)[0];
    for (const [label, value] of Object.entries(task.expected))
      await s.page.getByLabel(label, { exact: true }).fill(value);
    await s.page
      .getByRole("button", { name: "Save record", exact: true })
      .click();
    await s.page
      .getByRole("button", { name: "Edit record", exact: true })
      .waitFor();
    assert.equal(oracle(w, "contact-test", task), true);
    await s.page.reload();
    await s.page
      .getByRole("button", { name: "Open " + task.expected.Name, exact: true })
      .click();
    await s.page
      .getByText(task.expected.Email, { exact: true })
      .waitFor({ state: "visible" });
    const obs = await observe(s.page, "dom");
    assert.ok(obs.text.includes(task.expected.Email));
    assert.deepEqual(errors, []);
  } finally {
    await s.close();
    await w.close();
  }
});
test("room fixture exposes disabled controls and native date/time inside an iframe", async () => {
  const w = await new FixtureWorld().start(),
    s = await BrowserSession.open();
  try {
    const errors: string[] = [];
    s.page.on("pageerror", (e) => errors.push(e.message));
    await s.page.goto(w.newRun("room-test", "rooms"));
    const frame = s.page.frameLocator("iframe");
    await frame
      .getByRole("button", { name: "New booking", exact: true })
      .click();
    const initial = await observe(s.page, "dom");
    assert.ok(
      initial.elements.some(
        (e) => e.label === "Title" && e.enabled === false && e.frame > 0,
      ),
    );
    const task = goals("rooms", 1)[0];
    await frame.getByLabel("Title", { exact: true }).fill(task.expected.Title);
    await frame
      .getByLabel("Room", { exact: true })
      .selectOption({ label: task.expected.Room });
    await frame.getByLabel("Date", { exact: true }).fill(task.expected.Date);
    await frame
      .getByLabel("Start time", { exact: true })
      .fill(task.expected["Start time"]);
    await frame
      .getByRole("button", { name: "Save record", exact: true })
      .click();
    await frame
      .getByRole("button", { name: "Edit record", exact: true })
      .waitFor();
    assert.equal(oracle(w, "room-test", task), true);
    assert.deepEqual(errors, []);
  } finally {
    await s.close();
    await w.close();
  }
});
