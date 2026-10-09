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

test("commit subject changes are rejected while harmless clock updates remain executable", async () => {
  const s = await BrowserSession.open();
  try {
    await s.page.setContent(
      '<main><h2>Alpha</h2><time>10:00</time><button>Archive</button></main><script>document.querySelector("button").onclick=()=>document.body.dataset.saved="yes"</script>',
    );
    const o = await observe(s.page, "dom");
    const button = o.elements.find((e) => e.label === "Archive")!;
    const action = {
      operation: "click",
      target: button.id,
      value: "none",
      fine: "",
    };
    await s.page.locator("h2").evaluate((e) => (e.textContent = "Beta"));
    await assert.rejects(
      s.execute(action, o, "dom", {}, { name: "Alpha", field: "Name" }),
      /subject/,
    );
    assert.equal(await s.page.getAttribute("body", "data-saved"), null);
    await s.page.locator("h2").evaluate((e) => (e.textContent = "Alpha"));
    await s.page.locator("time").evaluate((e) => (e.textContent = "10:01"));
    await s.execute(action, o, "dom", {}, { name: "Alpha", field: "Name" });
    assert.equal(await s.page.getAttribute("body", "data-saved"), "yes");
  } finally {
    await s.close();
  }
});

test("form and confirmation guards use their own subject and reject prefix collisions", async () => {
  const s = await BrowserSession.open();
  try {
    await s.page.setContent(
      '<h2>Alpha</h2><form><label>Name<input value="Beta"></label><button>Save record</button></form>',
    );
    let o = await observe(s.page, "dom");
    let button = o.elements.find((e) => e.label === "Save record")!;
    await assert.rejects(
      s.execute(
        { operation: "click", target: button.id, value: "none", fine: "" },
        o,
        "dom",
        {},
        { name: "Alpha", field: "Name" },
      ),
      /subject/,
    );
    await s.page.setContent(
      "<h2>Alpha</h2><dialog open><p>Cancel booking AlphaBeta?</p><button>Confirm cancellation</button></dialog>",
    );
    o = await observe(s.page, "dom");
    button = o.elements.find((e) => e.label === "Confirm cancellation")!;
    await assert.rejects(
      s.execute(
        { operation: "click", target: button.id, value: "none", fine: "" },
        o,
        "dom",
        {},
        { name: "Alpha", field: "Name" },
      ),
      /subject/,
    );
  } finally {
    await s.close();
  }
});

test("changed input meaning and values are rejected before typing", async () => {
  const s = await BrowserSession.open();
  try {
    await s.page.setContent('<input aria-label="Name" value="Alpha">');
    const o = await observe(s.page, "dom"),
      field = o.elements[0];
    await s.page.locator("input").fill("Beta");
    await assert.rejects(
      s.execute(
        { operation: "type", target: field.id, value: "name", fine: "" },
        o,
        "dom",
        { name: "Gamma" },
      ),
      /value changed/,
    );
    await s.page.locator("input").fill("Alpha");
    await s.page
      .locator("input")
      .evaluate((e) => e.setAttribute("aria-label", "Other field"));
    await assert.rejects(
      s.execute(
        { operation: "type", target: field.id, value: "name", fine: "" },
        o,
        "dom",
        { name: "Gamma" },
      ),
      /meaning/,
    );
  } finally {
    await s.close();
  }
});

test("hidden ancestor frames contribute no DOM text or controls", async () => {
  const s = await BrowserSession.open();
  try {
    await s.page.setContent(
      '<iframe style="display:none" srcdoc="<button>HIDDEN_FRAME_CONTROL</button>"></iframe><button>Visible</button>',
    );
    const o = await observe(s.page, "dom");
    assert.ok(!o.text.includes("HIDDEN_FRAME_CONTROL"));
    assert.ok(o.elements.some((e) => e.label === "Visible"));
  } finally {
    await s.close();
  }
});
