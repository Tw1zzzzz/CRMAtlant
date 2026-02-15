import express from 'express';
import User from '../models/User';
import MoodEntry from '../models/MoodEntry';
import TestEntry from '../models/TestEntry';
import PlayerRating from '../models/PlayerRating';
import { protect, isStaff, hasPrivilegeKey } from '../middleware/auth';

const router = express.Router();

// Get all players (staff only)
router.get('/players', protect, isStaff, async (_req: any, res) => {
  try {
    console.log('Fetching all players');
    const players = await User.find({ role: 'player' })
      .select('name email role completedTests completedBalanceWheel createdAt')
      .sort({ createdAt: -1 });

    console.log(`Found ${players.length} players`);
    return res.json(players);
  } catch (error) {
    console.error('Error fetching players:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get player statistics (staff only)
router.get('/players/:id/stats', protect, isStaff, async (req: any, res) => {
  try {
    console.log('Fetching stats for player:', req.params.id);
    const player = await User.findById(req.params.id)
      .select('name email completedTests completedBalanceWheel createdAt')
      .sort({ createdAt: -1 });

    if (!player) {
      console.log('Player not found:', req.params.id);
      return res.status(404).json({ message: 'Player not found' });
    }

    // Добавляем получение данных о настроении и энергии
    const moodEntries = await MoodEntry.find({ userId: req.params.id })
      .sort({ date: -1 });
    
    // Добавляем получение данных о тестах
    const testEntries = await TestEntry.find({ userId: req.params.id })
      .sort({ date: -1 });

    // Формируем объект с полной статистикой игрока
    const playerData = {
      _id: player._id,
      name: player.name,
      email: player.email,
      completedTests: player.completedTests,
      completedBalanceWheel: player.completedBalanceWheel,
      createdAt: player.createdAt,
      moodEntries,
      testEntries
    };

    console.log('Player stats found with details:', player._id);
    return res.json(playerData);
  } catch (error) {
    console.error('Error fetching player stats:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Delete a player (only basic user data)
router.delete('/players/:id', protect, isStaff, hasPrivilegeKey, async (req: any, res) => {
  try {
    const { id } = req.params;
    
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ message: 'Некорректный ID игрока' });
    }
    
    console.log(`Attempting to delete player with ID: ${id}`);
    
    // Проверяем, существует ли игрок
    const player = await User.findById(id);
    if (!player) {
      return res.status(404).json({ message: 'Игрок не найден' });
    }
    
    // Проверяем, что удаляемый пользователь имеет роль 'player'
    if (player.role !== 'player') {
      return res.status(400).json({ message: 'Можно удалять только игроков' });
    }
    
    // Удаляем пользователя
    await User.findByIdAndDelete(id);
    
    return res.json({ message: 'Игрок успешно удален' });
  } catch (error) {
    console.error('Error deleting player:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Update player status (staff only)
router.patch('/players/:id/status', protect, isStaff, async (req: any, res) => {
  try {
    console.log('Updating status for player:', req.params.id);
    const { completedTests, completedBalanceWheel } = req.body;
    const player = await User.findById(req.params.id);
    
    if (!player) {
      console.log('Player not found for status update:', req.params.id);
      return res.status(404).json({ message: 'Player not found' });
    }

    if (player.role !== 'player') {
      console.log('Attempted to update status of non-player user:', req.params.id);
      return res.status(400).json({ message: 'Can only update players' });
    }

    player.completedTests = completedTests;
    player.completedBalanceWheel = completedBalanceWheel;
    await player.save();

    console.log('Player status updated successfully:', req.params.id);
    return res.json(player);
  } catch (error) {
    console.error('Error updating player status:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Cascade delete a player and all related data
router.delete('/players/:id/complete', protect, isStaff, hasPrivilegeKey, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ message: 'Некорректный ID игрока' });
    }
    
    console.log(`[CASCADE DELETE] Attempting to delete player with ID: ${id} and all related data`);
    
    // Проверяем, существует ли игрок
    const player = await User.findById(id);
    if (!player) {
      return res.status(404).json({ message: 'Игрок не найден' });
    }
    
    // Проверяем, что удаляемый пользователь имеет роль 'player'
    if (player.role !== 'player') {
      return res.status(400).json({ message: 'Можно удалять только игроков' });
    }
    
    // Удаляем все связанные данные
    console.log(`[CASCADE DELETE] Deleting mood entries for player: ${id}`);
    await MoodEntry.deleteMany({ userId: id });
    
    console.log(`[CASCADE DELETE] Deleting test entries for player: ${id}`);
    await TestEntry.deleteMany({ userId: id });
    
    console.log(`[CASCADE DELETE] Deleting player ratings for player: ${id}`);
    await PlayerRating.deleteMany({ userId: id });
    
    // Удаляем пользователя
    console.log(`[CASCADE DELETE] Deleting player: ${id}`);
    await User.findByIdAndDelete(id);
    
    return res.json({ 
      message: 'Игрок и все связанные данные успешно удалены',
      deletedPlayerId: id,
      success: true
    });
  } catch (error) {
    console.error('[CASCADE DELETE] Error deleting player and related data:', error);
    return res.status(500).json({ 
      message: 'Ошибка при удалении игрока и связанных данных',
      error: error.message
    });
  }
});

// Update privilege key (staff only)
router.post('/update-privilege-key', protect, isStaff, async (req: any, res) => {
  try {
    console.log('Updating privilege key for staff user:', req.user._id);
    const { privilegeKey } = req.body;

    // Проверяем, что пользователь может обновлять только свой ключ привилегий
    const userId = req.user._id;
    
    // Получаем корректный ключ из переменных окружения или используем fallback значение
    const validPrivilegeKey = process.env.STAFF_PRIVILEGE_KEY || 'ADMIN_ACCESS_2024_SECURE_KEY_xyz789';
    
    // Детальное логирование для диагностики
    console.log('[PRIVILEGE DEBUG] NODE_ENV:', process.env.NODE_ENV);
    console.log('[PRIVILEGE DEBUG] STAFF_PRIVILEGE_KEY загружен из env:', !!process.env.STAFF_PRIVILEGE_KEY);
    console.log('[PRIVILEGE DEBUG] Используемый ключ (первые 10 символов):', validPrivilegeKey.substring(0, 10) + '...');
    console.log('[PRIVILEGE DEBUG] Все env переменные (STAFF_*):', Object.keys(process.env).filter(key => key.includes('STAFF')));
    
    if (!validPrivilegeKey) {
      console.error('[PRIVILEGE ERROR] STAFF_PRIVILEGE_KEY not configured and no fallback available');
      return res.status(500).json({ 
        message: 'Ошибка конфигурации сервера: ключ привилегий не настроен',
        success: false 
      });
    }

    // Проверяем введенный ключ привилегий
    const isKeyValid = privilegeKey === validPrivilegeKey;
    
    console.log(`[PRIVILEGE] Попытка обновления ключа для ${req.user.name}`);
    console.log(`[PRIVILEGE] Введенный ключ: ${privilegeKey}`);
    console.log(`[PRIVILEGE] Валидный ключ: ${validPrivilegeKey}`);
    console.log(`[PRIVILEGE] Ключ валиден: ${isKeyValid}`);
    
    // Обновляем ключ привилегий только если он валидный
    if (isKeyValid) {
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { privilegeKey },
        { new: true }
      ).select('-password');

      if (!updatedUser) {
        return res.status(404).json({ 
          message: 'Пользователь не найден',
          success: false 
        });
      }

      console.log('Privilege key updated successfully');
      return res.json({
        success: true,
        message: 'Ключ привилегий успешно обновлен',
        user: {
          id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          privilegeKey: updatedUser.privilegeKey,
          avatar: updatedUser.avatar,
          createdAt: updatedUser.createdAt
        }
      });
    } else {
      // Если ключ неверный, возвращаем ошибку
      return res.status(400).json({
        success: false,
        message: 'Неверный ключ привилегий'
      });
    }
  } catch (error) {
    console.error('Error updating privilege key:', error);
    return res.status(500).json({ 
      message: 'Server error',
      success: false 
    });
  }
});

// Check if staff has privilege key
router.get('/check-privilege', protect, isStaff, async (req: any, res) => {
  try {
    const hasPrivilege = req.user && req.user.privilegeKey && req.user.privilegeKey.trim() !== '';
    
    return res.json({
      hasPrivilege,
      message: hasPrivilege 
        ? 'У вас есть доступ к редактированию состава участников' 
        : 'У вас нет доступа к редактированию состава участников'
    });
  } catch (error) {
    console.error('Error checking privilege key:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router; 