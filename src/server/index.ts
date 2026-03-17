// Загрузка переменных окружения в самом начале
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Загружаем .env файл из корня проекта
const envPath = path.resolve(__dirname, '../../.env');
console.log('[INDEX] Загрузка .env из:', envPath);

// Проверяем существование файла
if (fs.existsSync(envPath)) {
  console.log('[INDEX] .env файл найден');

  // Загружаем переменные окружения
  const envResult = dotenv.config({ path: envPath });
  if (envResult.error) {
    console.error('[INDEX] Ошибка загрузки .env файла:', envResult.error);
  } else {
    console.log('[INDEX] .env файл загружен успешно');
  }
} else {
  console.error('[INDEX] .env файл не найден по пути:', envPath);
}

// Проверяем все переменные окружения после загрузки
console.log('[INDEX] Проверка переменных окружения:');
console.log('[INDEX] NODE_ENV:', process.env.NODE_ENV);
console.log('[INDEX] PORT:', process.env.PORT);
console.log('[INDEX] MONGODB_URI:', process.env.MONGODB_URI ? 'установлен' : 'не установлен');
console.log('[INDEX] JWT_SECRET:', process.env.JWT_SECRET ? 'установлен' : 'не установлен');
console.log('[INDEX] STAFF_PRIVILEGE_KEY:', process.env.STAFF_PRIVILEGE_KEY ? 'установлен' : 'НЕ УСТАНОВЛЕН');

if (!process.env.STAFF_PRIVILEGE_KEY) {
  console.error('[INDEX] КРИТИЧЕСКАЯ ОШИБКА: STAFF_PRIVILEGE_KEY не загружен!');
}

// Импортируем app из server.ts ПОСЛЕ загрузки env
import app from './server';
import mongoose from 'mongoose';
import faceitSync from './services/faceitSync';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';

// Импортируем модели
import PlayerRating from './models/PlayerRating';
import User from './models/User';

// Определяем порт (SERVER_PORT имеет приоритет, чтобы избежать конфликта с Vite)
const PORT = process.env.SERVER_PORT || process.env.BACKEND_PORT || process.env.PORT || 5001;
const HOST =
  process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');

// Запускаем сервер при установлении подключения к MongoDB
mongoose.connection.once('open', () => {
  console.log('✅ MongoDB подключение установлено успешно');
  console.log(`🗄️ Подключено к базе данных: ${mongoose.connection.name}`);
  
  // Проверяем доступность коллекций
  mongoose.connection.db.listCollections().toArray()
    .then(collections => {
      console.log('📊 Доступные коллекции:', collections.map(c => c.name).join(', '));
    })
    .catch(err => {
      console.error('❌ Ошибка при получении списка коллекций:', err);
    });

  // Настройка расписаний (cron jobs)
  setupScheduledJobs();
});

// Слушаем ошибки подключения к MongoDB
mongoose.connection.on('error', (err) => {
  console.error('❌ Ошибка подключения к MongoDB:', err.message);
});

// Слушаем отключения от MongoDB
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ Отключено от MongoDB');
});

// Обработка необработанных исключений
process.on('uncaughtException', (err) => {
  console.error('❌ Необработанное исключение:', err.message);
  console.error(err.stack);
});

// Обработка необработанных отклонений Promise
process.on('unhandledRejection', (reason, _promise) => {
  console.error('❌ Необработанное отклонение Promise:', reason);
});

// Функция для проверки директорий загрузки и очистки кэша
function checkUploadsDirectories() {
  try {
    // Директории для загрузок
    const uploadDir = path.join(__dirname, '../../uploads');
    const avatarDir = path.join(uploadDir, 'avatars');
    
    console.log('📂 Проверка директорий для загрузки файлов:');
    console.log(`- Директория загрузок: ${uploadDir}`);
    console.log(`- Директория аватаров: ${avatarDir}`);
    
    // Проверяем/создаем директории
    if (!fs.existsSync(uploadDir)) {
      try {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log(`✅ Создана директория для загрузки: ${uploadDir}`);
      } catch (err) {
        console.error(`❌ Ошибка при создании директории uploads:`, err);
      }
    }
    
    if (!fs.existsSync(avatarDir)) {
      try {
        fs.mkdirSync(avatarDir, { recursive: true });
        console.log(`✅ Создана директория для аватаров: ${avatarDir}`);
      } catch (err) {
        console.error(`❌ Ошибка при создании директории avatars:`, err);
      }
    }
    
    console.log(`📁 Статус директорий: uploads=${fs.existsSync(uploadDir)}, avatars=${fs.existsSync(avatarDir)}`);
    
    // Проверка прав доступа к директориям
    try {
      console.log('🔍 Проверка прав доступа к директориям...');
      
      // Создаем и удаляем тестовый файл в директории аватаров
      const testFile = path.join(avatarDir, `test-${Date.now()}.txt`);
      console.log(`📄 Создаем тестовый файл: ${testFile}`);
      
      fs.writeFileSync(testFile, 'test-content', { encoding: 'utf8' });
      console.log(`✅ Тестовый файл создан успешно`);
      
      const fileExists = fs.existsSync(testFile);
      console.log(`📄 Тестовый файл существует: ${fileExists}`);
      
      const fileContent = fs.readFileSync(testFile, { encoding: 'utf8' });
      console.log(`📄 Содержимое тестового файла: "${fileContent}"`);
      
      fs.unlinkSync(testFile);
      console.log(`✅ Тестовый файл удален успешно`);
      
      console.log('✅ Проверка прав доступа: запись и удаление работают');
    } catch (err) {
      console.error('❌ Ошибка проверки прав доступа:', err);
    }
  } catch (err) {
    console.error('❌ Ошибка при проверке директорий загрузки:', err);
  }
}

// Запускаем сервер
const startServer = async () => {
  try {
    // Проверяем директории для загрузок
    checkUploadsDirectories();

    const configuredPort = Number(PORT);
    const listenPort = Number.isFinite(configuredPort) && configuredPort > 0
      ? configuredPort
      : 5001;

    const server = app.listen(listenPort, HOST, () => {
      const address = server.address();
      const runtimePort =
        typeof address === 'object' && address !== null ? address.port : listenPort;

      process.env.PORT = String(runtimePort);

      console.log(`🚀 Сервер запущен на порту: ${runtimePort}`);
      console.log(`🌐 Режим: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔐 JWT секрет: ${process.env.JWT_SECRET ? 'настроен' : 'не настроен - используется значение по умолчанию'}`);
      console.log(`📡 Адрес API: http://${HOST}:${runtimePort}/api`);
      console.log(`🩺 Адрес проверки состояния: http://${HOST}:${runtimePort}/health`);
      
      // Инициализация задач синхронизации с Faceit
      faceitSync.initFaceitSync();
    });

    server.on('error', (error: any) => {
      if (error?.code === 'EADDRINUSE') {
        console.error(`❌ Порт ${listenPort} уже занят. Укажите свободный PORT в .env и перезапустите frontend/backend.`);
      } else {
        console.error('❌ Ошибка запуска HTTP сервера:', error);
      }
      process.exit(1);
    });

    // Обработка сигналов завершения
    process.on('SIGTERM', () => {
      console.log('SIGTERM получен, закрываем сервер');
      server.close(() => {
        console.log('Сервер закрыт');
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT получен, закрываем сервер');
      server.close(() => {
        console.log('Сервер закрыт');
      });
    });

    return server;
  } catch (error) {
    console.error('Ошибка запуска сервера:', error);
    process.exit(1);
  }
};

// Настройка расписаний (cron jobs)
function setupScheduledJobs() {
  // Очистка записей рейтинга без связанных пользователей (каждый день в 3:00)
  cron.schedule('0 3 * * *', async () => {
    try {
      console.log('Cleaning up orphaned player rating records...');
      const ratings = await PlayerRating.find();
      
      let removedCount = 0;
      
      for (const rating of ratings) {
        const user = await User.findById(rating.userId);
        if (!user) {
          await PlayerRating.deleteOne({ _id: rating._id });
          removedCount++;
        }
      }
      
      console.log(`Cleanup completed. Removed ${removedCount} orphaned rating records.`);
    } catch (error) {
      console.error('Error during cleanup job:', error);
    }
  });
  
  console.log('Scheduled jobs setup completed');
}

// Запускаем сервер
startServer(); 
