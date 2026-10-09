import { chromium, type Browser, type Page, type Locator } from "playwright";
import { createHash } from "node:crypto";
import type { Observation, Mode, Action } from "./types.js";
import { Recording } from "./recording.js";
import { sameInputValue } from "./inputValue.js";

export async function assertCommitSubject(
  target: Locator,
  binding: { name: string; field: string },
): Promise<void> {
  const matches = await target.evaluate((element, expected) => {
    const normalize = (s: string) =>
      s.trim().replace(/\s+/g, " ").toLowerCase();
    const shown = (e: Element) =>
      e.getClientRects().length > 0 &&
      getComputedStyle(e).display !== "none" &&
      getComputedStyle(e).visibility !== "hidden";
    const name = normalize(expected.name);
    const dialog = element.closest("dialog,[role=dialog]");
    if (dialog) {
      const text = normalize(
        Array.from(dialog.querySelectorAll("*"))
          .filter(shown)
          .flatMap((e) =>
            Array.from(e.childNodes)
              .filter((n) => n.nodeType === Node.TEXT_NODE)
              .map((n) => n.textContent ?? ""),
          )
          .join(" "),
      );
      const index = text.indexOf(name);
      const word = (c: string) => /[\p{L}\p{N}]/u.test(c);
      return (
        index >= 0 &&
        !word(text[index - 1] ?? "") &&
        !word(text[index + name.length] ?? "")
      );
    }
    const form = element.closest("form");
    if (form) {
      const identifiers = Array.from(
        form.querySelectorAll("input,textarea,select"),
      )
        .filter(shown)
        .filter((e) => {
          const field = e as HTMLInputElement;
          const label =
            e.getAttribute("aria-label") ??
            Array.from(field.labels ?? [])
              .map((x) => x.textContent ?? "")
              .join(" ");
          return normalize(label) === normalize(expected.field);
        });
      return (
        identifiers.length === 1 &&
        normalize((identifiers[0] as HTMLInputElement).value) === name
      );
    }
    const scope =
      element.closest("section,article,main") ?? element.getRootNode();
    return Array.from(
      (scope as ParentNode).querySelectorAll(
        "h1,h2,h3,h4,h5,h6,[role=heading]",
      ),
    )
      .filter(shown)
      .some((e) => normalize(e.textContent ?? "") === name);
  }, binding);
  if (!matches)
    throw Error("Saved-record action no longer matches the requested subject");
}

export async function observe(page: Page, mode: Mode): Promise<Observation> {
  const start = performance.now();
  const image =
    mode === "dom"
      ? undefined
      : "data:image/png;base64," +
        (
          await page.screenshot({
            style: "input[type=password]{color:transparent!important}",
          })
        ).toString("base64");
  if (mode === "screenshot")
    return {
      text: "Raster-only observation.",
      image,
      elements: [],
      hash: createHash("sha256").update(image!).digest("hex"),
      elapsedMs: performance.now() - start,
    };
  const frames = page.frames();
  let text = "";
  const elements: Observation["elements"] = [];
  for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
    try {
      if (frames[frameIndex] !== page.mainFrame()) {
        let ancestor = frames[frameIndex];
        let hidden = false;
        while (ancestor.parentFrame()) {
          const owner = await ancestor.frameElement();
          if (!(await owner.isVisible())) {
            hidden = true;
            break;
          }
          ancestor = ancestor.parentFrame()!;
        }
        if (hidden) continue;
      }
      const part = await frames[frameIndex].evaluate((frame) => {
        const roots: (Document | ShadowRoot)[] = [document];
        for (let i = 0; i < roots.length; i++)
          for (const e of Array.from(roots[i].querySelectorAll("*")))
            if (e.shadowRoot) roots.push(e.shadowRoot);
        const visible = (e: Element) => {
          const r = e.getBoundingClientRect(),
            s = getComputedStyle(e);
          return (
            r.width > 1 &&
            r.height > 1 &&
            r.bottom > 0 &&
            r.right > 0 &&
            r.top < innerHeight &&
            r.left < innerWidth &&
            s.display !== "none" &&
            s.visibility !== "hidden"
          );
        };
        const nodes = roots
          .flatMap((root) =>
            Array.from(
              root.querySelectorAll(
                "input,select,textarea,button,a,[role=button]",
              ),
            ),
          )
          .filter(
            (e) => visible(e) && (e as HTMLInputElement).type !== "password",
          );
        const rows = nodes.map((e, i) => {
          const field = e as HTMLInputElement,
            box = e.getBoundingClientRect(),
            id = "e" + frame + "_" + i;
          e.setAttribute("data-agent-id", id);
          const labels = Array.from((field as HTMLInputElement).labels ?? [])
            .map((x) => x.textContent ?? "")
            .join(" ");
          return {
            id,
            frame,
            selector: '[data-agent-id="' + id + '"]',
            tag: e.tagName.toLowerCase(),
            role: e.getAttribute("role") ?? "",
            label: (
              e.getAttribute("aria-label") ??
              (labels ||
                e.getAttribute("placeholder") ||
                e.textContent ||
                field.name ||
                field.id)
            )
              .trim()
              .slice(0, 240),
            type: field.type ?? "",
            value: field.value ?? "",
            readOnly: field.readOnly ?? false,
            enabled:
              !field.disabled && e.getAttribute("aria-disabled") !== "true",
            busy: !!e.closest("[aria-busy=true]"),
            bounds: {
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
            },
            options:
              e.tagName === "SELECT"
                ? Array.from((e as HTMLSelectElement).options).map(
                    (x) => x.text,
                  )
                : undefined,
          };
        });
        const words = roots
          .flatMap((root) => Array.from(root.querySelectorAll("*")))
          .filter((e) => visible(e) && !["SCRIPT", "STYLE"].includes(e.tagName))
          .flatMap((e) =>
            Array.from(e.childNodes)
              .filter((n) => n.nodeType === Node.TEXT_NODE)
              .map((n) => n.textContent?.trim())
              .filter(Boolean),
          );
        return { rows, text: words.join("\n").slice(0, 18000) };
      }, frameIndex);
      elements.push(...part.rows);
      text += "\nFRAME " + frameIndex + "\n" + part.text;
    } catch {}
  }
  text += "\nVISIBLE CONTROLS: " + JSON.stringify(elements);
  return {
    text,
    image,
    elements,
    hash: createHash("sha256").update(text).digest("hex"),
    elapsedMs: performance.now() - start,
  };
}

export class BrowserSession {
  private recording?: Recording;
  constructor(
    readonly browser: Browser,
    readonly page: Page,
  ) {}
  async startRecording(dir: string) {
    this.recording = new Recording(this.page.context(), dir);
    await this.recording.switchPage(this.page);
  }
  async finishRecording() {
    return this.recording?.finish();
  }
  static async open(): Promise<BrowserSession> {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      timezoneId: "America/New_York",
    });
    return new BrowserSession(browser, await context.newPage());
  }
  async close(): Promise<void> {
    await this.browser.close();
  }
  async execute(
    action: Action,
    obs: Observation,
    mode: Mode,
    values: Record<string, string>,
    subject?: { name: string; field: string },
  ): Promise<void> {
    if (action.operation === "wait") {
      return;
    }
    if (action.operation === "reload") {
      await this.page.reload({ waitUntil: "domcontentloaded" });
      return;
    }
    if (action.operation === "back") {
      await this.page.goBack({ waitUntil: "domcontentloaded" });
      return;
    }
    if (
      action.operation === "scroll_down" ||
      action.operation === "scroll_up"
    ) {
      await this.page.mouse.wheel(
        0,
        action.operation === "scroll_down" ? 480 : -480,
      );
      return;
    }
    if (mode === "screenshot")
      throw Error(
        "Raster workflow execution is not in this benchmark; raster readiness is measured separately.",
      );
    const info = obs.elements.find((e) => e.id === action.target);
    if (!info) throw Error("Stale or unknown target");
    const frame = this.page.frames()[info.frame];
    if (!frame) throw Error("Detached frame");
    const target = frame.locator(info.selector);
    if (
      (await target.count()) !== 1 ||
      !(await target.isVisible()) ||
      !(await target.isEnabled())
    )
      throw Error("Target is stale, disabled or hidden");
    const checkControl = async () => {
      const live = await target.evaluate((e) => {
        const field = e as HTMLInputElement;
        const labels = Array.from(field.labels ?? [])
          .map((x) => x.textContent ?? "")
          .join(" ");
        return {
          tag: e.tagName.toLowerCase(),
          type: field.type ?? "",
          label: (
            e.getAttribute("aria-label") ??
            (labels ||
              e.getAttribute("placeholder") ||
              e.textContent ||
              field.name ||
              field.id)
          )
            .trim()
            .slice(0, 240),
          busy: !!e.closest("[aria-busy=true]"),
          options:
            e.tagName === "SELECT"
              ? Array.from((e as HTMLSelectElement).options).map((o) => o.text)
              : undefined,
        };
      });
      if (
        live.tag !== info.tag ||
        live.type !== info.type ||
        live.label !== info.label ||
        live.busy ||
        JSON.stringify(live.options) !== JSON.stringify(info.options)
      )
        throw Error("Control meaning or readiness changed after observation");
    };
    await checkControl();
    if (action.operation === "click") {
      await target.click({ trial: true, timeout: 4000 });
      await checkControl();
      if (
        subject &&
        /save|confirm|archive|cancel booking|resolve/i.test(info.label)
      )
        await assertCommitSubject(target, subject);
      await target.click({ timeout: 4000 });
      return;
    }
    const wanted = values[action.value];
    if (wanted === undefined) throw Error("Unknown supplied value");
    if (action.operation === "type") {
      const current = await target.inputValue();
      if (
        !sameInputValue(current, info.value, info.label, info.type) &&
        !sameInputValue(current, wanted, info.label, info.type)
      )
        throw Error("Input value changed after observation");
      if (
        sameInputValue(await target.inputValue(), wanted, info.label, info.type)
      )
        return;
      await target.fill(wanted, { timeout: 4000 });
      return;
    }
    if (action.operation === "select") {
      try {
        await target.selectOption({ label: wanted }, { timeout: 2000 });
      } catch {
        await target.selectOption(wanted, { timeout: 2000 });
      }
      return;
    }
    throw Error("Unsupported browser operation");
  }
}
