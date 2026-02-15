import express, { Request, Response, NextFunction } from 'express';
import faceitController from '../controllers/faceitController';
import { protect } from '../middleware/authMiddleware';
import { AuthRequest } from '../types';

const router = express.Router();

// Маршруты для Faceit OAuth
router.get('/oauth/init', protect, faceitController.initOAuth as any);
router.get('/oauth/callback', protect, faceitController.oauthCallback as any);

// Маршруты для импорта матчей и проверки статуса
router.post('/import-matches', protect, faceitController.importMatches as any);
router.get('/status', protect, faceitController.checkFaceitStatus as any);

export default router; 