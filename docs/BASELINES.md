# Reference systems and isolated mechanisms

Pinned source revisions: standalone `e04be30575de055e7d99b2505d35a228cf190722`, bridge `cf7e76607d4ec70592b24becadd0296dcda8177a`. Code comparison is separate from measured workflow outcomes.

| Dimension | jkudish/jev-browser | wy-coliney/jev-browser-use | Why it matters for browser workflows |
|---|---|---|---|
| Ownership | Standalone Playwright library, CLI and MCP; code owns the full navigation loop | A bridge inside Codex's existing Computer Use runtime; Codex remains the supervisor | Different runtime and supervisor costs confound a direct model comparison |
| Observation | Custom DOM extraction, a visible text excerpt, element descriptions and history; Jev sees text | Full indexed accessibility snapshots; Jev sees text, while Codex handles visual judgments | DOM coverage, naming and ambiguous controls affect available actions |
| Text input | A separate configured generative model writes the text; search may fall back to a keyword heuristic; native select uses a second Jev choice | The bridge has no text-entry operation; Codex supplies and enters text, then resumes the session | Form workflows have many inputs: errors, extra calls and handoff latency may dominate navigation |
| Large-model cadence | Input generation is conditional, rather than a planning call for every navigation step | Mechanical actions run in chunks; unsupported inputs, images, errors and verification return to Codex | Our main assisted condition calls a planner every cycle; it does not reproduce selective handoff |
| Questions | One primary action choice plus independent goal and stuck judgments; select adds another request | One next-action choice including DONE, BLOCKED and WAIT | Question count and stop semantics affect cost and premature stopping; bundled versus split questions are a protocol factor; their full-workflow effect is not yet established |
| Synchronization | After actions: DOMContentLoaded and a bounded DOM-stability heuristic, using text length and native-control count | Re-read the AX state after the API response and reject it if changed; separate deterministic `waitForState` polls without API calls | Load events, mechanical actionability and application readiness are distinct; unchanged text length is a weak stability signal |
| Recovery | Repeat/no-effect actions can use the next-best choice; goal/stuck watchers use 0.85; no universal low-confidence handback | Low-confidence handback (default 0.55), no-progress/error handback, three WAIT decisions before loading handback; persistent sessions preserve history | Recovery quality and host intervention can explain speed/success differences; raw confidences are not interchangeable across models |
| Coverage gaps | The inspected extractor uses the main document; no generic iframe/open-shadow traversal in that extraction path | The bridge explicitly hands frames, native select and other unsupported widgets back to Codex | A complete system can work where its small-model loop alone cannot |
| Completion | Native done/goal watcher is a proposal | DONE becomes `needs_verification` for Codex | Both still need independent saved-state verification |


The component study isolates waiting, helper cadence, supplied-value mapping and stale-state rejection. The standalone library runs as a separate complete system. Its typing model is configured as gpt-6.1-sol low with a 1024-token cap, a disclosed change from the package default. The required native Computer Use runtime is unavailable, so the bridge is not represented as an executed benchmark.

Sources: [standalone loop](https://github.com/jkudish/jev-browser/blob/e04be30575de055e7d99b2505d35a228cf190722/src/navigate.ts), [DOM extraction](https://github.com/jkudish/jev-browser/blob/e04be30575de055e7d99b2505d35a228cf190722/src/lib.ts), [bridge](https://github.com/wy-coliney/jev-browser-use/blob/cf7e76607d4ec70592b24becadd0296dcda8177a/skills/jev-browser-use/bridge.mjs).
