/** Pure, read-only arithmetic for binary all-win combos. No trading signal or market-data claims. */

export type Side = 'yes' | 'no';

export interface BinaryLegEstimate {
  /** Stable caller-provided identity, such as an exact market ticker. */
  id: string;
  /** Explicitly assert that this leg pays exactly $0 or $1. */
  payoffType: 'binary';
  side: Side;
  /** Estimated probability that the underlying YES side settles at $1. */
  yesProbabilityEstimate: number;
}

export interface BinaryComboAuditInput {
  /** At least two distinct binary legs; all must pay exactly $0 or $1. */
  legs: readonly BinaryLegEstimate[];
  /** Observed price for $1 paid only if every selected side wins, before fees. */
  observedPrice: number;
}

export interface BinaryComboAudit {
  selectedLegs: readonly {
    id: string;
    side: Side;
    selectedProbabilityEstimate: number;
  }[];
  observedPrice: number;
  /** Product of selected-leg estimates; only a fair joint estimate under independence. */
  independenceBenchmark: number;
  /** Exact Fréchet bounds for an intersection, conditional on the supplied marginals. */
  jointProbabilityBounds: { lower: number; upper: number };
  /** Observed price minus the independence benchmark; not expected profit. */
  observedMinusIndependence: number;
  /** Descriptive comparison to estimate-derived bounds; not an arbitrage signal. */
  boundComparison: 'below_estimate_bounds' | 'within_estimate_bounds' | 'above_estimate_bounds';
}

function requireProbability(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be a finite number in [0, 1]`);
  }
}

/**
 * Audits a binary all-win combo against caller-supplied probability estimates.
 * Market quotes are not necessarily fair probabilities, and the result is never an executable edge.
 */
export function auditBinaryCombo(input: BinaryComboAuditInput): BinaryComboAudit {
  if (!input || !Array.isArray(input.legs) || input.legs.length < 2) {
    throw new TypeError('legs must contain at least two binary markets');
  }
  requireProbability(input.observedPrice, 'observedPrice');

  const ids = new Set<string>();
  const selectedLegs = input.legs.map((leg, index) => {
    if (!leg || typeof leg.id !== 'string' || leg.id.trim() === '' || leg.id.trim() !== leg.id) {
      throw new TypeError(`legs[${index}].id must be a nonempty string without surrounding whitespace`);
    }
    if (ids.has(leg.id)) throw new TypeError(`duplicate leg id: ${leg.id}`);
    ids.add(leg.id);
    if (leg.side !== 'yes' && leg.side !== 'no') {
      throw new TypeError(`legs[${index}].side must be yes or no`);
    }
    if (leg.payoffType !== 'binary') {
      throw new TypeError(`legs[${index}].payoffType must be binary`);
    }
    requireProbability(leg.yesProbabilityEstimate, `legs[${index}].yesProbabilityEstimate`);
    return {
      id: leg.id,
      side: leg.side,
      selectedProbabilityEstimate: leg.side === 'yes'
        ? leg.yesProbabilityEstimate
        : 1 - leg.yesProbabilityEstimate,
    };
  });

  const probabilities = selectedLegs.map((leg) => leg.selectedProbabilityEstimate);
  const independenceBenchmark = probabilities.reduce((product, probability) => product * probability, 1);
  const upper = probabilities.reduce((minimum, probability) => Math.min(minimum, probability), 1);
  const lower = Math.min(upper, Math.max(0,
    probabilities.reduce((sum, probability) => sum + probability, 0) - (probabilities.length - 1),
  ));
  // IEEE-754 arithmetic can put an otherwise equal value a few ulps beyond a bound.
  const tolerance = 1e-12;
  const boundComparison = input.observedPrice < lower - tolerance
    ? 'below_estimate_bounds'
    : input.observedPrice > upper + tolerance
      ? 'above_estimate_bounds'
      : 'within_estimate_bounds';

  return {
    selectedLegs,
    observedPrice: input.observedPrice,
    independenceBenchmark,
    jointProbabilityBounds: { lower, upper },
    observedMinusIndependence: input.observedPrice - independenceBenchmark,
    boundComparison,
  };
}
