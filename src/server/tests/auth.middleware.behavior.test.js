require('./register-ts.cjs');
const assert = require('assert');
const path = require('path');

const jwtModule = require('../utils/jwt.ts');
const User = require('../models/User.ts').default;

const authModulePath = path.resolve(__dirname, '../middleware/auth.ts');
const originalVerifyJwt = jwtModule.verifyJwt;
const originalFindById = User.findById;
const originalJwtSecret = process.env.JWT_SECRET;
const originalPrivilegeKey = process.env.STAFF_PRIVILEGE_KEY;

let passed = 0;
let failed = 0;

const loadAuthModule = () => {
  delete require.cache[authModulePath];
  return require(authModulePath);
};

const createRequest = (overrides = {}) => ({
  method: 'GET',
  originalUrl: '/api/test',
  headers: {},
  ...overrides
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
  }
});

const runTest = async (name, fn) => {
  try {
    jwtModule.verifyJwt = originalVerifyJwt;
    User.findById = originalFindById;
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.STAFF_PRIVILEGE_KEY = originalPrivilegeKey;

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
  await runTest('protect denies request without Authorization header', async () => {
    const { protect } = loadAuthModule();
    const req = createRequest();
    const res = createResponse();
    let nextCalled = false;

    await protect(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.payload.message, /токен отсутствует/i);
  });

  await runTest('protect denies invalid token', async () => {
    jwtModule.verifyJwt = () => {
      throw new Error('broken token');
    };

    const { protect } = loadAuthModule();
    const req = createRequest({ headers: { authorization: 'Bearer broken' } });
    const res = createResponse();
    let nextCalled = false;

    await protect(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.payload.code, 'TOKEN_INVALID');
  });

  await runTest('protect sets req.user for valid token and existing user', async () => {
    jwtModule.verifyJwt = () => ({ id: 'u-1' });
    User.findById = () => ({
      select: async () => ({ _id: 'u-1', name: 'Operator', role: 'staff' })
    });

    const { protect } = loadAuthModule();
    const req = createRequest({ headers: { authorization: 'Bearer good' } });
    const res = createResponse();
    let nextCalled = false;

    await protect(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(req.user.role, 'staff');
  });

  await runTest('protect denies token when user is missing in database', async () => {
    jwtModule.verifyJwt = () => ({ id: 'u-missing' });
    User.findById = () => ({
      select: async () => null
    });

    const { protect } = loadAuthModule();
    const req = createRequest({ headers: { authorization: 'Bearer valid' } });
    const res = createResponse();
    let nextCalled = false;

    await protect(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.payload.message, /пользователь не найден/i);
  });

  await runTest('protect supports legacy JWT secret fallback', async () => {
    process.env.JWT_SECRET = 'brand-new-secret';
    jwtModule.verifyJwt = originalVerifyJwt;
    User.findById = () => ({
      select: async () => ({ _id: 'legacy-u', name: 'Legacy', role: 'staff' })
    });

    const legacyToken = jwtModule.signJwt({ id: 'legacy-u' }, 'your-secret-key', {
      expiresIn: '1h'
    });

    const { protect } = loadAuthModule();
    const req = createRequest({
      headers: { authorization: `Bearer ${legacyToken}` }
    });
    const res = createResponse();
    let nextCalled = false;

    await protect(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(req.user._id, 'legacy-u');
  });

  await runTest('isStaff allows only staff role', async () => {
    const { isStaff } = loadAuthModule();

    const staffReq = createRequest({ user: { role: 'staff', name: 'Alice' } });
    const staffRes = createResponse();
    let staffNext = false;
    isStaff(staffReq, staffRes, () => {
      staffNext = true;
    });
    assert.strictEqual(staffNext, true);

    const playerReq = createRequest({ user: { role: 'player', name: 'Bob' } });
    const playerRes = createResponse();
    let playerNext = false;
    isStaff(playerReq, playerRes, () => {
      playerNext = true;
    });
    assert.strictEqual(playerNext, false);
    assert.strictEqual(playerRes.statusCode, 403);
  });

  await runTest('isPlayer allows only player role', async () => {
    const { isPlayer } = loadAuthModule();

    const playerReq = createRequest({ user: { role: 'player', name: 'Bob' } });
    const playerRes = createResponse();
    let playerNext = false;
    isPlayer(playerReq, playerRes, () => {
      playerNext = true;
    });
    assert.strictEqual(playerNext, true);

    const staffReq = createRequest({ user: { role: 'staff', name: 'Alice' } });
    const staffRes = createResponse();
    let staffNext = false;
    isPlayer(staffReq, staffRes, () => {
      staffNext = true;
    });
    assert.strictEqual(staffNext, false);
    assert.strictEqual(staffRes.statusCode, 403);
  });

  await runTest('hasPrivilegeKey enforces configured key for staff updates', async () => {
    process.env.STAFF_PRIVILEGE_KEY = 'TOP_KEY';
    const { hasPrivilegeKey } = loadAuthModule();

    const okReq = createRequest({
      user: { role: 'staff', name: 'Lead', privilegeKey: 'TOP_KEY' }
    });
    const okRes = createResponse();
    let okNext = false;
    hasPrivilegeKey(okReq, okRes, () => {
      okNext = true;
    });
    assert.strictEqual(okNext, true);

    const badReq = createRequest({
      user: { role: 'staff', name: 'Lead', privilegeKey: 'WRONG' }
    });
    const badRes = createResponse();
    let badNext = false;
    hasPrivilegeKey(badReq, badRes, () => {
      badNext = true;
    });
    assert.strictEqual(badNext, false);
    assert.strictEqual(badRes.statusCode, 403);
    assert.strictEqual(badRes.payload.requiresPrivilegeKey, true);
  });

  jwtModule.verifyJwt = originalVerifyJwt;
  User.findById = originalFindById;
  process.env.JWT_SECRET = originalJwtSecret;
  process.env.STAFF_PRIVILEGE_KEY = originalPrivilegeKey;
  delete require.cache[authModulePath];

  if (failed > 0) {
    console.error(`\nAuth middleware tests failed: ${failed} of ${passed + failed}`);
    process.exit(1);
  }

  console.log(`\nAuth middleware tests passed: ${passed}/${passed + failed}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
