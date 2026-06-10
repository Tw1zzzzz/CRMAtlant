import express from 'express';
import { protect, isStaff } from '../middleware/auth';
import { getPlayerDashboard, getPlayerDashboardByNickname, getPlayerDashboardByUserId } from '../controllers/playerDashboardController';

const router = express.Router();

router.use(protect);

router.get('/me', getPlayerDashboard);

router.use(isStaff);

// Дашборд игрока с индексами и таймлайном
router.get('/user/:userId', getPlayerDashboardByUserId);
router.get('/nickname/:nickname', getPlayerDashboardByNickname);

export default router;
