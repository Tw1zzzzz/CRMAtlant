import express from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { protect, isStaff } from '../middleware/auth';
import { generatePlayerStateReport } from '../services/playerStateAiService';

// 10 AI-запросов на пользователя в час
const aiAnalysisLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Слишком много запросов к AI-анализу. Попробуйте через час.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => `player-state-${req.ip}-${req.user?._id || 'anon'}`,
});

const router = express.Router();

/**
 * GET /api/player-state/analyze
 * Анализ состояния текущего авторизованного пользователя
 */
router.get('/analyze', protect, aiAnalysisLimit, async (req: any, res) => {
  try {
    const report = await generatePlayerStateReport(req.user._id);
    return res.json({ success: true, data: report });
  } catch (error) {
    console.error('[PlayerState] Ошибка при генерации отчёта:', error);
    return res.status(500).json({
      success: false,
      message: 'Не удалось сформировать анализ состояния. Попробуйте позже.',
    });
  }
});

/**
 * GET /api/player-state/analyze/:playerId
 * Анализ состояния конкретного игрока (только для staff)
 */
router.get('/analyze/:playerId', protect, isStaff, aiAnalysisLimit, async (req: any, res) => {
  try {
    const { playerId } = req.params;

    if (!playerId || playerId === 'undefined' || playerId === 'null') {
      return res.status(400).json({ success: false, message: 'Некорректный ID игрока' });
    }

    if (!/^[0-9a-fA-F]{24}$/.test(playerId)) {
      return res.status(400).json({ success: false, message: 'Некорректный формат ID игрока' });
    }

    const report = await generatePlayerStateReport(
      new mongoose.Types.ObjectId(playerId),
    );

    return res.json({ success: true, data: report });
  } catch (error) {
    console.error('[PlayerState] Ошибка при генерации отчёта для игрока:', error);
    return res.status(500).json({
      success: false,
      message: 'Не удалось сформировать анализ состояния. Попробуйте позже.',
    });
  }
});

export default router;
