import express from 'express';
import { protect, isStaff, hasPrivilegeKey } from '../middleware/auth';
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

// Маршруты для просмотра - доступны для всех сотрудников (staff)
router.use(protect);
router.use(isStaff);

// Получить все карточки игроков с пагинацией (только просмотр)
router.get('/', getAllPlayerCards);

// Получить карточку игрока по ID (только просмотр)
router.get('/:userId', getPlayerCard);

// Маршруты для редактирования - требуют ключ привилегий
// Создать карточку игрока
router.post('/', hasPrivilegeKey, createPlayerCard);

// Привязать игрока к существующей карточке
router.put('/attach-player', hasPrivilegeKey, attachPlayerToCard);

// Обновить контакты игрока
router.put('/:userId/contacts', hasPrivilegeKey, updateContacts);

// Обновить коммуникативную линию игрока
router.put('/:userId/communication-line', hasPrivilegeKey, updateCommunicationLine);

// Загрузить Roadmap изображение
router.post('/:userId/roadmap', hasPrivilegeKey, upload.single('roadmap'), uploadRoadmap);

// Загрузить Mindmap изображение
router.post('/:userId/mindmap', hasPrivilegeKey, upload.single('mindmap'), uploadMindmap);

// Загрузить изображение для коммуникативной линии
router.post('/:userId/communication-image', hasPrivilegeKey, upload.single('communicationImage'), uploadCommunicationImage);

// Удалить карточку игрока
router.delete('/:userId', hasPrivilegeKey, deletePlayerCard);

export default router; 