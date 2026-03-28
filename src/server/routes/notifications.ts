import express from 'express';
import { protect } from '../middleware/auth';
import { getCrmUpdates, type CrmUpdate } from '../data/crmUpdates';

const router = express.Router();

type AppNotification = CrmUpdate;

router.get('/', protect, async (_req: any, res) => {
  try {
    const notifications: AppNotification[] = getCrmUpdates();
    return res.json(notifications.slice(0, 25));
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ message: 'Error fetching notifications' });
  }
});

export default router;
