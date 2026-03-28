import express from 'express';
import TestEntry from '../models/TestEntry';
import User from '../models/User';
import SleepEntry from '../models/SleepEntry';
import ScreenTime from '../models/ScreenTime';
import { protect, isStaff } from '../middleware/auth';
import {
  buildVisiblePlayersFilter,
  canAccessTargetUser,
  findAccessiblePlayerById,
  getScopedTeamId,
  isTeamStaffUser,
} from '../utils/teamAccess';

const router = express.Router();

const avg = (values: number[]) =>
  values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null;

const getStateIndex = (entry: any) => {
  const snapshot = entry?.stateSnapshot;
  if (!snapshot) return null;

  const focus = typeof snapshot.focus === 'number' ? snapshot.focus : null;
  const energy = typeof snapshot.energy === 'number' ? snapshot.energy : null;
  const mood = typeof snapshot.mood === 'number' ? snapshot.mood : null;
  const sleepHours = typeof snapshot.sleepHours === 'number' ? snapshot.sleepHours : null;
  const fatigue = typeof snapshot.fatigue === 'number' ? snapshot.fatigue : null;
  const stress = typeof snapshot.stress === 'number' ? snapshot.stress : null;

  if ([focus, energy, mood, sleepHours, fatigue, stress].some((value) => value === null)) {
    return null;
  }

  const raw = focus! + energy! + mood! + sleepHours! - fatigue! - stress!;
  return Number((raw / 3).toFixed(2));
};

// Создать новую запись о тесте
router.post('/', protect, async (req: any, res) => {
  try {
    if (isTeamStaffUser(req.user)) {
      return res.status(403).json({ message: 'Staff профиля team доступен только read-only режим тестов' });
    }

    console.log('Creating test entry:', req.body);
    const { 
      date, 
      name,
      link,
      screenshotUrl,
      isWeeklyTest,
      testType,
      scoreNormalized,
      rawScore,
      unit,
      durationSec,
      attempts,
      stateSnapshot,
      context,
      measuredAt
    } = req.body;

    const normalizedScore = typeof scoreNormalized === 'number'
      ? scoreNormalized
      : typeof rawScore === 'number'
        ? Math.max(0, Math.min(100, rawScore))
        : undefined;

    const testEntry = await TestEntry.create({
      userId: req.user._id,
      date: date || new Date(),
      name: name || testType || 'Тест',
      link,
      screenshotUrl,
      isWeeklyTest: isWeeklyTest || false,
      testType: testType || 'generic',
      scoreNormalized: normalizedScore,
      rawScore,
      unit,
      durationSec,
      attempts: attempts && attempts > 0 ? attempts : 1,
      stateSnapshot,
      context,
      recordedBy: req.user._id,
      measuredAt: measuredAt || date || new Date()
    });

    // Обновляем статус пользователя, что он завершил тест
    await User.findByIdAndUpdate(req.user._id, { completedTests: true });

    console.log('Test entry created:', testEntry._id);
    return res.status(201).json(testEntry);
  } catch (error) {
    console.error('Error creating test entry:', error);
    return res.status(500).json({ message: 'Error creating test entry' });
  }
});

// Получить все записи о тестах для текущего пользователя
router.get('/my', protect, async (req: any, res) => {
  try {
    console.log('Fetching test entries for user:', req.user._id);
    const entries = await TestEntry.find({ userId: req.user._id }).sort({ date: -1 });
    
    console.log(`Found ${entries.length} test entries`);
    return res.json(entries);
  } catch (error) {
    console.error('Error fetching test entries:', error);
    return res.status(500).json({ message: 'Error fetching test entries' });
  }
});

// Получить последний тест для текущего пользователя
router.get('/my/latest', protect, async (req: any, res) => {
  try {
    console.log('Fetching latest test entry for user:', req.user._id);
    const entry = await TestEntry.findOne({ userId: req.user._id }).sort({ date: -1 });
    
    if (!entry) {
      console.log('No test entry found');
      return res.status(404).json({ message: 'No test entry found' });
    }
    
    console.log('Latest test entry found:', entry._id);
    return res.json(entry);
  } catch (error) {
    console.error('Error fetching latest test entry:', error);
    return res.status(500).json({ message: 'Error fetching latest test entry' });
  }
});

router.get('/team-summary', protect, isStaff, async (req: any, res) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    if (to) {
      to.setHours(23, 59, 59, 999);
    }

    const players = await User.find(buildVisiblePlayersFilter(req.user))
      .select('_id name teamId teamName')
      .sort({ name: 1 })
      .lean();

    const playerIds = players.map((player: any) => player._id);
    if (!playerIds.length) {
      return res.json({
        success: true,
        summary: {
          teamId: getScopedTeamId(req.user) || null,
          teamName: req.user?.teamName || '',
          playersCount: 0,
          totalEntries: 0,
          weeklyEntries: 0,
          scoredEntries: 0,
          avgScore: null,
          avgStateIndex: null,
          avgSleepHours: null,
          avgScreenTimeHours: null,
        },
        byPlayer: [],
        byTestType: [],
        recentEntries: [],
      });
    }

    const testFilter: any = { userId: { $in: playerIds } };
    const dayFilter: any = { userId: { $in: playerIds } };
    if (from || to) {
      testFilter.measuredAt = {};
      dayFilter.date = {};
      if (from) {
        testFilter.measuredAt.$gte = from;
        dayFilter.date.$gte = from;
      }
      if (to) {
        testFilter.measuredAt.$lte = to;
        dayFilter.date.$lte = to;
      }
    }

    const [testEntries, sleepEntries, screenEntries] = await Promise.all([
      TestEntry.find(testFilter).populate('userId', 'name').sort({ measuredAt: -1 }).lean(),
      SleepEntry.find(dayFilter).lean(),
      ScreenTime.find(dayFilter).lean(),
    ]);

    const weeklyEntries = testEntries.filter((entry: any) => entry.isWeeklyTest);
    const scoredEntries = testEntries.filter((entry: any) => typeof entry.scoreNormalized === 'number');
    const stateIndexes = scoredEntries
      .map((entry: any) => getStateIndex(entry))
      .filter((value: number | null): value is number => typeof value === 'number');

    const sleepByPlayer = new Map<string, number[]>();
    sleepEntries.forEach((entry: any) => {
      const key = String(entry.userId);
      const values = sleepByPlayer.get(key) || [];
      values.push(Number(entry.hours));
      sleepByPlayer.set(key, values);
    });

    const screenByPlayer = new Map<string, number[]>();
    screenEntries.forEach((entry: any) => {
      const key = String(entry.userId);
      const values = screenByPlayer.get(key) || [];
      values.push(Number(entry.totalTime));
      screenByPlayer.set(key, values);
    });

    const testsByPlayer = new Map<string, any[]>();
    const testTypeMap = new Map<string, number[]>();
    testEntries.forEach((entry: any) => {
      const key = String((entry.userId as any)?._id || entry.userId);
      const values = testsByPlayer.get(key) || [];
      values.push(entry);
      testsByPlayer.set(key, values);

      const type = entry.testType || 'generic';
      const typeValues = testTypeMap.get(type) || [];
      if (typeof entry.scoreNormalized === 'number') {
        typeValues.push(entry.scoreNormalized);
      }
      testTypeMap.set(type, typeValues);
    });

    const byPlayer = players.map((player: any) => {
      const playerId = String(player._id);
      const playerTests = testsByPlayer.get(playerId) || [];
      const playerScores = playerTests
        .map((entry: any) => entry.scoreNormalized)
        .filter((value: unknown): value is number => typeof value === 'number');

      return {
        userId: playerId,
        name: player.name,
        entries: playerTests.length,
        weeklyEntries: playerTests.filter((entry: any) => entry.isWeeklyTest).length,
        avgScore: avg(playerScores),
        avgSleepHours: avg(sleepByPlayer.get(playerId) || []),
        avgScreenTimeHours: avg(screenByPlayer.get(playerId) || []),
        lastTestAt: playerTests[0]?.measuredAt || playerTests[0]?.date || null,
      };
    });

    const byTestType = Array.from(testTypeMap.entries()).map(([type, scores]) => ({
      type,
      entries: scores.length,
      avgScore: avg(scores),
    }));

    return res.json({
      success: true,
      summary: {
        teamId: getScopedTeamId(req.user) || null,
        teamName: players[0]?.teamName || req.user?.teamName || '',
        playersCount: players.length,
        totalEntries: testEntries.length,
        weeklyEntries: weeklyEntries.length,
        scoredEntries: scoredEntries.length,
        avgScore: avg(scoredEntries.map((entry: any) => entry.scoreNormalized)),
        avgStateIndex: avg(stateIndexes),
        avgSleepHours: avg(sleepEntries.map((entry: any) => Number(entry.hours))),
        avgScreenTimeHours: avg(screenEntries.map((entry: any) => Number(entry.totalTime))),
      },
      byPlayer,
      byTestType,
      recentEntries: testEntries.slice(0, 8).map((entry: any) => ({
        id: entry._id,
        userId: (entry.userId as any)?._id || entry.userId,
        playerName: (entry.userId as any)?.name || 'Игрок',
        name: entry.name,
        testType: entry.testType || 'generic',
        scoreNormalized: typeof entry.scoreNormalized === 'number' ? entry.scoreNormalized : null,
        measuredAt: entry.measuredAt || entry.date,
        isWeeklyTest: Boolean(entry.isWeeklyTest),
      })),
    });
  } catch (error) {
    console.error('Error fetching team test summary:', error);
    return res.status(500).json({ message: 'Error fetching team test summary' });
  }
});

// Для сотрудников: получить все тесты всех игроков
router.get('/all', protect, isStaff, async (req: any, res) => {
  try {
    console.log('Fetching all test entries (staff only)');
    const players = await User.find(buildVisiblePlayersFilter(req.user)).select('_id').lean();
    const playerIds = players.map((player: any) => player._id);
    const entries = await TestEntry.find({ userId: { $in: playerIds } })
      .populate('userId', 'name email')
      .sort({ date: -1 });
    
    console.log(`Found ${entries.length} test entries`);
    return res.json(entries);
  } catch (error) {
    console.error('Error fetching all test entries:', error);
    return res.status(500).json({ message: 'Error fetching all test entries' });
  }
});

// Для сотрудников: получить все тесты конкретного игрока
router.get('/player/:playerId', protect, isStaff, async (req: any, res) => {
  try {
    const { playerId } = req.params;
    console.log(`Fetching test entries for player: ${playerId}`);

    const player = await findAccessiblePlayerById(req.user, playerId);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }
    
    const entries = await TestEntry.find({ userId: player._id }).sort({ date: -1 });
    
    console.log(`Found ${entries.length} test entries for player`);
    return res.json(entries);
  } catch (error) {
    console.error('Error fetching player test entries:', error);
    return res.status(500).json({ message: 'Error fetching player test entries' });
  }
});

// Удалить запись о тесте
router.delete('/:id', protect, async (req: any, res) => {
  try {
    const { id } = req.params;
    console.log(`Attempting to delete test entry: ${id}`);
    
    const entry = await TestEntry.findById(id);
    
    if (!entry) {
      console.log(`Test entry not found: ${id}`);
      return res.status(404).json({ message: 'Test entry not found' });
    }
    
    // Проверяем, принадлежит ли запись текущему пользователю или пользователь - сотрудник
    if (entry.userId.toString() !== req.user._id.toString() && req.user.role !== 'staff') {
      console.log(`Unauthorized deletion attempt. Entry belongs to ${entry.userId}, request from ${req.user._id}`);
      return res.status(403).json({ message: 'Not authorized to delete this entry' });
    }

    if (isTeamStaffUser(req.user) && entry.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Staff профиля team не может удалять записи игроков' });
    }

    if (req.user.role === 'staff' && entry.userId.toString() !== req.user._id.toString()) {
      const owner = await User.findById(entry.userId).select('role playerType teamId');
      if (!canAccessTargetUser(req.user, owner)) {
        return res.status(403).json({ message: 'Not authorized to delete this entry' });
      }
    }
    
    await entry.deleteOne();
    console.log(`Test entry deleted successfully: ${id}`);
    return res.json({ message: 'Test entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting test entry:', error);
    return res.status(500).json({ message: 'Error deleting test entry' });
  }
});

export default router; 
