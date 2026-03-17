require('./register-ts.cjs');
const assert = require('assert');

const mongoose = require('mongoose');
const User = require('../models/User.ts').default;
const BalanceWheel = require('../models/BalanceWheel.ts').default;
const MoodEntry = require('../models/MoodEntry.ts').default;
const TestEntry = require('../models/TestEntry.ts').default;
const router = require('../health.ts').default;

const originalReadyState = mongoose.connection.readyState;
const originalName = mongoose.connection.name;
const originalHost = mongoose.connection.host;
const originalUserCountDocuments = User.countDocuments;
const originalUserFindOne = User.findOne;
const originalBalanceWheelCountDocuments = BalanceWheel.countDocuments;
const originalMoodEntryCountDocuments = MoodEntry.countDocuments;
const originalTestEntryCountDocuments = TestEntry.countDocuments;
const originalNodeEnv = process.env.NODE_ENV;
const originalPort = process.env.PORT;

let passed = 0;
let failed = 0;

const createResponse = () => {
  const headers = {};
  return {
    headers,
    statusCode: 200,
    payload: null,
    header(name, value) {
      headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
};

const runTest = async (name, fn) => {
  try {
    mongoose.connection.readyState = originalReadyState;
    mongoose.connection.name = originalName;
    mongoose.connection.host = originalHost;
    User.countDocuments = originalUserCountDocuments;
    User.findOne = originalUserFindOne;
    BalanceWheel.countDocuments = originalBalanceWheelCountDocuments;
    MoodEntry.countDocuments = originalMoodEntryCountDocuments;
    TestEntry.countDocuments = originalTestEntryCountDocuments;
    process.env.NODE_ENV = originalNodeEnv;
    process.env.PORT = originalPort;

    await fn();
    passed += 1;
    console.log(`[PASS] ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`[FAIL] ${name}`);
    console.error(error.message);
  }
};

const findRouteHandler = (path, method) => {
  const layer = router.stack.find((entry) => entry.route && entry.route.path === path);
  assert(layer, `Route ${path} should exist`);
  const routeLayer = layer.route.stack.find(
    (entry) => entry.method === method.toLowerCase()
  );
  assert(routeLayer, `${method} handler for ${path} should exist`);
  return routeLayer.handle;
};

const corsMiddleware = router.stack.find((entry) => !entry.route).handle;
const rootHandler = findRouteHandler('/', 'GET');
const dbHandler = findRouteHandler('/db', 'GET');

const main = async () => {
  await runTest('health root returns status, environment and port', async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '9000';

    const res = createResponse();
    await rootHandler({}, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.payload.status, 'ok');
    assert.strictEqual(res.payload.environment, 'test');
    assert.strictEqual(res.payload.port, '9000');
    assert.match(res.payload.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  });

  await runTest('health router answers OPTIONS preflight with CORS headers', async () => {
    const req = { method: 'OPTIONS' };
    const res = createResponse();
    let nextCalled = false;

    await corsMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['Access-Control-Allow-Origin'], '*');
    assert.strictEqual(res.headers['Access-Control-Allow-Methods'], 'GET');
    assert.deepStrictEqual(res.payload, {});
  });

  await runTest('health db route returns mapped state, counts and nbl stats', async () => {
    mongoose.connection.readyState = 1;
    mongoose.connection.name = 'esports-db';
    mongoose.connection.host = '127.0.0.1';

    User.countDocuments = async (query = {}) => {
      if (query.role === 'player') return 4;
      if (query.role === 'staff') return 2;
      return 6;
    };
    BalanceWheel.countDocuments = async (query = {}) =>
      query.userId ? 3 : 15;
    MoodEntry.countDocuments = async (query = {}) =>
      query.userId ? 8 : 40;
    TestEntry.countDocuments = async (query = {}) =>
      query.userId ? 5 : 27;
    User.findOne = () => ({
      select() {
        return {
          lean: async () => ({
            _id: 'nbl-id',
            name: 'nbl',
            avatar: '/uploads/nbl.png',
            createdAt: '2026-03-01T12:00:00.000Z',
          }),
        };
      },
    });

    const res = createResponse();
    await dbHandler({}, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.payload.status, 'ok');
    assert.strictEqual(res.payload.database.state, 1);
    assert.strictEqual(res.payload.database.stateText, 'подключено');
    assert.strictEqual(res.payload.database.connection, 'esports-db');
    assert.strictEqual(res.payload.counts.users, 6);
    assert.strictEqual(res.payload.counts.players, 4);
    assert.strictEqual(res.payload.counts.staff, 2);
    assert.strictEqual(res.payload.nbl.player.name, 'nbl');
    assert.strictEqual(res.payload.nbl.balanceWheels, 3);
    assert.strictEqual(res.payload.nbl.moodEntries, 8);
    assert.strictEqual(res.payload.nbl.testEntries, 5);
  });

  await runTest('health db route returns 500 when collection stats fail', async () => {
    User.countDocuments = async () => {
      throw new Error('db unavailable');
    };

    const res = createResponse();
    await dbHandler({}, res);

    assert.strictEqual(res.statusCode, 500);
    assert.strictEqual(res.payload.status, 'error');
    assert.match(res.payload.message, /состояния базы данных/i);
    assert.match(res.payload.error, /db unavailable/i);
  });

  mongoose.connection.readyState = originalReadyState;
  mongoose.connection.name = originalName;
  mongoose.connection.host = originalHost;
  User.countDocuments = originalUserCountDocuments;
  User.findOne = originalUserFindOne;
  BalanceWheel.countDocuments = originalBalanceWheelCountDocuments;
  MoodEntry.countDocuments = originalMoodEntryCountDocuments;
  TestEntry.countDocuments = originalTestEntryCountDocuments;
  process.env.NODE_ENV = originalNodeEnv;
  process.env.PORT = originalPort;

  if (failed > 0) {
    console.error(`\nHealth contract tests failed: ${failed} of ${passed + failed}`);
    process.exit(1);
  }

  console.log(`\nHealth contract tests passed: ${passed}/${passed + failed}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
