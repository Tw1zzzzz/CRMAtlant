import express from 'express';
import { submitSupportRequest } from '../controllers/supportController';
import { supportRequestLimit } from '../middleware/rateLimiting';
import { validate, validateSupportRequest } from '../middleware/validation';

const router = express.Router();

router.post('/request', supportRequestLimit, validate(validateSupportRequest), submitSupportRequest);

export default router;
