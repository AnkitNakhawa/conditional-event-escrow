/** Read-only Kalshi combo composition lookup. It does not obtain private RFQ quotes. */

export interface KalshiComboLeg {
  eventTicker: string;
  marketTicker: string;
  side: 'yes' | 'no';
}

export interface KalshiComboMetadata {
  marketTicker: string;
  title: string;
  status: string;
  updatedTime: string | null;
  rulesPrimary: string;
  rulesSecondary: string;
  selectedLegs: readonly KalshiComboLeg[];
  /** The public API has not proven binary-only payout rules for every leg. */
  payoffType: 'unverified';
  /** This lookup never supplies a private, executable RFQ quote. */
  executableQuote: null;
}

export interface GetKalshiComboOptions {
  /** For tests or callers with their own HTTP transport. */
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export interface KalshiComboLegRules extends KalshiComboLeg {
  title: string;
  status: string;
  marketType: string;
  updatedTime: string | null;
  rulesPrimary: string;
  rulesSecondary: string;
  /** Even a market labeled binary can have fractional settlement rules. */
  payoffType: 'unverified';
}

export interface KalshiComboRulesSnapshot {
  combo: KalshiComboMetadata;
  legs: readonly KalshiComboLegRules[];
  /** Client observation time, not exchange publication time or quote freshness. */
  fetchedAt: string;
  /** The combo and its legs are fetched in separate public requests. */
  consistency: 'non_atomic';
}

const endpoint = 'https://external-api.kalshi.com/trade-api/v2/markets/';
const tickerPattern = /^[A-Z0-9._-]{1,256}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTicker(value: unknown): value is string {
  return typeof value === 'string' && tickerPattern.test(value);
}

async function fetchMarket(ticker: string, options: GetKalshiComboOptions): Promise<Record<string, unknown>> {
  const response = await (options.fetchImpl ?? fetch)(`${endpoint}${encodeURIComponent(ticker)}`, {
    signal: options.signal ?? AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Kalshi market request failed with HTTP ${response.status}`);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error('Kalshi market response is not valid JSON');
  }
  const market = isRecord(body) ? body.market : null;
  if (!isRecord(market)) throw new Error('Kalshi market response is missing market data');
  if (market.ticker !== ticker) throw new Error('Kalshi market ticker does not match request');
  return market;
}

/** Fetches exact-ticker public market metadata and validates its selected combo legs. */
export async function getKalshiComboMetadata(
  ticker: string,
  options: GetKalshiComboOptions = {},
): Promise<KalshiComboMetadata> {
  if (!isTicker(ticker)) throw new TypeError('ticker must be a safe, exact Kalshi market ticker');
  const market = await fetchMarket(ticker, options);
  if (market.market_type !== 'binary') throw new Error('Kalshi combo market is not binary');
  if (!Array.isArray(market.mve_selected_legs) || market.mve_selected_legs.length < 2) {
    throw new Error('Kalshi market is not a supported combo');
  }
  if (typeof market.title !== 'string' || typeof market.status !== 'string') {
    throw new Error('Kalshi combo metadata is malformed');
  }

  const seen = new Set<string>();
  const selectedLegs = market.mve_selected_legs.map((raw: unknown, index: number): KalshiComboLeg => {
    if (!isRecord(raw) || !isTicker(raw.market_ticker) || !isTicker(raw.event_ticker)
      || (raw.side !== 'yes' && raw.side !== 'no')) {
      throw new Error(`Kalshi combo leg ${index} is malformed`);
    }
    if (raw.market_ticker === ticker || seen.has(raw.market_ticker)) {
      throw new Error(`Kalshi combo leg ${index} has a duplicate or self-referential ticker`);
    }
    seen.add(raw.market_ticker);
    return { marketTicker: raw.market_ticker, eventTicker: raw.event_ticker, side: raw.side };
  });

  return {
    marketTicker: ticker,
    title: market.title,
    status: market.status,
    updatedTime: typeof market.updated_time === 'string' ? market.updated_time : null,
    rulesPrimary: typeof market.rules_primary === 'string' ? market.rules_primary : '',
    rulesSecondary: typeof market.rules_secondary === 'string' ? market.rules_secondary : '',
    selectedLegs,
    payoffType: 'unverified',
    executableQuote: null,
  };
}

/** Reads each selected leg's public rules; it never certifies payout shape or obtains an RFQ quote. */
export async function getKalshiComboRulesSnapshot(
  ticker: string,
  options: GetKalshiComboOptions = {},
): Promise<KalshiComboRulesSnapshot> {
  // One default deadline covers the combo and all leg requests, not ten seconds per leg.
  const requestOptions = { ...options, signal: options.signal ?? AbortSignal.timeout(10_000) };
  const combo = await getKalshiComboMetadata(ticker, requestOptions);
  const legs: KalshiComboLegRules[] = [];
  // Sequential requests avoid unbounded fan-out for exchange-supplied leg lists.
  for (const leg of combo.selectedLegs) {
    const market = await fetchMarket(leg.marketTicker, requestOptions);
    if (market.event_ticker !== leg.eventTicker
      || typeof market.title !== 'string'
      || typeof market.status !== 'string'
      || typeof market.market_type !== 'string'
      || typeof market.rules_primary !== 'string'
      || typeof market.rules_secondary !== 'string') {
      throw new Error(`Kalshi combo leg ${leg.marketTicker} metadata is malformed or mismatched`);
    }
    legs.push({
      ...leg,
      title: market.title,
      status: market.status,
      marketType: market.market_type,
      updatedTime: typeof market.updated_time === 'string' ? market.updated_time : null,
      rulesPrimary: market.rules_primary,
      rulesSecondary: market.rules_secondary,
      payoffType: 'unverified',
    });
  }
  return { combo, legs, fetchedAt: new Date().toISOString(), consistency: 'non_atomic' };
}
