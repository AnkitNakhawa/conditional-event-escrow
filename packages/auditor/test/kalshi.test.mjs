import test from 'node:test';
import assert from 'node:assert/strict';
import { getKalshiComboMetadata, getKalshiComboRulesSnapshot } from '../dist/kalshi.js';

const ticker = 'KXMVE-26OCT04-ABC';
const goodMarket = {
  ticker,
  market_type: 'binary',
  title: 'Team A and Team B win',
  status: 'active',
  updated_time: '2026-10-04T18:00:00Z',
  rules_primary: '',
  rules_secondary: '',
  mve_selected_legs: [
    { event_ticker: 'GAME-A', market_ticker: 'GAME-A-YES', side: 'yes' },
    { event_ticker: 'GAME-B', market_ticker: 'GAME-B-YES', side: 'no' },
  ],
};
const mockFetch = (body, status = 200) => async () => new Response(JSON.stringify(body), { status });
const legMarket = (leg) => ({
  ticker: leg.market_ticker,
  event_ticker: leg.event_ticker,
  market_type: 'binary',
  title: `Outcome for ${leg.market_ticker}`,
  status: 'active',
  updated_time: '2026-10-04T18:00:01Z',
  rules_primary: 'Resolves Yes if the event occurs.',
  rules_secondary: 'May settle at $0.50 if the event is cancelled.',
});

const comboAndLegFetch = (override = {}) => async (url) => {
  const requestedTicker = decodeURIComponent(new URL(url).pathname.split('/').at(-1));
  if (requestedTicker === ticker) return new Response(JSON.stringify({ market: goodMarket }));
  const leg = goodMarket.mve_selected_legs.find(({ market_ticker }) => market_ticker === requestedTicker);
  if (!leg) return new Response('{}', { status: 404 });
  return new Response(JSON.stringify({ market: { ...legMarket(leg), ...override } }));
};

test('reads exact combo composition without fabricating quote or payoff certainty', async () => {
  let requestedUrl;
  const data = await getKalshiComboMetadata(ticker, {
    fetchImpl: async (url) => {
      requestedUrl = url;
      return new Response(JSON.stringify({ market: goodMarket }));
    },
  });
  assert.match(requestedUrl, new RegExp(`${ticker}$`));
  assert.deepEqual(data.selectedLegs.map(({ marketTicker, side }) => [marketTicker, side]), [
    ['GAME-A-YES', 'yes'], ['GAME-B-YES', 'no'],
  ]);
  assert.equal(data.payoffType, 'unverified');
  assert.equal(data.executableQuote, null);
});

test('rejects unsafe ticker and API failures', async () => {
  await assert.rejects(getKalshiComboMetadata('../secret'), /safe, exact/);
  await assert.rejects(getKalshiComboMetadata(ticker, { fetchImpl: mockFetch({}, 404) }), /HTTP 404/);
  await assert.rejects(getKalshiComboMetadata(ticker, { fetchImpl: async () => new Response('{') }), /valid JSON/);
});

test('rejects wrong market identity and non-combos', async () => {
  await assert.rejects(getKalshiComboMetadata(ticker, {
    fetchImpl: mockFetch({ market: { ...goodMarket, ticker: 'OTHER' } }),
  }), /does not match/);
  await assert.rejects(getKalshiComboMetadata(ticker, {
    fetchImpl: mockFetch({ market: { ...goodMarket, mve_selected_legs: [] } }),
  }), /not a supported combo/);
});

test('rejects malformed or duplicate selected legs', async () => {
  await assert.rejects(getKalshiComboMetadata(ticker, {
    fetchImpl: mockFetch({ market: {
      ...goodMarket,
      mve_selected_legs: [goodMarket.mve_selected_legs[0], { ...goodMarket.mve_selected_legs[1], side: 'maybe' }],
    } }),
  }), /leg 1 is malformed/);
  await assert.rejects(getKalshiComboMetadata(ticker, {
    fetchImpl: mockFetch({ market: {
      ...goodMarket,
      mve_selected_legs: [goodMarket.mve_selected_legs[0], goodMarket.mve_selected_legs[0]],
    } }),
  }), /duplicate/);
});

test('reads every leg rule without certifying binary payout or a quote', async () => {
  const requests = [];
  const fetchImpl = comboAndLegFetch();
  const snapshot = await getKalshiComboRulesSnapshot(ticker, {
    fetchImpl: async (url, init) => {
      requests.push(url);
      return fetchImpl(url, init);
    },
  });
  assert.deepEqual(requests.map((url) => new URL(url).pathname.split('/').at(-1)), [
    ticker, 'GAME-A-YES', 'GAME-B-YES',
  ]);
  assert.equal(snapshot.consistency, 'non_atomic');
  assert.ok(!Number.isNaN(Date.parse(snapshot.fetchedAt)));
  assert.equal(snapshot.combo.executableQuote, null);
  assert.equal(snapshot.legs.length, 2);
  assert.equal(snapshot.legs[0].rulesSecondary, 'May settle at $0.50 if the event is cancelled.');
  assert.equal(snapshot.legs[0].payoffType, 'unverified');
  assert.equal(snapshot.legs[1].side, 'no');
});

test('rejects a mismatched leg identity or missing rules', async () => {
  await assert.rejects(getKalshiComboRulesSnapshot(ticker, {
    fetchImpl: comboAndLegFetch({ event_ticker: 'WRONG-EVENT' }),
  }), /malformed or mismatched/);
  await assert.rejects(getKalshiComboRulesSnapshot(ticker, {
    fetchImpl: comboAndLegFetch({ rules_secondary: undefined }),
  }), /malformed or mismatched/);
  await assert.rejects(getKalshiComboRulesSnapshot(ticker, {
    fetchImpl: comboAndLegFetch({ ticker: 'WRONG-MARKET' }),
  }), /does not match/);
});

test('fails the whole lookup when a leg request fails', async () => {
  await assert.rejects(getKalshiComboRulesSnapshot(ticker, {
    fetchImpl: async (url) => url.endsWith('GAME-B-YES')
      ? new Response('{}', { status: 429 })
      : comboAndLegFetch()(url),
  }), /HTTP 429/);
});

test('uses a single signal for the combo and every leg request', async () => {
  const signals = [];
  const fetchImpl = comboAndLegFetch();
  await getKalshiComboRulesSnapshot(ticker, {
    fetchImpl: async (url, init) => {
      signals.push(init.signal);
      return fetchImpl(url, init);
    },
  });
  assert.equal(signals.length, 3);
  assert.ok(signals.every((signal) => signal === signals[0]));
});
