import { chromium, type Browser, type Page } from "playwright";
import { createHash } from "node:crypto";
import type { Observation, Mode, Action } from "./types.js";
import { Recording } from "./recording.js";
import { sameInputValue } from "./inputValue.js";

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
    if (action.operation === "click") {
      await target.click({ timeout: 4000 });
      return;
    }
    const wanted = values[action.value];
    if (wanted === undefined) throw Error("Unknown supplied value");
    if (action.operation === "type") {
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
