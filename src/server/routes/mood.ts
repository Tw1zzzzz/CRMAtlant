import express from 'express';
import MoodEntry from '../models/MoodEntry';
import User from '../models/User';
import ActivityHistory from '../models/ActivityHistory';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Middleware для проверки аутентификации
const protect = async (req: any, res: any, next: any) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      req.user = await User.findById((decoded as any).id).select('-password');
      if (!req.user) {
        console.log('User not found for token');
        return res.status(401).json({ message: 'User not found' });
      }
      console.log('Authenticated user:', req.user._id);
      next();
    } catch (error) {
      console.error('Token verification failed:', error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    console.log('No token provided');
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Middleware для проверки прав сотрудника
const isStaff = (req: any, res: any, next: any) => {
  if (req.user && req.user.role === 'staff') {
    console.log('Staff access granted for user:', req.user._id);
    next();
  } else {
    console.log('Staff access denied for user:', req.user?._id);
    return res.status(403).json({ message: 'Not authorized as staff' });
  }
};

// Создать новую запись о настроении
router.post('/', protect, async (req: any, res) => {
  try {
    console.log('[MoodRoutes] Creating mood entry:', req.body);
    const { 
      date, 
      timeOfDay,
      mood,
      energy,
      comment
    } = req.body;

    const moodEntry = await MoodEntry.create({
      userId: req.user._id,
      date: date || new Date(),
      timeOfDay,
      mood,
      energy,
      comment
    });

    console.log('[MoodRoutes] Mood entry created with ID:', moodEntry._id);

    // Создаем запись в истории активности
    try {
      const activityData = {
        userId: req.user._id,
        action: 'mood_track',
        entityType: 'mood',
        entityId: moodEntry._id,
        details: {
          mood,
          energy,
          timeOfDay
        },
        timestamp: new Date()
      };
      
      console.log('[MoodRoutes] Creating activity history record with data:', JSON.stringify(activityData));
      
      const activityRecord = await ActivityHistory.create(activityData);
      
      console.log('[MoodRoutes] Activity record created successfully:', {
        recordId: activityRecord._id,
        userId: activityRecord.userId,
        action: activityRecord.action,
        timestamp: activityRecord.timestamp
      });
    } catch (activityError) {
      console.error('[MoodRoutes] Error creating activity record:', activityError);
      // Не прерываем запрос даже если запись активности не создалась
    }

    console.log('[MoodRoutes] Returning response for mood entry:', moodEntry._id);
    return res.status(201).json(moodEntry);
  } catch (error) {
    console.error('[MoodRoutes] Error creating mood entry:', error);
    return res.status(500).json({ message: 'Error creating mood entry' });
  }
});

// Получить все записи о настроении для текущего пользователя
router.get('/my', protect, async (req: any, res) => {
  try {
    console.log('Fetching mood entries for user:', req.user._id);
    const entries = await MoodEntry.find({ userId: req.user._id }).sort({ date: -1 });
    
    console.log(`Found ${entries.length} mood entries`);
    return res.json(entries);
  } catch (error) {
    console.error('Error fetching mood entries:', error);
    return res.status(500).json({ message: 'Error fetching mood entries' });
  }
});

// Получить последнюю запись о настроении для текущего пользователя
router.get('/my/latest', protect, async (req: any, res) => {
  try {
    console.log('Fetching latest mood entry for user:', req.user._id);
    const entry = await MoodEntry.findOne({ userId: req.user._id }).sort({ date: -1 });
    
    if (!entry) {
      console.log('No mood entry found');
      return res.status(404).json({ message: 'No mood entry found' });
    }
    
    console.log('Latest mood entry found:', entry._id);
    return res.json(entry);
  } catch (error) {
    console.error('Error fetching latest mood entry:', error);
    return res.status(500).json({ message: 'Error fetching latest mood entry' });
  }
});

// Для сотрудников: получить все записи о настроении всех игроков
router.get('/all', protect, isStaff, async (_req: any, res) => {
  try {
    console.log('Fetching all mood entries (staff only)');
    const entries = await MoodEntry.find()
      .populate('userId', 'name email')
      .sort({ date: -1 });
    
    console.log(`Found ${entries.length} mood entries`);
    return res.json(entries);
  } catch (error) {
    console.error('Error fetching all mood entries:', error);
    return res.status(500).json({ message: 'Error fetching all mood entries' });
  }
});

// Для сотрудников: получить все записи о настроении конкретного игрока
router.get('/player/:playerId', protect, isStaff, async (req: any, res) => {
  try {
    const { playerId } = req.params;
    console.log(`Fetching mood entries for player: ${playerId}`);
    
    // Проверяем валидность ID
    if (!playerId || playerId === 'undefined' || playerId === 'null') {
      console.error(`Invalid player ID received: ${playerId}`);
      return res.status(400).json({ message: 'Invalid player ID' });
    }
    
    // Проверка на валидный ObjectId для MongoDB
    if (!/^[0-9a-fA-F]{24}$/.test(playerId)) {
      console.error(`Invalid MongoDB ObjectId format: ${playerId}`);
      return res.status(400).json({ message: 'Invalid player ID format' });
    }
    
    // Получаем записи о настроении игрока
    try {
      const entries = await MoodEntry.find({ userId: playerId }).sort({ date: -1 });
      console.log(`Found ${entries.length} mood entries for player ${playerId}`);
      return res.json(entries);
    } catch (dbError) {
      console.error(`Database error when fetching entries for player ${playerId}:`, dbError);
      return res.status(500).json({ message: 'Database error when fetching player entries' });
    }
  } catch (error) {
    console.error('Error fetching player mood entries:', error);
    return res.status(500).json({ 
      message: 'Error fetching player mood entries',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Для сотрудников: получить записи о настроении игрока за указанную дату
router.get('/player/:playerId/by-date', protect, isStaff, async (req: any, res) => {
  try {
    const { playerId } = req.params;
    const { date } = req.query;
    
    console.log(`Fetching mood entries for player: ${playerId} on date: ${date}`);
    
    // Проверяем наличие даты
    if (!date) {
      console.error('Date parameter is missing');
      return res.status(400).json({ message: 'Date parameter is required' });
    }
    
    // Проверяем валидность ID
    if (!playerId || playerId === 'undefined' || playerId === 'null') {
      console.error(`Invalid player ID received: ${playerId}`);
      return res.status(400).json({ message: 'Invalid player ID' });
    }
    
    // Проверка на валидный ObjectId для MongoDB
    if (!/^[0-9a-fA-F]{24}$/.test(playerId)) {
      console.error(`Invalid MongoDB ObjectId format: ${playerId}`);
      return res.status(400).json({ message: 'Invalid player ID format' });
    }
    
    // Создаем объекты Date для начала и конца выбранного дня
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    
    // Получаем записи о настроении игрока за указанную дату
    try {
      const entries = await MoodEntry.find({ 
        userId: playerId,
        date: { $gte: startDate, $lte: endDate } 
      }).sort({ date: -1 });
      
      console.log(`Found ${entries.length} mood entries for player ${playerId} on date ${date}`);
      return res.json(entries);
    } catch (dbError) {
      console.error(`Database error when fetching entries for player ${playerId} on date ${date}:`, dbError);
      return res.status(500).json({ message: 'Database error when fetching player entries' });
    }
  } catch (error) {
    console.error('Error fetching player mood entries by date:', error);
    return res.status(500).json({ 
      message: 'Error fetching player mood entries by date',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Удалить запись о настроении
router.delete('/:id', protect, async (req: any, res) => {
  try {
    const { id } = req.params;
    
    // Проверяем валидность ID
    if (!id || id === 'undefined' || id === 'null') {
      console.error(`Invalid mood entry ID received: ${id}`);
      return res.status(400).json({ message: 'Invalid mood entry ID' });
    }
    
    console.log(`Attempting to delete mood entry: ${id}`);
    
    // Проверка на валидный ObjectId для MongoDB
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error(`Invalid MongoDB ObjectId format: ${id}`);
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    
    const entry = await MoodEntry.findById(id);
    
    if (!entry) {
      console.log(`Mood entry not found: ${id}`);
      return res.status(404).json({ message: 'Mood entry not found' });
    }
    
    // Проверяем, принадлежит ли запись текущему пользователю или пользователь - сотрудник
    if (entry.userId.toString() !== req.user._id.toString() && req.user.role !== 'staff') {
      console.log(`Unauthorized deletion attempt. Entry belongs to ${entry.userId}, request from ${req.user._id}`);
      return res.status(403).json({ message: 'Not authorized to delete this entry' });
    }
    
    await entry.deleteOne();
    console.log(`Mood entry deleted successfully: ${id}`);
    return res.json({ message: 'Mood entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting mood entry:', error);
    return res.status(500).json({ message: 'Error deleting mood entry' });
  }
});

export default router; 