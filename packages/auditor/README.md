# Combo price auditor core

Pure TypeScript arithmetic for binary all-win prediction-market combos. It has no network, wallet, RFQ, or trading code.

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
