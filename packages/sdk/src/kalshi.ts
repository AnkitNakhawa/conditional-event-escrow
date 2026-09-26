/** Public Kalshi market data only. This module never reports an outcome onchain. */

const marketApi = 'https://external-api.kalshi.com/trade-api/v2/markets/';
const tickerPattern = /^[A-Z0-9][A-Z0-9.-]*$/;

export interface KalshiMarket {
  ticker: string;
  title: string;
  rulesPrimary: string;
  rulesSecondary: string | null;
  status: string;
  /** Kalshi's raw API field, not a verified or actionable onchain result. */
  reportedResult: string | null;
}

export interface GetKalshiMarketOptions {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
}

export class KalshiMarketIdentityError extends Error {
  constructor(
    public readonly reason: 'invalid_market_ticker' | 'market_mismatch',
    message: string,
  ) {
    super(message);
    this.name = 'KalshiMarketIdentityError';
  }
}

/** A classification of public API data, never authorization to report onchain. */
export type KalshiSettlementCandidate =
  | {
      kind: 'candidate';
      market: KalshiMarket;
      reportedOutcome: 'yes' | 'no';
      verifiedOnchain: false;
    }
  | {
      kind: 'not_ready';
      market: KalshiMarket;
      reason: 'not_finalized' | 'missing_result' | 'unsupported_result';
      verifiedOnchain: false;
    };

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid Kalshi market response');
  }
  return value as Record<string, unknown>;
}

function requiredString(market: Record<string, unknown>, field: string): string {
  const value = market[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid Kalshi market field: ${field}`);
  }
  return value;
}

function optionalString(market: Record<string, unknown>, field: string): string | null {
  const value = market[field];
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error(`Invalid Kalshi market field: ${field}`);
  return value;
}

/** Fetches one binary market by exact ticker. No Kalshi result is trusted for payout. */
export async function getKalshiMarket(
  ticker: string,
  options: GetKalshiMarketOptions = {},
): Promise<KalshiMarket> {
  if (typeof ticker !== 'string' || ticker.length > 200 || !tickerPattern.test(ticker)) {
    throw new KalshiMarketIdentityError('invalid_market_ticker', 'Invalid Kalshi market ticker');
  }

  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(10_000)])
    : AbortSignal.timeout(10_000);
  const response = await (options.fetcher ?? fetch)(marketApi + encodeURIComponent(ticker), { signal });
  if (!response.ok) throw new Error(`Kalshi market request failed (HTTP ${response.status})`);

  const market = object(object(await response.json()).market);
  if (requiredString(market, 'ticker') !== ticker) {
    throw new KalshiMarketIdentityError('market_mismatch', 'Kalshi returned a different market ticker');
  }
  if (requiredString(market, 'market_type') !== 'binary') {
    throw new Error('Only binary Kalshi markets are supported');
  }

  return {
    ticker,
    title: requiredString(market, 'title'),
    rulesPrimary: requiredString(market, 'rules_primary'),
    rulesSecondary: optionalString(market, 'rules_secondary'),
    status: requiredString(market, 'status'),
    reportedResult: optionalString(market, 'result'),
  };
}

/** Classifies one fetched market for human review; it cannot submit a payout result. */
export async function getKalshiSettlementCandidate(
  ticker: string,
  options: GetKalshiMarketOptions = {},
): Promise<KalshiSettlementCandidate> {
  const market = await getKalshiMarket(ticker, options);
  if (market.status !== 'finalized') {
    return { kind: 'not_ready', market, reason: 'not_finalized', verifiedOnchain: false };
  }
  if (market.reportedResult === null) {
    return { kind: 'not_ready', market, reason: 'missing_result', verifiedOnchain: false };
  }
  if (market.reportedResult !== 'yes' && market.reportedResult !== 'no') {
    return { kind: 'not_ready', market, reason: 'unsupported_result', verifiedOnchain: false };
  }
  return {
    kind: 'candidate',
    market,
    reportedOutcome: market.reportedResult,
    verifiedOnchain: false,
  };
}
