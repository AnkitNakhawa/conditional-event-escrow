/** Pure validation and descriptive audit of a caller-supplied combo quote. No RFQ API or trading. */

import { auditBinaryCombo, type BinaryComboAudit, type BinaryLegEstimate } from './index.js';
import type { KalshiComboRulesSnapshot } from './kalshi.js';

export interface ParticipantComboQuote {
  /** The caller, not this library, obtained and normalized this quote. */
  source: 'participant_supplied';
  marketTicker: string;
  action: 'buy_yes';
  /** Cost before fees per $1 maximum payout, not an exchange cents field. */
  pricePerDollar: number;
  /** When the caller observed the quote, in ISO-8601 with an explicit timezone. */
  observedAt: string;
}

export interface ParticipantQuoteAuditInput {
  snapshot: KalshiComboRulesSnapshot;
  quote: ParticipantComboQuote;
  estimates: readonly BinaryLegEstimate[];
  /** Caller attests after reading all rules; this library cannot certify payout shape. */
  strictBinaryPayoutAttested: true;
  /** Maximum acceptable client-observed age for both quote and metadata. */
  maxAgeMs: number;
  /** Evaluation time; defaults to now. Supply explicitly for reproducible historical work. */
  evaluatedAt?: string;
}

export interface ParticipantQuoteAudit {
  audit: BinaryComboAudit;
  quoteAgeMs: number;
  snapshotAgeMs: number;
  quoteSource: 'participant_supplied';
  /** Observed age is not proof the quote remains available or executable. */
  executableQuoteVerified: false;
  /** The rules snapshot was assembled from separate market reads. */
  snapshotConsistency: 'non_atomic';
  /** Payout eligibility is only caller-attested. */
  payoutVerifiedByLibrary: false;
}

function timestamp(value: string, label: string): number {
  const match = typeof value === 'string'
    ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value)
    : null;
  if (!match) {
    throw new TypeError(`${label} must be an ISO-8601 timestamp with timezone`);
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth
    || Number(hourText) > 23 || Number(minuteText) > 59 || Number(secondText) > 59) {
    throw new TypeError(`${label} must be a valid timestamp`);
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new TypeError(`${label} must be a valid timestamp`);
  return milliseconds;
}

/** Compares a participant-supplied quote with caller estimates; never claims an executable edge. */
export function auditParticipantQuote(input: ParticipantQuoteAuditInput): ParticipantQuoteAudit {
  if (!input || input.strictBinaryPayoutAttested !== true) {
    throw new TypeError('strict binary payout must be explicitly attested by the caller');
  }
  const { snapshot, quote, estimates, maxAgeMs } = input;
  if (!snapshot || snapshot.consistency !== 'non_atomic' || !snapshot.combo
    || !Array.isArray(snapshot.combo.selectedLegs) || !Array.isArray(snapshot.legs)
    || snapshot.combo.selectedLegs.length < 2
    || snapshot.legs.length !== snapshot.combo.selectedLegs.length) {
    throw new TypeError('snapshot has invalid combo or leg data');
  }
  if (!quote || quote.source !== 'participant_supplied' || quote.action !== 'buy_yes'
    || quote.marketTicker !== snapshot.combo.marketTicker) {
    throw new TypeError('quote must be a participant-supplied buy-YES quote for this exact combo');
  }
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) {
    throw new RangeError('maxAgeMs must be a positive finite number');
  }
  const now = timestamp(input.evaluatedAt ?? new Date().toISOString(), 'evaluatedAt');
  const quoteAgeMs = now - timestamp(quote.observedAt, 'quote.observedAt');
  const snapshotAgeMs = now - timestamp(snapshot.fetchedAt, 'snapshot.fetchedAt');
  if (quoteAgeMs < 0 || snapshotAgeMs < 0) throw new RangeError('quote and snapshot cannot be from the future');
  if (quoteAgeMs > maxAgeMs || snapshotAgeMs > maxAgeMs) {
    throw new RangeError('quote or snapshot exceeds maxAgeMs');
  }

  if (!Array.isArray(estimates) || estimates.length !== snapshot.combo.selectedLegs.length) {
    throw new TypeError('estimates must cover every selected combo leg exactly once');
  }
  const byId = new Map(estimates.map((estimate) => [estimate?.id, estimate]));
  if (byId.size !== estimates.length) throw new TypeError('duplicate leg estimates');
  const ordered = snapshot.combo.selectedLegs.map((leg, index) => {
    const detail = snapshot.legs[index];
    if (!detail || detail.marketTicker !== leg.marketTicker
      || detail.eventTicker !== leg.eventTicker || detail.side !== leg.side) {
      throw new TypeError('snapshot leg detail does not match combo composition');
    }
    const estimate = byId.get(leg.marketTicker);
    if (!estimate || estimate.side !== leg.side) {
      throw new TypeError(`missing or mismatched estimate for ${leg.marketTicker}`);
    }
    return estimate;
  });
  const audit = auditBinaryCombo({ legs: ordered, observedPrice: quote.pricePerDollar });
  return {
    audit,
    quoteAgeMs,
    snapshotAgeMs,
    quoteSource: 'participant_supplied',
    executableQuoteVerified: false,
    snapshotConsistency: 'non_atomic',
    payoutVerifiedByLibrary: false,
  };
}
