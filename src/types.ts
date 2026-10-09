export type Provider = "openai" | "typesafe";
export type Model = "luna" | "jev";
export type Mode = "dom" | "screenshot" | "combined";
export type Stage = "pilot" | "evaluation" | "extra";
export interface Condition {
  model: Model;
  mode: Mode;
  assisted: boolean;
  guidance?: "shortlist";
  planCadence?: "batch";
  history: 1 | 8;
  bundled: boolean;
  recovery: 0 | 2;
}
export interface Credentials {
  openai: string;
  typesafe: string;
  secrets?: string[];
}
export interface ElementInfo {
  id: string;
  frame: number;
  selector: string;
  tag: string;
  role: string;
  label: string;
  type: string;
  value: string;
  readOnly?: boolean;
  checked?: boolean;
  enabled?: boolean;
  busy?: boolean;
  placeholder?: string;
  required?: boolean;
  bounds?: { x: number; y: number; width: number; height: number };
  options?: string[];
}
export interface Observation {
  text: string;
  image?: string;
  elements: ElementInfo[];
  hash: string;
  elapsedMs: number;
}
export interface Question {
  name: string;
  instructions: string;
  type: "choice" | "predicate";
  choices?: { value: string; description?: string }[];
}
export interface Answer {
  choice?: string;
  probability?: number;
  confidence?: number;
}
export interface Decision {
  answers: Record<string, Answer>;
  model: string;
  elapsedMs: number;
  cost: number;
  calls: number;
}
export interface Action {
  operation: string;
  target: string;
  value: string;
  fine: string;
  inputStyle?: "literal" | "native_time";
}
export interface ApiStatistic {
  provider: Provider;
  model: string;
  purpose: "decision" | "planning" | "verification" | "typing";
  calls: number;
  retries: number;
  inputTokens: number;
  outputTokens: number;
  usageResponses: number;
  estimatedOrReservedUsd: number;
  pendingRequests: number;
  failedRequests: number;
  transportLatenciesMs: number[];
  logicalRequestLatenciesMs: number[];
}
