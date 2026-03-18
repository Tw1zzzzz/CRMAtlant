require('./register-ts.cjs');
const assert = require('assert');

const {
  computeAttemptOutcome,
  computeClientDerivedMetrics,
} = require('../services/brainTestsService.ts');

let passed = 0;
let failed = 0;

const approxEqual = (actual, expected, epsilon = 0.001) => {
  assert(Math.abs(actual - expected) <= epsilon, `Expected ${expected}, got ${actual}`);
};

const runTest = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`[PASS] ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`[FAIL] ${name}`);
    console.error(error.message);
  }
};

runTest('computeClientDerivedMetrics calculates median, variation and fast ratio', () => {
  const derived = computeClientDerivedMetrics([100, 200, 300, 400]);
  assert.strictEqual(derived.medianRtMs, 250);
  assert(derived.rtCv > 0);
  approxEqual(derived.fastResponseRatio, 0.25);
});

runTest('visual_search computes valid composite score', () => {
  const outcome = computeAttemptOutcome('visual_search', {
    accuracyPct: 90,
    medianRtMs: 600,
    rtCv: 0.1,
    misses: 3,
    durationMs: 45000,
    visibilityHiddenMs: 0,
    fastResponseRatio: 0.05
  });

  assert.strictEqual(outcome.validityStatus, 'valid');
  assert(outcome.rawCompositeScore > 80);
  assert(outcome.derivedMetrics.speedScore > 90);
});

runTest('go_no_go marks low inhibition accuracy as invalid', () => {
  const outcome = computeAttemptOutcome('go_no_go', {
    goAccuracyPct: 88,
    noGoAccuracyPct: 40,
    medianRtMs: 310,
    rtCv: 0.12,
    commissionErrors: 10,
    omissionErrors: 1,
    durationMs: 70000,
    visibilityHiddenMs: 0,
    fastResponseRatio: 0.05
  });

  assert.strictEqual(outcome.validityStatus, 'invalid');
  assert(outcome.invalidReasons.includes('accuracy_below_threshold'));
});

runTest('stroop_switch penalizes excessive hidden tab time', () => {
  const outcome = computeAttemptOutcome('stroop_switch', {
    congruentAccuracyPct: 95,
    conflictAccuracyPct: 82,
    congruentMedianRtMs: 420,
    conflictMedianRtMs: 610,
    switchCostMs: 120,
    durationMs: 1000,
    visibilityHiddenMs: 300,
    fastResponseRatio: 0.05
  });

  assert.strictEqual(outcome.validityStatus, 'invalid');
  assert(outcome.invalidReasons.includes('tab_hidden_over_15_percent'));
});

runTest('spatial_span uses maxSpan and sequence accuracy for raw score', () => {
  const outcome = computeAttemptOutcome('spatial_span', {
    maxSpan: 6,
    sequenceAccuracyPct: 75,
    totalCorrect: 21,
    durationMs: 63000,
    visibilityHiddenMs: 0
  });

  approxEqual(outcome.rawCompositeScore, 66);
  assert.strictEqual(outcome.validityStatus, 'valid');
});

if (failed > 0) {
  console.error(`\nBrain logic tests failed: ${failed} of ${passed + failed}`);
  process.exit(1);
}

console.log(`\nBrain logic tests passed: ${passed}/${passed + failed}`);
