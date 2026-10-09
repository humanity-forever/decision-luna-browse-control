<p align="center"><img src="assets/banner.svg" alt="Decision Luna Browser Lab" width="100%"></p>

<p align="center"><a href="https://github.com/humanity-forever/decision-luna-browse-control/actions/workflows/ci.yml"><img alt="Offline checks" src="https://github.com/humanity-forever/decision-luna-browse-control/actions/workflows/ci.yml/badge.svg"></a> <img alt="Node 22+" src="https://img.shields.io/badge/Node-22%2B-339933"> <img alt="MIT" src="https://img.shields.io/badge/License-MIT-14b8a6"></p>

# Can small decision models finish browser workflows?

A goal stays fixed. The browser supplies fresh evidence. **Luna Decisions or Jev chooses one action**, code executes it, and the loop observes again. This lab measures the result on three synthetic web applications: contact management, meeting-room reservations and support tickets.

The applications run in real Chromium and save state on a local server. Success requires **saving, changing, closing, and reopening** the requested record, plus an independent stored-state check. These controlled examples are a reproducible benchmark, not measurements of commercial websites.

[Measured results](results/RESULTS.md) · [Protocol](docs/PROTOCOL.md) · [Architecture](docs/ARCHITECTURE.md)

## What gets compared

| Factor | Conditions |
|---|---|
| Judgment model | `gpt-6-luna` Decisions / `jev-1.13.0` |
| Grounding | Current DOM / DOM + screenshot |
| Planning | No helper / `gpt-6.1-sol`, reasoning low |
| Waiting | Fresh model polling / bounded native waits + model judgment |
| Input planning | Every-step shortlist / independent field-plan reuse |

Models share the observer, executor, tasks, limits and verifier. Original Jev systems are analyzed separately. Unsupported visual input is recorded explicitly; it is never silently converted with OCR or another model. Confidence values from different providers are not comparable.

```mermaid
flowchart LR
  G[Goal + supplied values] --> O[Fresh browser observation]
  O --> D{Typed Decisions}
  D -- Wait --> O
  D -- One action --> P[Playwright]
  P --> O
  D -- Done --> R[Reload and inspect saved state]
  R --> V[Independent receipt check]
```

Playwright handles visibility, enabled state and click actionability. Page load alone does not prove an application is usable. Optional settling waits for currently visible generic busy signals, with a 1.5-second limit, then retains model judgment. The polling target is one second; API latency extends it. Decisions requests never overlap. [OpenAI Decisions guide](https://developers.openai.com/api/docs/guides/decisions) · [Playwright actionability](https://playwright.dev/docs/actionability).

## Run it

Use Node 22+, Python 3 and FFmpeg. Tests and CI use local browser fixtures without paid calls.

```bash
npm ci
npx playwright install --with-deps chromium
npm test
npm run check
```

Store the two provider keys in a mode-0600 file under a mode-0700 directory, outside the repository. The default is `~/.config/decision-luna-browser-lab/credentials.json`:

```json
{"openai":"YOUR_OPENAI_KEY","typesafe":"YOUR_TYPESAFE_KEY"}
```

Run one small paid example first:

```bash
npm run benchmark -- --paid --repeats 1 --apps contacts \
  --conditions luna-dom-guided-native --allowance 1
```

For a fresh complete study, use a separate runtime directory. The immutable manifest protects completed runs from accidental replay:

```bash
LUNA_RUNTIME=.runtime/study npm run benchmark -- --paid --repeats 3 --allowance 4
npm run report
```

`LUNA_CREDENTIALS` selects an existing private credential file. `LUNA_LEDGER` lets several experiments share one persistent provider ledger. Unknown-response costs remain reserved; helper calls and failed attempts count. Each provider has an independent $100 maximum, while each study also enforces its smaller allowance. Amounts are conservative token-rate estimates, not verified invoices.

## Examples you can inspect

- **Contact Studio:** create a contact, change the phone number, archive it, and reopen the retained record. Controls live in an open shadow root.
- **Room Planner:** create a reservation, change its date and time, cancel it, and reopen it. Native date/time controls live in an iframe.
- **Support Desk:** create a ticket with Normal priority, change it to Urgent, resolve it, and inspect saved status.

Every repetition uses an independent server state. Closed records require an explicit all-records view. The agent receives goals and supplied values, without fixture receipts, internal server responses or scripted navigation paths. The verifier can inspect stored state separately.

## Reading the evidence

Results preserve successful, failed, blocked, unsupported and downstream-not-started outcomes. Pilot amendments are separate from frozen comparisons. We report complete workflow success, Wilson intervals, time, cost, API roles, waits, actions and plan-cache reuse. Small samples and known synthetic application layouts limit generalization.

Recordings contain only synthetic local applications. Demo edits disclose omitted navigation and speed changes. Raw traces and credentials are ignored by Git. Contributions should include a reproducible local example and sanitized evidence. [Contributing](CONTRIBUTING.md) · [MIT license](LICENSE).
