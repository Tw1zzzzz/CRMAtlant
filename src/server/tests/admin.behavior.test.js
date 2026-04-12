require('./register-ts.cjs');
const assert = require('assert');
const path = require('path');

let passed = 0;
let failed = 0;

const authModulePath = path.resolve(__dirname, '../middleware/auth.ts');
const adminModulePath = path.resolve(__dirname, '../routes/admin.ts');

const loadAuthModule = () => {
  delete require.cache[authModulePath];
  return require(authModulePath);
};

const loadAdminModule = () => {
  delete require.cache[adminModulePath];
  return require(adminModulePath);
};

const createRequest = (overrides = {}) => ({
  user: undefined,
  ...overrides,
});

const createResponse = () => ({
  statusCode: 200,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.payload = body;
    return this;
  },
});

const runTest = async (name, fn) => {
  try {
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
  await runTest('requireSuperAdmin denies unauthenticated requests', async () => {
    const { requireSuperAdmin } = loadAuthModule();
    const req = createRequest();
    const res = createResponse();
    let nextCalled = false;

    requireSuperAdmin(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
  });

  await runTest('requireSuperAdmin denies regular player and staff users', async () => {
    const { requireSuperAdmin } = loadAuthModule();

    const playerRes = createResponse();
    requireSuperAdmin(createRequest({ user: { role: 'player', isSuperAdmin: false } }), playerRes, () => {});
    assert.strictEqual(playerRes.statusCode, 403);

    const staffRes = createResponse();
    requireSuperAdmin(createRequest({ user: { role: 'staff', isSuperAdmin: false } }), staffRes, () => {});
    assert.strictEqual(staffRes.statusCode, 403);
  });

  await runTest('requireSuperAdmin allows flagged super-admin', async () => {
    const { requireSuperAdmin } = loadAuthModule();
    const req = createRequest({ user: { role: 'staff', isSuperAdmin: true } });
    const res = createResponse();
    let nextCalled = false;

    requireSuperAdmin(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(res.statusCode, 200);
  });

  await runTest('buildDailyRegistrationSeries fills missing days with zeros', async () => {
    const { buildDailyRegistrationSeries } = loadAdminModule();
    const series = buildDailyRegistrationSeries(
      3,
      [{ _id: '2026-04-10', count: 2 }],
      new Date('2026-04-12T10:00:00.000Z')
    );

    assert.deepStrictEqual(series, [
      { date: '2026-04-10', registrations: 2 },
      { date: '2026-04-11', registrations: 0 },
      { date: '2026-04-12', registrations: 0 },
    ]);
  });

  await runTest('normalizeDashboardWindow accepts only supported presets', async () => {
    const { normalizeDashboardWindow } = loadAdminModule();

    assert.strictEqual(normalizeDashboardWindow('7'), 7);
    assert.strictEqual(normalizeDashboardWindow(30), 30);
    assert.strictEqual(normalizeDashboardWindow('90'), 90);
    assert.strictEqual(normalizeDashboardWindow('365'), 30);
    assert.strictEqual(normalizeDashboardWindow(undefined), 30);
  });

  if (failed > 0) {
    console.error(`\nAdmin behavior tests failed: ${failed} of ${passed + failed}`);
    process.exit(1);
  }

  console.log(`\nAdmin behavior tests passed: ${passed}/${passed + failed}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
