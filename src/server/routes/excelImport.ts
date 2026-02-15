import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { protect, isStaff } from '../middleware/auth';
import { importCs2Excel } from '../controllers/excelImportController';

const router = express.Router();

router.use(protect);
router.use(isStaff);

const uploadsDir = path.join(process.cwd(), '../../uploads/raw-imports');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, `cs2-${ts}-${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls') return cb(null, true);
    cb(new Error('Разрешены только .xlsx/.xls'));
  }
});

// POST /api/imports/cs2-excel
router.post('/cs2-excel', upload.single('file'), importCs2Excel);

export default router;

