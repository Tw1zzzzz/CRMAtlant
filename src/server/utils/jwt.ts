import crypto from 'crypto';

type JwtPayload = Record<string, unknown> & {
  iat?: number;
  exp?: number;
};

const BASE64URL_RE = /-/g;
const BASE64URL_PAD_RE = /_/g;

const toBase64Url = (value: Buffer | string): string => {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

const fromBase64Url = (value: string): Buffer => {
  const normalized = value
    .replace(BASE64URL_RE, '+')
    .replace(BASE64URL_PAD_RE, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(padded, 'base64');
};

const parseExpiresIn = (expiresIn?: string | number): number | null => {
  if (typeof expiresIn === 'number' && Number.isFinite(expiresIn)) {
    return Math.max(0, Math.floor(expiresIn));
  }

  if (typeof expiresIn !== 'string') {
    return null;
  }

  const trimmed = expiresIn.trim();
  const match = trimmed.match(/^(\d+)\s*([smhd])$/i);
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 60 * 60 * 24
  };

  return value * multipliers[unit];
};

const signHmac = (message: string, secret: string): string => {
  return toBase64Url(crypto.createHmac('sha256', secret).update(message).digest());
};

export const signJwt = (
  payload: JwtPayload,
  secret: string,
  options?: { expiresIn?: string | number }
): string => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const expOffset = parseExpiresIn(options?.expiresIn);
  const payloadWithMeta: JwtPayload = {
    ...payload,
    iat: now,
    ...(expOffset !== null ? { exp: now + expOffset } : {})
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payloadWithMeta));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = signHmac(signingInput, secret);

  return `${signingInput}.${signature}`;
};

export const verifyJwt = <T extends JwtPayload>(token: string, secret: string): T => {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = signHmac(signingInput, secret);

  const actualBuffer = Buffer.from(encodedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  const signaturesMatch =
    actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer);

  if (!signaturesMatch) {
    throw new Error('Invalid token signature');
  }

  const header = JSON.parse(fromBase64Url(encodedHeader).toString('utf8'));
  if (header.alg !== 'HS256') {
    throw new Error('Unsupported token algorithm');
  }

  const payload = JSON.parse(fromBase64Url(encodedPayload).toString('utf8')) as T;
  if (typeof payload.exp === 'number') {
    const now = Math.floor(Date.now() / 1000);
    if (now >= payload.exp) {
      throw new Error('Token expired');
    }
  }

  return payload;
};
