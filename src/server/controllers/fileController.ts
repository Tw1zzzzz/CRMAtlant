import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import File from '../models/File';

// Функция для форматирования размера файла в читаемом виде
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Расширяем тип Request в Express для включения пользователя
declare global {
  namespace Express {
    interface Request {
      user?: {
        _id: mongoose.Types.ObjectId;
        role: string;
        name: string;
        email: string;
      }
    }
  }
}

// Создаем директорию для хранения файлов, если она не существует
const uploadDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`✅ Создана директория для загрузки: ${uploadDir}`);
}

// Создаем директорию для аватаров, если она не существует
const avatarDir = path.join(uploadDir, 'avatars');
if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
  console.log(`✅ Создана директория для аватаров: ${avatarDir}`);
}

console.log('📁 Пути директорий:');
console.log(`- Директория загрузок: ${uploadDir}`);
console.log(`- Директория аватаров: ${avatarDir}`);

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueFilename = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueFilename);
  }
});

// Настройка multer для загрузки аватаров
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log(`📥 Сохранение аватара в директорию: ${avatarDir}`);
    // Проверяем существование директории перед сохранением
    if (!fs.existsSync(avatarDir)) {
      console.log(`📁 Директория для аватаров не существует, создаем...`);
      fs.mkdirSync(avatarDir, { recursive: true });
    }
    console.log(`📁 Директория для аватаров существует: ${fs.existsSync(avatarDir)}`);
    cb(null, avatarDir);
  },
  filename: function (req, file, cb) {
    // Получаем расширение файла
    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'png';
    const uniqueFilename = `avatar-${uuidv4()}.${ext}`;
    console.log(`📝 Генерируем уникальное имя для аватара: ${uniqueFilename}`);
    cb(null, uniqueFilename);
  }
});

// Проверка типа файла для аватаров
const imageFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  console.log(`🔍 Проверка файла аватара: ${file.originalname}, тип: ${file.mimetype}`);
  
  // Принимаем только изображения
  if (!file.mimetype.startsWith('image/')) {
    console.error(`❌ Отклонен файл не-изображение: ${file.mimetype}`);
    return cb(new Error('Только изображения могут быть загружены как аватары'));
  }
  
  // Проверяем расширение файла
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  const extension = file.originalname.split('.').pop()?.toLowerCase();
  
  if (!extension || !allowedExtensions.includes(extension)) {
    console.error(`❌ Отклонен файл с недопустимым расширением: ${extension || 'неизвестно'}`);
    return cb(new Error(`Поддерживаемые форматы: ${allowedExtensions.join(', ')}`));
  }
  
  console.log(`✅ Файл прошел проверку: ${file.originalname}`);
  cb(null, true);
};

export const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB лимит
});

export const avatarUpload = multer({ 
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB лимит для аватаров
  fileFilter: imageFileFilter
});

// Получение списка файлов и папок (с пагинацией)
export const getFiles = async (req: Request, res: Response) => {
  try {
    const { parentFolderId, search, page = 1, limit = 20 } = req.query;
    const userId = req.user?._id;

    // Формируем фильтр запроса
    const filter: any = { 
      isDeleted: false,
      parentFolder: parentFolderId || null,
    };

    // Если пользователь не админ, показываем только его файлы
    if (req.user?.role !== 'staff') {
      filter.owner = userId;
    }

    // Если есть поисковый запрос
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    // Получаем общее количество файлов
    const totalFiles = await File.countDocuments(filter);
    
    // Получаем файлы с пагинацией
    const files = await File.find(filter)
      .populate('owner', 'name')
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .sort({ type: 1, name: 1 }) // сначала папки, потом файлы
      .lean();

    // Преобразуем размер файла в человекочитаемый формат
    const filesWithReadableSize = files.map(file => ({
      ...file,
      readableSize: file.type === 'file' ? formatFileSize(file.size) : '-'
    }));

    res.json({
      status: 'success',
      data: {
        files: filesWithReadableSize,
        pagination: {
          total: totalFiles,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(totalFiles / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Ошибка при получении файлов:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Ошибка при получении списка файлов' 
    });
  }
};

// Создание новой папки
export const createFolder = async (req: Request, res: Response) => {
  try {
    const { name, parentFolderId } = req.body;
    const userId = req.user?._id;

    // Проверяем уникальность имени папки в текущей директории
    const existingFolder = await File.findOne({
      name,
      parentFolder: parentFolderId || null,
      type: 'folder',
      isDeleted: false
    });

    if (existingFolder) {
      return res.status(400).json({
        status: 'error',
        message: 'Папка с таким именем уже существует'
      });
    }

    // Формируем путь к папке
    let folderPath = name;
    
    if (parentFolderId) {
      const parentFolder = await File.findById(parentFolderId);
      if (!parentFolder) {
        return res.status(404).json({
          status: 'error',
          message: 'Родительская папка не найдена'
        });
      }
      folderPath = `${parentFolder.path}/${name}`;
    }

    // Создаем новую папку в базе данных
    const newFolder = await File.create({
      name,
      path: folderPath,
      type: 'folder',
      owner: userId,
      parentFolder: parentFolderId || null
    });

    res.status(201).json({
      status: 'success',
      data: {
        folder: newFolder
      }
    });
  } catch (error) {
    console.error('Ошибка при создании папки:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Ошибка при создании новой папки' 
    });
  }
};

// Загрузка файла
export const uploadFile = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'Файл не был загружен'
      });
    }

    const { parentFolderId } = req.body;
    const userId = req.user?._id;
    const file = req.file;

    // Проверяем уникальность имени файла в текущей директории
    const existingFile = await File.findOne({
      name: file.originalname,
      parentFolder: parentFolderId || null,
      type: 'file',
      isDeleted: false
    });

    if (existingFile) {
      // Удаляем загруженный файл, так как имя не уникально
      fs.unlinkSync(file.path);
      
      return res.status(400).json({
        status: 'error',
        message: 'Файл с таким именем уже существует'
      });
    }

    // Формируем путь к файлу
    let filePath = file.filename;
    
    if (parentFolderId) {
      const parentFolder = await File.findById(parentFolderId);
      if (!parentFolder) {
        // Удаляем загруженный файл, так как родительская папка не найдена
        fs.unlinkSync(file.path);
        
        return res.status(404).json({
          status: 'error',
          message: 'Родительская папка не найдена'
        });
      }
      filePath = `${parentFolder.path}/${file.filename}`;
    }

    // Создаем новый файл в базе данных
    const newFile = await File.create({
      name: file.originalname,
      path: filePath,
      type: 'file',
      size: file.size,
      mimeType: file.mimetype,
      owner: userId,
      parentFolder: parentFolderId || null
    });

    res.status(201).json({
      status: 'success',
      data: {
        file: {
          ...newFile.toObject(),
          readableSize: formatFileSize(newFile.size)
        }
      }
    });
  } catch (error) {
    console.error('Ошибка при загрузке файла:', error);
    
    // Удаляем загруженный файл в случае ошибки
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      status: 'error', 
      message: 'Ошибка при загрузке файла' 
    });
  }
};

// Скачивание файла
export const downloadFile = async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const userId = req.user?._id;

    // Находим файл в базе данных
    const file = await File.findById(fileId);

    if (!file || file.isDeleted) {
      return res.status(404).json({
        status: 'error',
        message: 'Файл не найден'
      });
    }

    // Проверяем, имеет ли пользователь доступ к файлу
    if (file.owner.toString() !== userId?.toString() && req.user?.role !== 'staff') {
      return res.status(403).json({
        status: 'error',
        message: 'У вас нет доступа к этому файлу'
      });
    }

    // Проверяем, является ли запись файлом (не папкой)
    if (file.type !== 'file') {
      return res.status(400).json({
        status: 'error',
        message: 'Невозможно скачать папку'
      });
    }

    // Путь к физическому файлу
    const filePath = path.join(uploadDir, path.basename(file.path));

    // Проверяем существование файла
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        status: 'error',
        message: 'Физический файл не найден на сервере'
      });
    }

    // Устанавливаем заголовки для скачивания файла
    const fileName = encodeURIComponent(file.name);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    
    // Устанавливаем no-cache заголовки
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Отправляем файл клиенту для скачивания
    res.download(filePath, file.name);
  } catch (error) {
    console.error('Ошибка при скачивании файла:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Ошибка при скачивании файла' 
    });
  }
};

// Удаление файла или папки (мягкое удаление)
export const deleteFile = async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const userId = req.user?._id;

    // Находим файл в базе данных
    const file = await File.findById(fileId);

    if (!file || file.isDeleted) {
      return res.status(404).json({
        status: 'error',
        message: 'Файл не найден'
      });
    }

    // Проверяем, имеет ли пользователь доступ к файлу
    if (file.owner.toString() !== userId?.toString() && req.user?.role !== 'staff') {
      return res.status(403).json({
        status: 'error',
        message: 'У вас нет доступа к этому файлу'
      });
    }

    // Если это папка, помечаем как удаленные все вложенные файлы и папки
    if (file.type === 'folder') {
      // Рекурсивно помечаем все вложенные файлы и папки как удаленные
      await markFolderContentsAsDeleted(file._id);
    }

    // Помечаем файл или папку как удаленные
    file.isDeleted = true;
    await file.save();

    res.json({
      status: 'success',
      message: `${file.type === 'folder' ? 'Папка' : 'Файл'} успешно удален`
    });
  } catch (error) {
    console.error('Ошибка при удалении файла:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Ошибка при удалении файла' 
    });
  }
};

// Рекурсивная функция для пометки содержимого папки как удаленного
async function markFolderContentsAsDeleted(folderId: mongoose.Types.ObjectId) {
  // Находим все файлы и папки в указанной папке
  const files = await File.find({ parentFolder: folderId, isDeleted: false });
  
  for (const file of files) {
    if (file.type === 'folder') {
      // Рекурсивно помечаем содержимое вложенной папки
      await markFolderContentsAsDeleted(file._id);
    }
    
    // Помечаем файл или папку как удаленные
    file.isDeleted = true;
    await file.save();
  }
}

// Получение информации о файле по ID
export const getFileById = async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const userId = req.user?._id;

    // Находим файл в базе данных
    const file = await File.findById(fileId);

    if (!file || file.isDeleted) {
      return res.status(404).json({
        status: 'error',
        message: 'Файл не найден'
      });
    }

    // Проверяем, имеет ли пользователь доступ к файлу
    if (file.owner.toString() !== userId?.toString() && req.user?.role !== 'staff') {
      return res.status(403).json({
        status: 'error',
        message: 'У вас нет доступа к этому файлу'
      });
    }

    // Добавляем читаемый размер файла
    const fileWithSize = {
      ...file.toObject(),
      readableSize: file.size ? formatFileSize(file.size) : undefined
    };

    res.status(200).json({
      status: 'success',
      data: {
        file: fileWithSize
      }
    });
  } catch (error) {
    console.error('Ошибка при получении информации о файле:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Ошибка при получении информации о файле' 
    });
  }
}; 