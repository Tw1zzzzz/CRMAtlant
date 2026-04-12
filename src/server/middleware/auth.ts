import User from '../models/User';
import { verifyJwt } from '../utils/jwt';
import { resolveEffectiveSubscriptionAccess } from '../utils/subscriptionAccess';
import { getScopedTeamId, isTeamStaffUser } from '../utils/teamAccess';
import { applyActiveProfileProjection } from '../utils/userProfiles';

const PRIMARY_JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const LEGACY_JWT_SECRET = 'your-secret-key';

const verifyTokenWithFallback = (token: string): { id: string; iat?: number } => {
  try {
    return verifyJwt<{ id: string }>(token, PRIMARY_JWT_SECRET);
  } catch (error) {
    // Поддержка старых токенов, выданных до фикса контракта
    if (PRIMARY_JWT_SECRET !== LEGACY_JWT_SECRET) {
      return verifyJwt<{ id: string }>(token, LEGACY_JWT_SECRET);
    }
    throw error;
  }
};

// Middleware для защиты маршрутов
export const protect = async (req: any, res: any, next: any) => {
  let token;

  console.log(`[AUTH] Проверка авторизации для ${req.method} ${req.originalUrl}`);
  console.log(`[AUTH] Заголовки:`, req.headers.authorization ? 'Bearer token присутствует' : 'Заголовок авторизации отсутствует');

  // Проверяем наличие токена в заголовке Authorization
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Получаем токен из заголовка
      token = req.headers.authorization.split(' ')[1];
      console.log(`[AUTH] Токен получен, проверяю...`);

      // Верифицируем токен
      const decoded = verifyTokenWithFallback(token);
      console.log(`[AUTH] Токен действителен, ID пользователя:`, decoded.id);

      // Получаем пользователя из базы, исключая пароль
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        console.log(`[AUTH] Пользователь с ID ${decoded.id} не найден в базе`);
        return res.status(401).json({ message: 'Пользователь не найден' });
      }

      if (req.user.isActive === false) {
        console.log(`[AUTH] Доступ запрещен: аккаунт ${req.user.email} деактивирован`);
        return res.status(401).json({
          message: 'Аккаунт заблокирован. Обратитесь к администратору.',
          code: 'ACCOUNT_BLOCKED'
        });
      }

      applyActiveProfileProjection(req.user);

      if (decoded.iat && req.user.passwordChangedAt instanceof Date) {
        const tokenIssuedAtMs = decoded.iat * 1000;
        const passwordChangedAtMs = req.user.passwordChangedAt.getTime();

        if (tokenIssuedAtMs < passwordChangedAtMs) {
          console.log('[AUTH] Токен устарел после смены пароля');
          return res.status(401).json({
            message: 'Сессия устарела после смены пароля. Выполните вход повторно.',
            code: 'TOKEN_STALE'
          });
        }
      }
      
      console.log(`[AUTH] Пользователь ${req.user.name} (${req.user.role}) авторизован`);
      next();
    } catch (error) {
      console.error('[AUTH] Ошибка проверки токена:', error);
      return res.status(401).json({
        message: 'Недействительный токен. Выполните вход повторно.',
        code: 'TOKEN_INVALID'
      });
    }
  } else {
    console.log('[AUTH] Токен не предоставлен');
    return res.status(401).json({ message: 'Не авторизован, токен отсутствует' });
  }
};

export const requireSuperAdmin = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Пользователь не авторизован' });
  }

  if (req.user.isSuperAdmin !== true) {
    return res.status(403).json({ message: 'Доступ разрешен только супер-администратору' });
  }

  return next();
};

// Middleware для проверки роли Staff
export const isStaff = (req: any, res: any, next: any) => {
  if (req.user && req.user.role === 'staff') {
    console.log(`[AUTH] Доступ для сотрудника (${req.user.name}) разрешен`);
    next();
  } else {
    console.log(`[AUTH] Доступ запрещен: требуется роль 'staff'`);
    return res.status(403).json({ message: 'Нет прав доступа для этого действия' });
  }
};

// Middleware для проверки привилегированного доступа сотрудника (наличие ключа привилегий)
export const hasPrivilegeKey = (req: any, res: any, next: any) => {
  try {
    if (req.user && req.user.role === 'staff') {
      if (isTeamStaffUser(req.user) && getScopedTeamId(req.user)) {
        console.log(`[AUTH] Team-staff доступ к управлению своей командой разрешен без ключа привилегий`);
        return next();
      }

      if (isTeamStaffUser(req.user) && !getScopedTeamId(req.user)) {
        return res.status(403).json({
          message: 'Сначала создайте команду или присоединитесь к существующей по staff-коду',
          requiresTeamSetup: true
        });
      }

      // Получаем корректный ключ привилегий из переменных окружения или используем fallback значение
      const validPrivilegeKey = process.env.STAFF_PRIVILEGE_KEY || 'ADMIN_ACCESS_2024_SECURE_KEY_xyz789';
      
      console.log('[AUTH] Проверка привилегий: ключ из env загружен:', !!process.env.STAFF_PRIVILEGE_KEY);
      
      // Проверка наличия настроенного ключа привилегий на сервере
      if (!validPrivilegeKey) {
        console.error('[AUTH] Ошибка конфигурации: STAFF_PRIVILEGE_KEY не задан и fallback недоступен');
        return res.status(500).json({ 
          message: 'Ошибка конфигурации сервера: система привилегий не настроена', 
        });
      }
      
      // Проверяем привилегии пользователя
      if (req.user.privilegeKey && req.user.privilegeKey === validPrivilegeKey) {
        console.log(`[AUTH] Привилегированный доступ для сотрудника (${req.user.name}) разрешен`);
        next();
      } else {
        console.log(`[AUTH] Доступ запрещен: неверный ключ привилегий или его отсутствие`);
        return res.status(403).json({ 
          message: 'Нет доступа для редактирования состава участников. Требуется действительный ключ доступа для staff.',
          requiresPrivilegeKey: true
        });
      }
    } else {
      console.log(`[AUTH] Доступ запрещен: требуется роль 'staff'`);
      return res.status(403).json({ 
        message: 'Нет прав доступа для этого действия' 
      });
    }
  } catch (error) {
    console.error('[AUTH] Ошибка при проверке привилегий:', error);
    return res.status(500).json({ message: 'Ошибка сервера при проверке привилегий' });
  }
};

export const hasPerformanceCoachCrmSubscription = async (req: any, res: any, next: any) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: 'Пользователь не авторизован' });
    }

    const accessFlags = await resolveEffectiveSubscriptionAccess(req.user);

    if (accessFlags.hasPerformanceCoachCrmAccess) {
      return next();
    }

    return res.status(403).json({
      message: 'Требуется активная подписка Performance CRM',
      requiresSubscription: true,
      requiredPlan: 'Performance CRM',
    });
  } catch (error) {
    console.error('[AUTH] Ошибка при проверке подписки PerformanceCoach CRM:', error);
    return res.status(500).json({ message: 'Ошибка сервера при проверке подписки' });
  }
};

export const hasCorrelationAnalysisSubscription = async (req: any, res: any, next: any) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: 'Пользователь не авторизован' });
    }

    const accessFlags = await resolveEffectiveSubscriptionAccess(req.user);

    if (accessFlags.hasCorrelationAnalysisAccess) {
      return next();
    }

    return res.status(403).json({
      message: 'Требуется активная подписка "Корреляционный анализ"',
      requiresSubscription: true,
      requiredPlan: 'Корреляционный анализ',
    });
  } catch (error) {
    console.error('[AUTH] Ошибка при проверке подписки Корреляционный анализ:', error);
    return res.status(500).json({ message: 'Ошибка сервера при проверке подписки' });
  }
};

export const hasGameStatsSubscription = async (req: any, res: any, next: any) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: 'Пользователь не авторизован' });
    }

    const accessFlags = await resolveEffectiveSubscriptionAccess(req.user);

    if (accessFlags.hasGameStatsAccess) {
      return next();
    }

    return res.status(403).json({
      message: 'Требуется активная подписка "Игровая статистика"',
      requiresSubscription: true,
      requiredPlan: 'Игровая статистика',
    });
  } catch (error) {
    console.error('[AUTH] Ошибка при проверке подписки Игровая статистика:', error);
    return res.status(500).json({ message: 'Ошибка сервера при проверке подписки' });
  }
};

// Middleware для проверки: стафф ИЛИ соло-игрок
// Соло-игрок получает доступ к аналитике и своей карточке наравне со стаффом
export const isSoloOrStaff = (req: any, res: any, next: any) => {
  const user = req.user;
  const isStaffUser = user && user.role === 'staff';
  const isSoloPlayer = user && user.role === 'player' && user.playerType === 'solo';

  if (isStaffUser || isSoloPlayer) {
    console.log(`[AUTH] Доступ для ${isStaffUser ? 'сотрудника' : 'соло-игрока'} (${user.name}) разрешен`);
    next();
  } else {
    console.log(`[AUTH] Доступ запрещен: требуется роль staff или тип solo`);
    return res.status(403).json({ message: 'Нет прав доступа для этого действия' });
  }
};

// Middleware для проверки роли Player
export const isPlayer = (req: any, res: any, next: any) => {
  if (req.user && req.user.role === 'player') {
    console.log(`[AUTH] Доступ для игрока (${req.user.name}) разрешен`);
    next();
  } else {
    console.log(`[AUTH] Доступ запрещен: требуется роль 'player'`);
    return res.status(403).json({ message: 'Нет прав доступа для этого действия' });
  }
}; 
