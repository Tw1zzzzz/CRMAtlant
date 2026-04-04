require('./register-ts.cjs');
const assert = require('assert');
const path = require('path');

const Subscription = require('../models/Subscription.ts').default;
const Team = require('../models/Team.ts').default;

const subscriptionAccessModulePath = path.resolve(__dirname, '../utils/subscriptionAccess.ts');
const originalSubscriptionFind = Subscription.find;
const originalTeamFindById = Team.findById;

let passed = 0;
let failed = 0;

const loadSubscriptionAccessModule = () => {
  delete require.cache[subscriptionAccessModulePath];
  return require(subscriptionAccessModulePath);
};

const makeSubscriptionFindResult = (items) => ({
  populate: async () => items,
});

const runTest = async (name, fn) => {
  try {
    Subscription.find = originalSubscriptionFind;
    Team.findById = originalTeamFindById;

    await fn();
    passed += 1;
    console.log(`[PASS] ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`[FAIL] ${name}`);
    console.error(error.message);
  }
};

const main = async () => {
  await runTest('keeps personal CRM access without team inheritance', async () => {
    Subscription.find = ({ userId }) =>
      makeSubscriptionFindResult(
        userId === 'solo-owner'
          ? [
              {
                _id: 'sub-personal',
                status: 'active',
                startedAt: new Date('2026-01-01T00:00:00.000Z'),
                expiresAt: new Date('2026-12-31T00:00:00.000Z'),
                planId: {
                  _id: 'plan-crm',
                  name: 'PerformanceCoach CRM (1 месяц)',
                  periodDays: 30,
                },
              },
            ]
          : []
      );

    const { resolveEffectiveSubscriptionAccess } = loadSubscriptionAccessModule();
    const flags = await resolveEffectiveSubscriptionAccess({ _id: 'solo-owner', teamId: null });

    assert.strictEqual(flags.hasPerformanceCoachCrmAccess, true);
    assert.strictEqual(flags.hasCorrelationAnalysisAccess, true);
    assert.strictEqual(flags.hasGameStatsAccess, true);
    assert.strictEqual(flags.inheritedFromTeamOwnerId, null);
  });

  await runTest('inherits CRM access from the team creator', async () => {
    Team.findById = () => ({
      select: async () => ({
        createdBy: 'team-owner',
      }),
    });

    Subscription.find = ({ userId }) =>
      makeSubscriptionFindResult(
        userId === 'team-owner'
          ? [
              {
                _id: 'sub-team-owner',
                status: 'active',
                startedAt: new Date('2026-01-01T00:00:00.000Z'),
                expiresAt: new Date('2026-12-31T00:00:00.000Z'),
                planId: {
                  _id: 'plan-crm',
                  name: 'PerformanceCoach CRM (3 месяца)',
                  periodDays: 90,
                },
              },
            ]
          : []
      );

    const { resolveEffectiveSubscriptionAccess } = loadSubscriptionAccessModule();
    const flags = await resolveEffectiveSubscriptionAccess({ _id: 'team-player', teamId: 'team-1' });

    assert.strictEqual(flags.hasPerformanceCoachCrmAccess, true);
    assert.strictEqual(flags.hasCorrelationAnalysisAccess, true);
    assert.strictEqual(flags.hasGameStatsAccess, true);
    assert.strictEqual(flags.inheritedFromTeamOwnerId, 'team-owner');
  });

  await runTest('does not inherit non-CRM products from the team creator', async () => {
    Team.findById = () => ({
      select: async () => ({
        createdBy: 'team-owner',
      }),
    });

    Subscription.find = ({ userId }) =>
      makeSubscriptionFindResult(
        userId === 'team-owner'
          ? [
              {
                _id: 'sub-team-owner-correlation',
                status: 'active',
                startedAt: new Date('2026-01-01T00:00:00.000Z'),
                expiresAt: new Date('2026-12-31T00:00:00.000Z'),
                planId: {
                  _id: 'plan-correlation',
                  name: 'Корреляционный анализ (1 месяц)',
                  periodDays: 30,
                },
              },
            ]
          : []
      );

    const { resolveEffectiveSubscriptionAccess } = loadSubscriptionAccessModule();
    const flags = await resolveEffectiveSubscriptionAccess({ _id: 'team-player', teamId: 'team-1' });

    assert.strictEqual(flags.hasPerformanceCoachCrmAccess, false);
    assert.strictEqual(flags.hasCorrelationAnalysisAccess, false);
    assert.strictEqual(flags.hasGameStatsAccess, false);
    assert.strictEqual(flags.inheritedFromTeamOwnerId, null);
  });

  Subscription.find = originalSubscriptionFind;
  Team.findById = originalTeamFindById;

  if (failed > 0) {
    throw new Error(`Subscription team access behavior tests failed: ${failed}/${passed + failed}`);
  }

  console.log(`Subscription team access behavior tests passed (${passed} tests)`);
};

main().catch((error) => {
  Subscription.find = originalSubscriptionFind;
  Team.findById = originalTeamFindById;
  console.error(error);
  process.exit(1);
});
