import express from 'express';
import User from '../models/User';
import MoodEntry from '../models/MoodEntry';
import SleepEntry from '../models/SleepEntry';
import TestEntry from '../models/TestEntry';
import PlayerRating from '../models/PlayerRating';
import { protect, isStaff, hasPrivilegeKey } from '../middleware/auth';
import {
  buildVisiblePlayersFilter,
  findAccessiblePlayerById,
  getScopedTeamId,
  isTeamStaffUser,
} from '../utils/teamAccess';
import { applyActiveProfileProjection, getUserProfiles } from '../utils/userProfiles';

const router = express.Router();

// Get all players (staff only)
router.get('/players', protect, isStaff, async (req: any, res) => {
  try {
    console.log('Fetching all players');
    const players = await User.find(buildVisiblePlayersFilter(req.user))
      .select('name email role playerType completedTests completedBalanceWheel createdAt')
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
    const player = await findAccessiblePlayerById(
      req.user,
      req.params.id,
      'name email playerType completedTests completedBalanceWheel createdAt'
    );

    if (!player) {
      console.log('Player not found:', req.params.id);
      return res.status(404).json({ message: 'Player not found' });
    }

    // Р”РѕР±Р°РІР»СЏРµРј РїРѕР»СѓС‡РµРЅРёРµ РґР°РЅРЅС‹С… Рѕ РЅР°СЃС‚СЂРѕРµРЅРёРё Рё СЌРЅРµСЂРіРёРё
    const moodEntries = await MoodEntry.find({ userId: player._id })
      .sort({ date: -1 });
    
    // Р”РѕР±Р°РІР»СЏРµРј РїРѕР»СѓС‡РµРЅРёРµ РґР°РЅРЅС‹С… Рѕ С‚РµСЃС‚Р°С…
    const testEntries = await TestEntry.find({ userId: player._id })
      .sort({ date: -1 });
    const sleepEntries = await SleepEntry.find({ userId: player._id })
      .sort({ date: -1 });

    // Р¤РѕСЂРјРёСЂСѓРµРј РѕР±СЉРµРєС‚ СЃ РїРѕР»РЅРѕР№ СЃС‚Р°С‚РёСЃС‚РёРєРѕР№ РёРіСЂРѕРєР°
    const playerData = {
      _id: player._id,
      name: player.name,
      email: player.email,
      playerType: player.playerType,
      completedTests: player.completedTests,
      completedBalanceWheel: player.completedBalanceWheel,
      createdAt: player.createdAt,
      moodEntries,
      sleepEntries,
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
      return res.status(400).json({ message: 'РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ ID РёРіСЂРѕРєР°' });
    }
    
    console.log(`Attempting to delete player with ID: ${id}`);
    
    // РџСЂРѕРІРµСЂСЏРµРј, СЃСѓС‰РµСЃС‚РІСѓРµС‚ Р»Рё РёРіСЂРѕРє
    const player = await findAccessiblePlayerById(req.user, id);
    if (!player) {
      return res.status(404).json({ message: 'РРіСЂРѕРє РЅРµ РЅР°Р№РґРµРЅ' });
    }
    
    // РџСЂРѕРІРµСЂСЏРµРј, С‡С‚Рѕ СѓРґР°Р»СЏРµРјС‹Р№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РёРјРµРµС‚ СЂРѕР»СЊ 'player'
    if (player.role !== 'player') {
      return res.status(400).json({ message: 'РњРѕР¶РЅРѕ СѓРґР°Р»СЏС‚СЊ С‚РѕР»СЊРєРѕ РёРіСЂРѕРєРѕРІ' });
    }
    
    // РЈРґР°Р»СЏРµРј РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
    await User.findByIdAndDelete(id);
    
    return res.json({ message: 'РРіСЂРѕРє СѓСЃРїРµС€РЅРѕ СѓРґР°Р»РµРЅ' });
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
    const player = await findAccessiblePlayerById(req.user, req.params.id);
    
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
      return res.status(400).json({ message: 'РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ ID РёРіСЂРѕРєР°' });
    }
    
    console.log(`[CASCADE DELETE] Attempting to delete player with ID: ${id} and all related data`);
    
    // РџСЂРѕРІРµСЂСЏРµРј, СЃСѓС‰РµСЃС‚РІСѓРµС‚ Р»Рё РёРіСЂРѕРє
    const player = await findAccessiblePlayerById(req.user, id);
    if (!player) {
      return res.status(404).json({ message: 'РРіСЂРѕРє РЅРµ РЅР°Р№РґРµРЅ' });
    }
    
    // РџСЂРѕРІРµСЂСЏРµРј, С‡С‚Рѕ СѓРґР°Р»СЏРµРјС‹Р№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РёРјРµРµС‚ СЂРѕР»СЊ 'player'
    if (player.role !== 'player') {
      return res.status(400).json({ message: 'РњРѕР¶РЅРѕ СѓРґР°Р»СЏС‚СЊ С‚РѕР»СЊРєРѕ РёРіСЂРѕРєРѕРІ' });
    }
    
    // РЈРґР°Р»СЏРµРј РІСЃРµ СЃРІСЏР·Р°РЅРЅС‹Рµ РґР°РЅРЅС‹Рµ
    console.log(`[CASCADE DELETE] Deleting mood entries for player: ${id}`);
    await MoodEntry.deleteMany({ userId: id });
    
    console.log(`[CASCADE DELETE] Deleting test entries for player: ${id}`);
    await TestEntry.deleteMany({ userId: id });

    console.log(`[CASCADE DELETE] Deleting sleep entries for player: ${id}`);
    await SleepEntry.deleteMany({ userId: id });
    
    console.log(`[CASCADE DELETE] Deleting player ratings for player: ${id}`);
    await PlayerRating.deleteMany({ userId: id });
    
    // РЈРґР°Р»СЏРµРј РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
    console.log(`[CASCADE DELETE] Deleting player: ${id}`);
    await User.findByIdAndDelete(id);
    
    return res.json({ 
      message: 'РРіСЂРѕРє Рё РІСЃРµ СЃРІСЏР·Р°РЅРЅС‹Рµ РґР°РЅРЅС‹Рµ СѓСЃРїРµС€РЅРѕ СѓРґР°Р»РµРЅС‹',
      deletedPlayerId: id,
      success: true
    });
  } catch (error) {
    console.error('[CASCADE DELETE] Error deleting player and related data:', error);
    return res.status(500).json({ 
      message: 'РћС€РёР±РєР° РїСЂРё СѓРґР°Р»РµРЅРёРё РёРіСЂРѕРєР° Рё СЃРІСЏР·Р°РЅРЅС‹С… РґР°РЅРЅС‹С…',
      error: error.message
    });
  }
});

// Update privilege key (staff only)
router.post('/update-privilege-key', protect, isStaff, async (req: any, res) => {
  try {
    console.log('Updating privilege key for staff user:', req.user._id);
    const { privilegeKey } = req.body;

    // РџСЂРѕРІРµСЂСЏРµРј, С‡С‚Рѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РјРѕР¶РµС‚ РѕР±РЅРѕРІР»СЏС‚СЊ С‚РѕР»СЊРєРѕ СЃРІРѕР№ РєР»СЋС‡ РїСЂРёРІРёР»РµРіРёР№
    const userId = req.user._id;
    
    // РџРѕР»СѓС‡Р°РµРј РєРѕСЂСЂРµРєС‚РЅС‹Р№ РєР»СЋС‡ РёР· РїРµСЂРµРјРµРЅРЅС‹С… РѕРєСЂСѓР¶РµРЅРёСЏ РёР»Рё РёСЃРїРѕР»СЊР·СѓРµРј fallback Р·РЅР°С‡РµРЅРёРµ
    const validPrivilegeKey = process.env.STAFF_PRIVILEGE_KEY || 'ADMIN_ACCESS_2024_SECURE_KEY_xyz789';
    
    // Р”РµС‚Р°Р»СЊРЅРѕРµ Р»РѕРіРёСЂРѕРІР°РЅРёРµ РґР»СЏ РґРёР°РіРЅРѕСЃС‚РёРєРё
    console.log('[PRIVILEGE DEBUG] NODE_ENV:', process.env.NODE_ENV);
    console.log('[PRIVILEGE DEBUG] STAFF_PRIVILEGE_KEY Р·Р°РіСЂСѓР¶РµРЅ РёР· env:', !!process.env.STAFF_PRIVILEGE_KEY);
    console.log('[PRIVILEGE DEBUG] РСЃРїРѕР»СЊР·СѓРµРјС‹Р№ РєР»СЋС‡ (РїРµСЂРІС‹Рµ 10 СЃРёРјРІРѕР»РѕРІ):', validPrivilegeKey.substring(0, 10) + '...');
    console.log('[PRIVILEGE DEBUG] Р’СЃРµ env РїРµСЂРµРјРµРЅРЅС‹Рµ (STAFF_*):', Object.keys(process.env).filter(key => key.includes('STAFF')));
    
    if (!validPrivilegeKey) {
      console.error('[PRIVILEGE ERROR] STAFF_PRIVILEGE_KEY not configured and no fallback available');
      return res.status(500).json({ 
        message: 'РћС€РёР±РєР° РєРѕРЅС„РёРіСѓСЂР°С†РёРё СЃРµСЂРІРµСЂР°: РєР»СЋС‡ РїСЂРёРІРёР»РµРіРёР№ РЅРµ РЅР°СЃС‚СЂРѕРµРЅ',
        success: false 
      });
    }

    // РџСЂРѕРІРµСЂСЏРµРј РІРІРµРґРµРЅРЅС‹Р№ РєР»СЋС‡ РїСЂРёРІРёР»РµРіРёР№
    const isKeyValid = privilegeKey === validPrivilegeKey;
    
    console.log(`[PRIVILEGE] РџРѕРїС‹С‚РєР° РѕР±РЅРѕРІР»РµРЅРёСЏ РєР»СЋС‡Р° РґР»СЏ ${req.user.name}`);
    console.log(`[PRIVILEGE] Р’РІРµРґРµРЅРЅС‹Р№ РєР»СЋС‡: ${privilegeKey}`);
    console.log(`[PRIVILEGE] Р’Р°Р»РёРґРЅС‹Р№ РєР»СЋС‡: ${validPrivilegeKey}`);
    console.log(`[PRIVILEGE] РљР»СЋС‡ РІР°Р»РёРґРµРЅ: ${isKeyValid}`);
    
    // РћР±РЅРѕРІР»СЏРµРј РєР»СЋС‡ РїСЂРёРІРёР»РµРіРёР№ С‚РѕР»СЊРєРѕ РµСЃР»Рё РѕРЅ РІР°Р»РёРґРЅС‹Р№
    if (isKeyValid) {
      const updatedUser = await User.findById(userId).select('-password');

      if (!updatedUser) {
        return res.status(404).json({ 
          message: 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ',
          success: false 
        });
      }

      updatedUser.privilegeKey = privilegeKey;
      updatedUser.profiles = getUserProfiles(updatedUser).map((profile) =>
        profile.role === 'staff'
          ? {
              ...profile,
              privilegeKey,
            }
          : profile
      ) as any;
      applyActiveProfileProjection(updatedUser);
      await updatedUser.save();

      console.log('Privilege key updated successfully');
      return res.json({
        success: true,
        message: 'РљР»СЋС‡ РїСЂРёРІРёР»РµРіРёР№ СѓСЃРїРµС€РЅРѕ РѕР±РЅРѕРІР»РµРЅ',
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
      // Р•СЃР»Рё РєР»СЋС‡ РЅРµРІРµСЂРЅС‹Р№, РІРѕР·РІСЂР°С‰Р°РµРј РѕС€РёР±РєСѓ
      return res.status(400).json({
        success: false,
        message: 'РќРµРІРµСЂРЅС‹Р№ РєР»СЋС‡ РїСЂРёРІРёР»РµРіРёР№'
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
    const hasPrivilege = (isTeamStaffUser(req.user) && Boolean(getScopedTeamId(req.user))) ||
      Boolean(req.user && req.user.privilegeKey && req.user.privilegeKey.trim() !== '');
    
    return res.json({
      hasPrivilege,
      message: hasPrivilege 
        ? 'РЈ РІР°СЃ РµСЃС‚СЊ РґРѕСЃС‚СѓРї Рє СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЋ СЃРѕСЃС‚Р°РІР° СѓС‡Р°СЃС‚РЅРёРєРѕРІ' 
        : 'РЈ РІР°СЃ РЅРµС‚ РґРѕСЃС‚СѓРїР° Рє СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЋ СЃРѕСЃС‚Р°РІР° СѓС‡Р°СЃС‚РЅРёРєРѕРІ'
    });
  } catch (error) {
    console.error('Error checking privilege key:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router; 
