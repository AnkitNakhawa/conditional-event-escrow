# Pivot plan: prediction-market combo price auditor

## Goal

Turn this existing public repository into a read-only, open-source library for auditing the price of prediction-market combos/parlays. Preserve the entire escrow prototype under `legacy/conditional-event-escrow/`; keep its testnet-only warnings. Retain the repository URL as requested, even though its slug reflects the old idea.

The first useful output is **an explanation, not a trade recommendation**: given binary leg probability estimates and an observed combo quote, show the independence benchmark, mathematically valid joint-probability bounds, and how far the quote is from those reference points. A quote away from the independence benchmark is not proof of mispricing.

## Increments (commit and push each after checks)

1. **Plan first:** commit this document before moving code or changing CI.
2. **Archive old work:** move escrow contracts, SDK, tests, docs, scripts, configuration, and history notes into `legacy/conditional-event-escrow/`; replace the root README and CI so no old deployment path is presented as the active product. Verify tracked files were preserved.
3. **Pure audit core:** create a small typed TypeScript package with no wallet, order, or trading APIs. Compute independence product and exact Fréchet bounds for 2–N binary legs; compare a quoted price to those numbers with clear labels. Validate finite probabilities and quote price in [0, 1]; test core math, perfect/nested and mutually exclusive examples, invalid values, and no false "arbitrage" claim.
4. **Market-data adapter (next increment):** read only public Kalshi market/combo metadata for exact IDs, preserve leg side and settlement rules, surface missing/stale data explicitly. Do not submit RFQs or use credentials in the first slice.
5. **Historical validation:** assemble reproducible timestamped combo-trade/leg-price/outcome fixtures for one narrow market family. Avoid lookahead, split by event/game, report calibration and uncertainty, and distinguish retrospective price gaps from executable net edge after fees/spread/size.
6. **Go/no-go:** continue only if the tool reliably explains real quotes better than simple baselines and users find the audit useful. Do not market a profitable strategy without out-of-sample and executable evidence.

## Constraints and known competition

- Kalshi already offers combo markets and live RFQs. Individual maker quotes are private to their participants, so public market data alone cannot power a complete live quote scanner. [Kalshi RFQ docs](https://docs.kalshi.com/getting_started/rfqs)
- Correlation-aware pricing is offered commercially by [OpticOdds](https://developer.opticodds.com/docs/opticodds-for-prediction-market-makers), and [open-source Kalshi combo research](https://github.com/jsteng19/kalshi-combos-research) already exists. Our initial wedge is transparent, reproducible quote auditing—not claiming a new pricing moat.
- Some combos can settle to fractional values. The pure binary formula must be labeled as inapplicable to scalar legs until we explicitly model their payoff ranges. [Kalshi Combos guide](https://help.kalshi.com/en/articles/13823820-combos)

## Acceptance for this turn

- Pivot plan is committed/pushed before code movement.
- Previous tracked project remains recoverable in a labeled legacy folder and from Git history.
- New root package has focused passing tests and CI; no live trading capability or profitability claim.
- A review of the first feature identifies any substantive correctness issues before the final commit.

## Errors

| Error | Resolution |
| --- | --- |
| Initial CI read used nonexistent `contract-tests.yml` path | Listed tracked files and read actual `.github/workflows/test.yml`; use file discovery before opening a guessed path. |
