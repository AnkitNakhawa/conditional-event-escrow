# Combo price auditor — working plan

## Goal
Build a read-only, open-source library for transparent prediction-market combo price audits. No automated trading or profitability claims. See `PIVOT_PLAN.md` for the full scope and acceptance criteria.

## Current phase
Phase 3 — read-only Kalshi market metadata and rules.

## Phases

### Phase 0 — plan (complete)
- [x] Write and push `PIVOT_PLAN.md` before moving old code.

### Phase 1 — archive and root reset (complete)
- [x] Move all tracked escrow implementation, SDK, tests, scripts, docs, and old CI under `legacy/conditional-event-escrow/` without deleting them.
- [x] Replace root README; remove the old workflow from active CI. A new workflow is part of Phase 2.
- [x] Check tracked-file preservation, run the legacy contract tests in place, and commit/push.

### Phase 2 — pure binary price audit (complete)
- [x] Create a typed TypeScript package without wallet/trading dependencies.
- [x] Compute independence benchmark and exact joint-probability bounds for 2–N binary legs.
- [x] Compare an observed combo quote without calling the difference a trading edge; reject invalid inputs and explicit scalar/unknown leg payoffs.
- [x] Add focused tests, typecheck, and run a code review.
- [x] Add new root CI for the package build and tests.
- [x] Commit/push and confirm CI.

### Phase 3 — read-only market data (in progress)
- [x] Confirm exact public Kalshi combo composition fields against a live exact-ticker response; note zero public bid/ask is not an RFQ quote.
- [x] Add a narrow exact-ticker, read-only combo metadata adapter that marks payoff type unverified and executable quote unavailable.
- [x] Test valid, malformed, missing, unsupported, and HTTP-failure responses with mocked fetch; live-smoke one current combo.
- [x] Read each leg's public primary/secondary rules and market identity, without inferring binary-only payout semantics.
- [ ] Add snapshot/freshness metadata and a quote-input path for participant-owned RFQs; no RFQ creation or order submission.

### Phase 4 — historical validation (pending)
- [ ] Use one market family, timestamped combo trades, contemporaneous leg prices, and final outcomes.
- [ ] Compare simple benchmarks out-of-sample, splitting by event/game to avoid leakage.
- [ ] Report calibration, uncertainty, fees, spread, size, and data-access limits; decide whether deeper modeling is worthwhile.

## Errors

| Error | Resolution |
| --- | --- |
| Guessed old workflow filename `contract-tests.yml` | Listed tracked paths and used `.github/workflows/test.yml`. |
| Initial progress/README patch failed because the README line was longer than expected | Read exact file and reapplied with precise context. |
| Archived SDK `tsc` stalled for more than two minutes in the moved folder | Stopped the optional legacy SDK check; unchanged legacy contract tests and the active new package tests passed. Recheck in clean CI or isolated copy if legacy maintenance resumes. |
| New async adapter test used `assert.throws` and produced an unhandled rejection | Use `assert.rejects` for the async function, then rerun the suite. |
