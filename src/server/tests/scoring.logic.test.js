require('./register-ts.cjs');
const assert = require('assert');

const {
  clamp,
  toDayKey,
  screenTimeScore,
  sleepScore,
  readinessScore,
  performanceScore,
  disciplineScore,
  successScore,
  confidenceScore
} = require('../domain/scores.ts');

let passed = 0;
let failed = 0;

const approxEqual = (actual, expected, epsilon = 0.001) => {
  assert(
    Math.abs(actual - expected) <= epsilon,
    `Expected ${expected}, got ${actual}`
  );
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

runTest('clamp keeps value inside boundaries', () => {
  assert.strictEqual(clamp(5, 0, 10), 5);
  assert.strictEqual(clamp(-4, 0, 10), 0);
  assert.strictEqual(clamp(999, 0, 10), 10);
});

runTest('toDayKey returns YYYY-MM-DD', () => {
  const date = new Date('2026-02-28T23:59:59.000Z');
  assert.strictEqual(toDayKey(date), '2026-02-28');
});

runTest('screenTimeScore applies expected buckets', () => {
  assert.strictEqual(screenTimeScore(null), null);
  assert.strictEqual(screenTimeScore(undefined), null);
  assert.strictEqual(screenTimeScore(2), 100);
  assert.strictEqual(screenTimeScore(2.5), 85);
  assert.strictEqual(screenTimeScore(3.5), 70);
  assert.strictEqual(screenTimeScore(4.5), 55);
  assert.strictEqual(screenTimeScore(9), 40);
});

runTest('sleepScore clamps extremes and follows curve anchors', () => {
  approxEqual(sleepScore(-5), 0);
  approxEqual(sleepScore(4), 40);
  approxEqual(sleepScore(5), 55);
  approxEqual(sleepScore(6), 70);
  approxEqual(sleepScore(8), 100);
  approxEqual(sleepScore(9), 90);
  approxEqual(sleepScore(10), 80);
  approxEqual(sleepScore(24), 10);
});

runTest('readinessScore combines metrics with weighted normalization', () => {
  const score = readinessScore({
    mood: 8,
    energy: 6,
    sleepHours: 8,
    screenHours: 2
  });
  approxEqual(score, 79);

  // Regression check: with only one available metric score must not be diluted by missing weights.
  const singleMetric = readinessScore({ screenHours: 2 });
  approxEqual(singleMetric, 100);
});

runTest('performanceScore handles full and partial inputs', () => {
  const full = performanceScore({
    winRate: 60,
    roundWinRate: 50,
    ctRoundWinRate: 55,
    tRoundWinRate: 45,
    pistolWinRate: 70
  });
  approxEqual(full, 73);

  const sideBalanceOnly = performanceScore({
    ctRoundWinRate: 70,
    tRoundWinRate: 50
  });
  approxEqual(sideBalanceOnly, 60);

  assert.strictEqual(performanceScore({}), null);
});

runTest('disciplineScore reflects completion and data freshness', () => {
  const score = disciplineScore({
    questionnaireFilledDays: 5,
    totalDays: 7,
    excelLastUpdatedDayDelta: 1
  });
  approxEqual(score, 72.86);

  const empty = disciplineScore({
    questionnaireFilledDays: 0,
    totalDays: 0,
    excelLastUpdatedDayDelta: null
  });
  approxEqual(empty, 0);
});

runTest('successScore normalizes weights when some components are missing', () => {
  const score = successScore({
    readiness: 80,
    performance: null,
    discipline: 60
  });
  approxEqual(score, 71.67);

  assert.strictEqual(
    successScore({
      readiness: null,
      performance: null,
      discipline: null
    }),
    null
  );
});

runTest('confidenceScore averages completeness and freshness', () => {
  approxEqual(confidenceScore({ completeness: 80, freshness: 60 }), 70);
  approxEqual(confidenceScore({ completeness: 500, freshness: -100 }), 100);
});

if (failed > 0) {
  console.error(`\nScoring logic tests failed: ${failed} of ${passed + failed}`);
  process.exit(1);
}

console.log(`\nScoring logic tests passed: ${passed}/${passed + failed}`);
