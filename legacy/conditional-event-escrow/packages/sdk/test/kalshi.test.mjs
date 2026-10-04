import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getKalshiMarket, getKalshiSettlementCandidate } from '../dist/kalshi.js';

const ticker = 'KXCOPPERW-26JUL2417-T6.29';
const market = {
  ticker,
  market_type: 'binary',
  title: 'Will copper close above $6.29?',
  rules_primary: 'Use the specified closing price.',
  rules_secondary: 'Round to two decimals.',
  status: 'finalized',
  result: 'yes',
};
const respond = (body, status = 200) => async () =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('fetches one exact market and returns read-only descriptive fields', async () => {
  let requestedUrl;
  let requestedSignal;
  const fetcher = async (url, options) => {
    requestedUrl = url;
    requestedSignal = options.signal;
    return new Response(JSON.stringify({ market }));
  };
  const result = await getKalshiMarket(ticker, { fetcher });
  assert.equal(requestedUrl, `https://external-api.kalshi.com/trade-api/v2/markets/${ticker}`);
  assert.ok(requestedSignal instanceof AbortSignal);
  assert.deepEqual(result, {
    ticker,
    title: market.title,
    rulesPrimary: market.rules_primary,
    rulesSecondary: market.rules_secondary,
    status: 'finalized',
    reportedResult: 'yes',
  });
});

test('rejects invalid ticker before making a request', async () => {
  let called = false;
  const fetcher = async () => { called = true; throw new Error('unexpected request'); };
  await assert.rejects(getKalshiMarket('../markets', { fetcher }), /Invalid Kalshi market ticker/);
  assert.equal(called, false);
});

test('surfaces missing market and other HTTP failures', async () => {
  await assert.rejects(getKalshiMarket(ticker, { fetcher: respond({}, 404) }), /HTTP 404/);
  await assert.rejects(getKalshiMarket(ticker, { fetcher: respond({}, 503) }), /HTTP 503/);
});

test('rejects mismatched, unsupported, or malformed API responses', async () => {
  await assert.rejects(getKalshiMarket(ticker, { fetcher: respond({ market: { ...market, ticker: 'OTHER' } }) }), /different market ticker/);
  await assert.rejects(getKalshiMarket(ticker, { fetcher: respond({ market: { ...market, market_type: 'scalar' } }) }), /Only binary/);
  await assert.rejects(getKalshiMarket(ticker, { fetcher: respond({ market: { ...market, rules_primary: '' } }) }), /rules_primary/);
  await assert.rejects(getKalshiMarket(ticker, { fetcher: respond({}) }), /Invalid Kalshi market response/);
});

test('preserves unknown status and does not invent a result', async () => {
  const result = await getKalshiMarket(ticker, { fetcher: respond({ market: { ...market, status: 'open', result: '' } }) });
  assert.equal(result.status, 'open');
  assert.equal(result.reportedResult, null);
});

test('classifies finalized YES and NO as unverified settlement candidates', async () => {
  for (const reportedOutcome of ['yes', 'no']) {
    const candidate = await getKalshiSettlementCandidate(ticker, {
      fetcher: respond({ market: { ...market, result: reportedOutcome } }),
    });
    assert.equal(candidate.kind, 'candidate');
    assert.equal(candidate.reportedOutcome, reportedOutcome);
    assert.equal(candidate.market.ticker, ticker);
    assert.equal(candidate.verifiedOnchain, false);
  }
});

test('does not accept a result before finalization', async () => {
  const candidate = await getKalshiSettlementCandidate(ticker, {
    fetcher: respond({ market: { ...market, status: 'open', result: 'yes' } }),
  });
  assert.equal(candidate.kind, 'not_ready');
  assert.equal(candidate.reason, 'not_finalized');
});

test('explains missing and unsupported finalized results', async () => {
  for (const [result, reason] of [['', 'missing_result'], ['0.50', 'unsupported_result']]) {
    const candidate = await getKalshiSettlementCandidate(ticker, {
      fetcher: respond({ market: { ...market, result } }),
    });
    assert.equal(candidate.kind, 'not_ready');
    assert.equal(candidate.reason, reason);
  }
});

test('inherits exact-market and HTTP safeguards from the lookup', async () => {
  await assert.rejects(getKalshiSettlementCandidate(ticker, { fetcher: respond({}, 404) }), /HTTP 404/);
  await assert.rejects(getKalshiSettlementCandidate(ticker, {
    fetcher: respond({ market: { ...market, ticker: 'WRONG' } }),
  }), /different market ticker/);
});
