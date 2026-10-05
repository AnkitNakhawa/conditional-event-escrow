import test from 'node:test';
import assert from 'node:assert/strict';
import { auditParticipantQuote } from '../dist/quote.js';
import { getKalshiComboRulesSnapshot } from '../dist/kalshi.js';

const selectedLegs = [
  { eventTicker: 'EVENT-A', marketTicker: 'A-YES', side: 'yes' },
  { eventTicker: 'EVENT-B', marketTicker: 'B-NO', side: 'no' },
];
const input = {
  snapshot: {
    combo: { marketTicker: 'COMBO-1', selectedLegs },
    legs: selectedLegs.map((leg) => ({ ...leg, payoffType: 'unverified', rulesPrimary: 'Rule text' })),
    fetchedAt: '2026-10-04T12:00:05Z',
    consistency: 'non_atomic',
  },
  quote: {
    source: 'participant_supplied', marketTicker: 'COMBO-1', action: 'buy_yes',
    pricePerDollar: 0.3, observedAt: '2026-10-04T12:00:10Z',
  },
  estimates: [
    { id: 'B-NO', payoffType: 'binary', side: 'no', yesProbabilityEstimate: 0.5 },
    { id: 'A-YES', payoffType: 'binary', side: 'yes', yesProbabilityEstimate: 0.6 },
  ],
  strictBinaryPayoutAttested: true,
  maxAgeMs: 60_000,
  evaluatedAt: '2026-10-04T12:00:20Z',
};

test('audits a matching caller quote and reports limits on its provenance', () => {
  const result = auditParticipantQuote(input);
  assert.equal(result.audit.independenceBenchmark, 0.3);
  assert.deepEqual(result.audit.selectedLegs.map(({ id }) => id), ['A-YES', 'B-NO']);
  assert.equal(result.quoteAgeMs, 10_000);
  assert.equal(result.snapshotAgeMs, 15_000);
  assert.equal(result.executableQuoteVerified, false);
  assert.equal(result.payoutVerifiedByLibrary, false);
  assert.equal(result.snapshotConsistency, 'non_atomic');
});

test('rejects stale or future-dated observations and malformed timestamps', () => {
  assert.throws(() => auditParticipantQuote({ ...input, maxAgeMs: 9_999 }), /exceeds maxAgeMs/);
  assert.throws(() => auditParticipantQuote({
    ...input, quote: { ...input.quote, observedAt: '2026-10-04T12:00:21Z' },
  }), /future/);
  assert.throws(() => auditParticipantQuote({
    ...input, quote: { ...input.quote, observedAt: 'yesterday' },
  }), /ISO-8601/);
  assert.throws(() => auditParticipantQuote({
    ...input, quote: { ...input.quote, observedAt: '2026-02-30T12:00:00Z' },
  }), /valid timestamp/);
});

test('rejects mismatched quote or estimate identity and side', () => {
  assert.throws(() => auditParticipantQuote({
    ...input, quote: { ...input.quote, marketTicker: 'OTHER' },
  }), /exact combo/);
  assert.throws(() => auditParticipantQuote({
    ...input, estimates: [{ ...input.estimates[0], side: 'yes' }, input.estimates[1]],
  }), /mismatched estimate/);
  assert.throws(() => auditParticipantQuote({
    ...input, snapshot: { ...input.snapshot, legs: [input.snapshot.legs[1], input.snapshot.legs[0]] },
  }), /does not match/);
});

test('requires explicit binary attestation and valid normalized price', () => {
  assert.throws(() => auditParticipantQuote({ ...input, strictBinaryPayoutAttested: false }), /attested/);
  assert.throws(() => auditParticipantQuote({
    ...input, estimates: [{ ...input.estimates[0], payoffType: 'scalar' }, input.estimates[1]],
  }), /payoffType must be binary/);
  assert.throws(() => auditParticipantQuote({
    ...input, quote: { ...input.quote, pricePerDollar: 1.2 },
  }), /observedPrice/);
});

test('connects a fetched rules snapshot to the pure participant quote audit', async () => {
  const markets = new Map([
    ['COMBO-1', {
      ticker: 'COMBO-1', market_type: 'binary', title: 'A and not B', status: 'active',
      rules_primary: 'Combo rule', rules_secondary: '',
      mve_selected_legs: selectedLegs.map((leg) => ({
        event_ticker: leg.eventTicker, market_ticker: leg.marketTicker, side: leg.side,
      })),
    }],
    ...selectedLegs.map((leg) => [leg.marketTicker, {
      ticker: leg.marketTicker, event_ticker: leg.eventTicker, market_type: 'binary',
      title: leg.marketTicker, status: 'active', rules_primary: 'Rule', rules_secondary: '',
    }]),
  ]);
  const snapshot = await getKalshiComboRulesSnapshot('COMBO-1', {
    fetchImpl: async (url) => new Response(JSON.stringify({
      market: markets.get(decodeURIComponent(new URL(url).pathname.split('/').at(-1))),
    })),
  });
  const result = auditParticipantQuote({
    ...input,
    snapshot,
    quote: { ...input.quote, observedAt: snapshot.fetchedAt },
    evaluatedAt: snapshot.fetchedAt,
  });
  assert.equal(result.audit.independenceBenchmark, 0.3);
  assert.equal(result.quoteAgeMs, 0);
  assert.equal(result.snapshotAgeMs, 0);
});
