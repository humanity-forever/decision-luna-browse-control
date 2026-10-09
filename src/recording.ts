import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import type { BrowserContext, CDPSession, Page } from "playwright";
/** Capture synthetic browser workflows with original wall-clock timing. */
export class Recording {
  private client?: CDPSession;
  private frames: { path: string; at: number }[] = [];
  private lastAt = 0;
  private busy = false;
  constructor(
    readonly context: BrowserContext,
    readonly dir: string,
    readonly allowedPage: (page: Page) => boolean = () => true,
  ) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  private save(data: string): void {
    const at = performance.now();
    if (this.frames.length && at - this.lastAt < 180) return;
    const path = join(
      this.dir,
      `frame-${String(this.frames.length).padStart(6, "0")}.jpg`,
    );
    writeFileSync(path, Buffer.from(data, "base64"), { mode: 0o600 });
    this.frames.push({ path, at });
    this.lastAt = at;
  }
  async switchPage(page: Page): Promise<void> {
    if (this.client) {
      try {
        await this.client.send("Page.stopScreencast");
        await this.client.detach();
      } catch {}
    }
    if (!this.allowedPage(page)) return;
    await page.bringToFront();
    this.save(
      (await page.screenshot({ type: "jpeg", quality: 80 })).toString("base64"),
    );
    const client = await this.context.newCDPSession(page);
    this.client = client;
    client.on("Page.screencastFrame", (event: any) => {
      if (this.client !== client) return;
      try {
        if (this.allowedPage(page)) this.save(event.data);
      } finally {
        void client
          .send("Page.screencastFrameAck", { sessionId: event.sessionId })
          .catch(() => {});
      }
    });
    await client.send("Page.startScreencast", {
      format: "jpeg",
      quality: 80,
      maxWidth: 1440,
      maxHeight: 900,
      everyNthFrame: 1,
    });
  }
  async finish(): Promise<string | undefined> {
    const end = performance.now();
    if (this.client) {
      try {
        await this.client.send("Page.stopScreencast");
        await this.client.detach();
      } catch {}
      this.client = undefined;
    }
    if (!this.frames.length) return;
    let list = "";
    for (let i = 0; i < this.frames.length; i++) {
      const duration = Math.max(
        0.04,
        ((this.frames[i + 1]?.at ?? end) - this.frames[i].at) / 1000,
      );
      const name = this.frames[i].path.split("/").at(-1)!;
      list += `file '${name}'\nduration ${duration.toFixed(6)}\n`;
    }
    list += `file '${this.frames.at(-1)!.path.split("/").at(-1)}'\n`;
    const manifest = join(this.dir, "frames.txt");
    writeFileSync(manifest, list, { mode: 0o600 });
    const output = join(this.dir, "run.mp4");
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-loglevel",
        "error",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        manifest,
        "-vf",
        "scale=1440:900:force_original_aspect_ratio=decrease,pad=1440:900:(ow-iw)/2:(oh-ih)/2",
        "-r",
        "5",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "24",
        "-threads",
        "2",
        "-pix_fmt",
        "yuv420p",
        output,
      ],
      { stdio: "ignore" },
    );
    return output;
  }
}
