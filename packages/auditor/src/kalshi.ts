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

const endpoint = 'https://external-api.kalshi.com/trade-api/v2/markets/';
const tickerPattern = /^[A-Z0-9._-]{1,256}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTicker(value: unknown): value is string {
  return typeof value === 'string' && tickerPattern.test(value);
}

/** Fetches exact-ticker public market metadata and validates its selected combo legs. */
export async function getKalshiComboMetadata(
  ticker: string,
  options: GetKalshiComboOptions = {},
): Promise<KalshiComboMetadata> {
  if (!isTicker(ticker)) throw new TypeError('ticker must be a safe, exact Kalshi market ticker');

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
