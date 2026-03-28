import express from 'express';
import BalanceWheel from '../models/BalanceWheel';
import MoodEntry from '../models/MoodEntry';
import SleepEntry from '../models/SleepEntry';
import TestEntry from '../models/TestEntry';
import User from '../models/User';
import { protect, isStaff } from '../middleware/authMiddleware';
import {
  buildVisiblePlayersFilter,
  canAccessTargetUser,
  findAccessiblePlayerById,
} from '../utils/teamAccess';

const router = express.Router();

const getVisiblePlayers = async (user: any) =>
  User.find(buildVisiblePlayersFilter(user)).select('_id name email').lean();

const getVisiblePlayerIds = async (user: any) => {
  const players = await getVisiblePlayers(user);
  return players.map((player: any) => player._id);
};

// Получить статистику настроения для текущего пользователя
router.get('/mood', protect, async (req: any, res) => {
  try {
    console.log('Fetching mood stats for user:', req.user._id);
    
    // Получаем все записи о настроении пользователя
    const userMoodEntries = await MoodEntry.find({ userId: req.user._id }).sort({ date: -1 });
    console.log(`Found ${userMoodEntries.length} mood entries for user ${req.user._id}`);
    
    // Возвращаем данные
    return res.json(userMoodEntries);
  } catch (error) {
    console.error('Error fetching mood stats:', error);
    return res.status(500).json({ message: 'Error fetching mood stats' });
  }
});

// Получить статистику тестов для текущего пользователя
router.get('/tests', protect, async (req: any, res) => {
  try {
    console.log('Fetching test stats for user:', req.user._id);
    
    // Получаем все записи о тестах пользователя
    const userTestEntries = await TestEntry.find({ userId: req.user._id }).sort({ date: -1 });
    console.log(`Found ${userTestEntries.length} test entries for user ${req.user._id}`);
    
    // Возвращаем данные
    return res.json(userTestEntries);
  } catch (error) {
    console.error('Error fetching test stats:', error);
    return res.status(500).json({ message: 'Error fetching test stats' });
  }
});

// Получить статистику сна для текущего пользователя
router.get('/sleep', protect, async (req: any, res) => {
  try {
    console.log('Fetching sleep stats for user:', req.user._id);

    const userSleepEntries = await SleepEntry.find({ userId: req.user._id }).sort({ date: -1 });
    console.log(`Found ${userSleepEntries.length} sleep entries for user ${req.user._id}`);

    return res.json(userSleepEntries);
  } catch (error) {
    console.error('Error fetching sleep stats:', error);
    return res.status(500).json({ message: 'Error fetching sleep stats' });
  }
});

// Для сотрудников: получить статистику настроения всех игроков
router.get('/players/mood', protect, isStaff, async (req: any, res) => {
  try {
    console.log('Fetching mood stats for all players (staff only)');
    const visiblePlayerIds = await getVisiblePlayerIds(req.user);
    const filter: any = { userId: { $in: visiblePlayerIds } };
    if (req.query.date) {
      const startDate = new Date(req.query.date as string);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(req.query.date as string);
      endDate.setHours(23, 59, 59, 999);
      filter.date = { $gte: startDate, $lte: endDate };
    }
    const allMoodEntries = await MoodEntry.find(filter).populate('userId', 'name email');
    console.log(`Found ${allMoodEntries.length} total mood entries`);
    
    // Группируем записи по пользователям и вычисляем средние значения
    const userMoodMap = new Map();
    
    allMoodEntries.forEach(entry => {
      if (!entry.userId) return;
      
      const userId = entry.userId.toString();
      const userName = (entry.userId as any).name || 'Неизвестный игрок';
      
      if (!userMoodMap.has(userId)) {
        userMoodMap.set(userId, {
          userId,
          name: userName,
          moodValues: [],
          energyValues: [],
          lastActivity: null
        });
      }
      
      const userData = userMoodMap.get(userId);
      userData.moodValues.push(entry.mood);
      userData.energyValues.push(entry.energy);
      
      // Обновляем дату последней активности
      const entryDate = new Date(entry.date);
      if (!userData.lastActivity || entryDate > userData.lastActivity) {
        userData.lastActivity = entryDate;
      }
    });
    
    // Преобразуем Map в массив и вычисляем средние значения
    const result = Array.from(userMoodMap.values()).map(userData => {
      const moodSum = userData.moodValues.reduce((sum: number, val: number): number => sum + val, 0);
      const energySum = userData.energyValues.reduce((sum: number, val: number): number => sum + val, 0);
      
      return {
        userId: userData.userId,
        name: userData.name,
        mood: userData.moodValues.length > 0 
          ? parseFloat((moodSum / userData.moodValues.length).toFixed(1)) 
          : 0,
        energy: userData.energyValues.length > 0 
          ? parseFloat((energySum / userData.energyValues.length).toFixed(1)) 
          : 0,
        entries: userData.moodValues.length,
        lastActivity: userData.lastActivity
      };
    });
    
    console.log(`Processed mood stats for ${result.length} players`);
    return res.json(result);
  } catch (error) {
    console.error('Error fetching all players mood stats:', error);
    return res.status(500).json({ message: 'Error fetching all players mood stats' });
  }
});

// Для сотрудников: получить статистику сна всех игроков
router.get('/players/sleep', protect, isStaff, async (req: any, res) => {
  try {
    console.log('Fetching sleep stats for all players (staff only)');

    const visiblePlayerIds = await getVisiblePlayerIds(req.user);
    const allSleepEntries = await SleepEntry.find({ userId: { $in: visiblePlayerIds } }).populate('userId', 'name email');
    console.log(`Found ${allSleepEntries.length} total sleep entries`);

    const userSleepMap = new Map();

    allSleepEntries.forEach(entry => {
      if (!entry.userId) return;

      const userId = entry.userId.toString();
      const userName = (entry.userId as any).name || 'Неизвестный игрок';

      if (!userSleepMap.has(userId)) {
        userSleepMap.set(userId, {
          userId,
          name: userName,
          sleepValues: [],
          lastEntry: null
        });
      }

      const userData = userSleepMap.get(userId);
      userData.sleepValues.push(entry.hours);

      const entryDate = new Date(entry.date);
      if (!userData.lastEntry || entryDate > userData.lastEntry) {
        userData.lastEntry = entryDate;
      }
    });

    const result = Array.from(userSleepMap.values()).map(userData => {
      const sleepSum = userData.sleepValues.reduce((sum: number, value: number) => sum + value, 0);

      return {
        userId: userData.userId,
        name: userData.name,
        avgSleep: userData.sleepValues.length > 0
          ? parseFloat((sleepSum / userData.sleepValues.length).toFixed(1))
          : 0,
        entries: userData.sleepValues.length,
        lastEntry: userData.lastEntry
      };
    });

    console.log(`Processed sleep stats for ${result.length} players`);
    return res.json(result);
  } catch (error) {
    console.error('Error fetching all players sleep stats:', error);
    return res.status(500).json({ message: 'Error fetching all players sleep stats' });
  }
});

// Для сотрудников: получить данные активности игрока за указанный период
router.get('/players/:playerId/activity', protect, isStaff, async (req: any, res) => {
  try {
    const { playerId } = req.params;
    const days = parseInt(req.query.days) || 14; // По умолчанию 14 дней
    
    console.log(`Fetching activity data for player: ${playerId}, days: ${days} (staff only)`);
    
    // Проверяем валидность ID
    if (!playerId || playerId === 'undefined' || playerId === 'null') {
      console.error(`Invalid player ID received for activity data: ${playerId}`);
      return res.status(400).json({ message: 'Invalid player ID' });
    }
    
    // Рассчитываем диапазон дат
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    try {
      // Извлекаем ID игрока из параметра
      // Проверяем, если playerId содержит объект игрока, как в URL из логов ошибок
      let actualPlayerId = playerId;
      
      // Если playerId содержит JSON-строку с объектом игрока
      if (playerId.includes('_id:') || playerId.includes('ObjectId')) {
        try {
          // Извлечение ID из строки
          const matches = playerId.match(/ObjectId\(['"]([0-9a-fA-F]{24})['"]\)/);
          if (matches && matches[1]) {
            actualPlayerId = matches[1];
            console.log(`Extracted player ID from object string: ${actualPlayerId}`);
          } else {
            console.error(`Failed to extract player ID from object string: ${playerId}`);
            return res.status(400).json({ message: 'Invalid player ID format in object string' });
          }
        } catch (parseError) {
          console.error(`Error parsing player ID from object string: ${playerId}`, parseError);
          return res.status(400).json({ message: 'Invalid player ID format in object string' });
        }
      }
      
      // Проверка на валидный ObjectId для MongoDB
      if (!/^[0-9a-fA-F]{24}$/.test(actualPlayerId)) {
        console.error(`Invalid MongoDB ObjectId format for activity data: ${actualPlayerId}`);
        return res.status(400).json({ message: 'Invalid player ID format' });
      }

      const accessiblePlayer = await findAccessiblePlayerById(req.user, actualPlayerId, '_id');
      if (!accessiblePlayer) {
        return res.status(404).json({ message: 'Player not found' });
      }
      
      // Получаем все записи о настроении игрока за указанный период
      const moodEntries = await MoodEntry.find({ 
        userId: accessiblePlayer._id,
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: 1 });
      
      console.log(`Found ${moodEntries.length} activity entries for player ${actualPlayerId} in the last ${days} days`);
      
      // Преобразуем записи в формат для графика активности
      const activityData = moodEntries.map(entry => ({
        date: entry.date,
        timeOfDay: entry.timeOfDay,
        mood: entry.mood,
        energy: entry.energy
      }));
      
      return res.json(activityData);
    } catch (dbError) {
      console.error(`Database error when processing activity data for player ${playerId}:`, dbError);
      return res.status(500).json({ message: 'Database error when processing activity data' });
    }
  } catch (error) {
    console.error('Error fetching player activity data:', error);
    return res.status(500).json({ 
      message: 'Error fetching player activity data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Для сотрудников: получить статистику тестов всех игроков
router.get('/players/tests', protect, isStaff, async (req: any, res) => {
  try {
    console.log('Fetching test stats for all players (staff only)');
    const visiblePlayerIds = await getVisiblePlayerIds(req.user);
    const allTestEntries = await TestEntry.find({ userId: { $in: visiblePlayerIds } }).populate('userId', 'name email');
    console.log(`Found ${allTestEntries.length} total test entries`);
    
    // Группируем записи по пользователям
    const userTestMap = new Map();
    
    allTestEntries.forEach(entry => {
      if (!entry.userId) return;
      
      const userId = entry.userId.toString();
      const userName = (entry.userId as any).name || 'Неизвестный игрок';
      
      if (!userTestMap.has(userId)) {
        userTestMap.set(userId, {
          userId,
          name: userName,
          tests: [],
          lastTest: null
        });
      }
      
      const userData = userTestMap.get(userId);
      userData.tests.push(entry);
      
      // Обновляем дату последнего теста
      const entryDate = new Date(entry.date);
      if (!userData.lastTest || entryDate > userData.lastTest) {
        userData.lastTest = entryDate;
      }
    });
    
    // Преобразуем Map в массив
    const result = Array.from(userTestMap.values()).map(userData => {
      return {
        userId: userData.userId,
        name: userData.name,
        testCount: userData.tests.length,
        lastTest: userData.lastTest
      };
    });
    
    console.log(`Processed test stats for ${result.length} players`);
    return res.json(result);
  } catch (error) {
    console.error('Error fetching all players test stats:', error);
    return res.status(500).json({ message: 'Error fetching all players test stats' });
  }
});

// Для сотрудников: получить статистику колес баланса всех игроков
router.get('/players/balance-wheel', protect, isStaff, async (req: any, res) => {
  try {
    console.log('Fetching balance wheel stats for all players (staff only)');
    const visiblePlayerIds = await getVisiblePlayerIds(req.user);
    const allWheels = await BalanceWheel.find({ userId: { $in: visiblePlayerIds } })
      .populate('userId', 'name email')
      .sort({ date: -1 });
      
    console.log(`Found ${allWheels.length} total balance wheel entries`);
    
    // Группируем по пользователям
    const wheelsByUser = new Map();
    allWheels.forEach(wheel => {
      if (!wheel.userId) return;
      
      const userId = wheel.userId.toString();
      const userName = (wheel.userId as any).name || 'Неизвестный игрок';
      
      if (!wheelsByUser.has(userId)) {
        wheelsByUser.set(userId, {
          userId,
          name: userName,
          wheels: []
        });
      }
      
      wheelsByUser.get(userId).wheels.push({
        id: wheel._id,
        date: wheel.date,
        physical: wheel.physical,
        emotional: wheel.emotional,
        intellectual: wheel.intellectual,
        spiritual: wheel.spiritual,
        occupational: wheel.occupational,
        social: wheel.social,
        environmental: wheel.environmental,
        financial: wheel.financial
      });
    });
    
    // Преобразуем Map в массив
    const result = Array.from(wheelsByUser.values());
    
    console.log(`Processed balance wheel stats for ${result.length} players`);
    return res.json(result);
  } catch (error) {
    console.error('Error fetching all players balance wheel stats:', error);
    return res.status(500).json({ message: 'Error fetching all players balance wheel stats' });
  }
});

// Для сотрудников: получить статистику настроения игрока в формате для графиков
router.get('/players/:playerId/mood/chart', protect, isStaff, async (req: any, res) => {
  try {
    const { playerId } = req.params;
    const { date } = req.query; // Добавлена обработка параметра date
    
    console.log(`Fetching mood chart data for player: ${playerId}${date ? ` for date: ${date}` : ''}`);
    
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
    
    try {
      const accessiblePlayer = await findAccessiblePlayerById(req.user, playerId, '_id');
      if (!accessiblePlayer) {
        return res.status(404).json({ message: 'Player not found' });
      }

      // Создаем базовый фильтр для запроса
      const filter: any = { userId: accessiblePlayer._id };
      
      // Если указана дата, добавляем фильтр по дате
      if (date) {
        const startDate = new Date(date as string);
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(date as string);
        endDate.setHours(23, 59, 59, 999);
        
        filter.date = { $gte: startDate, $lte: endDate };
        console.log(`Filtering by date range: ${startDate} to ${endDate}`);
      }
      
      // Получаем все записи о настроении игрока с учетом фильтра
      const moodEntries = await MoodEntry.find(filter).sort({ date: 1 });
      console.log(`Found ${moodEntries.length} mood entries for player ${playerId}`);
      
      if (moodEntries.length === 0) {
        return res.json([]);
      }
      
      // Группируем записи по дате (только день, без времени)
      const entriesByDate = new Map();
      
      moodEntries.forEach(entry => {
        const entryDate = new Date(entry.date);
        // Создаем ключ в формате YYYY-MM-DD для группировки
        const dateKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}-${String(entryDate.getDate()).padStart(2, '0')}`;
        
        if (!entriesByDate.has(dateKey)) {
          entriesByDate.set(dateKey, {
            date: dateKey,
            moodValues: [],
            energyValues: [],
            entries: 0
          });
        }
        
        const dateData = entriesByDate.get(dateKey);
        dateData.moodValues.push(entry.mood);
        dateData.energyValues.push(entry.energy);
        dateData.entries += 1;
      });
      
      // Преобразуем Map в массив и вычисляем средние значения
      const chartData = Array.from(entriesByDate.values()).map(dateData => {
        const moodSum = dateData.moodValues.reduce((sum: number, val: number) => sum + val, 0);
        const energySum = dateData.energyValues.reduce((sum: number, val: number) => sum + val, 0);
        
        return {
          date: dateData.date,
          mood: parseFloat((moodSum / dateData.moodValues.length).toFixed(1)),
          energy: parseFloat((energySum / dateData.energyValues.length).toFixed(1)),
          entries: dateData.entries
        };
      });
      
      // Сортируем по дате от старых к новым
      chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      return res.json(chartData);
    } catch (dbError) {
      console.error(`Database error when fetching chart data for player ${playerId}:`, dbError);
      return res.status(500).json({ message: 'Database error when fetching chart data' });
    }
  } catch (error) {
    console.error('Error fetching player mood chart data:', error);
    return res.status(500).json({ message: 'Error fetching player mood chart data' });
  }
});

// Для персонала: получить агрегированные данные настроения и энергии команды по дням
router.get('/team/mood/chart', protect, isStaff, async (req: any, res) => {
  try {
    console.log('Fetching team mood chart data (staff only)');
    const visiblePlayerIds = await getVisiblePlayerIds(req.user);
    const allMoodEntries = await MoodEntry.find({ userId: { $in: visiblePlayerIds } }).populate('userId', 'name email');
    console.log(`Found ${allMoodEntries.length} total mood entries for chart`);
    
    if (allMoodEntries.length === 0) {
      return res.json([]);
    }
    
    // Получаем последние 14 дней
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    const days = [...Array(14)].map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();
    
    // Группируем записи по дате
    const entriesByDate = new Map();
    days.forEach(dateStr => {
      entriesByDate.set(dateStr, {
        date: dateStr,
        totalMood: 0,
        totalEnergy: 0,
        count: 0
      });
    });
    
    // Обрабатываем каждую запись
    allMoodEntries.forEach(entry => {
      const entryDate = new Date(entry.date);
      const dateStr = entryDate.toISOString().split('T')[0];
      
      // Проверяем, что дата входит в наш диапазон
      if (entriesByDate.has(dateStr)) {
        const dayData = entriesByDate.get(dateStr);
        dayData.totalMood += entry.mood;
        dayData.totalEnergy += entry.energy;
        dayData.count += 1;
      }
    });
    
    // Формируем результат с вычислением средних значений
    const result = Array.from(entriesByDate.values()).map(day => {
      return {
        date: new Date(day.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
        mood: day.count > 0 ? parseFloat((day.totalMood / day.count).toFixed(1)) : 0,
        energy: day.count > 0 ? parseFloat((day.totalEnergy / day.count).toFixed(1)) : 0,
        count: day.count
      };
    });
    
    console.log(`Processed team mood chart data for ${result.length} days`);
    return res.json(result);
  } catch (error) {
    console.error('Error fetching team mood chart data:', error);
    return res.status(500).json({ message: 'Error fetching team mood chart data' });
  }
});

// Для всех пользователей: получить данные статистики настроения для аналитики
router.get('/analytics/mood', protect, async (req: any, res) => {
  try {
    console.log('Fetching analytics mood data for user:', req.user._id);
    
    if (req.user.role === 'staff') {
      const visiblePlayerIds = await getVisiblePlayerIds(req.user);
      const allMoodEntries = await MoodEntry.find({ userId: { $in: visiblePlayerIds } }).populate('userId', 'name email');
      console.log(`Found ${allMoodEntries.length} total mood entries for staff analytics`);
      
      // Группируем записи по пользователям и вычисляем средние значения
      const userMoodMap = new Map();
      
      allMoodEntries.forEach(entry => {
        if (!entry.userId) return;
        
        const userId = entry.userId.toString();
        const userName = (entry.userId as any).name || 'Неизвестный игрок';
        
        if (!userMoodMap.has(userId)) {
          userMoodMap.set(userId, {
            userId,
            name: userName,
            moodValues: [],
            energyValues: [],
            lastActivity: null
          });
        }
        
        const userData = userMoodMap.get(userId);
        userData.moodValues.push(entry.mood);
        userData.energyValues.push(entry.energy);
        
        // Обновляем дату последней активности
        const entryDate = new Date(entry.date);
        if (!userData.lastActivity || entryDate > userData.lastActivity) {
          userData.lastActivity = entryDate;
        }
      });
      
      // Преобразуем Map в массив и вычисляем средние значения
      const result = Array.from(userMoodMap.values()).map(userData => {
        const moodSum = userData.moodValues.reduce((sum: number, val: number): number => sum + val, 0);
        const energySum = userData.energyValues.reduce((sum: number, val: number): number => sum + val, 0);
        
        return {
          userId: userData.userId,
          name: userData.name,
          mood: userData.moodValues.length > 0 
            ? parseFloat((moodSum / userData.moodValues.length).toFixed(1)) 
            : 0,
          energy: userData.energyValues.length > 0 
            ? parseFloat((energySum / userData.energyValues.length).toFixed(1)) 
            : 0,
          entries: userData.moodValues.length,
          lastActivity: userData.lastActivity
        };
      });
      
      console.log(`Processed mood stats for ${result.length} players for staff analytics`);
      return res.json(result);
    } else {
      // Для игроков: получаем только их собственные данные
      const userMoodEntries = await MoodEntry.find({ userId: req.user._id }).sort({ date: -1 });
      console.log(`Found ${userMoodEntries.length} mood entries for player analytics (${req.user._id})`);
      
      // Готовим данные для игрока
      if (userMoodEntries.length === 0) {
        return res.json([]);
      }
      
      // Группируем записи по дате для создания временных рядов
      const entriesByDate = new Map();
      
      userMoodEntries.forEach(entry => {
        const date = new Date(entry.date);
        // Создаем ключ в формате YYYY-MM-DD для группировки
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        
        if (!entriesByDate.has(dateKey)) {
          entriesByDate.set(dateKey, {
            date: dateKey,
            moodValues: [],
            energyValues: [],
            entries: 0
          });
        }
        
        const dateData = entriesByDate.get(dateKey);
        dateData.moodValues.push(entry.mood);
        dateData.energyValues.push(entry.energy);
        dateData.entries += 1;
      });
      
      // Преобразуем Map в массив и вычисляем средние значения
      const chartData = Array.from(entriesByDate.values()).map(dateData => {
        const moodSum = dateData.moodValues.reduce((sum: number, val: number) => sum + val, 0);
        const energySum = dateData.energyValues.reduce((sum: number, val: number) => sum + val, 0);
        
        return {
          date: dateData.date,
          mood: parseFloat((moodSum / dateData.moodValues.length).toFixed(1)),
          energy: parseFloat((energySum / dateData.energyValues.length).toFixed(1)),
          entries: dateData.entries
        };
      });
      
      // Сортируем по дате от старых к новым
      chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      // Формируем результат для игрока - в том же формате, что и для персонала
      const result = [{
        userId: req.user._id,
        name: req.user.name,
        mood: chartData.length > 0 
          ? chartData.reduce((sum, item) => sum + item.mood, 0) / chartData.length
          : 0,
        energy: chartData.length > 0 
          ? chartData.reduce((sum, item) => sum + item.energy, 0) / chartData.length
          : 0,
        entries: userMoodEntries.length,
        lastActivity: userMoodEntries[0]?.date || null,
        chartData // Добавляем данные для графика
      }];
      
      console.log(`Processed mood stats for player analytics (${req.user._id})`);
      return res.json(result);
    }
  } catch (error) {
    console.error('Error fetching analytics mood data:', error);
    return res.status(500).json({ message: 'Error fetching analytics mood data' });
  }
});

// Для всех пользователей: получить данные статистики тестов для аналитики
router.get('/analytics/tests', protect, async (req: any, res) => {
  try {
    console.log('Fetching analytics test data for user:', req.user._id);
    
    if (req.user.role === 'staff') {
      const visiblePlayerIds = await getVisiblePlayerIds(req.user);
      const allTestEntries = await TestEntry.find({ userId: { $in: visiblePlayerIds } }).populate('userId', 'name email');
      console.log(`Found ${allTestEntries.length} total test entries for staff analytics`);
      
      // Группируем записи по пользователям
      const userTestMap = new Map();
      
      allTestEntries.forEach(entry => {
        if (!entry.userId) return;
        
        const userId = entry.userId.toString();
        const userName = (entry.userId as any).name || 'Неизвестный игрок';
        
        if (!userTestMap.has(userId)) {
          userTestMap.set(userId, {
            userId,
            name: userName,
            tests: [],
            lastTest: null
          });
        }
        
        const userData = userTestMap.get(userId);
        userData.tests.push(entry);
        
        // Обновляем дату последнего теста
        const entryDate = new Date(entry.date);
        if (!userData.lastTest || entryDate > userData.lastTest) {
          userData.lastTest = entryDate;
        }
      });
      
      // Преобразуем Map в массив
      const result = Array.from(userTestMap.values()).map(userData => {
        return {
          userId: userData.userId,
          name: userData.name,
          testCount: userData.tests.length,
          lastTest: userData.lastTest
        };
      });
      
      console.log(`Processed test stats for ${result.length} players for staff analytics`);
      return res.json(result);
    } else {
      // Для игроков: получаем только их собственные данные
      const userTestEntries = await TestEntry.find({ userId: req.user._id }).sort({ date: -1 });
      console.log(`Found ${userTestEntries.length} test entries for player analytics (${req.user._id})`);
      
      // Формируем результат для игрока - в том же формате, что и для персонала
      const result = [{
        userId: req.user._id,
        name: req.user.name,
        testCount: userTestEntries.length,
        lastTest: userTestEntries[0]?.date || null,
        tests: userTestEntries // Добавляем полные данные о тестах
      }];
      
      console.log(`Processed test stats for player analytics (${req.user._id})`);
      return res.json(result);
    }
  } catch (error) {
    console.error('Error fetching analytics test data:', error);
    return res.status(500).json({ message: 'Error fetching analytics test data' });
  }
});

// Для всех пользователей: получить данные статистики колеса баланса для аналитики
router.get('/analytics/balance-wheel', protect, async (req: any, res) => {
  try {
    console.log('Fetching analytics balance wheel data for user:', req.user._id);
    
    if (req.user.role === 'staff') {
      const visiblePlayerIds = await getVisiblePlayerIds(req.user);
      const allWheels = await BalanceWheel.find({ userId: { $in: visiblePlayerIds } })
        .populate('userId', 'name email')
        .sort({ date: -1 });
        
      console.log(`Found ${allWheels.length} total balance wheel entries for staff analytics`);
      
      // Группируем по пользователям
      const wheelsByUser = new Map();
      allWheels.forEach(wheel => {
        if (!wheel.userId) return;
        
        const userId = wheel.userId.toString();
        const userName = (wheel.userId as any).name || 'Неизвестный игрок';
        
        if (!wheelsByUser.has(userId)) {
          wheelsByUser.set(userId, {
            userId,
            name: userName,
            wheels: []
          });
        }
        
        wheelsByUser.get(userId).wheels.push({
          id: wheel._id,
          date: wheel.date,
          physical: wheel.physical,
          emotional: wheel.emotional,
          intellectual: wheel.intellectual,
          spiritual: wheel.spiritual,
          occupational: wheel.occupational,
          social: wheel.social,
          environmental: wheel.environmental,
          financial: wheel.financial
        });
      });
      
      // Преобразуем Map в массив
      const result = Array.from(wheelsByUser.values());
      
      console.log(`Processed balance wheel stats for ${result.length} players for staff analytics`);
      return res.json(result);
    } else {
      // Для игроков: получаем только их собственные данные
      const userWheels = await BalanceWheel.find({ userId: req.user._id }).sort({ date: -1 });
      console.log(`Found ${userWheels.length} balance wheel entries for player analytics (${req.user._id})`);
      
      // Преобразуем данные
      const wheels = userWheels.map(wheel => ({
        id: wheel._id,
        date: wheel.date,
        physical: wheel.physical,
        emotional: wheel.emotional,
        intellectual: wheel.intellectual,
        spiritual: wheel.spiritual,
        occupational: wheel.occupational,
        social: wheel.social,
        environmental: wheel.environmental,
        financial: wheel.financial
      }));
      
      // Формируем результат для игрока - в том же формате, что и для персонала
      const result = [{
        userId: req.user._id,
        name: req.user.name,
        wheels
      }];
      
      console.log(`Processed balance wheel stats for player analytics (${req.user._id})`);
      return res.json(result);
    }
  } catch (error) {
    console.error('Error fetching analytics balance wheel data:', error);
    return res.status(500).json({ message: 'Error fetching analytics balance wheel data' });
  }
});

const avg = (values: number[]): number =>
  values.length === 0 ? 0 : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));

const toBucket = (value: number): 'low' | 'mid' | 'high' => {
  if (value <= 3) return 'low';
  if (value <= 7) return 'mid';
  return 'high';
};

const getStateIndex = (entry: any): number | null => {
  const snapshot = entry.stateSnapshot;
  if (!snapshot) return null;

  const {
    fatigue = 0,
    focus = 0,
    stress = 0,
    sleepHours = 0,
    mood = 0,
    energy = 0
  } = snapshot;

  const raw = focus + energy + mood + sleepHours - fatigue - stress;
  return Number((raw / 3).toFixed(2));
};

// Сводка влияния состояния игрока на результаты тестов
router.get('/tests/state-impact', protect, async (req: any, res) => {
  try {
    const {
      from,
      to,
      testType,
      matchType,
      map,
      role,
      source
    } = req.query;

    const filter: any = {};

    if (req.user.role !== 'staff') {
      filter.userId = req.user._id;
    } else {
      filter.userId = { $in: await getVisiblePlayerIds(req.user) };
    }

    if (testType) {
      filter.testType = testType;
    }

    if (matchType) {
      filter['context.matchType'] = matchType;
    }

    if (map) {
      filter['context.map'] = map;
    }

    if (role) {
      filter['context.role'] = role;
    }

    if (source) {
      filter['context.source'] = source;
    }

    if (from || to) {
      filter.measuredAt = {};
      if (from) {
        filter.measuredAt.$gte = new Date(from);
      }
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        filter.measuredAt.$lte = end;
      }
    }

    const entries = await TestEntry.find(filter).sort({ measuredAt: -1 });
    const scoredEntries = entries.filter((entry: any) => typeof entry.scoreNormalized === 'number');

    const fatigueGroups: Record<'low' | 'mid' | 'high', number[]> = { low: [], mid: [], high: [] };
    const focusGroups: Record<'low' | 'mid' | 'high', number[]> = { low: [], mid: [], high: [] };
    const stressGroups: Record<'low' | 'mid' | 'high', number[]> = { low: [], mid: [], high: [] };
    const typeGroups = new Map<string, number[]>();
    const stateIndexes: number[] = [];

    for (const entry of scoredEntries as any[]) {
      const score = entry.scoreNormalized;
      const snapshot = entry.stateSnapshot;
      if (snapshot) {
        if (typeof snapshot.fatigue === 'number') {
          fatigueGroups[toBucket(snapshot.fatigue)].push(score);
        }
        if (typeof snapshot.focus === 'number') {
          focusGroups[toBucket(snapshot.focus)].push(score);
        }
        if (typeof snapshot.stress === 'number') {
          stressGroups[toBucket(snapshot.stress)].push(score);
        }

        const index = getStateIndex(entry);
        if (index !== null) {
          stateIndexes.push(index);
        }
      }

      const currentType = entry.testType || 'generic';
      const typeScores = typeGroups.get(currentType) || [];
      typeScores.push(score);
      typeGroups.set(currentType, typeScores);
    }

    const byTestType = Array.from(typeGroups.entries()).map(([type, scores]) => ({
      type,
      entries: scores.length,
      avgScore: avg(scores)
    }));

    const response = {
      filters: {
        from: from || null,
        to: to || null,
        testType: testType || null,
        matchType: matchType || null,
        map: map || null,
        role: role || null
        ,
        source: source || null
      },
      totals: {
        entries: entries.length,
        scoredEntries: scoredEntries.length,
        avgScore: avg(scoredEntries.map((entry: any) => entry.scoreNormalized)),
        avgStateIndex: avg(stateIndexes)
      },
      stateToResult: {
        fatigue: {
          low: avg(fatigueGroups.low),
          mid: avg(fatigueGroups.mid),
          high: avg(fatigueGroups.high)
        },
        focus: {
          low: avg(focusGroups.low),
          mid: avg(focusGroups.mid),
          high: avg(focusGroups.high)
        },
        stress: {
          low: avg(stressGroups.low),
          mid: avg(stressGroups.mid),
          high: avg(stressGroups.high)
        }
      },
      byTestType
    };

    return res.json(response);
  } catch (error) {
    console.error('Error fetching state impact test stats:', error);
    return res.status(500).json({ message: 'Error fetching state impact test stats' });
  }
});

// Единая сводка для новой аналитики
router.get('/analytics/overview', protect, async (req: any, res) => {
  try {
    const baseFilter =
      req.user.role === 'staff'
        ? { userId: { $in: await getVisiblePlayerIds(req.user) } }
        : { userId: req.user._id };
    const [moodEntries, testEntries, wheels, usersCount] = await Promise.all([
      MoodEntry.find(baseFilter).sort({ date: 1 }),
      TestEntry.find(baseFilter).sort({ measuredAt: 1 }),
      BalanceWheel.find(baseFilter).sort({ date: 1 }),
      req.user.role === 'staff'
        ? User.countDocuments(buildVisiblePlayersFilter(req.user))
        : Promise.resolve(1)
    ]);

    const moodTrendMap = new Map<string, { mood: number[]; energy: number[] }>();
    moodEntries.forEach((entry: any) => {
      const key = new Date(entry.date).toISOString().slice(0, 10);
      const point = moodTrendMap.get(key) || { mood: [], energy: [] };
      point.mood.push(entry.mood);
      point.energy.push(entry.energy);
      moodTrendMap.set(key, point);
    });

    const moodTrend = Array.from(moodTrendMap.entries())
      .map(([date, point]) => ({
        date,
        mood: avg(point.mood),
        energy: avg(point.energy)
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const scoreValues = testEntries
      .map((entry: any) => entry.scoreNormalized)
      .filter((score: any) => typeof score === 'number');

    const balanceAverages = wheels.map((wheel: any) => {
      const values = [
        wheel.physical,
        wheel.emotional,
        wheel.intellectual,
        wheel.spiritual,
        wheel.occupational,
        wheel.social,
        wheel.environmental,
        wheel.financial
      ];
      return avg(values);
    });

    const testsByType = Object.entries(
      testEntries.reduce((acc: Record<string, number>, entry: any) => {
        const type = entry.testType || 'generic';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {})
    ).map(([type, count]) => ({ type, count }));

    return res.json({
      role: req.user.role,
      totals: {
        activePlayers: usersCount,
        moodEntries: moodEntries.length,
        testEntries: testEntries.length,
        balanceEntries: wheels.length,
        avgMood: avg(moodEntries.map((entry: any) => entry.mood)),
        avgEnergy: avg(moodEntries.map((entry: any) => entry.energy)),
        avgTestScore: avg(scoreValues),
        avgBalanceIndex: avg(balanceAverages)
      },
      moodTrend,
      testsByType
    });
  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    return res.status(500).json({ message: 'Error fetching analytics overview' });
  }
});

export default router;
