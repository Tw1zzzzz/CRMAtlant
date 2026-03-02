import express from 'express';
import TestEntry from '../models/TestEntry';
import User from '../models/User';
import { protect, isStaff } from '../middleware/auth';

const router = express.Router();

// Создать новую запись о тесте
router.post('/', protect, async (req: any, res) => {
  try {
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

// Для сотрудников: получить все тесты всех игроков
router.get('/all', protect, isStaff, async (_req: any, res) => {
  try {
    console.log('Fetching all test entries (staff only)');
    const entries = await TestEntry.find()
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
    
    const entries = await TestEntry.find({ userId: playerId }).sort({ date: -1 });
    
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
    
    await entry.deleteOne();
    console.log(`Test entry deleted successfully: ${id}`);
    return res.json({ message: 'Test entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting test entry:', error);
    return res.status(500).json({ message: 'Error deleting test entry' });
  }
});

export default router; 
