import User from '../models/User';
import { sendPasswordResetEmail } from './mailService';
import { createOpaqueToken, hashOpaqueToken } from '../utils/securityTokens';

const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const getResetPasswordUrl = (token: string): string => {
  const clientUrl = normalizeText(process.env.CLIENT_URL);
  if (!clientUrl) {
    throw new Error('CLIENT_URL не настроен');
  }

  return `${clientUrl.replace(/\/+$/g, '')}/reset-password?token=${encodeURIComponent(token)}`;
};

export const issuePasswordResetForUser = async (user: {
  _id: unknown;
  email: string;
  name: string;
}): Promise<void> => {
  const resetToken = createOpaqueToken(24);
  const resetTokenHash = hashOpaqueToken(resetToken);
  const resetExpiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        passwordResetTokenHash: resetTokenHash,
        passwordResetExpiresAt: resetExpiresAt,
      },
    }
  );

  try {
    await sendPasswordResetEmail({
      email: user.email,
      name: user.name,
      resetUrl: getResetPasswordUrl(resetToken),
    });
  } catch (mailError) {
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
        },
      }
    );

    throw mailError;
  }
};
