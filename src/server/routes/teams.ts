import express from 'express';
import fs from 'fs';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import Team from '../models/Team';
import User from '../models/User';
import { isStaff, protect } from '../middleware/auth';
import { createInviteCode, hashOpaqueToken } from '../utils/securityTokens';
import { applyActiveProfileProjection, getUserProfiles, upsertUserProfile } from '../utils/userProfiles';

const router = express.Router();

const toObjectIdString = (value: unknown): string => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof mongoose.Types.ObjectId) {
    return value.toString();
  }

  if (typeof value === 'object' && value && 'toString' in value) {
    return String(value.toString());
  }

  return '';
};

const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const sameId = (left: unknown, right: unknown): boolean =>
  Boolean(left && right && toObjectIdString(left) === toObjectIdString(right));

const isTeamProfileStaff = (user: any): boolean => {
  return user?.role === 'staff' && user?.playerType === 'team';
};

const canManageTeam = (team: any, user: any): boolean => {
  const userId = toObjectIdString(user?._id);
  const userTeamId = toObjectIdString(user?.teamId);

  return Boolean(
    isTeamProfileStaff(user) &&
      (toObjectIdString(team.createdBy) === userId || toObjectIdString(team._id) === userTeamId)
  );
};

const canEditTeamBranding = (team: any, user: any): boolean =>
  Boolean(isTeamProfileStaff(user) && toObjectIdString(team.createdBy) === toObjectIdString(user?._id));

const buildTeamCodes = (teamName: string) => {
  const prefix = teamName.slice(0, 4).replace(/\s+/g, '');
  const playerCode = createInviteCode(`${prefix}P`);
  const staffCode = createInviteCode(`${prefix}S`);

  return {
    playerCode,
    playerCodeHash: hashOpaqueToken(playerCode),
    staffCode,
    staffCodeHash: hashOpaqueToken(staffCode),
  };
};

const ensureTeamLogoDir = () => {
  const uploadsDir = path.join(__dirname, '../../../uploads');
  const teamLogoDir = path.join(uploadsDir, 'team-logos');

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  if (!fs.existsSync(teamLogoDir)) {
    fs.mkdirSync(teamLogoDir, { recursive: true });
  }

  return teamLogoDir;
};

const teamLogoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, ensureTeamLogoDir());
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `team-logo-${uniqueSuffix}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new Error('Разрешены только изображения форматов: .jpg, .jpeg, .png, .webp, .svg'));
  }
});

const syncTeamBrandingToUsers = async (team: any) => {
  const relatedUsers = await User.find({
    $or: [
      { teamId: team._id },
      { 'profiles.teamId': team._id },
    ],
  });

  await Promise.all(
    relatedUsers.map(async (userDoc: any) => {
      const nextProfiles = getUserProfiles(userDoc).map((profile) =>
        sameId(profile.teamId, team._id)
          ? {
              ...profile,
              teamName: team.name,
              teamLogo: team.logo || '',
            }
          : profile
      );

      userDoc.profiles = nextProfiles;
      if (sameId(userDoc.teamId, team._id)) {
        userDoc.teamName = team.name;
        userDoc.teamLogo = team.logo || '';
      }

      applyActiveProfileProjection(userDoc);
      await userDoc.save();
    })
  );
};

router.get('/', protect, isStaff, async (req: any, res) => {
  try {
    if (!isTeamProfileStaff(req.user)) {
      return res.status(403).json({ message: 'Управление командами доступно только staff-профилю типа team' });
    }

    const userId = toObjectIdString(req.user?._id);
    const userTeamId = toObjectIdString(req.user?.teamId);
    const teams = await Team.find({
      $or: [
        { createdBy: userId },
        ...(userTeamId ? [{ _id: userTeamId }] : []),
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

    const items = await Promise.all(
      teams.map(async (team) => {
        const [playerCount, staffCount] = await Promise.all([
          User.countDocuments({ teamId: team._id, role: 'player', playerType: 'team' }),
          User.countDocuments({ teamId: team._id, role: 'staff' }),
        ]);

        return {
          id: toObjectIdString(team._id),
          name: team.name,
          logo: team.logo || '',
          playerLimit: team.playerLimit,
          playerCount,
          staffCount,
          isActive: team.isActive,
          createdAt: team.createdAt,
          isCreator: toObjectIdString(team.createdBy) === userId,
        };
      })
    );

    return res.json({ teams: items });
  } catch (error) {
    console.error('[Teams] Ошибка получения списка команд:', error);
    return res.status(500).json({ message: 'Не удалось получить список команд' });
  }
});

router.post('/', protect, isStaff, async (req: any, res) => {
  try {
    if (!isTeamProfileStaff(req.user)) {
      return res.status(403).json({ message: 'Создание команды доступно только staff-профилю типа team' });
    }

    const name = normalizeText(req.body?.name);
    if (!name) {
      return res.status(400).json({ message: 'Укажите название команды' });
    }

    if (req.user?.teamId) {
      return res.status(409).json({
        message: 'К этому staff/team уже привязана команда. Используйте текущую команду и её коды приглашения'
      });
    }

    const alreadyCreatedTeam = await Team.findOne({ createdBy: req.user._id }).lean();
    if (alreadyCreatedTeam) {
      return res.status(409).json({
        message: 'Для этого staff/team уже создана команда'
      });
    }

    const existingTeam = await Team.findOne({ name, createdBy: req.user._id });
    if (existingTeam) {
      return res.status(409).json({ message: 'Команда с таким названием уже создана' });
    }

    const codes = buildTeamCodes(name);
    const team = await Team.create({
      name,
      logo: '',
      createdBy: req.user._id,
      playerLimit: 7,
      playerInviteCodeHash: codes.playerCodeHash,
      staffInviteCodeHash: codes.staffCodeHash,
      playerInviteCodeUpdatedAt: new Date(),
      staffInviteCodeUpdatedAt: new Date(),
      isActive: true,
    });

    const currentUser = await User.findById(req.user._id);
    if (currentUser) {
      currentUser.profiles = upsertUserProfile(currentUser, {
        role: 'staff',
        playerType: 'team',
        teamId: team._id,
        teamName: team.name,
        teamLogo: team.logo || '',
        privilegeKey: currentUser.privilegeKey || ''
      }) as any;
      currentUser.activeProfileKey = currentUser.activeProfileKey || 'staff_team';
      applyActiveProfileProjection(currentUser);
      await currentUser.save();
    }

    return res.status(201).json({
      team: {
        id: toObjectIdString(team._id),
        name: team.name,
        logo: team.logo || '',
        playerLimit: team.playerLimit,
        isActive: team.isActive,
        createdAt: team.createdAt,
      },
      inviteCodes: {
        player: codes.playerCode,
        staff: codes.staffCode,
      },
    });
  } catch (error) {
    console.error('[Teams] Ошибка создания команды:', error);
    return res.status(500).json({ message: 'Не удалось создать команду' });
  }
});

router.post('/:id/regenerate-player-code', protect, isStaff, async (req: any, res) => {
  try {
    if (!isTeamProfileStaff(req.user)) {
      return res.status(403).json({ message: 'Управление кодами доступно только staff-профилю типа team' });
    }

    const team = await Team.findById(req.params.id).select('+playerInviteCodeHash');
    if (!team) {
      return res.status(404).json({ message: 'Команда не найдена' });
    }

    if (!canManageTeam(team, req.user)) {
      return res.status(403).json({ message: 'Нет прав на управление этой командой' });
    }

    const nextCode = createInviteCode(`${team.name.slice(0, 4)}P`);
    team.playerInviteCodeHash = hashOpaqueToken(nextCode);
    team.playerInviteCodeUpdatedAt = new Date();
    await team.save();

    return res.json({ playerCode: nextCode });
  } catch (error) {
    console.error('[Teams] Ошибка ротации player-кода:', error);
    return res.status(500).json({ message: 'Не удалось обновить код игрока' });
  }
});

router.post('/:id/regenerate-staff-code', protect, isStaff, async (req: any, res) => {
  try {
    if (!isTeamProfileStaff(req.user)) {
      return res.status(403).json({ message: 'Управление кодами доступно только staff-профилю типа team' });
    }

    const team = await Team.findById(req.params.id).select('+staffInviteCodeHash');
    if (!team) {
      return res.status(404).json({ message: 'Команда не найдена' });
    }

    if (!canManageTeam(team, req.user)) {
      return res.status(403).json({ message: 'Нет прав на управление этой командой' });
    }

    const nextCode = createInviteCode(`${team.name.slice(0, 4)}S`);
    team.staffInviteCodeHash = hashOpaqueToken(nextCode);
    team.staffInviteCodeUpdatedAt = new Date();
    await team.save();

    return res.json({ staffCode: nextCode });
  } catch (error) {
    console.error('[Teams] Ошибка ротации staff-кода:', error);
    return res.status(500).json({ message: 'Не удалось обновить код staff' });
  }
});

router.get('/:id/members', protect, isStaff, async (req: any, res) => {
  try {
    if (!isTeamProfileStaff(req.user)) {
      return res.status(403).json({ message: 'Просмотр состава доступен только staff-профилю типа team' });
    }

    const team = await Team.findById(req.params.id).lean();
    if (!team) {
      return res.status(404).json({ message: 'Команда не найдена' });
    }

    if (!canManageTeam(team, req.user)) {
      return res.status(403).json({ message: 'Нет прав на просмотр этой команды' });
    }

    const members = await User.find({ teamId: team._id })
      .select('name email role playerType teamId teamName createdAt')
      .sort({ role: 1, createdAt: 1 })
      .lean();

    return res.json({
      team: {
        id: toObjectIdString(team._id),
        name: team.name,
        logo: team.logo || '',
        playerLimit: team.playerLimit,
        isCreator: toObjectIdString(team.createdBy) === toObjectIdString(req.user?._id),
      },
      members,
    });
  } catch (error) {
    console.error('[Teams] Ошибка получения участников команды:', error);
    return res.status(500).json({ message: 'Не удалось получить состав команды' });
  }
});

router.patch('/:id/branding', protect, isStaff, teamLogoUpload.single('logo'), async (req: any, res) => {
  try {
    if (!isTeamProfileStaff(req.user)) {
      return res.status(403).json({ message: 'Управление брендингом доступно только staff-профилю типа team' });
    }

    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ message: 'Команда не найдена' });
    }

    if (!canManageTeam(team, req.user)) {
      return res.status(403).json({ message: 'Нет прав на управление этой командой' });
    }

    if (!canEditTeamBranding(team, req.user)) {
      return res.status(403).json({ message: 'Только создатель команды может менять название и логотип' });
    }

    const nextName = normalizeText(req.body?.name);
    const hasNameUpdate = Boolean(nextName && nextName !== team.name);
    const hasLogoUpdate = Boolean(req.file);

    if (!hasNameUpdate && !hasLogoUpdate) {
      return res.status(400).json({ message: 'Нет данных для обновления брендинга команды' });
    }

    const previousLogo = team.logo;
    if (hasNameUpdate) {
      team.name = nextName;
    }

    if (hasLogoUpdate) {
      team.logo = `/team-logos/${req.file.filename}`;
    }

    await team.save();
    await syncTeamBrandingToUsers(team);

    if (hasLogoUpdate && previousLogo && previousLogo !== team.logo) {
      const previousLogoPath = path.join(__dirname, '../../..', 'uploads', previousLogo.replace(/^\/+/, ''));
      if (fs.existsSync(previousLogoPath)) {
        fs.unlinkSync(previousLogoPath);
      }
    }

    return res.json({
      message: 'Брендинг команды обновлен',
      team: {
        id: toObjectIdString(team._id),
        name: team.name,
        logo: team.logo || '',
        playerLimit: team.playerLimit,
        isActive: team.isActive,
        createdAt: team.createdAt,
        isCreator: true,
      }
    });
  } catch (error) {
    console.error('[Teams] Ошибка обновления брендинга:', error);
    return res.status(500).json({ message: 'Не удалось обновить брендинг команды' });
  }
});

export default router;
