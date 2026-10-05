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

## Participant-supplied quote audit

`@combo-price-auditor/core/quote` exports `auditParticipantQuote`. It accepts a rules snapshot, a **caller-supplied** buy-YES quote, and one probability estimate per selected leg. It checks exact market IDs/sides, rejects an old or future-dated quote or snapshot using your `maxAgeMs`, then runs the binary audit. The quote price must already be normalized to a cost per $1 maximum payout before fees; this library does not parse raw Kalshi RFQ payloads or verify that the quote is still available.

```ts
import { auditParticipantQuote } from '@combo-price-auditor/core/quote';

const result = auditParticipantQuote({
  snapshot, // from getKalshiComboRulesSnapshot(...)
  quote: {
    source: 'participant_supplied',
    marketTicker: snapshot.combo.marketTicker,
    action: 'buy_yes',
    pricePerDollar: 0.30,
    observedAt: '2026-10-04T12:00:10Z',
  },
  estimates: [
    { id: 'LEG-A', side: 'yes', payoffType: 'binary', yesProbabilityEstimate: 0.6 },
    { id: 'LEG-B', side: 'no', payoffType: 'binary', yesProbabilityEstimate: 0.5 },
  ],
  strictBinaryPayoutAttested: true,
  maxAgeMs: 60_000,
});
```

The example leg IDs must be replaced with exact tickers and sides from the snapshot. `strictBinaryPayoutAttested: true` is your assertion after reviewing the combo **and every leg's** rules, not a library certification. In particular, do not assert it for markets whose rules permit fractional settlement. A quote within the age limit may still have expired or been withdrawn. The result always says `executableQuoteVerified: false` and `payoutVerifiedByLibrary: false`; fees, size, spread, and quote/metadata synchronization are not verified. This is an explanation, not a trading signal.
