# Combo price auditor core

Pure TypeScript arithmetic for binary all-win prediction-market combos, plus a separate read-only Kalshi metadata/rules lookup. The arithmetic core has no network dependency; the package has no wallet, RFQ, or trading code.

```ts
import { auditBinaryCombo } from '@combo-price-auditor/core';

const audit = auditBinaryCombo({
  legs: [
    { id: 'A', payoffType: 'binary', side: 'yes', yesProbabilityEstimate: 0.6 },
    { id: 'B', payoffType: 'binary', side: 'no', yesProbabilityEstimate: 0.5 },
  ],
  observedPrice: 0.4,
});
```

`yesProbabilityEstimate` is your estimate that a market's YES pays $1, **not automatically the displayed exchange price**. The function converts NO to `1 - yesProbabilityEstimate`, computes the independence product and exact Fréchet bounds for the intersection, and compares the observed combo price with those reference points. A quote different from the product, or even outside bounds derived from *your estimates*, is not proof of arbitrage or expected profit. Fees, spread, liquidity, timing, and model error are not included.

The `payoffType: 'binary'` declaration is required for every leg and rejects explicit scalar/unknown types. The caller must still verify that both the legs and the combo pay exactly $0 or $1: this pure function cannot inspect market rules. Kalshi combos can have scalar/partial settlement; those are outside this API's scope. The input `observedPrice` is a normalized pre-fee cost per $1 max payoff; a later venue adapter must explain exactly how it derives that cost from a live quote.

Run `npm ci --prefix packages/auditor` and `npm test --prefix packages/auditor` from the repository root.

## Read-only Kalshi metadata

`@combo-price-auditor/core/kalshi` exports `getKalshiComboMetadata(ticker)`. It reads the public exact-ticker market API and returns the selected leg tickers/sides and descriptive market fields. It returns `payoffType: 'unverified'` and `executableQuote: null` deliberately: the market's `binary` type does not establish that all leg settlements are strictly binary, and private RFQ quotes are not exposed by this public lookup. Verify each leg's rules before supplying `payoffType: 'binary'` to the arithmetic core. A public bid/ask of zero is not a free combo or a usable quote.

`getKalshiComboRulesSnapshot(ticker)` additionally fetches each selected leg's exact public market page and returns its title, status, raw market type, primary/secondary rules, and update time. Every leg remains `payoffType: 'unverified'`; this is a rules-inspection aid, not a payout classifier. The returned `fetchedAt` is when the client finished reading the data, not an exchange timestamp or quote freshness guarantee. `consistency: 'non_atomic'` means the combo and legs came from separate requests; if a leg is missing or malformed, the entire lookup fails. The function never requests RFQs or submits orders.
