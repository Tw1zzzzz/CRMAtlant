import crypto from 'crypto';

const getRequiredEnv = (name: 'ROBOKASSA_LOGIN' | 'ROBOKASSA_PASS1' | 'ROBOKASSA_PASS2'): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
};

const md5 = (value: string): string => crypto.createHash('md5').update(value).digest('hex');

const formatAmount = (amount: number): string => amount.toFixed(2);

export const generatePaymentUrl = (invoiceId: string, amount: number, description: string): string => {
  const merchantLogin = getRequiredEnv('ROBOKASSA_LOGIN');
  const password1 = getRequiredEnv('ROBOKASSA_PASS1');
  const formattedAmount = formatAmount(amount);
  const signatureValue = md5(`${merchantLogin}:${formattedAmount}:${invoiceId}:${password1}`);
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

  return `https://auth.robokassa.ru/Merchant/Index.aspx?${params.toString()}`;
};

export const verifyResultSignature = (OutSum: string, InvId: string, SignatureValue: string): boolean => {
  const password2 = getRequiredEnv('ROBOKASSA_PASS2');
  const expectedSignature = md5(`${OutSum}:${InvId}:${password2}`);

  return expectedSignature.toLowerCase() === SignatureValue.toLowerCase();
};

export const verifySuccessSignature = (OutSum: string, InvId: string, SignatureValue: string): boolean => {
  const password1 = getRequiredEnv('ROBOKASSA_PASS1');
  const expectedSignature = md5(`${OutSum}:${InvId}:${password1}`);

  return expectedSignature.toLowerCase() === SignatureValue.toLowerCase();
};
