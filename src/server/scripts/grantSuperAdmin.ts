import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { resolve } from 'path';
import User from '../models/User';
import AdminAuditLog from '../models/AdminAuditLog';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

const connectDB = async (): Promise<void> => {
  const mongoUri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    'mongodb://127.0.0.1:27017/esports-mood-tracker';

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 5000,
  });
};

const disconnectDB = async (): Promise<void> => {
  await mongoose.disconnect();
};

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const main = async () => {
  const [emailArg] = process.argv.slice(2);

  if (!emailArg) {
    console.error('Использование: npm run grant-superadmin -- user@example.com');
    process.exitCode = 1;
    return;
  }

  try {
    await connectDB();

    const email = normalizeEmail(emailArg);
    const user = await User.findOne({ email });

    if (!user) {
      console.error(`Пользователь не найден: ${email}`);
      process.exitCode = 1;
      return;
    }

    const alreadySuperAdmin = user.isSuperAdmin === true && user.isActive !== false;

    user.isSuperAdmin = true;
    user.isActive = true;
    user.deactivatedAt = null;
    user.deactivatedReason = null;
    await user.save();

    await AdminAuditLog.create({
      actorUserId: null,
      targetUserId: user._id,
      action: 'grant_superadmin',
      meta: {
        source: 'cli',
        email: user.email,
        alreadySuperAdmin,
      },
    });

    console.log(alreadySuperAdmin ? 'Супер-админ уже был назначен ранее' : 'Супер-админ успешно назначен');
    console.log(`Пользователь: ${user.email}`);
  } catch (error) {
    console.error('Не удалось назначить супер-админа:', error);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
};

void main();
