import rateLimit from 'express-rate-limit';

/**
 * Rate limiting для общих запросов API отчетов
 * Ограничивает до 100 запросов на получение данных в час
 */
export const reportsReadLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 100, // максимум 100 запросов на IP
  message: {
    status: 'error',
    message: 'Слишком много запросов на получение отчетов. Попробуйте позже.',
    retryAfter: '1 час'
  },
  standardHeaders: true, // Возвращает rate limit информацию в заголовках `RateLimit-*`
  legacyHeaders: false, // Отключает заголовки `X-RateLimit-*`
  keyGenerator: (req) => {
    // Используем пользователя и IP для более точного лимитирования
    return `${req.ip}-${req.user?._id || 'anonymous'}`;
  }
});

/**
 * Rate limiting для создания и изменения отчетов
 * Более строгие ограничения для операций записи
 */
export const reportsWriteLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 20, // максимум 20 операций записи в час
  message: {
    status: 'error',
    message: 'Слишком много операций создания/обновления отчетов. Попробуйте позже.',
    retryAfter: '1 час'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return `write-${req.ip}-${req.user?._id || 'anonymous'}`;
  }
});

/**
 * Rate limiting для загрузки файлов
 * Строгие ограничения для предотвращения атак через загрузку
 */
export const fileUploadLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 10, // максимум 10 загрузок в час
  message: {
    status: 'error',
    message: 'Слишком много попыток загрузки файлов. Попробуйте позже.',
    retryAfter: '1 час'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return `upload-${req.ip}-${req.user?._id || 'anonymous'}`;
  }
});

/**
 * Rate limiting для поиска
 * Защита от спам-запросов через поиск
 */
export const searchLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 минут
  max: 30, // максимум 30 поисковых запросов за 5 минут
  message: {
    status: 'error',
    message: 'Слишком много поисковых запросов. Попробуйте позже.',
    retryAfter: '5 минут'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Пропускаем rate limiting если нет поискового запроса
    return !req.query.search;
  },
  keyGenerator: (req) => {
    return `search-${req.ip}-${req.user?._id || 'anonymous'}`;
  }
});

/**
 * Комбинированный middleware для применения разных лимитов
 * в зависимости от типа операции
 */
export const smartRateLimit = (req: any, res: any, next: any) => {
  const method = req.method;
  const hasSearch = req.query.search;
  
  // Определяем тип операции и применяем соответствующий лимит
  if (hasSearch) {
    return searchLimit(req, res, next);
  }
  
  if (method === 'GET' || method === 'HEAD') {
    return reportsReadLimit(req, res, next);
  }
  
  if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
    return reportsWriteLimit(req, res, next);
  }
  
  // Для неизвестных методов применяем строгий лимит
  return reportsWriteLimit(req, res, next);
}; 