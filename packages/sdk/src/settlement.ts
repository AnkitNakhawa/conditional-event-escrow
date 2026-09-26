/** Read-only comparison of one escrow with public Kalshi market data. No transaction path. */

import type { Address } from 'viem';
import { getEscrow, type DemoPublicClient, type EscrowState } from './index.js';
import {
  getKalshiSettlementCandidate,
  KalshiMarketIdentityError,
  type GetKalshiMarketOptions,
  type KalshiMarket,
  type KalshiSettlementCandidate,
} from './kalshi.js';

export type SettlementStopReason =
  | 'already_claimed'
  | 'already_resolved'
  | 'reporting_not_open'
  | 'reporting_deadline_passed'
  | 'invalid_market_ticker'
  | 'market_mismatch'
  | 'not_finalized'
  | 'missing_result'
  | 'unsupported_result';

interface CheckSnapshot {
  escrow: EscrowState;
  market: KalshiMarket | null;
  checkedAtBlock: bigint;
  checkedAtTimestamp: bigint;
  /** Public API data is not authenticated to the contract. */
  verifiedOnchain: false;
}

export type EscrowSettlementCheck =
  | (CheckSnapshot & {
      kind: 'candidate';
      market: KalshiMarket;
      reportedOutcome: 'yes' | 'no';
    })
  | (CheckSnapshot & {
      kind: 'not_ready';
      reason: SettlementStopReason;
    });

async function readSnapshot(publicClient: DemoPublicClient, address: Address) {
  const checkedAtBlock = await publicClient.getBlockNumber({ cacheTime: 0 });
  const [escrow, block] = await Promise.all([
    getEscrow(publicClient, address, { blockNumber: checkedAtBlock }),
    publicClient.getBlock({ blockNumber: checkedAtBlock }),
  ]);
  return { escrow, checkedAtBlock, checkedAtTimestamp: block.timestamp, verifiedOnchain: false as const };
}

function escrowStopReason(
  escrow: EscrowState,
  timestamp: bigint,
): 'already_claimed' | 'already_resolved' | 'reporting_not_open' | 'reporting_deadline_passed' | null {
  if (escrow.claimed) return 'already_claimed';
  if (escrow.outcome !== 'unresolved') return 'already_resolved';
  if (timestamp < escrow.reportingOpensAt) return 'reporting_not_open';
  if (timestamp >= escrow.reportingDeadline) return 'reporting_deadline_passed';
  return null;
}

/**
 * Compares a fresh onchain snapshot with one exact-ticker API response.
 * The result is advisory and may become stale immediately; it never authorizes or sends a report.
 */
export async function checkEscrowSettlement(
  publicClient: DemoPublicClient,
  address: Address,
  options: GetKalshiMarketOptions = {},
): Promise<EscrowSettlementCheck> {
  // First snapshot discovers the ticker and handles closed escrows without depending on the API.
  const initial = await readSnapshot(publicClient, address);
  const initialStop = escrowStopReason(initial.escrow, initial.checkedAtTimestamp);
  if (initialStop) return { ...initial, market: null, kind: 'not_ready', reason: initialStop };

  let assessment: KalshiSettlementCandidate | null = null;
  let identityIssue: 'invalid_market_ticker' | 'market_mismatch' | null = null;
  try {
    assessment = await getKalshiSettlementCandidate(initial.escrow.marketTicker, options);
  } catch (error) {
    if (!(error instanceof KalshiMarketIdentityError)) throw error;
    identityIssue = error.reason;
  }

  // Re-read after HTTP; a result can become stale while the lookup is in flight.
  const final = await readSnapshot(publicClient, address);
  const base = {
    ...final,
    market: assessment?.market ?? null,
  };
  const stop = (reason: SettlementStopReason): EscrowSettlementCheck => ({ ...base, kind: 'not_ready', reason });

  const finalStop = escrowStopReason(final.escrow, final.checkedAtTimestamp);
  if (finalStop) return stop(finalStop);
  if (final.escrow.marketTicker !== initial.escrow.marketTicker) return stop('market_mismatch');
  if (identityIssue) return stop(identityIssue);
  if (!assessment) throw new Error('Missing Kalshi assessment');
  if (assessment.kind === 'not_ready') return stop(assessment.reason);
  return {
    ...base,
    kind: 'candidate',
    market: assessment.market,
    reportedOutcome: assessment.reportedOutcome,
  };
}
