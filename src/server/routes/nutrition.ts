import express, { Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import { protect, isStaff } from '../middleware/auth';
import NutritionEntry, { NutritionMealType, NutritionQuality } from '../models/NutritionEntry';
import User from '../models/User';
import { asyncHandler } from '../middleware/asyncHandler';
import { badRequest } from '../utils/apiError';
import { buildVisiblePlayersFilter, findAccessiblePlayerById } from '../utils/teamAccess';
import { AuthRequest } from '../types';

const router = express.Router();

router.use(protect);

const nutritionUploadDir = path.join(process.cwd(), '../../uploads/nutrition');

if (!fs.existsSync(nutritionUploadDir)) {
  fs.mkdirSync(nutritionUploadDir, { recursive: true });
}

const nutritionPhotoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, nutritionUploadDir),
    filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `meal-${Date.now()}-${crypto.randomUUID()}${extension}`);
    }
  }),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 1
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const extension = path.extname(file.originalname).toLowerCase();

    if (!allowedMimeTypes.includes(file.mimetype) || !allowedExtensions.includes(extension)) {
      return cb(new Error('Фото питания должно быть изображением: jpg, png, webp или gif'));
    }

    cb(null, true);
  }
}).single('photo');

const mealTypes: NutritionMealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const qualities: NutritionQuality[] = ['good', 'normal', 'heavy', 'skipped'];

function parseDateOnly(dateStr?: string) {
  if (!dateStr) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseRange(dateFrom?: string, dateTo?: string) {
  const from = parseDateOnly(dateFrom);
  const to = parseDateOnly(dateTo);
  if (!from || !to) return null;
  const end = new Date(to);
  end.setUTCDate(end.getUTCDate() + 1);
  return { from, end };
}

const isValidTime = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);

const toScore = (value: unknown, fieldName: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) {
    throw badRequest(`${fieldName} должен быть числом от 1 до 5`);
  }
  return parsed;
};

function handleNutritionPhotoUpload(req: express.Request, res: Response, next: express.NextFunction) {
  nutritionPhotoUpload(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'Фото питания слишком большое. Максимум 8MB'
        : 'Не удалось загрузить фото питания';
      return res.status(400).json({ success: false, message });
    }

    return res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Не удалось загрузить фото питания'
    });
  });
}

function cleanupUploadedPhoto(file?: Express.Multer.File) {
  if (!file?.path) return;
  try {
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  } catch (error) {
    console.error('Не удалось удалить временное фото питания:', error);
  }
}

router.post(
  '/',
  handleNutritionPhotoUpload,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: 'Пользователь не авторизован' });
      if (req.user.role !== 'player') {
        cleanupUploadedPhoto(req.file);
        return res.status(403).json({
          success: false,
          message: 'Питание в мобильной версии заполняет игрок'
        });
      }

      const { date, time, mealType, quality, satiety, hydration, comment } = req.body || {};
      const day = parseDateOnly(date);
      if (!day) throw badRequest('Некорректная дата (ожидается YYYY-MM-DD)');
      if (!isValidTime(time)) throw badRequest('Некорректное время (ожидается HH:mm)');
      if (!mealTypes.includes(mealType)) throw badRequest('Некорректный тип приема пищи');
      if (!qualities.includes(quality)) throw badRequest('Некорректная оценка питания');
      if (!req.file && quality !== 'skipped') {
        throw badRequest('Добавьте фото питания');
      }

      const photo = req.file
        ? {
            photoUrl: `/uploads/nutrition/${req.file.filename}`,
            photoOriginalName: req.file.originalname.slice(0, 255),
            photoMimeType: req.file.mimetype,
            photoSize: req.file.size
          }
        : {};

      const entry = await NutritionEntry.create({
        userId: req.user._id,
        date: day,
        time,
        mealType,
        quality,
        satiety: toScore(satiety, 'satiety'),
        hydration: toScore(hydration, 'hydration'),
        comment: typeof comment === 'string' ? comment.trim().slice(0, 500) : '',
        ...photo
      });

      return res.status(201).json({ success: true, data: entry });
    } catch (error) {
      cleanupUploadedPhoto(req.file);
      throw error;
    }
  })
);

router.get(
  '/my',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Пользователь не авторизован' });
    const range = parseRange(req.query.dateFrom as string | undefined, req.query.dateTo as string | undefined);
    if (!range) throw badRequest('Некорректный диапазон дат');

    const entries = await NutritionEntry.find({
      userId: req.user._id,
      date: { $gte: range.from, $lt: range.end }
    }).sort({ date: -1, time: -1 }).lean();

    return res.json({ success: true, data: entries });
  })
);

router.get(
  '/team-summary',
  isStaff,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Пользователь не авторизован' });
    const day = parseDateOnly(req.query.date as string | undefined);
    if (!day) throw badRequest('Некорректная date');
    const nextDay = new Date(day);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const players = await User.find(buildVisiblePlayersFilter(req.user, { isActive: { $ne: false } }))
      .select('name email avatar')
      .lean();
    const playerIds = players.map((player) => player._id);

    const entries = await NutritionEntry.find({
      userId: { $in: playerIds },
      date: { $gte: day, $lt: nextDay }
    }).lean();

    const entriesByPlayer = new Map<string, typeof entries>();
    for (const entry of entries) {
      const key = String(entry.userId);
      const current = entriesByPlayer.get(key) || [];
      current.push(entry);
      entriesByPlayer.set(key, current);
    }

    const playersSummary = players.map((player) => {
      const playerEntries = entriesByPlayer.get(String(player._id)) || [];
      return {
        userId: String(player._id),
        name: player.name,
        email: player.email,
        avatar: player.avatar,
        entriesCount: playerEntries.length,
        goodCount: playerEntries.filter((entry) => entry.quality === 'good').length,
        heavyCount: playerEntries.filter((entry) => entry.quality === 'heavy').length,
        skippedCount: playerEntries.filter((entry) => entry.quality === 'skipped').length,
        lastEntryAt: playerEntries
          .slice()
          .sort((a, b) => String(b.time).localeCompare(String(a.time)))[0]?.time || null
      };
    });

    const recentEntries = entries
      .slice()
      .sort((a, b) => String(b.time).localeCompare(String(a.time)))
      .map((entry) => {
        const player = players.find((item) => String(item._id) === String(entry.userId));
        return {
          ...entry,
          player: player
            ? {
                userId: String(player._id),
                name: player.name,
                email: player.email,
                avatar: player.avatar
              }
            : null
        };
      });

    return res.json({
      success: true,
      date: day.toISOString().slice(0, 10),
      totalPlayers: players.length,
      playersWithEntries: playersSummary.filter((player) => player.entriesCount > 0).length,
      totalEntries: entries.length,
      players: playersSummary,
      recentEntries
    });
  })
);

router.get(
  '/player/:playerId',
  isStaff,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Пользователь не авторизован' });
    const { playerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(playerId)) throw badRequest('Некорректный playerId');

    const range = parseRange(req.query.dateFrom as string | undefined, req.query.dateTo as string | undefined);
    if (!range) throw badRequest('Некорректный диапазон дат');

    const player = await findAccessiblePlayerById(req.user, playerId, '_id name email avatar');
    if (!player) throw badRequest('Игрок недоступен для этой команды');

    const entries = await NutritionEntry.find({
      userId: player._id,
      date: { $gte: range.from, $lt: range.end }
    }).sort({ date: -1, time: -1 }).lean();

    return res.json({ success: true, player, data: entries });
  })
);

export default router;
