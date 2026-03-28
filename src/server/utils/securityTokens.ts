import crypto from 'crypto';

export const createOpaqueToken = (size = 32): string => crypto.randomBytes(size).toString('hex');

export const hashOpaqueToken = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex');

export const createInviteCode = (prefix: string): string => {
  const normalizedPrefix = prefix.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6) || 'TEAM';
  return `${normalizedPrefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};
