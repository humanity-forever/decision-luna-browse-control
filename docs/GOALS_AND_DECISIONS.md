# A goal stays fixed; choices come from the current screen

The goal describes the desired stored result. It is not a list of navigation steps. The runner supplies structured values and status alongside a short instruction, then rebuilds action candidates from each observation.

A Room Planner creation goal looks like this:

```json
{
  "operation": "create",
  "goal": "Create exactly one new record with the supplied initial fields. Save it. Do not edit unrelated records.",
  "expected": {
    "Title": "Demo rooms 0",
    "Room": "Studio A",
    "Date": "2026-11-12",
    "Start time": "10:00"
  },
  "status": "Booked",
  "values": {
    "none": "",
    "Title": "Demo rooms 0",
    "Room": "Studio A",
    "Date": "2026-11-12",
    "Start time": "10:00"
  }
}
```

`src/runner.ts` generates these goals for the three applications. The current CLI runs those reproducible benchmark examples; it does not accept an arbitrary external website as an authorized benchmark target.

## One observation, one physical action

The observer collects currently available controls with labels, rendered values, enabled/read-only/busy state and frame IDs. Candidate IDs are local to that observation. Input candidates exclude disabled, read-only and busy fields. Wait, done and stop remain explicit choices.

The metered `Api.decide()` wrapper submits an OpenAI request shaped as follows. This small example illustrates the protocol; production candidates are generated from the current controls rather than hard-coded.

```json
{
  "model": "gpt-6-luna",
  "input": [{
    "role": "user",
    "content": [{
      "type": "input_text",
      "text": "Goal and supplied values, recent action results, current visible text and control properties"
    }]
  }],
  "questions": [{
    "name": "action",
    "type": "choice",
    "instructions": "Choose one next action from the current controls.",
    "choices": [
      {"value": "a0", "description": "type e0_1 Title; current="},
      {"value": "a1", "description": "wait"},
      {"value": "a2", "description": "Done: hand off to saved-state requery."}
    ]
  }, {
    "name": "readiness",
    "type": "choice",
    "instructions": "Is the current screen ready for the next task action?",
    "choices": [
      {"value": "ready", "description": "Current controls are ready."},
      {"value": "wait", "description": "Wait for usable controls."}
    ]
  }]
}
```

If readiness says wait, it vetoes input. If the chosen action is type/select, a second, dependent choice selects a supplied value for that specific field; skip is available. The executor then performs one normal Playwright action. The next decision uses a fresh observation and the result of that action. No fixed five-second sleep is inserted. Sampling targets one second, with serial API latency extending the interval.

Bounded native waiting helps with load events and observable busy signals. Playwright still performs its normal actionability checks. Neither mechanism alone certifies application acceptance, so model readiness remains in the loop. Frames and open shadow roots are traversed by the shared observer; a main-page load event is not a substitute for observing the frame containing the control.

## Completion and optional planning

Done hands control to reload, locate and reopen the saved record. Mutation controls are excluded during that phase. Visible expected fields/status, a stored-state oracle, unique target and unchanged unrelated records are all required for a successful result. A plausible done response or correctly filled unsaved form is insufficient.

The optional helper returns a closed-schema shortlist using observed action IDs and supplied value keys. It cannot manipulate the browser. Independent field-plan reuse may retain assignments across an unchanged form, but every target is rematched and navigation, unexpected values, structural changes or execution errors discard the plan.

See the [actual loop](../src/runner.ts), [provider normalization and accounting](../src/api.ts), [browser executor](../src/browser.ts), and [OpenAI Decisions guide](https://developers.openai.com/api/docs/guides/decisions).
