import express from 'express';
import {
  getReports,
  getReportById,
  createReport,
  updateReport,
  updateReportStatus,
  deleteReport,
  getReportsStats
} from '../controllers/teamReportsController';
import { protect } from '../middleware/authMiddleware';
import {
  validate,
  validateCreateReport,
  validateUpdateReport,
  validateUpdateReportStatus,
  validateGetReport,
  validateDeleteReport,
  validateGetReports,
  sanitizeHtmlContent
} from '../middleware/validation';
import { smartRateLimit } from '../middleware/rateLimiting';
import { 
  uploadReportFiles, 
  handleUploadErrors, 
  validateUploadedFiles
} from '../middleware/fileUpload';
import { fileUploadLimit } from '../middleware/rateLimiting';

const router = express.Router();

/**
 * Middleware для парсинга JSON полей из FormData
 */
const parseFormDataJSON = (req: any, res: any, next: any) => {
  try {
    console.log('📝 [ParseFormDataJSON] Исходные данные req.body:', {
      title: req.body.title,
      description: req.body.description,
      type: req.body.type,
      visibility: req.body.visibility,
      content: typeof req.body.content === 'string' ? 'JSON string' : req.body.content,
      assignedTo: typeof req.body.assignedTo === 'string' ? 'JSON string' : req.body.assignedTo,
      viewableBy: typeof req.body.viewableBy === 'string' ? 'JSON string' : req.body.viewableBy
    });
    
    // Парсим JSON поля из FormData
    if (req.body.content && typeof req.body.content === 'string') {
      req.body.content = JSON.parse(req.body.content);
      console.log('📝 [ParseFormDataJSON] Content после парсинга:', req.body.content);
    }
    
    if (req.body.assignedTo && typeof req.body.assignedTo === 'string') {
      req.body.assignedTo = JSON.parse(req.body.assignedTo);
      console.log('📝 [ParseFormDataJSON] AssignedTo после парсинга:', req.body.assignedTo);
    }
    
    if (req.body.viewableBy && typeof req.body.viewableBy === 'string') {
      req.body.viewableBy = JSON.parse(req.body.viewableBy);
      console.log('📝 [ParseFormDataJSON] ViewableBy после парсинга:', req.body.viewableBy);
    }
    
    console.log('📝 [ParseFormDataJSON] Финальные данные готовы для валидации');
    next();
  } catch (error) {
    console.error('❌ [ParseFormDataJSON] Ошибка парсинга JSON:', error);
    res.status(400).json({
      status: 'error',
      message: 'Ошибка парсинга JSON данных',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
};

/**
 * @route   GET /api/team-reports/stats
 * @desc    Получить статистику отчетов
 * @access  Private (все авторизованные пользователи)
 */
router.get('/stats', smartRateLimit, protect, getReportsStats);

/**
 * @route   GET /api/team-reports
 * @desc    Получить список отчетов с фильтрацией и пагинацией
 * @access  Private (все авторизованные пользователи)
 * @query   {number} page - Номер страницы (по умолчанию 1)
 * @query   {number} limit - Количество элементов на странице (по умолчанию 10)
 * @query   {string} status - Фильтр по статусу (draft, published, archived)
 * @query   {string} search - Поиск по тексту
 */
router.get('/', smartRateLimit, protect, validate(validateGetReports), getReports);

/**
 * @route   GET /api/team-reports/:id
 * @desc    Получить конкретный отчет по ID
 * @access  Private (с проверкой прав доступа)
 */
router.get('/:id', smartRateLimit, protect, validate(validateGetReport), getReportById);

/**
 * @route   POST /api/team-reports
 * @desc    Создать новый отчет
 * @access  Private (только персонал)
 * @body    {string} title - Название отчета (обязательно)
 * @body    {string} description - Описание отчета (опционально)
 * @body    {object} content - Содержимое отчета (обязательно)
 * @body    {string} type - Тип отчета (обязательно)
 * @body    {string} visibility - Уровень видимости (опционально, по умолчанию 'team')
 * @body    {array} assignedTo - Массив ID назначенных пользователей (опционально)
 * @files   {array} attachments - Вложения (изображения, документы) до 5 файлов по 10MB
 */
router.post('/', 
  fileUploadLimit, 
  protect, 
  uploadReportFiles, 
  handleUploadErrors,
  parseFormDataJSON,
  validateUploadedFiles,
  validate(validateCreateReport), 
  sanitizeHtmlContent, 
  createReport
);

/**
 * @route   PUT /api/team-reports/:id
 * @desc    Обновить существующий отчет
 * @access  Private (только создатель отчета)
 */
router.put('/:id', smartRateLimit, protect, validate(validateUpdateReport), sanitizeHtmlContent, updateReport);

/**
 * @route   PATCH /api/team-reports/:id/status
 * @desc    Изменить статус отчета
 * @access  Private (только создатель отчета)
 * @body    {string} status - Новый статус (draft, published, archived)
 */
router.patch('/:id/status', smartRateLimit, protect, validate(validateUpdateReportStatus), updateReportStatus);

/**
 * @route   DELETE /api/team-reports/:id
 * @desc    Удалить отчет (мягкое удаление)
 * @access  Private (только создатель отчета)
 */
router.delete('/:id', smartRateLimit, protect, validate(validateDeleteReport), deleteReport);

export default router; 