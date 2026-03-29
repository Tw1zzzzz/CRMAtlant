import crypto from 'crypto';

type HashAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha384' | 'sha512';

const SUPPORTED_HASH_ALGORITHMS: HashAlgorithm[] = ['md5', 'sha1', 'sha256', 'sha384', 'sha512'];

const getRequiredEnv = (name: 'ROBOKASSA_LOGIN' | 'ROBOKASSA_PASS1' | 'ROBOKASSA_PASS2'): string => {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`${name} is not configured`);
  }

  return value.trim();
};

const getHashAlgorithm = (): HashAlgorithm => {
  const rawValue = (
    process.env.ROBOKASSA_HASH_ALGORITHM ||
    process.env.ROBOKASSA_HASH_ALGO ||
    'md5'
  )
    .toLowerCase()
    .trim() as HashAlgorithm;

  if (!SUPPORTED_HASH_ALGORITHMS.includes(rawValue)) {
    throw new Error(
      `Unsupported ROBOKASSA_HASH_ALGORITHM="${rawValue}". Supported: ${SUPPORTED_HASH_ALGORITHMS.join(', ')}`
    );
  }

  return rawValue;
};

const sign = (value: string): string => crypto.createHash(getHashAlgorithm()).update(value).digest('hex');

const formatAmount = (amount: number): string => amount.toFixed(2);

export const generatePaymentUrl = (invoiceId: string, amount: number, description: string): string => {
  const merchantLogin = getRequiredEnv('ROBOKASSA_LOGIN');
  const password1 = getRequiredEnv('ROBOKASSA_PASS1');
  const formattedAmount = formatAmount(amount);
  const signatureSource = `${merchantLogin}:${formattedAmount}:${invoiceId}:${password1}`;
  const signatureValue = sign(signatureSource);
  const params = new URLSearchParams({
    MerchantLogin: merchantLogin,
    OutSum: formattedAmount,
    InvId: invoiceId,
    Description: description,
    SignatureValue: signatureValue,
  });

  if (process.env.ROBOKASSA_TEST_MODE === 'true') {
    params.set('IsTest', '1');
  }

  console.log(
    `[ROBOKASSA] Payment link generated: invoiceId=${invoiceId} amount=${formattedAmount} hash=${getHashAlgorithm()} testMode=${process.env.ROBOKASSA_TEST_MODE === 'true'}`
  );

  return `https://auth.robokassa.ru/Merchant/Index.aspx?${params.toString()}`;
};

export const verifyResultSignature = (OutSum: string, InvId: string, SignatureValue: string): boolean => {
  const password2 = getRequiredEnv('ROBOKASSA_PASS2');
  const expectedSignature = sign(`${OutSum}:${InvId}:${password2}`);

  return expectedSignature.toLowerCase() === SignatureValue.toLowerCase();
};

export const verifySuccessSignature = (OutSum: string, InvId: string, SignatureValue: string): boolean => {
  const password1 = getRequiredEnv('ROBOKASSA_PASS1');
  const expectedSignature = sign(`${OutSum}:${InvId}:${password1}`);

  return expectedSignature.toLowerCase() === SignatureValue.toLowerCase();
};
