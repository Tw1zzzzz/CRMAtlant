const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;

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

const importModule = async (relativePath) => {
  const moduleUrl = pathToFileURL(path.join(projectRoot, relativePath)).href;
  return import(moduleUrl);
};

const main = async () => {
  const routesModule = await importModule('src/lib/routes.ts');
  const navigationModule = await importModule('src/lib/sidebarNavigation.ts');
  const apiHelpersModule = await importModule('src/lib/apiHelpers.ts');

  const {
    ROUTES,
    isProtectedRoute,
    isStaffRoute,
    isPlayerRoute,
  } = routesModule;
  const { getSidebarNavItems } = navigationModule;
  const {
    extractPlayerId,
    normalizeBalanceWheelResponse,
    buildTestsStateImpactPath,
    buildTeamReportsPath,
  } = apiHelpersModule;

  runTest('route guards classify public, player and staff routes correctly', () => {
    assert.strictEqual(isProtectedRoute(ROUTES.WELCOME), false);
    assert.strictEqual(isProtectedRoute(ROUTES.DASHBOARD), true);
    assert.strictEqual(isPlayerRoute(ROUTES.BALANCE_WHEEL), true);
    assert.strictEqual(isPlayerRoute(ROUTES.GAME_STATS), false);
    assert.strictEqual(isStaffRoute(ROUTES.STAFF_BALANCE_WHEEL), true);
    assert.strictEqual(isStaffRoute(ROUTES.ACTIVITY_HISTORY), false);
  });

  runTest('guest navigation keeps only common sections', () => {
    const hrefs = getSidebarNavItems(null, null).map((item) => item.href);

    assert.deepStrictEqual(hrefs, [
      '/',
      '/mood',
      '/tests',
      '/stats',
      '/correlation-analysis',
      '/game-stats',
    ]);
  });

  runTest('solo player navigation hides team management and keeps personal card', () => {
    const items = getSidebarNavItems('player', 'solo');
    const titles = items.map((item) => item.title);
    const hrefs = items.map((item) => item.href);

    assert(hrefs.includes('/balance-wheel'));
    assert(!hrefs.includes('/staff-balance-wheel'));
    assert(titles.includes('Моя карточка'));
    assert(!titles.includes('Топ игроков'));
    assert(!titles.includes('Управление игроками'));
    assert(!titles.includes('Управление персоналом'));
    assert(titles.includes('Профиль'));
  });

  runTest('staff navigation exposes staff balance wheel and team sections', () => {
    const items = getSidebarNavItems('staff', null);
    const titles = items.map((item) => item.title);
    const hrefs = items.map((item) => item.href);

    assert(hrefs.includes('/staff-balance-wheel'));
    assert(!hrefs.includes('/balance-wheel'));
    assert(titles.includes('Топ игроков'));
    assert(titles.includes('Управление игроками'));
    assert(titles.includes('Управление персоналом'));
    assert(titles.includes('Моя карточка'));
  });

  runTest('extractPlayerId supports object, string and serialized ObjectId inputs', () => {
    assert.strictEqual(
      extractPlayerId({ _id: { toString: () => '507f1f77bcf86cd799439011' } }),
      '507f1f77bcf86cd799439011'
    );
    assert.strictEqual(
      extractPlayerId({ userId: '507f1f77bcf86cd799439012' }),
      '507f1f77bcf86cd799439012'
    );
    assert.strictEqual(
      extractPlayerId('ObjectId("507f1f77bcf86cd799439013")'),
      '507f1f77bcf86cd799439013'
    );
    assert.strictEqual(
      extractPlayerId('{"_id":"507f1f77bcf86cd799439014","name":"nbl"}'),
      '507f1f77bcf86cd799439014'
    );
    assert.strictEqual(extractPlayerId('broken-value'), 'broken-value');
  });

  runTest('balance wheel response normalization tolerates multiple backend payload shapes', () => {
    assert.deepStrictEqual(
      normalizeBalanceWheelResponse([{ id: 1 }, { id: 2 }]),
      { data: [{ id: 1 }, { id: 2 }] }
    );
    assert.deepStrictEqual(
      normalizeBalanceWheelResponse({ data: [{ id: 3 }] }),
      { data: [{ id: 3 }] }
    );
    assert.deepStrictEqual(
      normalizeBalanceWheelResponse({ wheels: [{ id: 4 }] }),
      { data: [{ id: 4 }] }
    );
    assert.deepStrictEqual(
      normalizeBalanceWheelResponse({ id: 5 }),
      { data: [{ id: 5 }] }
    );
    assert.deepStrictEqual(
      normalizeBalanceWheelResponse(null),
      { data: [] }
    );
  });

  runTest('tests state impact path includes only provided filters', () => {
    assert.strictEqual(
      buildTestsStateImpactPath(),
      '/stats/tests/state-impact'
    );
    assert.strictEqual(
      buildTestsStateImpactPath({
        from: '2026-03-01',
        to: '2026-03-15',
        testType: 'reaction',
        map: 'Mirage',
      }),
      '/stats/tests/state-impact?from=2026-03-01&to=2026-03-15&testType=reaction&map=Mirage'
    );
  });

  runTest('team reports path omits empty filters and stringifies numbers', () => {
    assert.strictEqual(buildTeamReportsPath(), '/team-reports');
    assert.strictEqual(
      buildTeamReportsPath({
        status: 'published',
        page: 2,
        limit: 20,
        search: '',
        createdBy: undefined,
      }),
      '/team-reports?status=published&page=2&limit=20'
    );
  });

  if (failed > 0) {
    console.error(`\nFrontend behavior tests failed: ${failed} of ${passed + failed}`);
    process.exit(1);
  }

  console.log(`\nFrontend behavior tests passed: ${passed}/${passed + failed}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
