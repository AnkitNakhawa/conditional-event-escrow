import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkEscrowSettlement } from '../dist/settlement.js';

const address = '0x000000000000000000000000000000000000bEEF';
const ticker = 'KX-DEMO-MARKET';
const market = {
  ticker,
  market_type: 'binary',
  title: 'Demo market',
  rules_primary: 'Demo rules',
  status: 'finalized',
  result: 'yes',
};

function fixture(overrides = {}) {
  const chain = {
    now: 150n,
    state: {
      depositor: address,
      beneficiary: address,
      reporter: address,
      reportingOpensAt: 100n,
      reportingDeadline: 200n,
      depositWei: 1n,
      marketTicker: ticker,
      outcome: 'unresolved',
      claimed: false,
      ...overrides,
    },
    reads: [],
    nextBlock: 10n,
  };
  const client = {
    getChainId: async () => 31337,
    getBlockNumber: async ({ cacheTime }) => {
      assert.equal(cacheTime, 0);
      return chain.nextBlock++;
    },
    getBlock: async ({ blockNumber }) => {
      assert.equal(blockNumber, chain.nextBlock - 1n);
      return { timestamp: chain.now };
    },
    readContract: async ({ functionName, blockNumber }) => {
      chain.reads.push(blockNumber);
      if (functionName === 'deposit') return chain.state.depositWei;
      if (functionName === 'outcome') return { unresolved: 0, yes: 1, no: 2 }[chain.state.outcome];
      return chain.state[functionName];
    },
    writeContract: () => { throw new Error('read-only check attempted a write'); },
  };
  const fetcher = async (_url, _options) => new Response(JSON.stringify({ market }));
  return { chain, client, fetcher };
}

test('returns exact-market YES and NO candidates without writing', async () => {
  for (const result of ['yes', 'no']) {
    const { chain, client } = fixture();
    const fetcher = async () => new Response(JSON.stringify({ market: { ...market, result } }));
    const check = await checkEscrowSettlement(client, address, { fetcher });
    assert.equal(check.kind, 'candidate');
    assert.equal(check.reportedOutcome, result);
    assert.equal(check.market.ticker, ticker);
    assert.equal(check.verifiedOnchain, false);
    assert.equal(check.checkedAtBlock, 11n);
    assert.equal(check.checkedAtTimestamp, 150n);
    assert.deepEqual([...new Set(chain.reads)], [10n, 11n]);
  }
});

test('explains why a market or escrow is not reportable', async () => {
  const cases = [
    [{ claimed: true }, 150n, market, 'already_claimed'],
    [{ outcome: 'yes' }, 150n, market, 'already_resolved'],
    [{}, 99n, market, 'reporting_not_open'],
    [{}, 200n, market, 'reporting_deadline_passed'],
    [{}, 150n, { ...market, status: 'open' }, 'not_finalized'],
    [{}, 150n, { ...market, result: '' }, 'missing_result'],
    [{}, 150n, { ...market, result: 'void' }, 'unsupported_result'],
    [{ marketTicker: 'BAD TICKER' }, 150n, market, 'invalid_market_ticker'],
    [{}, 150n, { ...market, ticker: 'WRONG' }, 'market_mismatch'],
  ];
  for (const [state, now, returnedMarket, reason] of cases) {
    const { chain, client } = fixture(state);
    chain.now = now;
    const fetcher = async () => new Response(JSON.stringify({ market: returnedMarket }));
    const check = await checkEscrowSettlement(client, address, { fetcher });
    assert.equal(check.kind, 'not_ready');
    assert.equal(check.reason, reason);
    assert.equal(check.verifiedOnchain, false);
  }
});

test('closed escrows do not depend on the market API', async () => {
  for (const [state, now, reason] of [
    [{ claimed: true }, 150n, 'already_claimed'],
    [{ outcome: 'no' }, 150n, 'already_resolved'],
    [{}, 99n, 'reporting_not_open'],
    [{}, 200n, 'reporting_deadline_passed'],
  ]) {
    const { chain, client } = fixture(state);
    chain.now = now;
    const check = await checkEscrowSettlement(client, address, {
      fetcher: async () => { throw new Error('market API should not be called'); },
    });
    assert.equal(check.kind, 'not_ready');
    assert.equal(check.reason, reason);
    assert.equal(check.market, null);
  }
});

test('rechecks escrow state and chain time after a slow market lookup', async () => {
  const { chain, client } = fixture();
  const fetcher = async () => {
    chain.state.outcome = 'yes';
    chain.now = 200n;
    return new Response(JSON.stringify({ market }));
  };
  const check = await checkEscrowSettlement(client, address, { fetcher });
  assert.equal(check.kind, 'not_ready');
  assert.equal(check.reason, 'already_resolved');
  assert.equal(check.checkedAtTimestamp, 200n);

  chain.state.outcome = 'unresolved';
  const expired = await checkEscrowSettlement(client, address, { fetcher: async () => new Response(JSON.stringify({ market })) });
  assert.equal(expired.reason, 'reporting_deadline_passed');
});

test('surfaces HTTP failures instead of fabricating a result', async () => {
  const { client } = fixture();
  await assert.rejects(
    checkEscrowSettlement(client, address, { fetcher: async () => new Response('{}', { status: 503 }) }),
    /HTTP 503/,
  );
});
