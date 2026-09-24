# Progress log

## 2026-09-24
- Confirmed the requested GitHub account is authenticated and `conditional-event-escrow` is not an existing repository.
- Drafted the testnet-only project plan before implementation.
- Created the public repository: https://github.com/AnkitNakhawa/conditional-event-escrow
- Committed and pushed the initial plan (`902990d`).
- Specified a one-escrow, fully funded ETH demo with an explicitly simulated reporter.
- Added contract and test skeleton. First test invocation exposed a Foundry naming rule: `testFailed*` was interpreted as the removed `testFail*` syntax; renamed before rerunning.
- Implemented `DemoEventEscrow` with a chain-ID guard and 13 unit/fuzz tests.
- Code review identified and documented non-production limitations; added cases for post-deadline YES claims, direct-deposit rejection, and NO/timeout conservation.
- Added GitHub Actions checks for formatting, compilation, and 1,000-run fuzz tests on pushes and pull requests.
- First GitHub Actions run completed successfully: https://github.com/AnkitNakhawa/conditional-event-escrow/actions/runs/35961483803
- Added a local trace walkthrough for the YES, NO, and timeout paths.

## 2026-09-24 — local transaction demo
- Started the one-command Anvil demo increment. It will use separate onchain transactions and assert escrow balance/state afterward.
- Corrected an initial CLI assumption: this Cast version uses `wallet derive-private-key`, not `wallet derive`. The demo will use unlocked local Anvil accounts instead of any private keys.
- Implemented `scripts/local-demo.sh` using unlocked Anvil accounts. It starts and stops its own local chain, broadcasts three transactions, and checks receipt status and onchain payout state.
- Ran the local demo twice consecutively to verify the flow and cleanup; both passed.
- Replaced Bash integer comparison with Python's arbitrary-precision integer comparison for ETH-sized balances.
- Added the local smoke command to GitHub Actions; existing contract tests remain unchanged.
- GitHub Actions passed with the new Anvil smoke step: https://github.com/AnkitNakhawa/conditional-event-escrow/actions/runs/35962712637

## 2026-09-24 — library-first pivot
- User chose library functionality before any interface. Updated the roadmap accordingly and specified the first typed SDK API in `docs/library-api.md`.
- The UI is now optional and deferred until after library and outcome-source work.
- Scoped the library as typed contract operations first, followed by read-only Kalshi market metadata; neither step claims to provide verified settlement.

## Test results
| Check | Result |
| --- | --- |
| No tests yet | Planning phase |
| `forge fmt --check` | Pass after formatting |
| `forge test` | 13 passed, 0 failed; 3 fuzz/property tests at 256 runs each |
| `forge test --fuzz-runs 1000` | 13 passed, 0 failed; 3 fuzz/property tests at 1,000 runs each |
| `forge coverage --report summary` | Reported 100% contract lines/statements/branches/functions; tool emitted source-anchor warnings, so treat as a guide rather than a security guarantee |
| `bash -n scripts/local-demo.sh` | Pass |
| `bash scripts/local-demo.sh` twice | Pass both times: deploy 1 ETH, report simulated YES, beneficiary claim, escrow balance 0 |
| `forge test --fuzz-runs 1000` after smoke addition | Pass |

## Commit log
- `902990d` — docs: establish testnet escrow plan.
- `77ffcfb` — docs: specify escrow lifecycle and test matrix.
- `3f5ff8b` — feat: add testnet-only conditional escrow contract.
- `e992b80` — ci: verify contract build and fuzz tests.
- `750135f` — docs: add reproducible local payout walkthrough.
- `3c65c7c` — feat: add one-command local transaction demo.
