import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

/**
 * Директории для загрузки файлов
 */
const UPLOAD_PATHS = {
  REPORTS: path.join(process.cwd(), '../../uploads/team-reports'),
  TEMP: path.join(process.cwd(), '../../uploads/temp')
};

/**
 * Создание директорий если они не существуют
 */
const ensureDirectoryExists = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Создана директория: ${dirPath}`);
  }
};

// Создаем необходимые директории
Object.values(UPLOAD_PATHS).forEach(ensureDirectoryExists);

/**
 * Настройка хранения файлов
 */
const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    // Временно сохраняем в temp, затем переместим после валидации
    callback(null, UPLOAD_PATHS.TEMP);
  },
  filename: (_req, file, callback) => {
    // Генерируем уникальное имя файла
    const uniqueSuffix = `${Date.now()}-${crypto.randomUUID()}`;
    const fileExtension = path.extname(file.originalname);
    const fileName = `${file.fieldname}-${uniqueSuffix}${fileExtension}`;
    callback(null, fileName);
  }
});

/**
 * Фильтр для проверки типов файлов
 */
const fileFilter = (_req: any, file: Express.Multer.File, callback: multer.FileFilterCallback) => {
  // Разрешенные типы файлов для отчетов
  const allowedMimeTypes = [
    // Изображения
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    // Документы
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ];

  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'];
  
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)) {
    callback(null, true);
  } else {
    callback(new Error(`Неподдерживаемый тип файла: ${file.mimetype}. Разрешены: изображения (jpg, png, gif, webp), документы (pdf, doc, docx, xls, xlsx, txt, csv)`));
  }
};

/**
 * Конфигурация Multer для загрузки файлов отчетов
 */
export const uploadReportFiles = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB максимум на файл
    files: 5 // Максимум 5 файлов за раз
  }
}).array('attachments', 5); // Поле 'attachments', максимум 5 файлов

/**
 * Middleware для обработки ошибок загрузки файлов
 */
export const handleUploadErrors = (error: any, _req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    let message = 'Ошибка загрузки файла';
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'Файл слишком большой. Максимальный размер: 10MB';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Слишком много файлов. Максимум: 5 файлов';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Неожиданное поле файла. Используйте поле "attachments"';
        break;
      default:
        message = `Ошибка загрузки: ${error.message}`;
    }
    
    return res.status(400).json({
      status: 'error',
      message: message,
      code: error.code
    });
  }
  
  if (error.message.includes('Неподдерживаемый тип файла')) {
    return res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
  
  next(error);
};

/**
 * Утилита для перемещения файлов из temp в постоянную директорию
 */
export const moveFilesToReports = async (files: Express.Multer.File[]): Promise<string[]> => {
  const movedFiles: string[] = [];
  
  for (const file of files) {
    const tempPath = file.path;
    const finalPath = path.join(UPLOAD_PATHS.REPORTS, file.filename);
    
    try {
      // Перемещаем файл из temp в постоянную директорию
      fs.renameSync(tempPath, finalPath);
      movedFiles.push(file.filename);
      console.log(`📁 Файл перемещен: ${file.filename}`);
    } catch (error) {
      console.error(`❌ Ошибка перемещения файла ${file.filename}:`, error);
      // Удаляем временный файл если не удалось переместить
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  }
  
  return movedFiles;
};

/**
 * Утилита для очистки временных файлов при ошибке
 */
export const cleanupTempFiles = (files: Express.Multer.File[]) => {
  files.forEach(file => {
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
      console.log(`🗑️ Временный файл удален: ${file.filename}`);
    }
  });
};

/**
 * Утилита для удаления файлов отчета
 */
export const deleteReportFiles = async (filenames: string[]): Promise<void> => {
  for (const filename of filenames) {
    const filePath = path.join(UPLOAD_PATHS.REPORTS, filename);
    
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Файл отчета удален: ${filename}`);
      }
    } catch (error) {
      console.error(`❌ Ошибка удаления файла ${filename}:`, error);
    }
  }
};

/**
 * Middleware для проверки и валидации загруженных файлов
 */
export const validateUploadedFiles = (req: any, res: any, next: any) => {
  const files = req.files as Express.Multer.File[];
  
  if (!files || files.length === 0) {
    return next(); // Файлы опциональны
  }
  
  // Дополнительная валидация
  const errors: string[] = [];
  
  files.forEach((file, index) => {
    // Проверяем размер
    if (file.size > 10 * 1024 * 1024) {
      errors.push(`Файл ${index + 1} слишком большой: ${file.originalname}`);
    }
    
    // Проверяем имя файла на безопасность
    if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
      errors.push(`Небезопасное имя файла: ${file.originalname}`);
    }
  });
  
  if (errors.length > 0) {
    // Удаляем загруженные файлы при ошибке валидации
    cleanupTempFiles(files);
    
    return res.status(400).json({
      status: 'error',
      message: 'Ошибки валидации файлов',
      errors: errors
    });
  }
  
  next();
};

/**
 * URL для доступа к загруженным файлам
 */
export const getFileUrl = (filename: string): string => {
  return `/uploads/team-reports/${filename}`;
};

/**
 * Middleware для статической раздачи файлов отчетов
 * Добавить в server.ts: app.use('/uploads/team-reports', express.static(UPLOAD_PATHS.REPORTS));
 */
export { UPLOAD_PATHS }; 