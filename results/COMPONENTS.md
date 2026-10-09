# Architectural component experiments

Fresh synthetic fixtures measure mechanisms separately from complete workflows. Screenshot readiness observations contain no DOM, but the harness fixes the target and executes a DOM locator afterward; this is not a raster-only full browser workflow. Wrong-target and clock-change cases isolate execution freshness. Mapping keeps the target fixed. A permanent validation blocker must be recognized separately; successful interaction with that fixture is not expected.

| Suite | Scenario | Method | Model | Accepted / samples | Recognized blocker | Median time | Median API calls | Median helper calls |
|---|---|---|---|---:|---:|---:|---:|---:|
| freshness | — | enabled_only | — | 0/3 | 0 | 0.045s | 0 | 0 |
| freshness | — | full_snapshot | — | 3/3 | 0 | 0.005s | 0 | 0 |
| waiting | covered_button | autowait | — | 2/2 | 0 | 1.393s | 0.0 | 0.0 |
| waiting | covered_button | dom_settle | — | 0/2 | 0 | 0.284s | 0.0 | 0.0 |
| waiting | covered_button | domcontentloaded | — | 0/2 | 0 | 0.027s | 0.0 | 0.0 |
| waiting | covered_button | hybrid_dom_luna | — | 2/2 | 0 | 2.644s | 1.0 | 0.0 |
| waiting | covered_button | load | — | 0/2 | 0 | 0.030s | 0.0 | 0.0 |
| waiting | covered_button | model_dom_jev | — | 2/2 | 0 | 3.003s | 2.5 | 0.0 |
| waiting | covered_button | model_dom_luna | — | 2/2 | 0 | 2.843s | 2.5 | 0.0 |
| waiting | covered_button | model_pixels_luna | — | 2/2 | 0 | 2.931s | 2.0 | 0.0 |
| waiting | covered_button | networkidle | — | 0/2 | 0 | 0.533s | 0.0 | 0.0 |
| waiting | covered_button | visible | — | 0/2 | 0 | 0.029s | 0.0 | 0.0 |
| waiting | disabled_iframe | autowait | — | 2/2 | 0 | 1.512s | 0.0 | 0.0 |
| waiting | disabled_iframe | dom_settle | — | 0/2 | 0 | 0.276s | 0.0 | 0.0 |
| waiting | disabled_iframe | domcontentloaded | — | 0/2 | 0 | 0.019s | 0.0 | 0.0 |
| waiting | disabled_iframe | hybrid_dom_luna | — | 2/2 | 0 | 2.693s | 1.0 | 0.0 |
| waiting | disabled_iframe | load | — | 0/2 | 0 | 0.018s | 0.0 | 0.0 |
| waiting | disabled_iframe | model_dom_jev | — | 2/2 | 0 | 3.031s | 2.5 | 0.0 |
| waiting | disabled_iframe | model_dom_luna | — | 2/2 | 0 | 2.945s | 2.5 | 0.0 |
| waiting | disabled_iframe | model_pixels_luna | — | 2/2 | 0 | 3.904s | 2.5 | 0.0 |
| waiting | disabled_iframe | networkidle | — | 0/2 | 0 | 0.505s | 0.0 | 0.0 |
| waiting | disabled_iframe | visible | — | 0/2 | 0 | 0.020s | 0.0 | 0.0 |
| waiting | hydration | autowait | — | 0/1 | 0 | 0.022s | 0 | 0 |
| waiting | hydration | dom_settle | — | 0/1 | 0 | 0.275s | 0 | 0 |
| waiting | hydration | domcontentloaded | — | 0/1 | 0 | 0.021s | 0 | 0 |
| waiting | hydration | hybrid_dom_luna | — | 1/1 | 0 | 1.784s | 1 | 0 |
| waiting | hydration | load | — | 0/1 | 0 | 0.026s | 0 | 0 |
| waiting | hydration | model_dom_jev | — | 1/1 | 0 | 2.214s | 2 | 0 |
| waiting | hydration | model_dom_luna | — | 1/1 | 0 | 2.715s | 2 | 0 |
| waiting | hydration | model_pixels_luna | — | 1/1 | 0 | 2.484s | 2 | 0 |
| waiting | hydration | networkidle | — | 0/1 | 0 | 0.531s | 0 | 0 |
| waiting | hydration | visible | — | 0/1 | 0 | 0.022s | 0 | 0 |
| waiting | late_control | autowait | — | 2/2 | 0 | 1.310s | 0.0 | 0.0 |
| waiting | late_control | dom_settle | — | 0/2 | 0 | 0.272s | 0.0 | 0.0 |
| waiting | late_control | domcontentloaded | — | 0/2 | 0 | 0.015s | 0.0 | 0.0 |
| waiting | late_control | hybrid_dom_luna | — | 2/2 | 0 | 2.323s | 1.0 | 0.0 |
| waiting | late_control | load | — | 0/2 | 0 | 0.015s | 0.0 | 0.0 |
| waiting | late_control | model_dom_jev | — | 2/2 | 0 | 2.728s | 2.5 | 0.0 |
| waiting | late_control | model_dom_luna | — | 2/2 | 0 | 2.875s | 2.5 | 0.0 |
| waiting | late_control | model_pixels_luna | — | 2/2 | 0 | 3.387s | 2.5 | 0.0 |
| waiting | late_control | networkidle | — | 0/2 | 0 | 0.520s | 0.0 | 0.0 |
| waiting | late_control | visible | — | 2/2 | 0 | 1.312s | 0.0 | 0.0 |
| waiting | noisy_network | autowait | — | 0/2 | 0 | 0.020s | 0.0 | 0.0 |
| waiting | noisy_network | dom_settle | — | 0/1 | 0 | 0.278s | 0 | 0 |
| waiting | noisy_network | domcontentloaded | — | 0/1 | 0 | 0.021s | 0 | 0 |
| waiting | noisy_network | hybrid_dom_luna | — | 1/1 | 0 | 1.803s | 1 | 0 |
| waiting | noisy_network | load | — | 0/1 | 0 | 0.026s | 0 | 0 |
| waiting | noisy_network | model_dom_jev | — | 1/1 | 0 | 2.475s | 2 | 0 |
| waiting | noisy_network | model_dom_luna | — | 1/1 | 0 | 2.743s | 2 | 0 |
| waiting | noisy_network | model_pixels_luna | — | 1/1 | 0 | 2.855s | 2 | 0 |
| waiting | noisy_network | networkidle | — | 0/1 | 0 | 5.001s | 0 | 0 |
| waiting | noisy_network | visible | — | 0/1 | 0 | 0.023s | 0 | 0 |
| waiting | validation_blocker | autowait | — | 0/1 | 0 | 0.018s | 0 | 0 |
| waiting | validation_blocker | dom_settle | — | 0/1 | 0 | 0.279s | 0 | 0 |
| waiting | validation_blocker | domcontentloaded | — | 0/1 | 0 | 0.021s | 0 | 0 |
| waiting | validation_blocker | hybrid_dom_luna | — | 0/1 | 1 | 0.991s | 1 | 0 |
| waiting | validation_blocker | load | — | 0/1 | 0 | 0.023s | 0 | 0 |
| waiting | validation_blocker | model_dom_jev | — | 0/1 | 1 | 1.221s | 1 | 0 |
| waiting | validation_blocker | model_dom_luna | — | 0/1 | 1 | 1.218s | 1 | 0 |
| waiting | validation_blocker | model_pixels_luna | — | 0/1 | 1 | 1.335s | 1 | 0 |
| waiting | validation_blocker | networkidle | — | 0/1 | 0 | 0.524s | 0 | 0 |
| waiting | validation_blocker | visible | — | 0/1 | 0 | 0.020s | 0 | 0 |

Component costs and per-call observations are available in [components.json](components.json). Three repetitions with known fixture delays are exploratory; they do not establish application-wide reliability. Budget/runtime failures remain visible in the exported status counts.
