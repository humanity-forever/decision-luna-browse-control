# Recorded API roles

Every paid call is metered, including planning, typing, retries and uncertain requests. Transport latency measures the network request; logical latency also includes local accounting and retries. Costs are conservative token-rate estimates with unresolved reservations, not invoiced charges. Study rows are separate; the original contact block and isolated recheck are both shown here for accounting, rather than counted twice in primary accuracy comparisons.

| Study | Provider / model | Purpose | Calls | Retries | Input / output tokens | Median transport | Median logical request | Estimated / reserved cost |
|---|---|---|---:|---:|---:|---:|---:|---:|
| architecture-study | openai / gpt-6-luna | decision | 48 | 0 | 38374 / 0 | 359ms | 946ms | $0.00384 |
| architecture-study | typesafe / jev-1.13.0 | decision | 20 | 0 | 10599 / 780 | 241ms | 809ms | $0.00045 |
| helper-study | openai / gpt-6-luna | decision | 389 | 0 | 458304 / 0 | 294ms | 833ms | $0.04583 |
| helper-study | openai / gpt-6.1-sol | planning | 506 | 0 | 585919 / 22908 | 3301ms | 3856ms | $1.40092 |
| helper-study | typesafe / jev-1.13.0 | decision | 209 | 0 | 241848 / 14771 | 279ms | 879ms | $0.01016 |
| native-study | openai / gpt-6.1-sol | typing | 21 | 0 | 2682 / 168 | 2279ms | 2819ms | $0.00704 |
| native-study | typesafe / jev-1.13.0 | decision | 111 | 0 | 92781 / 12906 | 230ms | 780ms | $0.00390 |
| study | openai / gpt-6-luna | decision | 1245 | 0 | 1864683 / 0 | 324ms | 840ms | $0.18647 |
| study | typesafe / jev-1.13.0 | decision | 1561 | 0 | 1762272 / 132614 | 232ms | 677ms | $0.07962 |

These are sums of recorded experiment rows. Interrupted work with no completed row remains in the persistent project ledger and is not claimed to be included in this per-study table.
