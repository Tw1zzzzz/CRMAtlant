import express from 'express';
import { UPLOAD_PATHS } from './middleware/fileUpload';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

// Маршруты API
import authRoutes from './routes/auth';
import balanceWheelRoutes from './routes/balanceWheel';
import userRoutes from './routes/users';
import moodRoutes from './routes/mood';
import testsRoutes from './routes/tests';
import statsRoutes from './routes/stats';
import healthRoutes from './health';
import faceitRoutes from './routes/faceitRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import playerRatingRoutes from './routes/playerRating';
import activityHistoryRoutes from './routes/activityHistory';
import playerCardRoutes from './routes/playerCards';
import playerDashboardRoutes from './routes/playerDashboard';
import staffRoutes from './routes/staffRoutes';
import teamReportsRoutes from './routes/teamReports';
import correlationsRoutes from './routes/correlations';
import advancedAnalyticsRoutes from './routes/advancedAnalytics';
import screenTimeRoutes from './routes/screenTime';
import gameStatsRoutes from './routes/gameStats';
import questionnairesRoutes from './routes/questionnaires';
import excelImportRoutes from './routes/excelImport';
import cs2AnalyticsRoutes from './routes/cs2Analytics';
import notificationsRoutes from './routes/notifications';
import brainTestsRoutes from './routes/brainTests';
import playerStateRoutes from './routes/playerState.routes';
import teamsRoutes from './routes/teams';
import paymentsRoutes from './routes/payments';
import { errorHandler } from './middleware/errorHandler';

// Загрузка переменных окружения с явным указанием пути
import { resolve } from 'path';

// Ищем .env файл в корне проекта
const envPath = resolve(__dirname, '../../.env');
console.log('[SERVER] Попытка загрузки .env из:', envPath);

const envResult = dotenv.config({ path: envPath });
if (envResult.error) {
  console.error('[SERVER] Ошибка загрузки .env файла:', envResult.error);
} else {
  console.log('[SERVER] .env файл загружен успешно');
  console.log('[SERVER] STAFF_PRIVILEGE_KEY загружен:', !!process.env.STAFF_PRIVILEGE_KEY);
}

// Инициализация приложения
const app = express();
mongoose.set('bufferTimeoutMS', 3000);

const resolveAllowedOrigins = () => {
  const configuredOrigins = process.env.CORS_ORIGIN
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configuredOrigins?.length) {
    return configuredOrigins;
  }

  if (process.env.NODE_ENV === 'production') {
    return ['http://5.129.198.32', 'https://5.129.198.32'];
  }

  return [
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ];
};

const resolveClientBuildPath = () => {
  const candidates = [
    path.resolve(__dirname, '..'),
    path.resolve(__dirname, '../../dist'),
    path.resolve(process.cwd(), 'dist'),
    path.resolve(__dirname, '../../client/build')
  ];

  return candidates.find((candidate) => {
    return fs.existsSync(path.join(candidate, 'index.html'));
  });
};

// Middleware
app.use(cors({
  origin: resolveAllowedOrigins(),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Диагностический middleware для логирования запросов и ответов
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(2, 10);
  
  console.log(`🔍 [${requestId}] ${req.method} ${req.url} - начало запроса`);
  
  // Сохраняем оригинальный метод end
  const originalEnd = res.end;
  
  // Переопределяем метод end для логирования ответа
  // @ts-ignore - Игнорируем предупреждения о неиспользуемых параметрах, они нужны для совместимости с типами
  res.end = function(
    _chunk?: any,
    _encoding?: BufferEncoding | (() => void),
    _callback?: (() => void)
  ): any {
    const duration = Date.now() - start;
    console.log(`✅ [${requestId}] ${req.method} ${req.url} - статус ${res.statusCode} (${duration}ms)`);
    
    // Вызываем оригинальный метод end с оригинальными аргументами
    return originalEnd.apply(this, arguments);
  };
  
  next();
});

// Подключение к MongoDB (с dev-фоллбеком на in-memory)
const connectMongo = async () => {
  const envUri = process.env.MONGODB_URI;
  const isDev = process.env.NODE_ENV !== 'production';

  if (envUri) {
    try {
      await mongoose.connect(envUri, {
        serverSelectionTimeoutMS: 2500,
        family: 4
      });
      console.log('Connected to MongoDB');
      return;
    } catch (error) {
      console.error('MongoDB connection error:', error);
    }
  }

  if (!isDev) {
    return;
  }

  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const memoryServer = await MongoMemoryServer.create();
  const memoryUri = memoryServer.getUri();
  await mongoose.connect(memoryUri);
  console.log('Connected to in-memory MongoDB');
};

connectMongo().catch((error) => {
  console.error('MongoDB connection error:', error);
});

app.use('/api', (_req, res, next) => {
  const readyState = mongoose.connection.readyState;
  if (readyState === 0 || readyState === 2 || readyState === 3) {
    return res.status(503).json({
      message: 'База данных инициализируется, повторите запрос через несколько секунд'
    });
  }
  return next();
});

// API Маршруты
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/balance-wheel', balanceWheelRoutes);
app.use('/api/mood', moodRoutes);
app.use('/api/tests', testsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/faceit', faceitRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/player-rating', playerRatingRoutes);
app.use('/api/history', activityHistoryRoutes);
app.use('/api/player-cards', playerCardRoutes);
app.use('/api/player-dashboard', playerDashboardRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/team-reports', teamReportsRoutes);
app.use('/api/correlations', correlationsRoutes);
app.use('/api/advanced-analytics', advancedAnalyticsRoutes);
app.use('/api/screen-time', screenTimeRoutes);
app.use('/api/game-stats', gameStatsRoutes);
app.use('/api/questionnaires', questionnairesRoutes);
app.use('/api/imports', excelImportRoutes);
app.use('/api/cs2', cs2AnalyticsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/brain-tests', brainTestsRoutes);
app.use('/api/player-state', playerStateRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/health', healthRoutes);

// Специальный middleware для обработки статических изображений с заголовками против кэширования
app.use('/uploads', (req, res, next) => {
  // Устанавливаем заголовки для предотвращения кэширования
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Логируем запросы к изображениям для отладки
  console.log(`📷 Запрос изображения: ${req.url}`);
  
  next();
}, express.static(path.join(__dirname, '../../uploads')));

// Специальная раздача для файлов отчетов команды
app.use('/uploads/team-reports', express.static(UPLOAD_PATHS.REPORTS));

// Обработка ошибки 404 для маршрутов API
app.use('/api/*', (req, res) => {
  console.log(`404 для API маршрута: ${req.originalUrl}`);
  res.status(404).json({ 
    status: 'error', 
    message: 'API endpoint не найден', 
    path: req.originalUrl 
  });
});

// Маршрут для проверки здоровья сервера (базовая версия)
app.get('/health-check', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Обслуживание статических файлов в production
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = resolveClientBuildPath();

  if (clientBuildPath) {
    app.use(express.static(clientBuildPath));

    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    });
  } else {
    console.warn('[SERVER] Не найден frontend build для production-режима');
  }
}

// Глобальный обработчик ошибок (последним)
app.use(errorHandler);

// Экспортируем приложение для использования в других файлах
export default app; 
