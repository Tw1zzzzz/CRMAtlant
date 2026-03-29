import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const rootDir = path.join(__dirname, '../../../');
const uploadDir = path.join(rootDir, 'uploads');
const avatarDir = path.join(uploadDir, 'avatars');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(avatarDir)) {
      fs.mkdirSync(avatarDir, { recursive: true });
    }
    cb(null, avatarDir);
  },
  filename: function (req, file, cb) {
    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'png';
    const uniqueFilename = `avatar-${uuidv4()}.${ext}`;
    cb(null, uniqueFilename);
  }
});

const imageFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Только изображения могут быть загружены как аватар'));
  }

  const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  const extension = file.originalname.split('.').pop()?.toLowerCase();

  if (!extension || !allowedExtensions.includes(extension)) {
    return cb(new Error(`Недопустимое расширение: ${allowedExtensions.join(', ')}`));
  }

  cb(null, true);
};

export const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter
});
