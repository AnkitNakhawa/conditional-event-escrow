# Combo price auditor — findings

## Product and evidence

- Kalshi Combos are distinct markets; quotes are provided through RFQs and individual maker quotes are private to the requester and maker. Source: https://help.kalshi.com/en/articles/13823820-combos and https://docs.kalshi.com/getting_started/rfqs
- Some combo legs have fractional/scalar settlement. The first library increment handles binary $0/$1 payoff legs only and must refuse or clearly exclude scalar ones. Source: https://help.kalshi.com/en/articles/13823820-combos
- The fair price of an all-win combo is a joint probability. Multiplying marginals assumes independence; a difference from that benchmark alone is not mispricing.
- Commercial and open-source prior art includes OpticOdds' correlation-aware SGP pricer and `jsteng19/kalshi-combos-research`. Sources: https://developer.opticodds.com/docs/opticodds-for-prediction-market-makers and https://github.com/jsteng19/kalshi-combos-research
- Kalshi exposes public completed trades for historical research, but those are not the same as private executable quotes. Source: https://docs.kalshi.com/api-reference/market/get-trades
- On 2026-10-04, the public `/markets?limit=100&status=open` response included an active binary MVE ticker `KXMVECROSSCATEGORY0-S202695FF5ED0492-FEFABDD43A3` with four `mve_selected_legs`. Exact `GET /markets/{ticker}` returned the same leg mapping, but `yes_bid_dollars` and `yes_ask_dollars` were both `0.0000`. This confirms that public metadata can expose composition while the public book may offer no usable quote. The example ticker is ephemeral and should not be a permanent live-test dependency.
- The new `getKalshiComboMetadata` read-only adapter successfully fetched that exact ticker on 2026-10-04 and returned four legs with `payoffType: unverified` and `executableQuote: null`. A generic `market_type: binary` does not certify that every component pays only $0/$1; leg rules still need examination.

## Pivot decisions

- Preserve all tracked old project files under `legacy/conditional-event-escrow/`; Git history is another recovery path.
- Keep the existing repository URL as requested, even though its slug refers to escrow.
- Start with pure arithmetic and precise labels, then add live-data adapters and historical evaluation. No trade execution path.
