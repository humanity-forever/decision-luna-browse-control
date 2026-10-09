# Small decisions, explicit browser execution

The API selects from observed action candidates. Selecting an input action is followed by a dependent value-choice request, with only supplied values and skip available. Independent action/readiness judgments share one request. A helper can shortlist actions but cannot type, click, invent field values or read fixture state.

The observer walks frames and open shadow roots, collects currently visible text/control properties, excludes passwords, and rebuilds element IDs on every observation. Text extraction retains direct text around nested icons. Image readiness experiments use raster-only observations without DOM reads. The public full-workflow benchmark currently uses DOM or DOM plus screenshot; raster-only workflows are not presented as implemented.

Normal Playwright actions handle native controls and actionability. Browser load states, DOM stability and network idle cannot certify business readiness by themselves. Bounded native settling uses observable busy state; model judgment remains responsible for task meaning. Read-only saved-state navigation and deterministic server receipts are separate from model completion.

The two reference Jev projects have different ownership. The standalone `jkudish/jev-browser` library owns the navigation loop and can generate typing values. `wy-coliney/jev-browser-use` is a bridge inside a Computer Use runtime, handing complex work back to its supervisor. Their planning cadence, input generation, waiting and stale-state behavior are architectural variables, not isolated model changes. A missing Computer Use runtime must remain an unavailable baseline rather than be replaced silently.

Sources: [standalone Jev](https://github.com/jkudish/jev-browser), [Computer Use bridge](https://github.com/wy-coliney/jev-browser-use), [Decisions](https://developers.openai.com/api/docs/guides/decisions), [load states](https://playwright.dev/docs/api/class-page#page-wait-for-load-state).
