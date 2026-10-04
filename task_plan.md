# Combo price auditor — working plan

## Goal
Build a read-only, open-source library for transparent prediction-market combo price audits. No automated trading or profitability claims. See `PIVOT_PLAN.md` for the full scope and acceptance criteria.

## Current phase
Phase 2 — pure binary price audit (final verification and push).

## Phases

### Phase 0 — plan (complete)
- [x] Write and push `PIVOT_PLAN.md` before moving old code.

### Phase 1 — archive and root reset (complete)
- [x] Move all tracked escrow implementation, SDK, tests, scripts, docs, and old CI under `legacy/conditional-event-escrow/` without deleting them.
- [x] Replace root README; remove the old workflow from active CI. A new workflow is part of Phase 2.
- [x] Check tracked-file preservation, run the legacy contract tests in place, and commit/push.

### Phase 2 — pure binary price audit (in progress)
- [x] Create a typed TypeScript package without wallet/trading dependencies.
- [x] Compute independence benchmark and exact joint-probability bounds for 2–N binary legs.
- [x] Compare an observed combo quote without calling the difference a trading edge; reject invalid inputs and explicit scalar/unknown leg payoffs.
- [x] Add focused tests, typecheck, and run a code review.
- [x] Add new root CI for the package build and tests.
- [ ] Commit/push and confirm CI.

### Phase 3 — read-only market data (pending)
- [ ] Confirm exact public Kalshi combo and leg response fields against live API fixtures.
- [ ] Add narrow adapters with explicit provenance and freshness; no RFQ creation or credentials in the first slice.
- [ ] Test malformed, missing, stale, and unsupported markets.

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
