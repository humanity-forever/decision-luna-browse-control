import type { Action, Answer } from "./types.js";

// A one-second sampling target, not a promise of one-second API latency.
export const OBSERVATION_INTERVAL_MS = 1000;
export function samplingDelay(observedAt: number, now: number): number {
  return Math.max(0, observedAt + OBSERVATION_INTERVAL_MS - now);
}
export function readinessAction(
  action: Action,
  readiness: Answer | undefined,
): Action {
  return readiness?.choice === "wait"
    ? { operation: "wait", target: "none", value: "none", fine: "f0" }
    : action;
}
export function unchangedAttempts(
  previous: number,
  unchanged: boolean,
  operation: string,
): number {
  // Loading does not become a failed interaction just because it lasts four ticks.
  return operation === "wait" ? 0 : unchanged ? previous + 1 : 0;
}
