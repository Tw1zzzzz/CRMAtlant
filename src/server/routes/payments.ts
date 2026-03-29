import express from 'express';
import Plan from '../models/Plan';
import Subscription from '../models/Subscription';
import User from '../models/User';
import { protect } from '../middleware/authMiddleware';
import type { AuthRequest } from '../types';
import { ensurePlansSeeded } from '../config/paymentPlans';
import {
  generatePaymentUrl,
  verifyResultSignature,
  verifySuccessSignature,
} from '../services/robokassaService';

const router = express.Router();

const formatAmount = (amount: number): string => amount.toFixed(2);
const generateRobokassaInvoiceId = (): string =>
  `${Date.now()}${Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0')}`;

router.get('/plans', async (_req, res) => {
  try {
    await ensurePlansSeeded();

    const plans = await Plan.find({ isActive: true }).sort({ price: 1, periodDays: 1 }).lean();

    return res.json(
      plans.map((plan) => ({
        id: String(plan._id),
        name: plan.name,
        price: Number(plan.price.toFixed(2)),
        periodDays: plan.periodDays,
        features: plan.features,
        isActive: plan.isActive,
      }))
    );
  } catch (error) {
    console.error('[PAYMENTS] Failed to fetch plans:', error);
    return res.status(500).json({ message: 'Не удалось загрузить тарифы' });
  }
});

router.post('/create-invoice', protect, async (req: AuthRequest, res) => {
  try {
    await ensurePlansSeeded();

    const userId = req.user?._id;
    const { planId } = req.body as { planId?: string };

    if (!userId) {
      return res.status(401).json({ message: 'Пользователь не авторизован' });
    }

    if (!planId) {
      return res.status(400).json({ message: 'Не указан planId' });
    }

    const plan = await Plan.findOne({ _id: planId, isActive: true });

    if (!plan) {
      return res.status(404).json({ message: 'Тариф не найден' });
    }

    let invoiceId = '';
    let subscription = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      invoiceId = generateRobokassaInvoiceId();

      try {
        subscription = await Subscription.create({
          userId,
          planId: plan._id,
          status: 'pending',
          robokassaInvoiceId: invoiceId,
        });
        break;
      } catch (error) {
        const duplicateKeyErrorCode = 11000;
        if ((error as { code?: number }).code !== duplicateKeyErrorCode) {
          throw error;
        }
      }
    }

    if (!subscription) {
      throw new Error('Failed to allocate unique Robokassa invoice id');
    }

    console.log(`[PAYMENTS] Invoice created: invoiceId=${invoiceId} status=${subscription.status}`);

    const paymentUrl = generatePaymentUrl(
      invoiceId,
      Number(plan.price.toFixed(2)),
      plan.name
    );

    return res.json({ paymentUrl });
  } catch (error) {
    console.error('[PAYMENTS] Failed to create invoice:', error);
    return res.status(500).json({ message: 'Не удалось создать счёт на оплату' });
  }
});

router.post('/result', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const { OutSum, InvId, SignatureValue } = req.body as {
      OutSum?: string;
      InvId?: string;
      SignatureValue?: string;
    };

    if (!OutSum || !InvId || !SignatureValue) {
      return res.status(400).send('Missing required fields');
    }

    const isValidSignature = verifyResultSignature(OutSum, InvId, SignatureValue);

    if (!isValidSignature) {
      console.log(`[PAYMENTS] Result signature mismatch: invoiceId=${InvId} status=invalid-signature`);
      return res.status(400).send('Invalid signature');
    }

    const subscription = await Subscription.findOne({ robokassaInvoiceId: InvId });

    if (!subscription) {
      return res.status(404).send('Subscription not found');
    }

    if (subscription.status === 'active') {
      console.log(`[PAYMENTS] Result idempotent success: invoiceId=${InvId} status=active`);
      res.type('text/plain');
      return res.send(`OK${InvId}`);
    }

    const plan = await Plan.findById(subscription.planId);

    if (!plan) {
      return res.status(404).send('Plan not found');
    }

    if (formatAmount(plan.price) !== formatAmount(Number(OutSum))) {
      console.log(`[PAYMENTS] Result amount mismatch: invoiceId=${InvId} status=amount-mismatch`);
      return res.status(400).send('Invalid amount');
    }

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + plan.periodDays * 24 * 60 * 60 * 1000);

    subscription.status = 'active';
    subscription.startedAt = startedAt;
    subscription.expiresAt = expiresAt;
    await subscription.save();

    await User.findByIdAndUpdate(subscription.userId, {
      subscription: subscription._id,
    });

    console.log(`[PAYMENTS] Result processed: invoiceId=${InvId} status=active`);
    res.type('text/plain');
    return res.send(`OK${InvId}`);
  } catch (error) {
    console.error('[PAYMENTS] Failed to process result callback:', error);
    return res.status(500).send('Server error');
  }
});

router.get('/success', async (req, res) => {
  try {
    const { OutSum, InvId, SignatureValue } = req.query as {
      OutSum?: string;
      InvId?: string;
      SignatureValue?: string;
    };

    if (OutSum && InvId && SignatureValue && !verifySuccessSignature(OutSum, InvId, SignatureValue)) {
      return res.status(400).json({ success: false, message: 'Неверная подпись успеха' });
    }

    if (InvId) {
      const subscription = await Subscription.findOne({ robokassaInvoiceId: InvId }).populate('planId');
      const plan = subscription?.planId as { _id?: unknown; name?: string } | undefined;
      const isActiveNow = Boolean(
        subscription?.status === 'active' &&
        subscription?.expiresAt &&
        new Date(subscription.expiresAt).getTime() > Date.now()
      );

      return res.json({
        success: true,
        planId: plan?._id ? String(plan._id) : undefined,
        planName: plan?.name,
        status: subscription?.status || 'pending',
        hasAccess: isActiveNow,
      });
    }

    return res.json({ success: true, status: 'pending', hasAccess: false });
  } catch (error) {
    console.error('[PAYMENTS] Failed to handle success callback:', error);
    return res.status(500).json({ success: false, message: 'Не удалось обработать успешную оплату' });
  }
});

router.get('/fail', (req, res) => {
  const reason = typeof req.query.reason === 'string' ? req.query.reason : undefined;

  return res.json({
    success: false,
    reason,
  });
});

export default router;
