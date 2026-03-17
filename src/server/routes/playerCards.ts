import express from 'express';
import { protect, isStaff, isSoloOrStaff, hasPrivilegeKey } from '../middleware/auth';
import {
  getPlayerCard,
  getAllPlayerCards,
  updateContacts,
  uploadRoadmap,
  uploadMindmap,
  uploadCommunicationImage,
  createPlayerCard,
  updateCommunicationLine,
  deletePlayerCard,
  attachPlayerToCard,
  upload
} from '../controllers/playerCardController';

const router = express.Router();

// Все маршруты требуют аутентификации
router.use(protect);

// ─── Только стафф ───────────────────────────────────────────────────────────

// Получить все карточки игроков с пагинацией (только стафф)
router.get('/', isStaff, getAllPlayerCards);

// Привязать игрока к существующей карточке (только стафф + ключ привилегий)
router.put('/attach-player', isStaff, hasPrivilegeKey, attachPlayerToCard);

// Загрузить изображение для коммуникативной линии (только стафф + ключ привилегий)
router.post('/:userId/communication-image', isStaff, hasPrivilegeKey, upload.single('communicationImage'), uploadCommunicationImage);

// Удалить карточку игрока (только стафф + ключ привилегий)
router.delete('/:userId', isStaff, hasPrivilegeKey, deletePlayerCard);

// ─── Стафф или соло-игрок (для своей карточки) ──────────────────────────────

// Получить карточку игрока по ID
// Соло-игрок может читать только свою карточку (проверка в контроллере)
router.get('/:userId', isSoloOrStaff, getPlayerCard);

// Создать карточку игрока
// Стафф: нужен ключ привилегий; соло-игрок: создаёт только свою карточку без ключа
router.post('/', isSoloOrStaff, createPlayerCard);

// Обновить контакты игрока
router.put('/:userId/contacts', isSoloOrStaff, updateContacts);

// Обновить коммуникативную линию игрока
router.put('/:userId/communication-line', isSoloOrStaff, updateCommunicationLine);

// Загрузить Roadmap изображение
router.post('/:userId/roadmap', isSoloOrStaff, upload.single('roadmap'), uploadRoadmap);

// Загрузить Mindmap изображение
router.post('/:userId/mindmap', isSoloOrStaff, upload.single('mindmap'), uploadMindmap);

export default router;
