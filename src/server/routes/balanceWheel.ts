import express from 'express';
import BalanceWheel from '../models/BalanceWheel';
import User from '../models/User';
import { protect, isStaff } from '../middleware/auth';
import {
  buildVisiblePlayersFilter,
  findAccessiblePlayerById,
} from '../utils/teamAccess';

const router = express.Router();

const formatWheel = (wheel: any) => {
  const source = wheel?.toObject ? wheel.toObject() : wheel;

  return {
    id: String(source._id),
    userId: String(source.userId),
    date: source.date,
    physical: source.physical,
    emotional: source.emotional,
    intellectual: source.intellectual,
    spiritual: source.spiritual,
    occupational: source.occupational,
    social: source.social,
    environmental: source.environmental,
    financial: source.financial,
  };
};

const resolveBalanceWheelOwner = async (req: any, playerId: string) => {
  if (req.user?.role === 'staff') {
    return findAccessiblePlayerById(req.user, playerId, '_id role playerType teamId');
  }

  if (String(req.user?._id) !== playerId) {
    return null;
  }

  return User.findById(playerId).select('_id role playerType teamId');
};

router.post('/', protect, async (req: any, res) => {
  try {
    const {
      date,
      physical,
      emotional,
      intellectual,
      spiritual,
      occupational,
      social,
      environmental,
      financial
    } = req.body;

    const wheel = await BalanceWheel.create({
      userId: req.user._id,
      date: date || new Date(),
      physical,
      emotional,
      intellectual,
      spiritual,
      occupational,
      social,
      environmental,
      financial
    });

    await User.findByIdAndUpdate(req.user._id, { completedBalanceWheel: true });

    return res.status(201).json(wheel);
  } catch (error) {
    console.error('Error creating balance wheel:', error);
    return res.status(500).json({ message: 'Error creating balance wheel' });
  }
});

router.get('/my', protect, async (req: any, res) => {
  try {
    const wheels = await BalanceWheel.find({ userId: req.user._id }).sort({ date: -1 });
    return res.json({ data: wheels.map(formatWheel) });
  } catch (error) {
    console.error('Error fetching balance wheels:', error);
    return res.status(500).json({ message: 'Error fetching balance wheels' });
  }
});

router.get('/my/latest', protect, async (req: any, res) => {
  try {
    const wheel = await BalanceWheel.findOne({ userId: req.user._id }).sort({ date: -1 });

    if (!wheel) {
      return res.status(404).json({ message: 'No balance wheel found' });
    }

    return res.json(wheel);
  } catch (error) {
    console.error('Error fetching latest balance wheel:', error);
    return res.status(500).json({ message: 'Error fetching latest balance wheel' });
  }
});

router.get('/all', protect, isStaff, async (req: any, res) => {
  try {
    const players = await User.find(buildVisiblePlayersFilter(req.user)).select('_id').lean();
    const playerIds = players.map((player: any) => player._id);

    if (!playerIds.length) {
      return res.json([]);
    }

    const wheels = await BalanceWheel.find({ userId: { $in: playerIds } })
      .populate('userId', 'name email role playerType teamId teamName')
      .sort({ date: -1 });

    return res.json(wheels);
  } catch (error) {
    console.error('Error fetching all balance wheels:', error);
    return res.status(500).json({ message: 'Error fetching all balance wheels' });
  }
});

router.get('/player/:playerId', protect, async (req: any, res) => {
  try {
    const { playerId } = req.params;
    const owner = await resolveBalanceWheelOwner(req, playerId);

    if (!owner) {
      return res.status(404).json({ message: 'Игрок не найден' });
    }

    const wheels = await BalanceWheel.find({ userId: owner._id }).sort({ date: -1 });
    return res.json({ data: wheels.map(formatWheel) });
  } catch (error) {
    console.error('Ошибка при получении колес баланса игрока:', error);
    return res.status(500).json({
      message: 'Ошибка при получении колес баланса игрока',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
});

export default router;
