import express from 'express';
import { protect, isStaff } from '../middleware/auth';
import { getPlayerDashboardByNickname, getPlayerDashboardByUserId } from '../controllers/playerDashboardController';

const router = express.Router();

router.use(protect);
router.use(isStaff);

// Дашборд игрока с индексами и таймлайном
router.get('/user/:userId', getPlayerDashboardByUserId);
router.get('/nickname/:nickname', getPlayerDashboardByNickname);

export default router;
