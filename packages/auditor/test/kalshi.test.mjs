import test from 'node:test';
import assert from 'node:assert/strict';
import { getKalshiComboMetadata } from '../dist/kalshi.js';

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
