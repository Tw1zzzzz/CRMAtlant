import express from 'express';
import MoodEntry from '../models/MoodEntry';
import TestEntry from '../models/TestEntry';
import BalanceWheel from '../models/BalanceWheel';
import User from '../models/User';
import { protect } from '../middleware/auth';

const router = express.Router();

type AppNotification = {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  type: 'mood' | 'test' | 'balance' | 'account';
};

router.get('/', protect, async (req: any, res) => {
  try {
    const isStaff = req.user.role === 'staff';
    const userFilter = isStaff ? {} : { userId: req.user._id };

    const [moodEntries, testEntries, balanceEntries, recentUsers] = await Promise.all([
      MoodEntry.find(userFilter).sort({ date: -1 }).limit(8).populate('userId', 'name'),
      TestEntry.find(userFilter).sort({ measuredAt: -1, date: -1 }).limit(8).populate('userId', 'name'),
      BalanceWheel.find(userFilter).sort({ date: -1 }).limit(8).populate('userId', 'name'),
      isStaff
        ? User.find({ role: 'player' }).sort({ createdAt: -1 }).limit(5).select('name createdAt')
        : Promise.resolve([])
    ]);

    const notifications: AppNotification[] = [];

    for (const entry of moodEntries as any[]) {
      notifications.push({
        id: `mood-${entry._id}`,
        type: 'mood',
        title: 'Обновление настроения',
        description: `${entry.userId?.name || 'Игрок'}: настроение ${entry.mood}, энергия ${entry.energy}`,
        createdAt: new Date(entry.date)
      });
    }

    for (const entry of testEntries as any[]) {
      const measured = entry.measuredAt || entry.date;
      notifications.push({
        id: `test-${entry._id}`,
        type: 'test',
        title: 'Новый результат теста',
        description: `${entry.userId?.name || 'Игрок'}: ${entry.name || entry.testType || 'Тест'}${typeof entry.scoreNormalized === 'number' ? ` (${entry.scoreNormalized}%)` : ''}`,
        createdAt: new Date(measured)
      });
    }

    for (const entry of balanceEntries as any[]) {
      notifications.push({
        id: `balance-${entry._id}`,
        type: 'balance',
        title: 'Обновлено колесо баланса',
        description: `${entry.userId?.name || 'Игрок'} обновил колесо баланса`,
        createdAt: new Date(entry.date)
      });
    }

    for (const player of recentUsers as any[]) {
      notifications.push({
        id: `account-${player._id}`,
        type: 'account',
        title: 'Новый игрок в системе',
        description: `${player.name} зарегистрирован в CRM`,
        createdAt: new Date(player.createdAt)
      });
    }

    notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return res.json(notifications.slice(0, 25));
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ message: 'Error fetching notifications' });
  }
});

export default router;
