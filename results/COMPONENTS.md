# Architectural component experiments

Fresh synthetic fixtures measure mechanisms separately from complete workflows. Screenshot readiness observations contain no DOM, but the harness fixes the target and executes a DOM locator afterward; this is not a raster-only full browser workflow. Wrong-target and clock-change cases isolate execution freshness. Mapping keeps the target fixed. A permanent validation blocker must be recognized separately; successful interaction with that fixture is not expected.

| Suite | Scenario | Method | Model | Accepted / samples | Recognized blocker | Median time | Median API calls | Median helper calls |
|---|---|---|---|---:|---:|---:|---:|---:|
| freshness | — | enabled_only | — | 0/3 | 0 | 0.045s | 0 | 0 |
| freshness | — | full_snapshot | — | 3/3 | 0 | 0.005s | 0 | 0 |
| freshness_noise | — | enabled_only | — | 3/3 | 0 | 0.031s | 0 | 0 |
| freshness_noise | — | full_snapshot | — | 0/3 | 0 | 0.002s | 0 | 0 |
| helper | — | every_action | jev | 3/3 | 0 | 36.913s | 14 | 7 |
| helper | — | every_action | luna | 3/3 | 0 | 39.512s | 14 | 7 |
| helper | — | handoff | jev | 3/3 | 0 | 18.908s | 10 | 3 |
| helper | — | handoff | luna | 3/3 | 0 | 18.394s | 10 | 3 |
| mapping | — | choice | jev | 3/3 | 0 | 4.718s | 4 | 0 |
| mapping | — | choice | luna | 3/3 | 0 | 4.136s | 4 | 0 |
| mapping | — | generated | jev | 3/3 | 0 | 11.729s | 4 | 0 |
| mapping | — | generated | luna | 3/3 | 0 | 12.652s | 4 | 0 |
| waiting | covered_button | autowait | — | 3/3 | 0 | 1.909s | 0 | 0 |
| waiting | covered_button | dom_settle | — | 0/3 | 0 | 0.284s | 0 | 0 |
| waiting | covered_button | domcontentloaded | — | 0/3 | 0 | 0.028s | 0 | 0 |
| waiting | covered_button | hybrid_dom_luna | — | 3/3 | 0 | 2.908s | 1 | 0 |
| waiting | covered_button | load | — | 0/3 | 0 | 0.030s | 0 | 0 |
| waiting | covered_button | model_dom_jev | — | 3/3 | 0 | 3.409s | 3 | 0 |
| waiting | covered_button | model_dom_luna | — | 3/3 | 0 | 3.349s | 3 | 0 |
| waiting | covered_button | model_pixels_luna | — | 3/3 | 0 | 3.426s | 2 | 0 |
| waiting | covered_button | networkidle | — | 0/3 | 0 | 0.533s | 0 | 0 |
| waiting | covered_button | visible | — | 0/3 | 0 | 0.030s | 0 | 0 |
| waiting | disabled_iframe | autowait | — | 3/3 | 0 | 2.265s | 0 | 0 |
| waiting | disabled_iframe | dom_settle | — | 0/3 | 0 | 0.275s | 0 | 0 |
| waiting | disabled_iframe | domcontentloaded | — | 0/3 | 0 | 0.019s | 0 | 0 |
| waiting | disabled_iframe | hybrid_dom_luna | — | 3/3 | 0 | 3.616s | 1 | 0 |
| waiting | disabled_iframe | load | — | 0/3 | 0 | 0.018s | 0 | 0 |
| waiting | disabled_iframe | model_dom_jev | — | 3/3 | 0 | 3.828s | 3 | 0 |
| waiting | disabled_iframe | model_dom_luna | — | 3/3 | 0 | 3.511s | 3 | 0 |
| waiting | disabled_iframe | model_pixels_luna | — | 3/3 | 0 | 4.220s | 3 | 0 |
| waiting | disabled_iframe | networkidle | — | 0/3 | 0 | 0.503s | 0 | 0 |
| waiting | disabled_iframe | visible | — | 0/3 | 0 | 0.022s | 0 | 0 |
| waiting | hydration | autowait | — | 0/3 | 0 | 0.022s | 0 | 0 |
| waiting | hydration | dom_settle | — | 0/3 | 0 | 0.275s | 0 | 0 |
| waiting | hydration | domcontentloaded | — | 0/3 | 0 | 0.021s | 0 | 0 |
| waiting | hydration | hybrid_dom_luna | — | 3/3 | 0 | 3.373s | 1 | 0 |
| waiting | hydration | load | — | 0/3 | 0 | 0.023s | 0 | 0 |
| waiting | hydration | model_dom_jev | — | 3/3 | 0 | 3.481s | 3 | 0 |
| waiting | hydration | model_dom_luna | — | 3/3 | 0 | 3.511s | 3 | 0 |
| waiting | hydration | model_pixels_luna | — | 3/3 | 0 | 4.336s | 3 | 0 |
| waiting | hydration | networkidle | — | 0/3 | 0 | 0.524s | 0 | 0 |
| waiting | hydration | visible | — | 0/3 | 0 | 0.022s | 0 | 0 |
| waiting | late_control | autowait | — | 3/3 | 0 | 1.812s | 0 | 0 |
| waiting | late_control | dom_settle | — | 0/3 | 0 | 0.273s | 0 | 0 |
| waiting | late_control | domcontentloaded | — | 0/3 | 0 | 0.015s | 0 | 0 |
| waiting | late_control | hybrid_dom_luna | — | 3/3 | 0 | 2.964s | 1 | 0 |
| waiting | late_control | load | — | 0/3 | 0 | 0.015s | 0 | 0 |
| waiting | late_control | model_dom_jev | — | 3/3 | 0 | 3.092s | 3 | 0 |
| waiting | late_control | model_dom_luna | — | 3/3 | 0 | 3.511s | 3 | 0 |
| waiting | late_control | model_pixels_luna | — | 3/3 | 0 | 4.020s | 3 | 0 |
| waiting | late_control | networkidle | — | 0/3 | 0 | 0.520s | 0 | 0 |
| waiting | late_control | visible | — | 3/3 | 0 | 1.813s | 0 | 0 |
| waiting | noisy_network | autowait | — | 0/3 | 0 | 0.020s | 0 | 0 |
| waiting | noisy_network | dom_settle | — | 0/3 | 0 | 0.279s | 0 | 0 |
| waiting | noisy_network | domcontentloaded | — | 0/3 | 0 | 0.020s | 0 | 0 |
| waiting | noisy_network | hybrid_dom_luna | — | 3/3 | 0 | 3.036s | 1 | 0 |
| waiting | noisy_network | load | — | 0/3 | 0 | 0.021s | 0 | 0 |
| waiting | noisy_network | model_dom_jev | — | 3/3 | 0 | 3.558s | 3 | 0 |
| waiting | noisy_network | model_dom_luna | — | 3/3 | 0 | 3.243s | 3 | 0 |
| waiting | noisy_network | model_pixels_luna | — | 3/3 | 0 | 3.884s | 3 | 0 |
| waiting | noisy_network | networkidle | — | 0/3 | 0 | 5.001s | 0 | 0 |
| waiting | noisy_network | visible | — | 0/3 | 0 | 0.023s | 0 | 0 |
| waiting | validation_blocker | autowait | — | 0/3 | 0 | 0.019s | 0 | 0 |
| waiting | validation_blocker | dom_settle | — | 0/3 | 0 | 0.279s | 0 | 0 |
| waiting | validation_blocker | domcontentloaded | — | 0/3 | 0 | 0.021s | 0 | 0 |
| waiting | validation_blocker | hybrid_dom_luna | — | 0/3 | 3 | 1.051s | 1 | 0 |
| waiting | validation_blocker | load | — | 0/3 | 0 | 0.023s | 0 | 0 |
| waiting | validation_blocker | model_dom_jev | — | 0/3 | 3 | 1.288s | 1 | 0 |
| waiting | validation_blocker | model_dom_luna | — | 0/3 | 3 | 1.103s | 1 | 0 |
| waiting | validation_blocker | model_pixels_luna | — | 0/3 | 3 | 1.397s | 1 | 0 |
| waiting | validation_blocker | networkidle | — | 0/3 | 0 | 0.524s | 0 | 0 |
| waiting | validation_blocker | visible | — | 0/3 | 0 | 0.020s | 0 | 0 |

Component costs and per-call observations are available in [components.json](components.json). Three repetitions with known fixture delays are exploratory; they do not establish application-wide reliability. Budget/runtime failures remain visible in the exported status counts.
