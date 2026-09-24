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
    throw new Error('Invalid Kalshi market ticker');
  }

  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(10_000)])
    : AbortSignal.timeout(10_000);
  const response = await (options.fetcher ?? fetch)(marketApi + encodeURIComponent(ticker), { signal });
  if (!response.ok) throw new Error(`Kalshi market request failed (HTTP ${response.status})`);

  const market = object(object(await response.json()).market);
  if (requiredString(market, 'ticker') !== ticker) throw new Error('Kalshi returned a different market ticker');
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
