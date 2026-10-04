import test from 'node:test';
import assert from 'node:assert/strict';
import { auditBinaryCombo } from '../dist/index.js';

const leg = (id, side, yesProbabilityEstimate) => ({ id, payoffType: 'binary', side, yesProbabilityEstimate });

test('reports independence and exact two-leg bounds without claiming an edge', () => {
  const audit = auditBinaryCombo({
    legs: [leg('A', 'yes', 0.6), leg('B', 'yes', 0.5)],
    observedPrice: 0.4,
  });
  assert.ok(Math.abs(audit.independenceBenchmark - 0.3) < 1e-12);
  assert.ok(Math.abs(audit.jointProbabilityBounds.lower - 0.1) < 1e-12);
  assert.equal(audit.jointProbabilityBounds.upper, 0.5);
  assert.equal(audit.boundComparison, 'within_estimate_bounds');
  assert.ok(audit.observedMinusIndependence > 0);
  assert.equal('profitable' in audit, false);
});

test('converts a selected NO leg and bounds a three-leg combo', () => {
  const audit = auditBinaryCombo({
    legs: [leg('A', 'yes', 0.8), leg('B', 'no', 0.25), leg('C', 'yes', 0.7)],
    observedPrice: 0.65,
  });
  assert.equal(audit.selectedLegs[1].selectedProbabilityEstimate, 0.75);
  assert.ok(Math.abs(audit.independenceBenchmark - 0.42) < 1e-12);
  assert.ok(Math.abs(audit.jointProbabilityBounds.lower - 0.25) < 1e-12);
  assert.equal(audit.jointProbabilityBounds.upper, 0.7);
});

test('classifies prices outside estimate-derived bounds, not as arbitrage', () => {
  const legs = [leg('A', 'yes', 0.6), leg('B', 'yes', 0.5)];
  assert.equal(auditBinaryCombo({ legs, observedPrice: 0.05 }).boundComparison, 'below_estimate_bounds');
  assert.equal(auditBinaryCombo({ legs, observedPrice: 0.6 }).boundComparison, 'above_estimate_bounds');
  assert.equal(auditBinaryCombo({ legs, observedPrice: 0.1 }).boundComparison, 'within_estimate_bounds');
});

test('handles nested certainty and mutually exclusive limiting cases', () => {
  const certain = auditBinaryCombo({
    legs: [leg('A', 'yes', 1), leg('B', 'no', 0.4)],
    observedPrice: 0.6,
  });
  assert.ok(Math.abs(certain.jointProbabilityBounds.lower - 0.6) < 1e-12);
  assert.equal(certain.jointProbabilityBounds.upper, 0.6);

  const exclusive = auditBinaryCombo({
    legs: [leg('A', 'yes', 0.2), leg('B', 'yes', 0.3)],
    observedPrice: 0,
  });
  assert.equal(exclusive.jointProbabilityBounds.lower, 0);
});

test('rejects invalid and ambiguous inputs', () => {
  const good = leg('A', 'yes', 0.5);
  assert.throws(() => auditBinaryCombo({ legs: [good], observedPrice: 0.2 }), /at least two/);
  assert.throws(() => auditBinaryCombo({ legs: [good, good], observedPrice: 0.2 }), /duplicate/);
  assert.throws(() => auditBinaryCombo({ legs: [good, leg(' A ', 'yes', 0.5)], observedPrice: 0.2 }), /whitespace/);
  assert.throws(() => auditBinaryCombo({ legs: [good, leg('B', 'maybe', 0.5)], observedPrice: 0.2 }), /side/);
  assert.throws(() => auditBinaryCombo({ legs: [good, { ...leg('B', 'yes', 0.5), payoffType: 'scalar' }], observedPrice: 0.2 }), /payoffType/);
  assert.throws(() => auditBinaryCombo({ legs: [good, leg('B', 'yes', NaN)], observedPrice: 0.2 }), /finite/);
  assert.throws(() => auditBinaryCombo({ legs: [good, leg('B', 'yes', 1.1)], observedPrice: 0.2 }), /finite/);
  assert.throws(() => auditBinaryCombo({ legs: [good, leg('B', 'yes', 0.5)], observedPrice: Infinity }), /finite/);
  assert.throws(() => auditBinaryCombo({ legs: [good, leg('B', 'yes', 0.5)], observedPrice: -0.01 }), /finite/);
});
