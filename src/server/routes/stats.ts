import express from 'express';
import BalanceWheel from '../models/BalanceWheel';
import MoodEntry from '../models/MoodEntry';
import TestEntry from '../models/TestEntry';
import { protect, isStaff } from '../middleware/authMiddleware';

const router = express.Router();

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

// Для сотрудников: получить статистику настроения всех игроков
router.get('/players/mood', protect, isStaff, async (_req: any, res) => {
  try {
    console.log('Fetching mood stats for all players (staff only)');
    
    // Получаем все записи о настроении
    const allMoodEntries = await MoodEntry.find().populate('userId', 'name email');
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
      
      // Получаем все записи о настроении игрока за указанный период
      const moodEntries = await MoodEntry.find({ 
        userId: actualPlayerId,
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
router.get('/players/tests', protect, isStaff, async (_req: any, res) => {
  try {
    console.log('Fetching test stats for all players (staff only)');
    
    // Получаем все записи о тестах
    const allTestEntries = await TestEntry.find().populate('userId', 'name email');
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
router.get('/players/balance-wheel', protect, isStaff, async (_req: any, res) => {
  try {
    console.log('Fetching balance wheel stats for all players (staff only)');
    
    // Получаем все колеса баланса и группируем их по пользователям
    const allWheels = await BalanceWheel.find()
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
      // Создаем базовый фильтр для запроса
      const filter: any = { userId: playerId };
      
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
router.get('/team/mood/chart', protect, isStaff, async (_req: any, res) => {
  try {
    console.log('Fetching team mood chart data (staff only)');
    
    // Получаем все записи о настроении
    const allMoodEntries = await MoodEntry.find().populate('userId', 'name email');
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
      // Для персонала: получаем данные всех игроков
      const allMoodEntries = await MoodEntry.find().populate('userId', 'name email');
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
      // Для персонала: получаем данные всех игроков
      const allTestEntries = await TestEntry.find().populate('userId', 'name email');
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
      // Для персонала: получаем данные всех игроков
      const allWheels = await BalanceWheel.find()
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

export default router; 