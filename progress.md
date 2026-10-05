# Combo price auditor — progress

## 2026-10-04
- Committed and pushed the pivot plan as `9a7ffe7` before moving code.
- Moved the tracked escrow project toward `legacy/conditional-event-escrow/`; replacing root docs and CI next. No tracked escrow source has been deleted.
- Preserved all tracked escrow files under `legacy/conditional-event-escrow/` and moved its former CI out of the active GitHub workflow directory. Replaced root README and planning files for the new project. `forge test -q` passed from the archived project.
- Created `packages/auditor` as a pure TypeScript library, with no runtime dependencies or network/trading path. Five focused tests and the typechecked build pass. A code-review pass tightened explicit binary-payoff validation, whitespace identity handling, and large-input bound calculation.
- Added a new root GitHub Actions workflow for package build/tests and documented the package in the active README.
- Optional archived SDK verification stalled during `tsc` after more than two minutes and was stopped. This matches prior local filesystem stalls; the archived Solidity tests passed, and the new active package tests passed. No conclusion about archived SDK test status from this run.
- Committed and pushed the pure audit core as `41d196f`; GitHub Actions run https://github.com/AnkitNakhawa/conditional-event-escrow/actions/runs/37225140259 succeeded on a clean checkout. Phase 2 is complete.
- Live-checked a current Kalshi combo: exact-ticker API data includes selected legs, but its displayed bid/ask were zero. The adapter will expose composition only, not invent an executable RFQ quote.
- Added `getKalshiComboMetadata` as a separate package export. Nine active tests and the TypeScript build pass; a live read returned four selected legs and no invented executable quote. Reviewed identity, malformed response, payout certainty, and RFQ privacy boundaries.
- Added `getKalshiComboRulesSnapshot`: exact public market reads for each selected leg, preserving rules/status/update metadata while leaving payout shape unverified and marking the snapshot non-atomic. A live four-leg read succeeded. Code review caught per-request timeout accumulation; the whole lookup now shares one default 10-second deadline. No RFQ or trading integration was added.
- Added a pure participant-supplied quote audit path with exact combo/leg/side matching, explicit strict-binary attestation, timestamp-age limits for quote and snapshot, and clear non-executability labels. Code review tightened calendar-date validation after confirming JavaScript normalized February 30, then added an end-to-end adapter-to-audit seam test. All 18 active tests and the TypeScript build pass. The path neither fetches RFQs nor places orders.
