import { Request, Response } from 'express';
import PlayerCard from '../models/PlayerCard';
import User from '../models/User';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Настройка хранения изображений
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Создаем абсолютный путь к директории загрузки
    const uploadsDir = path.join(__dirname, '../../../uploads');
    const dir = path.join(uploadsDir, 'player-cards');
    
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    console.log(`Сохраняем файл в директорию: ${dir}`);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// Фильтр для проверки типов файлов
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Разрешены только изображения форматов: .jpg, .jpeg, .png, .webp'));
  }
};

// Инициализация multer
export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter
});

// Получить карточку игрока
export const getPlayerCard = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId || req.user?._id;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: 'ID пользователя не указан' });
    }

    // Проверка на валидный ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Некорректный формат ID пользователя' });
    }

    // Поиск пользователя
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }

    // Поиск карточки игрока
    let playerCard = await PlayerCard.findOne({ userId });
    
    // Если карточки нет, возвращаем ошибку (не создаем автоматически)
    // изменено с автоматического создания на явный запрос создания карточки
    if (!playerCard) {
      return res.status(404).json({ success: false, message: 'Карточка игрока не найдена' });
    }

    // Получаем данные о производительности игрока из других коллекций, если доступны
    // Это можно расширить, добавив больше метрик
    
    return res.status(200).json({
      success: true,
      playerCard,
      user: {
        id: user._id.toString(),
        name: user.name,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Ошибка при получении карточки игрока:', error);
    return res.status(500).json({ success: false, message: 'Ошибка сервера при получении карточки игрока' });
  }
};

// Получить все карточки игроков
export const getAllPlayerCards = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    
    // Получаем общее количество карточек для пагинации
    const total = await PlayerCard.countDocuments();
    
    // Получаем карточки с пагинацией и сортировкой по дате обновления
    const playerCards = await PlayerCard.find()
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);
    
    if (!playerCards || playerCards.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Карточки игроков не найдены',
        data: [],
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit)
        }
      });
    }
    
    // Получаем информацию о пользователях для каждой карточки
    const userIds = playerCards.map(card => card.userId);
    const users = await User.find({ _id: { $in: userIds } }, 'name avatar');
    
    // Объединяем данные карточек с данными пользователей
    const cardsWithUserInfo = playerCards.map(card => {
      const user = users.find(u => u._id.toString() === card.userId.toString());
      return {
        _id: card._id,
        userId: card.userId,
        contacts: card.contacts,
        roadmap: card.roadmap,
        mindmap: card.mindmap,
        communicationLine: card.communicationLine,
        updatedAt: card.updatedAt,
        user: user ? {
          id: user._id.toString(),
          name: user.name,
          avatar: user.avatar
        } : null
      };
    });
    
    return res.status(200).json({
      success: true,
      data: cardsWithUserInfo,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Ошибка при получении списка карточек игроков:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Ошибка сервера при получении списка карточек игроков' 
    });
  }
};

// Создать карточку игрока
export const createPlayerCard = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      console.error('Ошибка: ID пользователя не указан');
      return res.status(400).json({ 
        success: false, 
        message: 'ID пользователя не указан' 
      });
    }

    // Проверка на валидный ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.error(`Ошибка: Некорректный формат ID пользователя: ${userId}`);
      return res.status(400).json({ 
        success: false, 
        message: 'Некорректный формат ID пользователя' 
      });
    }

    // Проверяем, существует ли пользователь
    const user = await User.findById(userId);
    if (!user) {
      console.error(`Ошибка: Пользователь с ID ${userId} не найден`);
      return res.status(404).json({ 
        success: false, 
        message: 'Пользователь не найден' 
      });
    }

    // Проверяем, нет ли уже карточки у этого пользователя
    const existingCard = await PlayerCard.findOne({ userId });
    if (existingCard) {
      console.error(`Ошибка: Карточка игрока уже существует для пользователя: ${userId}`);
      return res.status(400).json({ 
        success: false, 
        message: 'Карточка игрока уже существует для этого пользователя' 
      });
    }

    // Извлекаем и валидируем данные из запроса
    const { 
      vk = '', 
      telegram = '', 
      faceit = '', 
      steam = '', 
      nickname = '',
      communicationLine = ''
    } = req.body;

    // Санитизация данных
    const sanitizedData = {
      vk: (vk || '').toString().trim().slice(0, 100),
      telegram: (telegram || '').toString().trim().slice(0, 100),
      faceit: (faceit || '').toString().trim().slice(0, 100),
      steam: (steam || '').toString().trim().slice(0, 100),
      nickname: (nickname || '').toString().trim().slice(0, 100),
      communicationLine: (communicationLine || '').toString().trim().slice(0, 2000)
    };

    // Создаем новую карточку игрока
    const playerCard = new PlayerCard({
      userId,
      contacts: {
        vk: sanitizedData.vk,
        telegram: sanitizedData.telegram,
        faceit: sanitizedData.faceit,
        steam: sanitizedData.steam,
        nickname: sanitizedData.nickname
      },
      roadmap: '',
      mindmap: '',
      communicationLine: sanitizedData.communicationLine
    });

    // Сохраняем карточку
    await playerCard.save();
    
    console.log(`Карточка игрока для пользователя ${userId} успешно создана:`, {
      id: playerCard._id,
      userId: playerCard.userId
    });

    return res.status(201).json({
      success: true,
      message: 'Карточка игрока успешно создана',
      playerCard,
      user: {
        id: user._id.toString(),
        name: user.name,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Ошибка при создании карточки игрока:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Ошибка сервера при создании карточки игрока',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка' 
    });
  }
};

// Обновить контакты игрока
export const updateContacts = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const { contacts } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID пользователя не указан' 
      });
    }

    // Проверка на валидный ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Некорректный формат ID пользователя' 
      });
    }

    // Проверка наличия данных контактов
    if (!contacts) {
      return res.status(400).json({ 
        success: false, 
        message: 'Данные контактов не предоставлены' 
      });
    }

    // Находим карточку
    const existingCard = await PlayerCard.findOne({ userId });
    
    if (!existingCard) {
      return res.status(404).json({ 
        success: false, 
        message: 'Карточка игрока не найдена' 
      });
    }

    // Санитизация данных
    const sanitizedContacts = {
      vk: (contacts.vk || '').toString().trim().slice(0, 100),
      telegram: (contacts.telegram || '').toString().trim().slice(0, 100),
      faceit: (contacts.faceit || '').toString().trim().slice(0, 100),
      steam: (contacts.steam || '').toString().trim().slice(0, 100),
      nickname: (contacts.nickname || '').toString().trim().slice(0, 100)
    };

    // Обновляем контакты
    const playerCard = await PlayerCard.findOneAndUpdate(
      { userId },
      {
        $set: {
          'contacts.vk': sanitizedContacts.vk,
          'contacts.telegram': sanitizedContacts.telegram,
          'contacts.faceit': sanitizedContacts.faceit,
          'contacts.steam': sanitizedContacts.steam,
          'contacts.nickname': sanitizedContacts.nickname
        }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!playerCard) {
      return res.status(404).json({
        success: false,
        message: 'Карточка игрока не найдена'
      });
    }

    return res.status(200).json({ 
      success: true,
      message: 'Контакты успешно обновлены', 
      playerCard 
    });
  } catch (error) {
    console.error('Ошибка при обновлении контактов:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Ошибка сервера при обновлении контактов',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
};

// Обновить коммуникативную линию игрока
export const updateCommunicationLine = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const { communicationLine } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID пользователя не указан' 
      });
    }

    // Проверка на валидный ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Некорректный формат ID пользователя' 
      });
    }

    // Находим карточку
    let playerCard = await PlayerCard.findOne({ userId });
    
    if (!playerCard) {
      return res.status(404).json({ 
        success: false, 
        message: 'Карточка игрока не найдена' 
      });
    }

    // Санитизация данных
    const sanitizedCommunicationLine = (communicationLine || '').toString().trim().slice(0, 2000);

    // Обновляем коммуникативную линию
    playerCard.communicationLine = sanitizedCommunicationLine;

    await playerCard.save();

    return res.status(200).json({ 
      success: true,
      message: 'Коммуникативная линия успешно обновлена', 
      playerCard 
    });
  } catch (error) {
    console.error('Ошибка при обновлении коммуникативной линии:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Ошибка сервера при обновлении коммуникативной линии',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
};

// Загрузить Roadmap изображение
export const uploadRoadmap = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID пользователя не указан' 
      });
    }

    // Проверка на валидный ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Некорректный формат ID пользователя' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Файл не загружен' 
      });
    }

    // Находим карточку
    let playerCard = await PlayerCard.findOne({ userId });
    
    if (!playerCard) {
      return res.status(404).json({ 
        success: false, 
        message: 'Карточка игрока не найдена' 
      });
    }

    // Если уже есть roadmap, запоминаем старый путь
    let oldFilePath = null;
    if (playerCard.roadmap) {
      oldFilePath = path.join(__dirname, '../../..', playerCard.roadmap);
    }

    // Добавляем путь к новому файлу
    playerCard.roadmap = `/player-cards/${req.file.filename}`;
    console.log(`Сохраняем путь к roadmap в БД: ${playerCard.roadmap}`);
    
    // Сохраняем карточку
    await playerCard.save();
    
    // После успешного сохранения в БД удаляем старый файл
    if (oldFilePath) {
      try {
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      } catch (err) {
        console.error('Ошибка при удалении старого файла:', err);
        // Продолжаем работу, т.к. ошибка удаления старого файла не критична
      }
    }

    return res.status(200).json({ 
      success: true,
      message: 'Roadmap успешно загружен', 
      roadmap: playerCard.roadmap 
    });
  } catch (error) {
    console.error('Ошибка при загрузке Roadmap:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Ошибка сервера при загрузке Roadmap',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
};

// Загрузить Mindmap изображение
export const uploadMindmap = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID пользователя не указан' 
      });
    }

    // Проверка на валидный ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Некорректный формат ID пользователя' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Файл не загружен' 
      });
    }

    // Находим карточку
    let playerCard = await PlayerCard.findOne({ userId });
    
    if (!playerCard) {
      return res.status(404).json({ 
        success: false, 
        message: 'Карточка игрока не найдена' 
      });
    }

    // Если уже есть mindmap, сохраняем путь для последующего удаления
    let oldFilePath = null;
    if (playerCard.mindmap) {
      oldFilePath = path.join(__dirname, '../../..', playerCard.mindmap);
    }

    // Добавляем путь к новому файлу
    playerCard.mindmap = `/player-cards/${req.file.filename}`;
    console.log(`Сохраняем путь к mindmap в БД: ${playerCard.mindmap}`);
    
    // Сохраняем карточку
    await playerCard.save();
    
    // После успешного сохранения в БД удаляем старый файл
    if (oldFilePath) {
      try {
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      } catch (err) {
        console.error('Ошибка при удалении старого файла:', err);
        // Продолжаем работу, т.к. ошибка удаления старого файла не критична
      }
    }

    return res.status(200).json({ 
      success: true,
      message: 'Mindmap успешно загружен', 
      mindmap: playerCard.mindmap 
    });
  } catch (error) {
    console.error('Ошибка при загрузке Mindmap:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Ошибка сервера при загрузке Mindmap',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
}; 

/**
 * Загрузить изображение для коммуникативной линии
 * @param req - запрос
 * @param res - ответ
 */
export const uploadCommunicationImage = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    
    // Проверка наличия userId
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID пользователя не указан' 
      });
    }
    
    // Проверка наличия загружаемого файла
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Файл не был загружен' 
      });
    }
    
    // Проверка на валидный ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Некорректный формат ID пользователя' 
      });
    }
    
    // Поиск карточки игрока
    let playerCard = await PlayerCard.findOne({ userId });
    
    // Если карточка не найдена
    if (!playerCard) {
      return res.status(404).json({ 
        success: false, 
        message: 'Карточка игрока не найдена' 
      });
    }
    
    // Сохраняем путь к старому файлу для последующего удаления
    let oldFilePath = null;
    if (playerCard.communicationImage) {
      oldFilePath = path.join(__dirname, '../../..', playerCard.communicationImage);
    }
    
    // Добавляем путь к новому файлу
    playerCard.communicationImage = `/player-cards/${req.file.filename}`;
    console.log(`Сохраняем путь к изображению коммуникативной линии в БД: ${playerCard.communicationImage}`);
    
    // Сохраняем карточку
    await playerCard.save();
    
    // После успешного сохранения в БД удаляем старый файл
    if (oldFilePath) {
      try {
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      } catch (err) {
        console.error('Ошибка при удалении старого файла:', err);
        // Продолжаем работу, т.к. ошибка удаления старого файла не критична
      }
    }

    return res.status(200).json({ 
      success: true,
      message: 'Изображение коммуникативной линии успешно загружено', 
      communicationImage: playerCard.communicationImage 
    });
  } catch (error) {
    console.error('Ошибка при загрузке изображения коммуникативной линии:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Ошибка сервера при загрузке изображения коммуникативной линии',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
};

/**
 * Удалить карточку игрока
 * @param req - запрос
 * @param res - ответ
 */
export const deletePlayerCard = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID пользователя не указан' 
      });
    }

    // Проверка на валидный ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Некорректный формат ID пользователя' 
      });
    }

    // Находим карточку
    const playerCard = await PlayerCard.findOne({ userId });
    
    if (!playerCard) {
      return res.status(404).json({ 
        success: false, 
        message: 'Карточка игрока не найдена' 
      });
    }

    // Сохраняем пути к файлам для последующего удаления
    const filesToDelete = [];
    if (playerCard.roadmap) {
      filesToDelete.push(path.join(__dirname, '../../..', playerCard.roadmap));
    }
    if (playerCard.mindmap) {
      filesToDelete.push(path.join(__dirname, '../../..', playerCard.mindmap));
    }

    // Удаляем карточку из базы данных
    const deleteResult = await PlayerCard.deleteOne({ userId });
    
    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Карточка игрока не найдена или уже удалена' 
      });
    }

    // Удаляем связанные файлы после успешного удаления из БД
    filesToDelete.forEach(filePath => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Удален файл: ${filePath}`);
        }
      } catch (err) {
        console.error(`Ошибка при удалении файла ${filePath}:`, err);
        // Продолжаем работу, т.к. ошибка удаления файла не критична
      }
    });

    return res.status(200).json({ 
      success: true,
      message: 'Карточка игрока успешно удалена',
      deletedFiles: filesToDelete.length
    });
  } catch (error) {
    console.error('Ошибка при удалении карточки игрока:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Ошибка сервера при удалении карточки игрока',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
};

/**
 * Привязать игрока к существующей карточке
 * @param req - запрос
 * @param res - ответ
 */
export const attachPlayerToCard = async (req: Request, res: Response) => {
  try {
    const { cardId, newUserId } = req.body;
    
    // Валидация входных данных
    if (!cardId || !newUserId) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID карточки и ID нового игрока обязательны' 
      });
    }

    // Проверка на валидные ObjectId
    if (!mongoose.Types.ObjectId.isValid(cardId) || !mongoose.Types.ObjectId.isValid(newUserId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Некорректный формат ID' 
      });
    }

    // Проверяем, существует ли пользователь с новым ID
    const newUser = await User.findById(newUserId);
    if (!newUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'Игрок с указанным ID не найден' 
      });
    }

    // Проверяем, что пользователь является игроком
    if (newUser.role !== 'player') {
      return res.status(400).json({ 
        success: false, 
        message: 'Выбранный пользователь не является игроком' 
      });
    }

    // Проверяем, существует ли карточка с указанным ID
    const existingCard = await PlayerCard.findById(cardId);
    if (!existingCard) {
      return res.status(404).json({ 
        success: false, 
        message: 'Карточка с указанным ID не найдена' 
      });
    }

    // Проверяем, нет ли уже карточки у нового игрока
    const existingPlayerCard = await PlayerCard.findOne({ userId: newUserId });
    if (existingPlayerCard) {
      return res.status(400).json({ 
        success: false, 
        message: 'У выбранного игрока уже есть карточка' 
      });
    }

    // Сохраняем старый userId для логирования
    const oldUserId = existingCard.userId;

    // Обновляем userId в карточке
    existingCard.userId = newUserId;
    await existingCard.save();
    
    console.log(`Карточка ${cardId} успешно привязана к игроку ${newUserId} (ранее была привязана к ${oldUserId})`);

    // Получаем обновленные данные карточки с информацией о пользователе
    const updatedCardData = await PlayerCard.findById(cardId);
    
    return res.status(200).json({
      success: true,
      message: 'Игрок успешно привязан к карточке',
      playerCard: updatedCardData,
      user: {
        id: newUser._id.toString(),
        name: newUser.name,
        avatar: newUser.avatar
      }
    });
  } catch (error) {
    console.error('Ошибка при привязке игрока к карточке:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Ошибка сервера при привязке игрока к карточке',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
};