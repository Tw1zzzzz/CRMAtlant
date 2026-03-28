import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
import User from '../models/User';
import Plan from '../models/Plan';
import Subscription from '../models/Subscription';
import { ensurePlansSeeded } from '../config/paymentPlans';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

const DEFAULT_PLAN_NAME = 'PerformanceCoach CRM (1 месяц)';

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

const resolvePlan = async (planQuery?: string) => {
  await ensurePlansSeeded();

  if (!planQuery) {
    return Plan.findOne({ name: DEFAULT_PLAN_NAME, isActive: true });
  }

  const normalizedQuery = planQuery.trim().toLowerCase();

  const byId = await Plan.findOne({ _id: planQuery, isActive: true }).catch(() => null);
  if (byId) {
    return byId;
  }

  const plans = await Plan.find({ isActive: true }).lean();
  const matchedPlan = plans.find((plan) => plan.name.toLowerCase().includes(normalizedQuery));

  return matchedPlan ? Plan.findById(matchedPlan._id) : null;
};

const main = async () => {
  const [emailArg, ...planArgs] = process.argv.slice(2);
  const planQuery = planArgs.join(' ').trim() || undefined;

  if (!emailArg) {
    console.error('Использование: npm run unlock-subscription -- user@example.com [название тарифа или planId]');
    console.error('Пример: npm run unlock-subscription -- me@example.com "PerformanceCoach CRM"');
    process.exit(1);
  }

  try {
    await connectDB();

    const user = await User.findOne({ email: normalizeEmail(emailArg) });
    if (!user) {
      console.error(`Пользователь не найден: ${emailArg}`);
      process.exit(1);
    }

    const plan = await resolvePlan(planQuery);
    if (!plan) {
      console.error(`Тариф не найден: ${planQuery || DEFAULT_PLAN_NAME}`);
      process.exit(1);
    }

    await Subscription.updateMany(
      {
        userId: user._id,
        status: { $in: ['pending', 'active'] },
      },
      {
        $set: {
          status: 'cancelled',
        },
      }
    );

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + plan.periodDays * 24 * 60 * 60 * 1000);

    const subscription = await Subscription.create({
      userId: user._id,
      planId: plan._id,
      status: 'active',
      startedAt,
      expiresAt,
      robokassaInvoiceId: `dev-unlock-${randomUUID()}`,
    });

    user.subscription = subscription._id;
    await user.save();

    console.log('Dev-подписка активирована');
    console.log(`Пользователь: ${user.email}`);
    console.log(`Тариф: ${plan.name}`);
    console.log(`expiresAt: ${expiresAt.toISOString()}`);
  } catch (error) {
    console.error('Не удалось активировать dev-подписку:', error);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
};

void main();
