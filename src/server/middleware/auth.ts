import User from '../models/User';
import { verifyJwt } from '../utils/jwt';

const PRIMARY_JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const LEGACY_JWT_SECRET = 'your-secret-key';

const verifyTokenWithFallback = (token: string): { id: string } => {
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
          message: 'Нет доступа для редактирования состава участников. Требуется действительный ключ привилегий.',
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
