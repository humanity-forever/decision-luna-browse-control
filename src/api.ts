import { Budget, usageCost, prices } from "./budget.js";
import { redact } from "./security.js";
import type {
  Credentials,
  Question,
  Decision,
  Observation,
  Stage,
  Model,
  Provider,
  ApiStatistic,
} from "./types.js";
export class ApiFailure extends Error {
  constructor(
    readonly status: number | string,
    readonly code: string,
  ) {
    super(`API ${status}: ${code}`);
  }
}
export class Unsupported extends Error {}
export function redactRequest(value: any, secrets: string[]): any {
  if (typeof value === "string")
    return value.startsWith("data:image/") ? value : redact(value, secrets);
  if (Array.isArray(value)) return value.map((v) => redactRequest(v, secrets));
  if (value && typeof value === "object") {
    const scrubbed = Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, redactRequest(v, secrets)]),
    );
    // Client-defined protocol identifiers remain stable while free text is scrubbed.
    if (value.model && Array.isArray(value.questions)) {
      scrubbed.questions = scrubbed.questions.map((q: any, i: number) => ({
        ...q,
        name: value.questions[i].name,
        ...(q.choices
          ? {
              choices: q.choices.map((c: any, j: number) => ({
                ...c,
                value: value.questions[i].choices[j].value,
              })),
            }
          : {}),
      }));
    }
    if (value.model && value.text?.format?.type === "json_schema") {
      const metadata = (original: any, clean: any): any => {
        if (Array.isArray(original))
          return original.map((v, i) => metadata(v, clean?.[i]));
        if (original && typeof original === "object")
          return Object.fromEntries(
            Object.entries(original).map(([k, v]) => [
              k,
              k === "type" || k === "enum" ? v : metadata(v, clean?.[k]),
            ]),
          );
        return clean;
      };
      scrubbed.text = {
        ...scrubbed.text,
        format: {
          ...scrubbed.text.format,
          name: value.text.format.name,
          schema: metadata(
            value.text.format.schema,
            scrubbed.text.format.schema,
          ),
        },
      };
    }
    return scrubbed;
  }
  return value;
}
export function openaiQuestions(qs: Question[]): unknown[] {
  return qs.map((q) =>
    q.type === "choice"
      ? { ...q, choices: q.choices }
      : { name: q.name, type: "predicate", instructions: q.instructions },
  );
}
export function jevQuestions(qs: Question[]): unknown {
  return Object.fromEntries(
    qs.map((q) => [
      q.name,
      q.type === "choice"
        ? {
            type: "choice",
            instructions: q.instructions,
            criteria: Object.fromEntries(
              q.choices!.map((c) => [c.value, c.description ?? c.value]),
            ),
          }
        : { type: "noul", instructions: q.instructions },
    ]),
  );
}
export function normalize(
  model: Model,
  data: any,
  qs: Question[],
): Decision["answers"] {
  const out: Decision["answers"] = {};
  for (const q of qs) {
    const a =
      model === "luna"
        ? data.answers?.find((x: any) => x.name === q.name)
        : data.answers?.[q.name];
    if (!a) throw new ApiFailure(200, "missing_answer_" + q.name);
    if (a.type === "refusal") throw new ApiFailure(200, "refusal_" + q.name);
    if (q.type === "choice") {
      if (!q.choices!.some((c) => c.value === a.choice))
        throw new ApiFailure(200, "invalid_choice");
      const raw =
        model === "luna"
          ? a.probabilities?.map((x: any) => [x.value, x.probability])
          : Object.entries(a.probabilities ?? {});
      if (!Array.isArray(raw) || raw.length !== q.choices!.length)
        throw new ApiFailure(200, "invalid_distribution");
      const map = new Map<string, number>(raw);
      const ps = q.choices!.map((c) => map.get(c.value));
      if (
        ps.some(
          (p) => typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 1,
        ) ||
        Math.abs((ps as number[]).reduce((s, p) => s + p, 0) - 1) > 0.03
      )
        throw new ApiFailure(200, "invalid_distribution");
      out[q.name] = { choice: a.choice, confidence: a.confidence };
    } else {
      const p = model === "luna" ? a.probability : a.noul;
      if (typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 1)
        throw new ApiFailure(200, "invalid_probability");
      out[q.name] = { probability: p };
    }
  }
  return out;
}
export class Api {
  calls = 0;
  elapsedMs = 0;
  models = new Set<string>();
  deadline = Infinity;
  statistics: Record<string, ApiStatistic> = {};
  constructor(
    readonly credentials: Credentials,
    readonly budget: Budget,
    readonly stage: Stage,
    readonly fetcher: typeof fetch = fetch,
  ) {}
  async request(
    provider: Provider,
    kind: "luna" | "jev" | "assistant",
    body: any,
    endpoint?: string,
    purpose: ApiStatistic["purpose"] = kind === "assistant"
      ? "planning"
      : "decision",
  ): Promise<any> {
    const model =
      kind === "luna"
        ? "gpt-6-luna"
        : kind === "jev"
          ? "jev-1.13.0"
          : "gpt-6.1-sol";
    const key = `${model}/${purpose}`;
    const stat = (this.statistics[key] ??= {
      provider,
      model,
      purpose,
      calls: 0,
      retries: 0,
      inputTokens: 0,
      outputTokens: 0,
      usageResponses: 0,
      estimatedOrReservedUsd: 0,
      pendingRequests: 0,
      failedRequests: 0,
      transportLatenciesMs: [],
      logicalRequestLatenciesMs: [],
    });
    const attempts = { count: 0 };
    const start = performance.now();
    try {
      return await this.performRequest(
        provider,
        kind,
        body,
        stat,
        attempts,
        endpoint,
      );
    } catch (error) {
      if (attempts.count) stat.failedRequests++;
      throw error;
    } finally {
      if (attempts.count)
        stat.logicalRequestLatenciesMs.push(performance.now() - start);
    }
  }
  private async performRequest(
    provider: Provider,
    kind: "luna" | "jev" | "assistant",
    body: any,
    stat: ApiStatistic,
    attempts: { count: number },
    endpoint?: string,
  ): Promise<any> {
    body = redactRequest(body, [
      this.credentials.openai,
      this.credentials.typesafe,
      ...(this.credentials.secrets ?? []),
    ]);
    const url =
      endpoint ??
      (kind === "luna"
        ? "https://api.openai.com/v1/decisions"
        : kind === "jev"
          ? "https://api.typesafe.ai/v1/systemone"
          : "https://api.openai.com/v1/responses");
    const allowed =
      provider === "openai"
        ? [
            "https://api.openai.com/v1/decisions",
            "https://api.openai.com/v1/responses",
            "https://api.openai.com/v1/chat/completions",
          ]
        : ["https://api.typesafe.ai/v1/systemone"];
    if (!allowed.includes(url))
      throw new Error("Provider endpoint outside metered allowlist");
    const expected =
      kind === "luna"
        ? "gpt-6-luna"
        : kind === "jev"
          ? "jev-1.13.0"
          : "gpt-6.1-sol";
    if (body.model !== expected)
      throw new Error("Model outside priced experiment configuration");
    // UTF-8 bytes upper-bound text tokens. Reserve 262144 image tokens per image.
    const encoded = JSON.stringify(body);
    const textBytes = Buffer.byteLength(
      encoded.replace(/data:image\/[^" ]+/g, ""),
    );
    const images = (encoded.match(/data:image\//g) ?? []).length;
    const estimate =
      ((textBytes + images * 262144) * prices[kind].input) / 1e6 +
      (kind === "assistant"
        ? ((body.max_output_tokens ?? 2048) * 10) / 1e6
        : 0) +
      0.001;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (performance.now() >= this.deadline)
        throw new ApiFailure("deadline", "time_limit");
      const reservation = this.budget.reserve(provider, this.stage, estimate);
      const start = performance.now();
      this.calls++;
      stat.calls++;
      attempts.count++;
      if (attempt) stat.retries++;
      stat.estimatedOrReservedUsd += estimate;
      stat.pendingRequests++;
      let response: Response;
      const timeout = Math.max(
        1,
        Math.floor(Math.min(45000, this.deadline - performance.now())),
      );
      try {
        response = await this.fetcher(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.credentials[provider]}`,
            "Content-Type": "application/json",
          },
          body: encoded,
          signal: AbortSignal.timeout(timeout),
        });
      } catch {
        this.budget.uncertain(reservation);
        this.elapsedMs += performance.now() - start;
        stat.transportLatenciesMs.push(performance.now() - start);
        if (performance.now() >= this.deadline)
          throw new ApiFailure("deadline", "time_limit");
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
          continue;
        }
        throw new ApiFailure("network", "transport_error");
      }
      this.elapsedMs += performance.now() - start;
      stat.transportLatenciesMs.push(performance.now() - start);
      if (!response.ok) {
        if (response.status < 500) {
          this.budget.settle(reservation, 0);
          stat.estimatedOrReservedUsd -= estimate;
          stat.pendingRequests--;
        } else this.budget.uncertain(reservation);
        let error: any = {};
        try {
          error = await response.json();
        } catch {}
        const code = String(
          error?.error?.code ?? error?.error?.type ?? "http_error",
        )
          .replace(/[^\w.-]/g, "")
          .slice(0, 80);
        const retry =
          (response.status === 429 &&
            !/insufficient_quota|billing|credit/i.test(code)) ||
          [500, 502, 503, 504].includes(response.status);
        const delay = Number(
          response.headers.get("retry-after") ?? 2 ** attempt,
        );
        if (retry && attempt < 2 && delay <= 30) {
          await new Promise((r) => setTimeout(r, Math.max(0, delay) * 1000));
          continue;
        }
        throw new ApiFailure(response.status, code);
      }
      let data: any;
      try {
        data = await response.json();
      } catch {
        this.budget.uncertain(reservation);
        throw new ApiFailure(200, "invalid_json");
      }
      try {
        const charged = usageCost(kind, data.usage);
        this.budget.settle(reservation, charged, data.usage);
        stat.estimatedOrReservedUsd += charged - estimate;
        stat.pendingRequests--;
        stat.inputTokens +=
          data.usage.input_tokens ?? data.usage.prompt_tokens ?? 0;
        stat.outputTokens +=
          data.usage.output_tokens ?? data.usage.completion_tokens ?? 0;
        stat.usageResponses++;
      } catch {
        this.budget.uncertain(reservation);
        throw new ApiFailure(200, "invalid_usage");
      }
      this.models.add(data.model ?? kind);
      return data;
    }
    throw new ApiFailure("network", "retry_exhausted");
  }
  input(obs: Observation, context: string): any[] {
    return [
      {
        role: "user",
        content: [
          { type: "input_text", text: context + "\nOBSERVATION:\n" + obs.text },
          ...(obs.image
            ? [{ type: "input_image", image_url: obs.image, detail: "high" }]
            : []),
        ],
      },
    ];
  }
  async decide(
    model: Model,
    obs: Observation,
    context: string,
    qs: Question[],
  ): Promise<Decision> {
    if (model === "jev" && obs.image)
      throw new Unsupported(
        "Jev 1.13 supports text only; no visual preprocessing substituted",
      );
    const before = this.budget.totals();
    const start = performance.now();
    const calls = this.calls;
    const data = await this.request(
      model === "luna" ? "openai" : "typesafe",
      model,
      model === "luna"
        ? {
            model: "gpt-6-luna",
            input: this.input(obs, context),
            questions: openaiQuestions(qs),
          }
        : {
            model: "jev-1.13.0",
            state: context + "\nOBSERVATION:\n" + obs.text,
            questions: jevQuestions(qs),
          },
    );
    const after = this.budget.totals();
    return {
      answers: normalize(model, data, qs),
      model: data.model,
      elapsedMs: performance.now() - start,
      cost: after.openai - before.openai + after.typesafe - before.typesafe,
      calls: this.calls - calls,
    };
  }
  async shortlist(
    obs: Observation,
    context: string,
    actions: { key: string; description: string }[],
    values: Record<string, string>,
    batch = false,
  ): Promise<{ choices: { action: string; value: string }[]; notes: string }> {
    const schema = {
      type: "object",
      properties: {
        choices: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          items: {
            type: "object",
            properties: {
              action: { type: "string", enum: actions.map((a) => a.key) },
              value: { type: "string", enum: Object.keys(values) },
            },
            required: ["action", "value"],
            additionalProperties: false,
          },
        },
        notes: { type: "string" },
      },
      required: ["choices", "notes"],
      additionalProperties: false,
    };
    const data = await this.request(
      "openai",
      "assistant",
      {
        model: "gpt-6.1-sol",
        input: this.input(
          obs,
          context +
            "\nShortlist 1..4 complete next actions from the current rendered controls. Choose the supplied value key for typing/selecting, otherwise none. Do not invent values, hidden state or a workflow macro. Avoid already-correct inputs. After saving is visibly accepted, propose done to hand off to independent read-only requery. During READ-ONLY REQUERY, locate and open the saved target, never save again. Never modify unrelated records. ACTION CATALOG: " +
            JSON.stringify(actions) +
            "\nVALUE CATALOG: " +
            JSON.stringify(values) +
            (batch
              ? "\nWhen the current form has multiple independent unfilled inputs, propose 2..4 distinct supplied field assignments together. They must all be valid on this current screen. Do not mix a navigation/save action into a field batch. Each field still gets fresh observation and a separate Decisions choice before execution."
              : ""),
        ),
        reasoning: { effort: "low" },
        max_output_tokens: 1024,
        store: false,
        text: {
          format: {
            type: "json_schema",
            name: "shortlist",
            strict: true,
            schema,
          },
        },
      },
      undefined,
      "planning",
    );
    const text =
      data.output
        ?.flatMap((o: any) => o.content ?? [])
        .filter((c: any) => c.type === "output_text")
        .map((c: any) => c.text)
        .join("") ?? "";
    let plan: any;
    try {
      plan = JSON.parse(text);
    } catch {
      throw new ApiFailure(200, "invalid_shortlist");
    }
    if (
      !Array.isArray(plan.choices) ||
      !plan.choices.length ||
      plan.choices.length > 4 ||
      typeof plan.notes !== "string" ||
      plan.choices.some(
        (c: any) =>
          !actions.some((a) => a.key === c.action) ||
          !Object.hasOwn(values, c.value),
      )
    )
      throw new ApiFailure(200, "invalid_shortlist");
    return plan;
  }
  async assistant(obs: Observation, context: string): Promise<string> {
    const data = await this.request("openai", "assistant", {
      model: "gpt-6.1-sol",
      input: this.input(
        obs,
        context +
          "\nSuggest the next subgoal and which supplied values to use. Do not invent missing task data. Do not execute tools. Return at most 120 words.",
      ),
      reasoning: { effort: "low" },
      max_output_tokens: 1024,
      store: false,
    });
    return (
      data.output
        ?.flatMap((o: any) => o.content ?? [])
        .filter((c: any) => c.type === "output_text")
        .map((c: any) => c.text)
        .join("\n") ?? ""
    );
  }
}
