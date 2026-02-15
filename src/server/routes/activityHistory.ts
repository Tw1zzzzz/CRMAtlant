import express, { Request, Response, NextFunction } from 'express';
import { 
  createActivityRecord,
  getUserActivityHistory,
  getAllActivityHistory,
  getActivityStats,
  getMonthlyActivity
} from '../controllers/activityHistoryController';
import { protect } from '../middleware/authMiddleware';
import { AuthRequest } from '../types';

const router = express.Router();

// Маршруты, требующие аутентификации
router.use(protect);

// Маршруты для всех пользователей
router.post('/', createActivityRecord as (req: AuthRequest, res: Response, next: NextFunction) => void);
router.get('/', getUserActivityHistory as (req: AuthRequest, res: Response, next: NextFunction) => void);
router.get('/monthly', getMonthlyActivity as (req: AuthRequest, res: Response, next: NextFunction) => void);

// Маршруты только для персонала (проверка роли происходит в контроллере)
router.get('/all', getAllActivityHistory as (req: AuthRequest, res: Response, next: NextFunction) => void);
router.get('/stats', getActivityStats as (req: AuthRequest, res: Response, next: NextFunction) => void);

export default router;