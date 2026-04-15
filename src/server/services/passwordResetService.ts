import User from '../models/User';
import { sendPasswordResetEmail } from './mailService';
import { createOpaqueToken, hashOpaqueToken } from '../utils/securityTokens';
import { buildPublicAppUrl } from '../utils/publicAppUrl';

const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

export const issuePasswordResetForUser = async (user: {
  _id: unknown;
  email: string;
  name: string;
}, clientUrl?: string): Promise<void> => {
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
      resetUrl: buildPublicAppUrl(`/reset-password?token=${encodeURIComponent(resetToken)}`, {
        baseUrl: clientUrl,
      }),
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
