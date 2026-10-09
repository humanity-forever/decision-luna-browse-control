import type { Observation, Action } from "./types.js";
import { sameInputValue } from "./inputValue.js";
type Candidate = { action: Action; description: string };
type Entry = {
  tag: string;
  label: string;
  type: string;
  frame: number;
  operation: string;
  value: string;
};
export class FieldBatch {
  private entries: Entry[] = [];
  private signature = "";
  private original: string[] = [];
  private allowed: Entry[] = [];
  private structure(obs: Observation): string {
    return JSON.stringify(
      obs.elements
        .filter((e) => ["input", "select", "textarea"].includes(e.tag))
        .map((e) => [
          e.tag,
          e.label,
          e.type,
          e.frame,
          e.enabled,
          e.readOnly,
          e.busy,
          e.bounds,
          e.options,
        ]),
    );
  }
  seed(
    obs: Observation,
    recommendations: { candidate: Candidate; value: string }[],
  ): void {
    this.signature = this.structure(obs);
    this.original = obs.elements
      .filter((e) => ["input", "select", "textarea"].includes(e.tag))
      .map((e) => e.value);
    this.entries = recommendations
      .filter(
        (r) =>
          ["type", "select"].includes(r.candidate.action.operation) &&
          r.value !== "none",
      )
      .flatMap((r) => {
        const e = obs.elements.find((e) => e.id === r.candidate.action.target);
        return e
          ? [
              {
                tag: e.tag,
                label: e.label,
                type: e.type,
                frame: e.frame,
                operation: r.candidate.action.operation,
                value: r.value,
              },
            ]
          : [];
      });
    this.allowed = [...this.entries];
  }
  take(
    obs: Observation,
    catalog: Candidate[],
    values: Record<string, string>,
  ): { candidate: Candidate; value: string }[] {
    const fields = obs.elements.filter((e) =>
      ["input", "select", "textarea"].includes(e.tag),
    );
    const valuesUnchanged = fields.every((e, i) => {
      const planned = this.allowed.find(
        (x) =>
          x.tag === e.tag &&
          x.label === e.label &&
          x.type === e.type &&
          x.frame === e.frame,
      );
      return (
        e.value === this.original[i] ||
        (planned &&
          Object.hasOwn(values, planned.value) &&
          sameInputValue(e.value, values[planned.value], e.label, e.type))
      );
    });
    if (this.signature !== this.structure(obs) || !valuesUnchanged) {
      this.entries = [];
      return [];
    }
    return this.entries.flatMap((entry) => {
      const matches = obs.elements.filter(
        (e) =>
          e.tag === entry.tag &&
          e.label === entry.label &&
          e.type === entry.type &&
          e.frame === entry.frame &&
          e.enabled !== false &&
          !e.busy &&
          !e.readOnly,
      );
      if (matches.length !== 1 || !Object.hasOwn(values, entry.value))
        return [];
      const c = catalog.find(
        (c) =>
          c.action.target === matches[0].id &&
          c.action.operation === entry.operation,
      );
      return c ? [{ candidate: c, value: entry.value }] : [];
    });
  }
  consumed(target: string, obs: Observation): void {
    const e = obs.elements.find((e) => e.id === target);
    if (e)
      this.entries = this.entries.filter(
        (x) =>
          !(
            x.tag === e.tag &&
            x.label === e.label &&
            x.type === e.type &&
            x.frame === e.frame
          ),
      );
  }
  clear(): void {
    this.entries = [];
  }
}
