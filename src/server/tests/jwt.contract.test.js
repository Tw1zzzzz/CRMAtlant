require('./register-ts.cjs');
const assert = require('assert');
const crypto = require('crypto');

const { signJwt, verifyJwt } = require('../utils/jwt.ts');

let passed = 0;
let failed = 0;

const toBase64Url = (value) => {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

const decodeBase64UrlJson = (value) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
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

runTest('signJwt + verifyJwt return original payload fields', () => {
  const secret = 'jwt-contract-secret';
  const token = signJwt({ id: 'user-1', role: 'staff' }, secret, { expiresIn: '2h' });
  const payload = verifyJwt(token, secret);

  assert.strictEqual(payload.id, 'user-1');
  assert.strictEqual(payload.role, 'staff');
  assert.strictEqual(typeof payload.iat, 'number');
  assert.strictEqual(typeof payload.exp, 'number');
  assert(payload.exp - payload.iat >= 7199 && payload.exp - payload.iat <= 7201);
});

runTest('invalid expiresIn does not inject exp claim', () => {
  const secret = 'jwt-contract-secret';
  const token = signJwt({ id: 'user-2' }, secret, { expiresIn: 'unexpected-format' });
  const payload = verifyJwt(token, secret);
  assert.strictEqual(payload.id, 'user-2');
  assert.strictEqual(payload.exp, undefined);
});

runTest('verifyJwt rejects malformed token format', () => {
  assert.throws(() => verifyJwt('not.a.jwt.with.too.many.parts', 'x'), /Invalid token format/);
});

runTest('verifyJwt rejects token with invalid signature', () => {
  const token = signJwt({ id: 'user-3' }, 'secret-A', { expiresIn: '1h' });
  assert.throws(() => verifyJwt(token, 'secret-B'), /Invalid token signature/);
});

runTest('verifyJwt rejects tampered payload', () => {
  const secret = 'jwt-contract-secret';
  const token = signJwt({ id: 'safe-user' }, secret, { expiresIn: '1h' });
  const parts = token.split('.');
  const payload = decodeBase64UrlJson(parts[1]);
  payload.id = 'attacker';
  const tamperedToken = `${parts[0]}.${toBase64Url(JSON.stringify(payload))}.${parts[2]}`;

  assert.throws(() => verifyJwt(tamperedToken, secret), /Invalid token signature/);
});

runTest('verifyJwt rejects expired token', () => {
  const secret = 'jwt-contract-secret';
  const token = signJwt({ id: 'old-user' }, secret, { expiresIn: 0 });
  assert.throws(() => verifyJwt(token, secret), /Token expired/);
});

runTest('verifyJwt rejects unsupported algorithm even with valid signature bytes', () => {
  const secret = 'jwt-contract-secret';
  const header = toBase64Url(JSON.stringify({ alg: 'HS512', typ: 'JWT' }));
  const payload = toBase64Url(JSON.stringify({ id: 'user-4' }));
  const signingInput = `${header}.${payload}`;
  const signature = toBase64Url(
    crypto.createHmac('sha256', secret).update(signingInput).digest()
  );
  const token = `${signingInput}.${signature}`;

  assert.throws(() => verifyJwt(token, secret), /Unsupported token algorithm/);
});

if (failed > 0) {
  console.error(`\nJWT contract tests failed: ${failed} of ${passed + failed}`);
  process.exit(1);
}

console.log(`\nJWT contract tests passed: ${passed}/${passed + failed}`);
