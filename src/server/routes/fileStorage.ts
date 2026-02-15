import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { 
  getFiles, 
  createFolder, 
  uploadFile, 
  downloadFile, 
  deleteFile,
  getFileById,
  upload
} from '../controllers/fileController';

const router = express.Router();

// Маршруты, требующие аутентификации
router.use(protect);

// Получение списка файлов и папок
router.get('/', getFiles);

// Получение информации о конкретном файле
router.get('/:fileId', getFileById);

// Создание новой папки
router.post('/folder', createFolder);

// Загрузка файла
router.post('/upload', upload.single('file'), uploadFile);

// Скачивание файла
router.get('/download/:fileId', downloadFile);

// Удаление файла или папки
router.delete('/:fileId', deleteFile);

export default router; 