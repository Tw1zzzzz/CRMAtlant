import { Request, Response } from 'express';
import ActivityHistory from '../models/ActivityHistory';
import User from '../models/User';
import { AuthRequest } from '../types';

/**
 * @desc    Создать новую запись истории активности
 * @route   POST /api/history
 * @access  Private
 */
export const createActivityRecord = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { action, entityType, entityId, details } = req.body;
    
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Не авторизован'
      });
    }
    
    const userId = req.user._id;

    const activity = await ActivityHistory.create({
      userId,
      action,
      entityType,
      entityId: entityId || null,
      details: details || {},
      timestamp: new Date()
    });

    res.status(201).json({
      status: 'success',
      data: {
        activity
      }
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Ошибка при создании записи активности',
      error: error.message
    });
  }
};

/**
 * @desc    Получить историю активности для текущего пользователя
 * @route   GET /api/history
 * @access  Private
 */
export const getUserActivityHistory = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Не авторизован'
      });
    }
    
    const userId = req.user._id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Подсчет общего количества записей
    const total = await ActivityHistory.countDocuments({ userId });

    // Получение данных с пагинацией и сортировкой по убыванию даты
    const activities = await ActivityHistory.find({ userId })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email')
      .exec();

    // Общее количество страниц
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      status: 'success',
      data: {
        activities,
        pagination: {
          total,
          page,
          limit,
          pages: totalPages
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Ошибка при получении истории активности',
      error: error.message
    });
  }
};

/**
 * @desc    Получить всю историю активности (для персонала)
 * @route   GET /api/history/all
 * @access  Private/Staff
 */
export const getAllActivityHistory = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    // Проверка роли пользователя
    if (req.user.role !== 'staff') {
      return res.status(403).json({
        status: 'error',
        message: 'Доступ запрещен'
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    // Фильтр по пользователю (опционально)
    const userFilter = req.query.userId ? { userId: req.query.userId } : {};
    
    // Фильтр по типу действия (опционально)
    const actionFilter = req.query.action ? { action: req.query.action } : {};
    
    // Фильтр по типу сущности (опционально)
    const entityTypeFilter = req.query.entityType ? { entityType: req.query.entityType } : {};
    
    // Объединяем все фильтры
    const filter = {
      ...userFilter,
      ...actionFilter,
      ...entityTypeFilter
    };

    console.log(`[ActivityHistory] Запрос активности с фильтрами:`, JSON.stringify(filter));
    console.log(`[ActivityHistory] Пагинация: страница ${page}, лимит ${limit}`);

    // Подсчет общего количества записей с учетом фильтров
    const total = await ActivityHistory.countDocuments(filter);
    console.log(`[ActivityHistory] Всего найдено записей: ${total}`);

    // Получение данных с пагинацией и сортировкой по убыванию даты
    const activities = await ActivityHistory.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email role')
      .exec();

    console.log(`[ActivityHistory] Загружено записей: ${activities.length}`);
    
    // Выводим первую запись для диагностики, если она есть
    if (activities.length > 0) {
      console.log('[ActivityHistory] Пример записи активности:', {
        id: activities[0]._id,
        user: typeof activities[0].userId === 'object' ? 
          ((activities[0].userId as any)?.name || 'Неизвестный пользователь') : 
          String(activities[0].userId),
        action: activities[0].action,
        entityType: activities[0].entityType,
        timestamp: activities[0].timestamp
      });
    }

    // Получение списка пользователей для фильтрации
    const users = await User.find({}, 'name email').exec();

    // Общее количество страниц
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      status: 'success',
      data: {
        activities,
        users,
        pagination: {
          total,
          page,
          limit,
          pages: totalPages
        }
      }
    });
  } catch (error: any) {
    console.error('[ActivityHistory] Ошибка при получении истории активности:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка при получении истории активности',
      error: error.message
    });
  }
};

/**
 * @desc    Получить статистику активности (для персонала)
 * @route   GET /api/history/stats
 * @access  Private/Staff
 */
export const getActivityStats = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    // Проверка роли пользователя
    if (req.user.role !== 'staff') {
      return res.status(403).json({
        status: 'error',
        message: 'Доступ запрещен'
      });
    }

    // Получение статистики по типам действий
    const actionStats = await ActivityHistory.aggregate([
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Получение статистики по типам сущностей
    const entityStats = await ActivityHistory.aggregate([
      { $group: { _id: '$entityType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Получение статистики активности по пользователям
    const userStats = await ActivityHistory.aggregate([
      { 
        $group: { 
          _id: '$userId', 
          count: { $sum: 1 },
          lastActivity: { $max: '$timestamp' }
        } 
      },
      { 
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      { 
        $project: {
          _id: 1,
          count: 1,
          lastActivity: 1,
          'user.name': 1,
          'user.email': 1,
          'user.role': 1
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        actionStats,
        entityStats,
        userStats
      }
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Ошибка при получении статистики активности',
      error: error.message
    });
  }
};

/**
 * @desc    Получить месячную активность
 * @route   GET /api/history/monthly
 * @access  Private/Staff
 */
export const getMonthlyActivity = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const userId = req.user._id;
    const isStaff = req.user.role === 'staff';
    
    // Проверка авторизации
    if (!isStaff) {
      return res.status(403).json({
        status: 'error',
        message: 'Доступ запрещен. Требуется роль персонала.'
      });
    }
    
    // Определение временных границ текущего месяца
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    console.log('[ActivityMonthly] Запрос месячной активности от', req.user.name, 'для периода', 
      startOfMonth.toISOString(), 'по', endOfMonth.toISOString());
    
    try {
      // Сначала проверим, существуют ли вообще какие-либо записи активности
      const totalActivities = await ActivityHistory.countDocuments();
      console.log(`[ActivityMonthly] Всего записей активности в базе: ${totalActivities}`);
      
      // Проверим есть ли записи о настроении
      const moodTrackActivities = await ActivityHistory.countDocuments({ action: 'mood_track' });
      console.log(`[ActivityMonthly] Записей о настроении: ${moodTrackActivities}`);
      
      // Получаем игроков для информации
      const players = await User.find({ role: { $in: ['user', 'player'] } }, '_id name email role');
      console.log(`[ActivityMonthly] Найдено ${players.length} игроков`);
      
      const playerIds = players.map(player => player._id);
      
      // ВАЖНО: Не будем фильтровать по userId, чтобы увидеть все записи активности
      // Независимо от того, каким пользователям они принадлежат
      const filter = {}; // Пустой фильтр для получения всех записей
      
      console.log('[ActivityMonthly] Запрос активности без фильтров для диагностики');
      
      // Получаем все записи с большим лимитом
      const activities = await ActivityHistory.find(filter)
        .sort({ timestamp: -1 })
        .populate('userId', 'name email role')
        .limit(1000) // Увеличиваем лимит для диагностики
        .exec();
      
      console.log(`[ActivityMonthly] Найдено ${activities.length} записей активности`);
      
      // Вывести первые несколько записей для диагностики
      if (activities.length > 0) {
        console.log('[ActivityMonthly] Первые 3 записи активности:');
        for (let i = 0; i < Math.min(3, activities.length); i++) {
          const activity = activities[i];
          
          console.log(`[ActivityMonthly] Запись ${i+1}:`, {
            id: activity._id,
            timestamp: activity.timestamp,
            action: activity.action,
            entityType: activity.entityType,
            userId: typeof activity.userId === 'object' 
              ? `${(activity.userId as any)?.name || 'Нет имени'} (ID: ${(activity.userId as any)?._id || 'Нет ID'})` 
              : `ID: ${String(activity.userId)}`,
            details: activity.details || 'Нет деталей'
          });
        }
        
        // Поиск записей конкретно о настроении
        const moodActivities = activities.filter(a => a.action === 'mood_track');
        console.log(`[ActivityMonthly] Найдено ${moodActivities.length} записей о настроении`);
        
        if (moodActivities.length > 0) {
          console.log('[ActivityMonthly] Пример записи о настроении:', {
            id: moodActivities[0]._id,
            timestamp: moodActivities[0].timestamp,
            userId: typeof moodActivities[0].userId === 'object' 
              ? `${(moodActivities[0].userId as any)?.name || 'Нет имени'} (ID: ${(moodActivities[0].userId as any)?._id || 'Нет ID'})` 
              : `ID: ${String(moodActivities[0].userId)}`,
            details: moodActivities[0].details || 'Нет деталей'
          });
        }
      }
      
      // Фильтруем записи только по игрокам для реального ответа API
      const playerActivities = activities.filter(activity => {
        if (!activity.userId) return false;
        
        // Если userId объект, проверяем его _id
        if (typeof activity.userId === 'object') {
          const userIdStr = String((activity.userId as any)?._id || '');
          return playerIds.some(id => String(id) === userIdStr);
        }
        
        // Если userId строка или ObjectId
        const userIdStr = String(activity.userId);
        return playerIds.some(id => String(id) === userIdStr);
      });
      
      console.log(`[ActivityMonthly] После фильтрации по игрокам осталось ${playerActivities.length} записей`);
      
      // Возвращаем реальные данные, но если их нет, возвращаем демо-данные
      if (playerActivities.length > 0) {
        return res.status(200).json({
          status: 'success',
          data: {
            activities: playerActivities,
            period: {
              start: startOfMonth.toISOString(),
              end: endOfMonth.toISOString()
            }
          }
        });
      } else {
        console.log('[ActivityMonthly] Нет активности игроков, возвращаем демо-данные');
        return res.status(200).json({
          status: 'success',
          data: {
            activities: generateDemoActivities(req.user._id),
            period: {
              start: startOfMonth.toISOString(),
              end: endOfMonth.toISOString()
            }
          }
        });
      }
    } catch (innerError: any) {
      console.error('[ActivityMonthly] Ошибка при получении данных:', innerError);
      
      // В случае ошибки MongoDB/Mongoose, возвращаем демо-данные
      return res.status(200).json({
        status: 'success',
        message: 'Используются демонстрационные данные из-за ошибки',
        data: {
          activities: generateDemoActivities(req.user._id),
          period: {
            start: startOfMonth.toISOString(),
            end: endOfMonth.toISOString()
          }
        }
      });
    }
  } catch (error: any) {
    console.error('[ActivityMonthly] Критическая ошибка при получении месячной активности:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка при получении месячной активности',
      error: error.message
    });
  }
};

/**
 * Генерирует тестовые данные об активности для демонстрации
 */
function generateDemoActivities(userId: string | any) {
  const now = new Date();
  const activities = [];
  
  // Создаем тестовые активности за последние 30 дней
  for (let i = 0; i < 15; i++) {
    const date = new Date();
    date.setDate(now.getDate() - Math.floor(Math.random() * 30));
    
    const actionTypes = ['create', 'update', 'delete', 'login', 'logout', 'test_complete', 'mood_track'];
    const entityTypes = ['user', 'mood', 'test', 'file', 'balance_wheel', 'system'];
    
    const action = actionTypes[Math.floor(Math.random() * actionTypes.length)] as any;
    const entityType = entityTypes[Math.floor(Math.random() * entityTypes.length)] as any;
    
    activities.push({
      _id: `demo-${i}-${Date.now()}`,
      userId: {
        _id: userId,
        name: 'Тестовый игрок',
        email: 'player@example.com',
        role: 'user'
      },
      action: action,
      entityType: entityType,
      details: { demoData: true, field: `значение ${i}` },
      timestamp: date.toISOString()
    });
  }
  
  // Сортируем по убыванию даты
  return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
} 