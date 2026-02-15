import mongoose from 'mongoose';
import TeamReport, { ReportStatus, ReportVisibility } from '../models/TeamReport';
import { moveFilesToReports, cleanupTempFiles, getFileUrl } from '../middleware/fileUpload';

/**
 * Получить все отчеты с фильтрацией и пагинацией
 */
export const getReports = async (req: any, res: any) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      type, 
      visibility,
      search 
    } = req.query;
    
    const userId = new mongoose.Types.ObjectId(req.user?._id);
    const userRole = req.user?.role;
    
    // Базовый фильтр
    let filter: any = { isDeleted: false };
    
    // Фильтр по доступности для пользователя
    if (userRole === 'player') {
      filter.$or = [
        { visibility: ReportVisibility.PUBLIC },
        { createdBy: userId },
        { assignedTo: userId },
        { viewableBy: userId }
      ];
    } else if (userRole === 'staff') {
      // Персонал видит все отчеты кроме приватных других пользователей
      filter.$or = [
        { visibility: { $ne: ReportVisibility.PRIVATE } },
        { createdBy: userId }
      ];
    }
    
    // Дополнительные фильтры
    if (status) {
      filter.status = status;
    }
    
    if (type) {
      filter.type = type;
    }
    
    if (visibility) {
      filter.visibility = visibility;
    }
    
    // Поиск по тексту
    if (search) {
      filter.$text = { $search: search.toString() };
    }
    
    // Пагинация
    const skip = (parseInt(page.toString()) - 1) * parseInt(limit.toString());
    
    // Выполняем запрос
    const reports = await TeamReport.find(filter)
      .populate('createdBy', 'name email avatar')
      .populate('assignedTo', 'name email avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit.toString()));
    
    // Подсчет общего количества
    const total = await TeamReport.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      data: {
        reports,
        pagination: {
          current: parseInt(page.toString()),
          pages: Math.ceil(total / parseInt(limit.toString())),
          total,
          limit: parseInt(limit.toString())
        }
      }
    });
    
  } catch (error) {
    console.error('[TeamReports Controller] Ошибка при получении отчетов:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении отчетов',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
};

/**
 * Получить конкретный отчет по ID
 */
export const getReportById = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const userId = new mongoose.Types.ObjectId(req.user?._id);
    
    // Валидация ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Неверный ID отчета'
      });
    }
    
    // Поиск отчета
    const report = await TeamReport.findOne({ 
      _id: id, 
      isDeleted: false 
    })
      .populate('createdBy', 'name email avatar')
      .populate('assignedTo', 'name email avatar')
      .populate('viewableBy', 'name email avatar');
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Отчет не найден'
      });
    }
    
    // Проверка прав доступа
    if (!report.canBeViewedBy(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Недостаточно прав для просмотра этого отчета'
      });
    }
    
    res.status(200).json({
      success: true,
      data: report
    });
    
  } catch (error) {
    console.error('[TeamReports Controller] Ошибка при получении отчета:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении отчета',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
};

/**
 * Создать новый отчет
 */
export const createReport = async (req: any, res: any) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user?._id);
    const userRole = req.user?.role;
    
    console.log(`📝 [CreateReport] Пользователь ${req.user?.name} (роль: ${userRole}) создает отчет`);
    
    const { 
      title, 
      description, 
      content, 
      type, 
      visibility, 
      assignedTo, 
      viewableBy 
    } = req.body;
    
    // Валидация обязательных полей
    if (!title || !content || !type) {
      return res.status(400).json({
        success: false,
        message: 'Отсутствуют обязательные поля: title, content, type'
      });
    }
    
    // Валидация содержимого - базовые поля проверяются в middleware валидации
    
    // Обработка загруженных файлов
    const files = req.files as Express.Multer.File[] || [];
    let attachments: any[] = [];
    
    try {
      if (files.length > 0) {
        // Перемещаем файлы из temp в постоянную директорию
        const attachmentFilenames = await moveFilesToReports(files);
        console.log(`📁 Загружено ${attachmentFilenames.length} файлов для отчета`);
        
        // Создаем полную информацию о файлах для MongoDB
        attachments = files.map((file, index) => ({
          filename: attachmentFilenames[index],
          path: `/uploads/team-reports/${attachmentFilenames[index]}`,
          mimetype: file.mimetype,
          size: file.size
        }));
      }
      
      // Добавляем информацию о файлах в content
      const enhancedContent = {
        ...content,
        attachments: attachments
      };

            // Создание отчета
      const reportData: any = {
        title,
        description,
        content: enhancedContent,
        type,
        visibility: visibility || ReportVisibility.TEAM,
        createdBy: userId
      };
      
      // Добавляем назначенных пользователей если указаны
      if (assignedTo && Array.isArray(assignedTo)) {
        reportData.assignedTo = assignedTo.filter(id => mongoose.Types.ObjectId.isValid(id));
      }
      
      if (viewableBy && Array.isArray(viewableBy)) {
        reportData.viewableBy = viewableBy.filter(id => mongoose.Types.ObjectId.isValid(id));
      }
      
      const report = new TeamReport(reportData);
      await report.save();
      
      // Загружаем отчет с популяцией
      const populatedReport = await TeamReport.findById(report._id)
        .populate('createdBy', 'name email avatar')
        .populate('assignedTo', 'name email avatar')
        .populate('viewableBy', 'name email avatar');
      
      res.status(201).json({
        success: true,
        message: 'Отчет успешно создан',
        data: populatedReport
      });
      
    } catch (fileError) {
      // Очищаем временные файлы при ошибке
      if (files.length > 0) {
        cleanupTempFiles(files);
      }
      throw fileError;
    }
    
  } catch (error) {
    console.error('[TeamReports Controller] Ошибка при создании отчета:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при создании отчета',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
};

/**
 * Обновить существующий отчет
 */
export const updateReport = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const userId = new mongoose.Types.ObjectId(req.user?._id);
    
    // Валидация ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Неверный ID отчета'
      });
    }
    
    // Поиск отчета
    const report = await TeamReport.findOne({ 
      _id: id, 
      isDeleted: false 
    });
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Отчет не найден'
      });
    }
    
    // Проверка прав редактирования
    if (!report.canBeEditedBy(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Недостаточно прав для редактирования этого отчета'
      });
    }
    
    // Обновляемые поля
    const updateFields = [
      'title', 
      'description', 
      'content', 
      'type', 
      'visibility', 
      'assignedTo', 
      'viewableBy'
    ];
    
    // Применяем обновления
    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        (report as any)[field] = req.body[field];
      }
    });
    
    await report.save();
    
    // Загружаем обновленный отчет с популяцией
    const updatedReport = await TeamReport.findById(report._id)
      .populate('createdBy', 'name email avatar')
      .populate('assignedTo', 'name email avatar')
      .populate('viewableBy', 'name email avatar');
    
    res.status(200).json({
      success: true,
      message: 'Отчет успешно обновлен',
      data: updatedReport
    });
    
  } catch (error) {
    console.error('[TeamReports Controller] Ошибка при обновлении отчета:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении отчета',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
};

/**
 * Изменить статус отчета
 */
export const updateReportStatus = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = new mongoose.Types.ObjectId(req.user?._id);
    
    // Валидация ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Неверный ID отчета'
      });
    }
    
    // Валидация статуса
    if (!Object.values(ReportStatus).includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Неверный статус отчета'
      });
    }
    
    // Поиск отчета
    const report = await TeamReport.findOne({ 
      _id: id, 
      isDeleted: false 
    });
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Отчет не найден'
      });
    }
    
    // Проверка прав редактирования
    if (!report.canBeEditedBy(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Недостаточно прав для изменения статуса этого отчета'
      });
    }
    
    report.status = status;
    await report.save();
    
    res.status(200).json({
      success: true,
      message: `Статус отчета изменен на "${status}"`,
      data: report
    });
    
  } catch (error) {
    console.error('[TeamReports Controller] Ошибка при изменении статуса:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при изменении статуса отчета',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
};

/**
 * Удалить отчет (мягкое удаление)
 */
export const deleteReport = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const userId = new mongoose.Types.ObjectId(req.user?._id);
    
    // Валидация ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Неверный ID отчета'
      });
    }
    
    // Поиск отчета
    const report = await TeamReport.findOne({ 
      _id: id, 
      isDeleted: false 
    });
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Отчет не найден'
      });
    }
    
    // Проверка прав удаления
    if (!report.canBeEditedBy(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Недостаточно прав для удаления этого отчета'
      });
    }
    
    // Мягкое удаление
    await report.softDelete();
    
    res.status(200).json({
      success: true,
      message: 'Отчет успешно удален'
    });
    
  } catch (error) {
    console.error('[TeamReports Controller] Ошибка при удалении отчета:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при удалении отчета',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
};

/**
 * Получить статистику отчетов
 */
export const getReportsStats = async (req: any, res: any) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user?._id);
    const userRole = req.user?.role;
    
    // Базовый фильтр доступности
    let accessFilter: any = { isDeleted: false };
    
    if (userRole === 'player') {
      accessFilter.$or = [
        { visibility: ReportVisibility.PUBLIC },
        { createdBy: userId },
        { assignedTo: userId },
        { viewableBy: userId }
      ];
    } else if (userRole === 'staff') {
      accessFilter.$or = [
        { visibility: { $ne: ReportVisibility.PRIVATE } },
        { createdBy: userId }
      ];
    }
    
    // Агрегация статистики
    const statsAggregation = await TeamReport.aggregate([
      { $match: accessFilter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          published: { 
            $sum: { $cond: [{ $eq: ['$status', ReportStatus.PUBLISHED] }, 1, 0] } 
          },
          draft: { 
            $sum: { $cond: [{ $eq: ['$status', ReportStatus.DRAFT] }, 1, 0] } 
          },
          archived: { 
            $sum: { $cond: [{ $eq: ['$status', ReportStatus.ARCHIVED] }, 1, 0] } 
          }
        }
      }
    ]);
    
    // Статистика по типам
    const typeStats = await TeamReport.aggregate([
      { $match: accessFilter },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    const stats = statsAggregation[0] || {
      total: 0,
      published: 0,
      draft: 0,
      archived: 0
    };
    
    res.status(200).json({
      success: true,
      data: {
        ...stats,
        byType: typeStats
      }
    });
    
  } catch (error) {
    console.error('[TeamReports Controller] Ошибка при получении статистики:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении статистики отчетов',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
}; 