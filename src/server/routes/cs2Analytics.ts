import express from 'express';
import { protect, isStaff } from '../middleware/auth';
import { getPlayerCs2Overview } from '../controllers/cs2AnalyticsController';

const router = express.Router();

router.use(protect);
router.use(isStaff);

router.get('/player/:userId/overview', getPlayerCs2Overview);

export default router;

