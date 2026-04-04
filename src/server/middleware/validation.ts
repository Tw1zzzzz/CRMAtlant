import express from 'express';
import { body, param, query, validationResult, ValidationChain } from 'express-validator';
import { ReportStatus, ReportVisibility, ReportType } from '../models/TeamReport';

/**
 * Универсальный middleware для обработки результатов валидации
 * Использует patterns из Context7 документации express-validator
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.log('🔍 [Validation] Начало валидации. Данные req.body:', JSON.stringify(req.body, null, 2));
    
    // Параллельная обработка всех валидаций
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      console.log('✅ [Validation] Валидация прошла успешно');
      return next();
    }

    console.error('❌ [Validation] Ошибки валидации:', errors.array());

    // Структурированный ответ с ошибками валидации
    res.status(400).json({
      status: 'error',
      message: 'Ошибки валидации данных',
      errors: errors.array().map(error => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined,
        location: error.type === 'field' ? error.location : undefined
      }))
    });
  };
};

/**
 * Валидация для создания отчета
 */
export const validateCreateReport = [
  body('title')
    .notEmpty()
    .withMessage('Название отчета обязательно')
    .isLength({ min: 3, max: 200 })
    .withMessage('Название должно быть от 3 до 200 символов')
    .trim()
    .escape(),

  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Описание не может превышать 500 символов')
    .trim()
    .escape(),

  body('type')
    .isIn(Object.values(ReportType))
    .withMessage(`Тип отчета должен быть одним из: ${Object.values(ReportType).join(', ')}`),

  body('visibility')
    .optional()
    .isIn(Object.values(ReportVisibility))
    .withMessage(`Видимость должна быть одной из: ${Object.values(ReportVisibility).join(', ')}`),

  body('content')
    .isObject()
    .withMessage('Контент должен быть объектом'),

  body('content.sections')
    .isArray({ min: 1 })
    .withMessage('Отчет должен содержать как минимум одну секцию'),

  body('content.sections.*.title')
    .notEmpty()
    .withMessage('Название секции обязательно')
    .isLength({ max: 200 })
    .withMessage('Название секции не может превышать 200 символов'),

  body('content.sections.*.content')
    .notEmpty()
    .withMessage('Содержимое секции обязательно')
    .isLength({ max: 10000 })
    .withMessage('Содержимое секции не может превышать 10000 символов'),

  body('content.sections.*.order')
    .isInt({ min: 0 })
    .withMessage('Порядок секции должен быть неотрицательным числом'),

  body('content.sections.*.type')
    .isIn(['text', 'markdown', 'chart', 'table'])
    .withMessage('Тип секции должен быть одним из: text, markdown, chart, table'),

  body('content.summary')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Краткое содержание не может превышать 1000 символов')
    .trim(),

  body('content.details')
    .optional()
    .isLength({ max: 5000 })
    .withMessage('Детали не могут превышать 5000 символов')
    .trim(),

  body('content.recommendations')
    .optional()
    .isArray()
    .withMessage('Рекомендации должны быть массивом'),

  body('content.recommendations.*')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Каждая рекомендация не может превышать 500 символов'),

  body('assignedTo')
    .optional()
    .isArray()
    .withMessage('assignedTo должно быть массивом'),

  body('assignedTo.*')
    .optional()
    .isMongoId()
    .withMessage('ID назначенного пользователя должен быть валидным MongoDB ObjectId'),

  body('viewableBy')
    .optional()
    .isArray()
    .withMessage('viewableBy должно быть массивом'),

  body('viewableBy.*')
    .optional()
    .isMongoId()
    .withMessage('ID пользователя для просмотра должен быть валидным MongoDB ObjectId')
];

/**
 * Валидация для обновления отчета
 */
export const validateUpdateReport = [
  param('id')
    .isMongoId()
    .withMessage('ID отчета должен быть валидным MongoDB ObjectId'),

  body('title')
    .optional()
    .notEmpty()
    .withMessage('Название отчета не может быть пустым')
    .isLength({ min: 3, max: 200 })
    .withMessage('Название должно быть от 3 до 200 символов')
    .trim()
    .escape(),

  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Описание не может превышать 500 символов')
    .trim()
    .escape(),

  body('content')
    .optional()
    .isObject()
    .withMessage('Контент должен быть объектом'),

  body('content.summary')
    .optional()
    .notEmpty()
    .withMessage('Краткое содержание не может быть пустым')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Краткое содержание должно быть от 10 до 1000 символов')
    .trim(),

  body('content.details')
    .optional()
    .notEmpty()
    .withMessage('Детали отчета не могут быть пустыми')
    .isLength({ min: 20, max: 5000 })
    .withMessage('Детали должны быть от 20 до 5000 символов')
    .trim()
];

/**
 * Валидация для изменения статуса отчета
 */
export const validateUpdateReportStatus = [
  param('id')
    .isMongoId()
    .withMessage('ID отчета должен быть валидным MongoDB ObjectId'),

  body('status')
    .isIn(Object.values(ReportStatus))
    .withMessage(`Статус должен быть одним из: ${Object.values(ReportStatus).join(', ')}`)
];

/**
 * Валидация для получения отчета по ID
 */
export const validateGetReport = [
  param('id')
    .isMongoId()
    .withMessage('ID отчета должен быть валидным MongoDB ObjectId')
];

/**
 * Валидация для удаления отчета
 */
export const validateDeleteReport = [
  param('id')
    .isMongoId()
    .withMessage('ID отчета должен быть валидным MongoDB ObjectId')
];

export const validateSupportRequest = [
  body('name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Имя не должно превышать 100 символов')
    .trim(),

  body('email')
    .notEmpty()
    .withMessage('Email обязателен')
    .isEmail()
    .withMessage('Укажите корректный email')
    .normalizeEmail(),

  body('category')
    .notEmpty()
    .withMessage('Категория обращения обязательна')
    .isIn(['access', 'bug', 'billing', 'integration', 'other'])
    .withMessage('Указана неизвестная категория обращения'),

  body('subject')
    .notEmpty()
    .withMessage('Тема обращения обязательна')
    .isLength({ min: 3, max: 200 })
    .withMessage('Тема должна быть от 3 до 200 символов')
    .trim(),

  body('message')
    .notEmpty()
    .withMessage('Опишите проблему')
    .isLength({ min: 10, max: 4000 })
    .withMessage('Сообщение должно быть от 10 до 4000 символов')
    .trim(),

  body('pageUrl')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Ссылка на страницу не должна превышать 500 символов')
    .trim(),

  body('userAgent')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('User-Agent не должен превышать 1000 символов')
    .trim(),
];

/**
 * Валидация для получения списка отчетов
 */
export const validateGetReports = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Номер страницы должен быть целым числом больше 0')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Лимит должен быть целым числом от 1 до 100')
    .toInt(),

  query('status')
    .optional()
    .isIn(Object.values(ReportStatus))
    .withMessage(`Статус должен быть одним из: ${Object.values(ReportStatus).join(', ')}`),

  query('search')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Поисковый запрос должен быть от 1 до 100 символов')
    .trim()
    .escape()
];

/**
 * Middleware для санитизации HTML контента от XSS атак
 * Очищает потенциально опасные HTML теги из текстовых полей
 */
export const sanitizeHtmlContent = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    console.log('🧹 [SanitizeHTML] Санитизация HTML контента');

    // Функция для безопасной санитизации текста
    const sanitizeText = (text: string): string => {
      if (typeof text !== 'string') return text;
      
      // Простая санитизация - удаляем потенциально опасные теги
      return text
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Удаляем script теги
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Удаляем iframe
        .replace(/on\w+="[^"]*"/gi, '') // Удаляем on* event handlers
        .replace(/javascript:/gi, '') // Удаляем javascript: протоколы
        .trim();
    };

    // Санитизируем текстовые поля в req.body
    if (req.body.title) {
      req.body.title = sanitizeText(req.body.title);
    }

    if (req.body.description) {
      req.body.description = sanitizeText(req.body.description);
    }

    // Санитизируем содержимое отчета
    if (req.body.content) {
      if (req.body.content.summary) {
        req.body.content.summary = sanitizeText(req.body.content.summary);
      }

      if (req.body.content.details) {
        req.body.content.details = sanitizeText(req.body.content.details);
      }

      // Санитизируем секции
      if (req.body.content.sections && Array.isArray(req.body.content.sections)) {
        req.body.content.sections = req.body.content.sections.map((section: any) => ({
          ...section,
          title: sanitizeText(section.title),
          content: sanitizeText(section.content)
        }));
      }

      // Санитизируем рекомендации
      if (req.body.content.recommendations && Array.isArray(req.body.content.recommendations)) {
        req.body.content.recommendations = req.body.content.recommendations.map((rec: string) => 
          sanitizeText(rec)
        );
      }
    }

    console.log('✅ [SanitizeHTML] HTML контент санитизирован');
    next();
  } catch (error) {
    console.error('❌ [SanitizeHTML] Ошибка санитизации:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ошибка обработки данных',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
}; 
