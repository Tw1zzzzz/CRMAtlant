import express from 'express';
import { registerUser, loginUser, getCurrentUser } from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';
import { avatarUpload } from '../controllers/fileController';
import User from '../models/User';
import fs from 'fs';
import path from 'path';
import { checkAndCreateDirectories, getAvatarFullPath, avatarExists } from '../utils/fileUtils';

const router = express.Router();

// Регистрация нового пользователя
router.post('/register', registerUser);

// Аутентификация пользователя
router.post('/login', loginUser);

// Получение данных текущего пользователя
router.get('/me', protect, getCurrentUser);

// Обновление аватара пользователя
router.post('/avatar', protect, async (req, res) => {
  try {
    // Проверяем и создаем директории для загрузки файлов
    const dirCheck = checkAndCreateDirectories();
    
    if (!dirCheck.success) {
      console.error('❌ Ошибка при подготовке директорий:', dirCheck);
      return res.status(500).json({ 
        message: 'Ошибка при подготовке директорий для загрузки', 
        details: dirCheck
      });
    }
    
    console.log('📁 Директории для загрузки проверены:', dirCheck.dirs);

    // Используем avatarUpload для загрузки файла
    avatarUpload.single('avatar')(req, res, async (err) => {
      if (err) {
        console.error('❌ Ошибка при загрузке аватара:', err);
        return res.status(400).json({ 
          message: 'Ошибка при загрузке файла', 
          error: err.message 
        });
      }

      try {
        if (!req.file) {
          console.error('❌ Файл не был загружен');
          return res.status(400).json({ message: 'Файл не был загружен' });
        }
        
        if (!req.user || !req.user._id) {
          console.error('❌ Пользователь не найден в запросе');
          return res.status(401).json({ message: 'Пользователь не авторизован' });
        }
        
        const userId = req.user._id;
        
        // Получаем путь к файлу относительно директории аватаров
        const filename = req.file.filename;
        const avatarPath = `avatars/${filename}`;
        const diskPath = req.file.path;
        
        console.log('📄 Информация о загруженном файле:');
        console.log(`- Имя файла: ${filename}`);
        console.log(`- Относительный путь: ${avatarPath}`);
        console.log(`- Физический путь: ${diskPath}`);
        
        // Проверяем существование загруженного файла
        const fileExists = fs.existsSync(diskPath);
        console.log(`📄 Файл существует в физической директории: ${fileExists}`);
        
        if (!fileExists) {
          console.error('❌ Загруженный файл не обнаружен в файловой системе');
          return res.status(500).json({ 
            message: 'Ошибка при сохранении файла',
            details: 'Загруженный файл не обнаружен в файловой системе' 
          });
        }
        
        // Проверяем, существует ли предыдущий аватар пользователя
        const currentUser = await User.findById(userId).lean();
        if (currentUser && currentUser.avatar) {
          try {
            const oldAvatarPath = getAvatarFullPath(currentUser.avatar);
            if (fs.existsSync(oldAvatarPath)) {
              fs.unlinkSync(oldAvatarPath);
              console.log(`🗑️ Удален старый аватар: ${oldAvatarPath}`);
            } else {
              console.log(`⚠️ Старый аватар не найден: ${oldAvatarPath}`);
            }
          } catch (e) {
            console.error(`❌ Ошибка при удалении старого аватара:`, e);
          }
        }
        
        // Обновляем пользователя в базе данных
        const updatedUser = await User.findByIdAndUpdate(
          userId, 
          { 
            avatar: avatarPath,
            _updateTimestamp: Date.now() // Добавляем timestamp для решения проблем с кэшем
          },
          { new: true }
        ).select('_id name email role avatar _updateTimestamp').lean();
        
        if (!updatedUser) {
          console.error(`❌ Пользователь с ID ${userId} не найден`);
          return res.status(404).json({ message: 'Пользователь не найден' });
        }
        
        console.log(`✅ Аватар пользователя ${updatedUser.name} успешно обновлен:`, avatarPath);
        
        // Возвращаем полную информацию о пользователе вместе с обновленным аватаром
        res.status(200).json({ 
          message: 'Аватар успешно обновлен',
          avatar: avatarPath,
          user: updatedUser
        });
      } catch (error) {
        console.error('❌ Ошибка при обновлении аватара:', error);
        res.status(500).json({ 
          message: 'Ошибка при обновлении аватара',
          error: error instanceof Error ? error.message : 'Неизвестная ошибка' 
        });
      }
    });
  } catch (error) {
    console.error('❌ Критическая ошибка при обработке загрузки аватара:', error);
    res.status(500).json({
      message: 'Внутренняя ошибка сервера при обработке загрузки',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
});

// Диагностический маршрут для проверки директорий и файлов аватаров
router.get('/avatar/check', protect, async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Пользователь не авторизован' });
    }
    
    const userId = req.user._id;
    const result: any = {
      userId: userId.toString(),
      directories: {},
      user: null,
      avatarFiles: [],
      errors: []
    };
    
    // Проверяем директории
    const dirCheck = checkAndCreateDirectories();
    result.directories = dirCheck;
    
    // Получаем информацию о текущем пользователе и аватаре
    try {
      const currentUser = await User.findById(userId).lean();
      
      if (!currentUser) {
        result.errors.push('Пользователь не найден в базе данных');
      } else {
        result.user = {
          id: currentUser._id.toString(),
          name: currentUser.name,
          avatar: currentUser.avatar,
          _updateTimestamp: currentUser._updateTimestamp
        };
        
        // Если у пользователя есть аватар, проверяем файл
        if (currentUser.avatar) {
          try {
            const avatarFullPath = getAvatarFullPath(currentUser.avatar);
            const avatarExists = fs.existsSync(avatarFullPath);
            
            result.user.avatarFullPath = avatarFullPath;
            result.user.avatarExists = avatarExists;
            
            if (!avatarExists) {
              result.errors.push(`Аватар пользователя не найден по пути: ${avatarFullPath}`);
            }
          } catch (err) {
            result.errors.push(`Ошибка при проверке аватара: ${err instanceof Error ? err.message : String(err)}`);
          }
        } else {
          result.user.avatarExists = false;
        }
      }
    } catch (err) {
      result.errors.push(`Ошибка при получении пользователя: ${err instanceof Error ? err.message : String(err)}`);
    }
    
    // Получаем список файлов в директории аватаров
    try {
      const rootDir = path.join(__dirname, '../../../');
      const avatarDir = path.join(rootDir, 'uploads', 'avatars');
      
      if (fs.existsSync(avatarDir)) {
        const files = fs.readdirSync(avatarDir);
        result.avatarFiles = files.map(file => ({
          name: file,
          path: path.join(avatarDir, file),
          isFile: fs.statSync(path.join(avatarDir, file)).isFile()
        }));
      } else {
        result.errors.push(`Директория аватаров не существует: ${avatarDir}`);
      }
    } catch (err) {
      result.errors.push(`Ошибка при получении списка файлов: ${err instanceof Error ? err.message : String(err)}`);
    }
    
    res.json({
      message: 'Проверка аватаров и директорий',
      result
    });
  } catch (error) {
    res.status(500).json({
      message: 'Ошибка при диагностике аватаров',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
});

// Маршрут для исправления путей к аватарам
router.post('/avatar/fix', protect, async (req, res) => {
  try {
    // Проверяем, что пользователь является администратором или персональным запросом
    if (req.user?.role !== 'staff' && req.body.userId !== req.user?._id.toString()) {
      return res.status(403).json({ 
        message: 'Доступ запрещен',
        error: 'Только администраторы могут выполнять эту операцию' 
      });
    }
    
    // Проверяем директории
    const dirCheck = checkAndCreateDirectories();
    
    if (!dirCheck.success) {
      return res.status(500).json({ 
        message: 'Ошибка при проверке директорий', 
        details: dirCheck 
      });
    }
    
    // Находим всех пользователей с аватарами
    const userId = req.body.userId || (req.user?._id.toString());
    
    const query = userId ? { _id: userId } : { avatar: { $ne: null, $ne: '' } };
    const users = await User.find(query).select('_id name avatar').lean();
    
    const results = {
      total: users.length,
      fixed: 0,
      errors: 0,
      details: [] as any[]
    };
    
    // Проверяем и исправляем пути к аватарам
    for (const user of users) {
      const result = {
        userId: user._id.toString(),
        name: user.name,
        original: user.avatar,
        fixed: user.avatar,
        status: 'ok'
      };
      
      if (user.avatar) {
        try {
          // Проверяем существование аватара
          const avatarFullPath = getAvatarFullPath(user.avatar);
          const avatarExists = fs.existsSync(avatarFullPath);
          
          if (!avatarExists) {
            // Аватар не существует, помечаем как ошибку
            result.status = 'error';
            result.error = `Файл не найден: ${avatarFullPath}`;
            results.errors++;
          } else {
            // Проверяем правильность формата пути
            let fixedPath = user.avatar;
            
            if (!fixedPath.startsWith('avatars/')) {
              fixedPath = `avatars/${fixedPath}`;
              result.fixed = fixedPath;
              result.status = 'fixed';
              
              // Обновляем путь в базе данных
              await User.findByIdAndUpdate(user._id, { 
                avatar: fixedPath,
                _updateTimestamp: Date.now()
              });
              
              results.fixed++;
            }
          }
        } catch (err) {
          result.status = 'error';
          result.error = err instanceof Error ? err.message : String(err);
          results.errors++;
        }
      }
      
      results.details.push(result);
    }
    
    res.json({
      message: 'Исправление путей к аватарам завершено',
      results
    });
  } catch (error) {
    res.status(500).json({
      message: 'Ошибка при исправлении путей к аватарам',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
});

export default router; 