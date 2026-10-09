# Measured browser workflows

These are synthetic, server-backed local web applications operated through real Chromium. Model completion must pass fresh saved-state navigation, visible expected fields and an independent stored-state oracle. Failed predecessors remain separate from downstream tasks that did not start.

| Example | Condition | Successful flows | Unsupported / unavailable | Wilson 95% interval | Median successful time | Estimated total cost |
|---|---|---:|---:|---|---:|---:|
| contacts | jev-combined-solo-native | 0/0 | 3 / 0 | — | — | $0.00000 |
| contacts | jev-combined-solo-poll | 0/0 | 3 / 0 | — | — | $0.00000 |
| contacts | jev-dom-solo-native | 0/3 | 0 / 0 | 0.0%–56.1% | — | $0.01194 |
| contacts | jev-dom-solo-poll | 0/3 | 0 / 0 | 0.0%–56.1% | — | $0.01260 |
| contacts | luna-combined-solo-native | 3/3 | 0 / 0 | 43.9%–100.0% | 39.7s | $0.01768 |
| contacts | luna-combined-solo-poll | 3/3 | 0 / 0 | 43.9%–100.0% | 41.8s | $0.02032 |
| contacts | luna-dom-solo-native | 1/3 | 0 / 0 | 6.1%–79.2% | 32.9s | $0.01370 |
| contacts | luna-dom-solo-poll | 1/3 | 0 / 0 | 6.1%–79.2% | 35.6s | $0.01527 |
| rooms | jev-combined-solo-native | 0/0 | 3 / 0 | — | — | $0.00000 |
| rooms | jev-combined-solo-poll | 0/0 | 3 / 0 | — | — | $0.00000 |
| rooms | jev-dom-solo-native | 0/3 | 0 / 0 | 0.0%–56.1% | — | $0.00759 |
| rooms | jev-dom-solo-poll | 0/3 | 0 / 0 | 0.0%–56.1% | — | $0.01230 |
| rooms | luna-combined-solo-native | 3/3 | 0 / 0 | 43.9%–100.0% | 45.1s | $0.02066 |
| rooms | luna-combined-solo-poll | 3/3 | 0 / 0 | 43.9%–100.0% | 46.9s | $0.02345 |
| rooms | luna-dom-solo-native | 3/3 | 0 / 0 | 43.9%–100.0% | 32.3s | $0.00891 |
| rooms | luna-dom-solo-poll | 3/3 | 0 / 0 | 43.9%–100.0% | 36.1s | $0.01034 |
| support | jev-combined-solo-native | 0/0 | 3 / 0 | — | — | $0.00000 |
| support | jev-combined-solo-poll | 0/0 | 3 / 0 | — | — | $0.00000 |
| support | jev-dom-solo-native | 0/3 | 0 / 0 | 0.0%–56.1% | — | $0.01832 |
| support | jev-dom-solo-poll | 0/3 | 0 / 0 | 0.0%–56.1% | — | $0.01687 |
| support | luna-combined-solo-native | 3/3 | 0 / 0 | 43.9%–100.0% | 42.0s | $0.01772 |
| support | luna-combined-solo-poll | 3/3 | 0 / 0 | 43.9%–100.0% | 42.7s | $0.02037 |
| support | luna-dom-solo-native | 3/3 | 0 / 0 | 43.9%–100.0% | 37.1s | $0.00864 |
| support | luna-dom-solo-poll | 3/3 | 0 / 0 | 43.9%–100.0% | 34.2s | $0.00940 |

## Dispositions and independent checks

Recorded task dispositions: `{'unsupported': 54, 'dependency_failed': 34, 'blocked': 7, 'failed': 15, 'success': 106}`. 128 active operations were audited for changes to two unrelated synthetic records; 0 changes were recorded. 6 operations had the expected persisted state but did not finish verified visible requery; they remain unsuccessful. These are fixture-specific observations, not a safety guarantee for external websites. [Per-operation denominators](operation-summary.json) · [Quality audit](quality-audit.json).

The first contact block overlapped an offline test; an isolated same-source rerun is pending. Current timing summaries are provisional.

Costs use uncached token-rate estimates and conservative unknown-response reservations, not provider invoices. Confidence scores from different models are not comparable. Failed workflows are not described as faster successful automation. Provider unavailability stays outside attempted-trial denominators. Small samples, known fixture distributions and one local VM limit generalization. The original Computer Use bridge remains unavailable when its required runtime is absent.
