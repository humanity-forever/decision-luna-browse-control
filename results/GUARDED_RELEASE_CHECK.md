# Guarded Release Check

This study stays separate from the frozen three-repetition direct-model comparison. The helper follow-up targets one repetition per application and condition; it must not be pooled with the primary study. Pilot amendments and native-system changes are not isolated model effects.

| Workflow | All three verified | Recorded time | Estimated cost | API calls | Cache hits | Statuses |
|---|---|---:|---:|---:|---:|---|
| b0-contacts-luna-combined-solo-native | True | 44.2s | $0.00589 | 27 | 0 | {'success': 3} |
| b0-rooms-luna-combined-solo-native | True | 51.1s | $0.00681 | 30 | 0 | {'success': 3} |
| b0-support-luna-combined-solo-native | True | 45.1s | $0.00591 | 27 | 0 | {'success': 3} |

This revised release check used controller `4334258`, one repetition per application, after the control/subject guards were added. Its three flows stay separate from historical source `a06ddd7`; no primary trial is reused.
