import User from '../models/User';
import Team from '../models/Team';
import PlayerCard from '../models/PlayerCard';
import FaceitAccount from '../models/FaceitAccount';
import { sendVerificationEmail } from '../services/mailService';
import { issuePasswordResetForUser } from '../services/passwordResetService';
import faceitService, { FaceitProfileInfo } from '../services/faceitService';
import { createOpaqueToken, hashOpaqueToken } from '../utils/securityTokens';
import { signJwt } from '../utils/jwt';
import { buildSubscriptionSummary, hasPerformanceCoachCrmAccess, resolveEffectiveSubscriptionAccess } from '../utils/subscriptionAccess';
import {
  applyActiveProfileProjection,
  getActiveProfile,
  getUserProfiles,
  serializeProfilesForResponse,
  upsertUserProfile,
} from '../utils/userProfiles';
import mongoose from 'mongoose';
import { maskBaselineAssessmentSummary } from '../utils/baselineAssessment';

// Генерация JWT токена
const generateToken = (id: string): string => {
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  return signJwt({ id }, secret, {
    expiresIn: '30d'
  });
};

const normalizeEmail = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toLowerCase();
};

const isDatabaseUnavailableError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as { name?: string; message?: string };
  const name = maybeError.name || '';
  const message = maybeError.message || '';

  return (
    name === 'MongooseServerSelectionError' ||
    name === 'MongoNetworkError' ||
    name === 'MongoNotConnectedError' ||
    /server selection|topology|ECONNREFUSED|buffering timed out|not connected|client must be connected|connection .* closed/i.test(message)
  );
};

const isFaceitOwnershipConflictError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message === 'Этот Faceit-аккаунт уже привязан к другому игроку';
};

const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const isFaceitLink = (value: string): boolean => /^https?:\/\/(www\.)?faceit\.com\//i.test(value);
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const EMAIL_VERIFICATION_SUCCESS_MESSAGE = 'Если аккаунт существует и email ещё не подтвержден, письмо уже отправлено';

const buildUserResponse = (
  user: any,
  accessFlags = {
    hasPerformanceCoachCrmAccess: false,
    hasCorrelationAnalysisAccess: false,
    hasGameStatsAccess: false,
  }
) => {
  const baselineAssessmentCompleted = Boolean(user?.baselineAssessment?.completedAt);
  const subscription = buildSubscriptionSummary(user?.subscription);
  const activeProfile = getActiveProfile(user);

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
    emailVerifiedAt: user.emailVerifiedAt || null,
    isSuperAdmin: Boolean(user.isSuperAdmin),
    isActive: user.isActive !== false,
    deactivatedAt: user.deactivatedAt || null,
    deactivatedReason: user.deactivatedReason || null,
    role: activeProfile.role,
    playerType: activeProfile.playerType,
    teamId: activeProfile.teamId || null,
    teamName: activeProfile.teamName || '',
    teamLogo: activeProfile.teamLogo || '',
    avatar: user.avatar,
    privilegeKey: activeProfile.privilegeKey,
    staffHasPrivilegeKey: Boolean(
      activeProfile.role === 'staff' &&
        typeof activeProfile.privilegeKey === 'string' &&
        activeProfile.privilegeKey.trim()
    ),
    availableProfiles: serializeProfilesForResponse(user),
    activeProfileKey: activeProfile.key,
    subscription,
    hasPerformanceCoachCrmAccess: accessFlags.hasPerformanceCoachCrmAccess || hasPerformanceCoachCrmAccess(subscription),
    hasCorrelationAnalysisAccess: accessFlags.hasCorrelationAnalysisAccess,
    hasGameStatsAccess: accessFlags.hasGameStatsAccess,
    completedTests: user.completedTests,
    completedBalanceWheel: user.completedBalanceWheel,
    createdAt: user.createdAt,
    baselineAssessmentCompleted,
    baselineAssessment: maskBaselineAssessmentSummary(
      user.baselineAssessment || null,
      accessFlags.hasPerformanceCoachCrmAccess || hasPerformanceCoachCrmAccess(subscription)
    )
  };
};

const loadUserWithAccessData = async (userId: mongoose.Types.ObjectId | string) => {
  const user = await User.findById(userId)
    .select('-password')
    .populate({
      path: 'subscription',
      populate: {
        path: 'planId',
        model: 'Plan',
      },
    });

  if (user) {
    applyActiveProfileProjection(user);
  }

  const accessFlags = user
    ? await resolveEffectiveSubscriptionAccess(user)
    : {
        hasPerformanceCoachCrmAccess: false,
        hasCorrelationAnalysisAccess: false,
        hasGameStatsAccess: false,
        inheritedFromTeamOwnerId: null,
      };

  return { user, accessFlags };
};

const createPlayerCardForUser = async (
  userId: mongoose.Types.ObjectId,
  fallbackName: string,
  faceitUrl: string,
  nickname: string
) => {
  const existingCard = await PlayerCard.findOne({ userId });
  const cardNickname = nickname || fallbackName;

  if (existingCard) {
    existingCard.contacts = {
      ...existingCard.contacts,
      faceit: faceitUrl,
      nickname: existingCard.contacts.nickname || cardNickname
    };
    await existingCard.save();
    return existingCard;
  }

  return PlayerCard.create({
    userId,
    contacts: {
      vk: '',
      telegram: '',
      faceit: faceitUrl,
      steam: '',
      nickname: cardNickname
    },
    roadmap: '',
    mindmap: '',
    communicationLine: ''
  });
};

const linkFaceitAccountToUser = async (
  userId: mongoose.Types.ObjectId,
  profile: FaceitProfileInfo
): Promise<void> => {
  const existingFaceitOwner = await FaceitAccount.findOne({ faceitId: profile.faceitId });
  if (existingFaceitOwner && existingFaceitOwner.userId.toString() !== userId.toString()) {
    throw new Error('Этот Faceit-аккаунт уже привязан к другому игроку');
  }

  let faceitAccount = await FaceitAccount.findOne({ userId });
  if (faceitAccount) {
    faceitAccount.faceitId = profile.faceitId;
    faceitAccount.accessToken = faceitAccount.accessToken || '';
    faceitAccount.refreshToken = faceitAccount.refreshToken || '';
    faceitAccount.tokenExpiresAt = faceitAccount.tokenExpiresAt || new Date('2100-01-01T00:00:00.000Z');
    await faceitAccount.save();
  } else {
    faceitAccount = await FaceitAccount.create({
      userId,
      faceitId: profile.faceitId,
      accessToken: '',
      refreshToken: '',
      tokenExpiresAt: new Date('2100-01-01T00:00:00.000Z')
    });
  }

  await User.findByIdAndUpdate(userId, { faceitAccountId: faceitAccount._id });

  faceitService.importMatches(faceitAccount._id)
    .then((count) => console.log(`[AuthController] Импортировано ${count} матчей после регистрации пользователя ${userId}`))
    .catch((error) => console.error(`[AuthController] Ошибка импорта матчей после регистрации пользователя ${userId}:`, error));
};

const findTeamByInviteCode = async (
  code: string
): Promise<{ team: any; invitedRole: 'player' | 'staff' } | null> => {
  const normalizedCode = normalizeText(code);
  if (!normalizedCode) {
    return null;
  }

  const hashedCode = hashOpaqueToken(normalizedCode);
  const teams = await Team.find({ isActive: true }).select(
    '+playerInviteCodeHash +staffInviteCodeHash name logo playerLimit isActive'
  );

  for (const team of teams) {
    if (team.playerInviteCodeHash === hashedCode) {
      return { team, invitedRole: 'player' };
    }

    if (team.staffInviteCodeHash === hashedCode) {
      return { team, invitedRole: 'staff' };
    }
  }

  return null;
};

const ensureTeamPlayerCapacity = async (teamId: mongoose.Types.ObjectId): Promise<void> => {
  const [team, playersCount] = await Promise.all([
    Team.findById(teamId).select('playerLimit'),
    User.countDocuments({
      teamId,
      role: 'player',
      playerType: 'team',
    }),
  ]);

  if (!team) {
    throw new Error('Команда не найдена');
  }

  if (playersCount >= team.playerLimit) {
    throw new Error('Лимит игроков в этой команде уже достигнут');
  }
};

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

const sameObjectId = (left: unknown, right: unknown): boolean =>
  Boolean(left && right && toObjectIdString(left) === toObjectIdString(right));

const buildTeamLinkSummary = (team: any) => ({
  id: toObjectIdString(team?._id),
  name: team?.name || '',
  logo: team?.logo || ''
});

const getVerifyEmailUrl = (token: string): string => {
  const clientUrl = normalizeText(process.env.CLIENT_URL);
  if (!clientUrl) {
    throw new Error('CLIENT_URL не настроен');
  }

  return `${clientUrl.replace(/\/+$/g, '')}/verify-email?token=${encodeURIComponent(token)}`;
};

const createEmailVerificationPayload = () => {
  const verificationToken = createOpaqueToken(24);

  return {
    verificationToken,
    verificationTokenHash: hashOpaqueToken(verificationToken),
    verificationExpiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
  };
};

// Регистрация нового пользователя
export const registerUser = async (req: any, res: any) => {
  try {
    console.log('[AuthController] Запрос на регистрацию:', {
      email: req.body.email,
      name: req.body.name,
      playerType: req.body.playerType
    });
    
    const { name, password } = req.body;
    const email = normalizeEmail(req.body.email);
    const faceitUrl = normalizeText(req.body.faceitUrl || req.body.faceit);
    const nickname = normalizeText(req.body.nickname);
    const rawPlayerType = normalizeText(req.body.playerType || req.body.player_type);
    const teamCode = normalizeText(req.body.teamCode);
    const teamName = normalizeText(req.body.teamName);
    const requestedRole = normalizeText(req.body.role);
    
    if (!name || !email || !password) {
      console.log('[AuthController] Ошибка: отсутствуют обязательные поля');
      return res.status(400).json({ 
        message: 'Необходимо указать имя, email и пароль' 
      });
    }
    
    // Проверка валидности email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('[AuthController] Ошибка: некорректный формат email');
      return res.status(400).json({ 
        message: 'Некорректный формат email' 
      });
    }
    
    if (password.length < 6) {
      console.log('[AuthController] Ошибка: пароль слишком короткий');
      return res.status(400).json({ 
        message: "Пароль должен быть не менее 6 символов"
      });
    }
    
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: 'База данных инициализируется, повторите регистрацию через несколько секунд'
      });
    }

    const validPlayerTypes = ['solo', 'team'];
    let finalPlayerType = validPlayerTypes.includes(rawPlayerType) ? rawPlayerType : 'solo';
    let finalRole: 'player' | 'staff' = 'player';
    let teamAssignment: {
      teamId: mongoose.Types.ObjectId;
      teamName: string;
      teamLogo: string;
    } | null = null;

    if (teamName) {
      return res.status(403).json({
        message: 'Создание команды доступно только авторизованному сотруднику через раздел управления командами'
      });
    }

    if (teamCode) {
      const resolvedTeamAccess = await findTeamByInviteCode(teamCode);
      if (!resolvedTeamAccess) {
        return res.status(400).json({
          message: 'Код команды недействителен или уже устарел'
        });
      }

      if (resolvedTeamAccess.invitedRole === 'player') {
        await ensureTeamPlayerCapacity(resolvedTeamAccess.team._id);
      }

      finalRole = resolvedTeamAccess.invitedRole;
      finalPlayerType = 'team';
      teamAssignment = {
        teamId: resolvedTeamAccess.team._id,
        teamName: resolvedTeamAccess.team.name,
        teamLogo: resolvedTeamAccess.team.logo || '',
      };
    } else {
      if (requestedRole === 'staff') {
        if (finalPlayerType !== 'team') {
          return res.status(400).json({
            message: 'Сотрудник может зарегистрироваться только с типом профиля team'
          });
        }

        finalRole = 'staff';
      }

      if (finalRole === 'player' && finalPlayerType === 'team') {
        return res.status(400).json({
          message: 'Для командной регистрации необходимо указать код команды'
        });
      }
    }

    let resolvedFaceitProfile: FaceitProfileInfo | null = null;
    let faceitValidationWarning: string | null = null;
    if (finalRole === 'player') {
      if (!faceitUrl) {
        return res.status(400).json({
          message: 'Для регистрации игрока необходимо указать ссылку на Faceit'
        });
      }

      if (!isFaceitLink(faceitUrl)) {
        return res.status(400).json({
          message: 'Укажите корректную ссылку на профиль Faceit'
        });
      }

      try {
        resolvedFaceitProfile = await faceitService.resolveFaceitProfile(faceitUrl);
      } catch (faceitError) {
        faceitValidationWarning = faceitError instanceof Error
          ? faceitError.message
          : 'Не удалось проверить Faceit';
        console.warn('[AuthController] Предупреждение проверки Faceit при регистрации:', faceitValidationWarning);
      }

      if (resolvedFaceitProfile) {
        const existingFaceitOwner = await FaceitAccount.findOne({ faceitId: resolvedFaceitProfile.faceitId });
        if (existingFaceitOwner) {
          return res.status(409).json({
            message: 'Этот Faceit-аккаунт уже привязан к другому игроку'
          });
        }
      }
    }

    // Проверка существования пользователя с улучшенной обработкой ошибок
    try {
      const userExists = await User.findOne({ email });
      if (userExists) {
        console.log(`[AuthController] Пользователь с email ${email} уже существует`);
        return res.status(409).json({ 
          message: 'Пользователь с таким email уже существует' 
        });
      }
    } catch (findError) {
      console.error('[AuthController] Ошибка при проверке существования пользователя:', findError);
      if (isDatabaseUnavailableError(findError)) {
        return res.status(503).json({
          message: 'База данных временно недоступна. Повторите попытку через несколько секунд.'
        });
      }
      return res.status(500).json({ 
        message: 'Ошибка при проверке существования пользователя',
        error: findError instanceof Error ? findError.message : 'Неизвестная ошибка'
      });
    }
    
    console.log('[AuthController] Создание нового пользователя');
    
    try {
      // Создание пользователя с дополнительной защитой
      console.log(`[AuthController] Создание пользователя с ролью: ${finalRole}`);
      
      // Проверка email на соответствие формату модели
      const emailFormatRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailFormatRegex.test(email)) {
        console.log(`[AuthController] Email ${email} не соответствует формату модели`);
        return res.status(400).json({ 
          message: 'Некорректный формат email для модели данных' 
        });
      }
      
      // Проверка длины email
      if (email.length > 50) {
        console.log(`[AuthController] Email ${email} слишком длинный (${email.length} символов)`);
        return res.status(400).json({ 
          message: 'Email слишком длинный, максимум 50 символов' 
        });
      }

      const { verificationToken, verificationTokenHash, verificationExpiresAt } = createEmailVerificationPayload();

      const userData = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        emailVerified: false,
        emailVerifiedAt: null,
        emailVerificationTokenHash: verificationTokenHash,
        emailVerificationExpiresAt: verificationExpiresAt,
        role: finalRole,
        playerType: finalPlayerType,
        ...(teamAssignment
          ? {
              teamId: teamAssignment.teamId,
              teamName: teamAssignment.teamName,
              teamLogo: teamAssignment.teamLogo,
            }
          : {}),
        profiles: [
          {
            key: `${finalRole}_${finalPlayerType}`,
            label:
              finalRole === 'staff'
                ? 'Стафф / Team'
                : finalPlayerType === 'solo'
                  ? 'Игрок / Solo'
                  : 'Игрок / Team',
            role: finalRole,
            playerType: finalPlayerType,
            teamId: teamAssignment?.teamId || null,
            teamName: teamAssignment?.teamName || '',
            teamLogo: teamAssignment?.teamLogo || '',
            privilegeKey: finalRole === 'staff' ? '' : '',
          },
        ],
        activeProfileKey: `${finalRole}_${finalPlayerType}`,
      };
      
      console.log(`[AuthController] Попытка создания пользователя с данными:`, {
        name: userData.name,
        email: userData.email,
        role: userData.role,
        playerType: userData.playerType,
        teamName: teamAssignment?.teamName || null,
        passwordLength: userData.password.length
      });
      
      let user;
      try {
        // Используем новый экземпляр модели вместо метода create для лучшей обработки ошибок
        user = new User(userData);
        await user.save();
      } catch (mongoError) {
        console.error('[AuthController] Ошибка MongoDB при создании пользователя:', mongoError);
        
        // Обработка специфических ошибок MongoDB
        if (mongoError.code === 11000) {
          return res.status(409).json({ 
            message: 'Пользователь с таким email уже существует',
            error: 'DuplicateKey',
            field: Object.keys(mongoError.keyPattern || {})[0] || 'email'
          });
        }
        
        // Обработка ошибок валидации
        if (mongoError.name === 'ValidationError') {
          const validationErrors = Object.values(mongoError.errors || {}).map((err: any) => {
            return {
              field: err.path,
              message: err.message,
              value: err.value,
              kind: err.kind
            };
          });
          
          console.error('[AuthController] Ошибки валидации:', validationErrors);
          
          return res.status(400).json({
            message: 'Ошибка валидации данных',
            errors: validationErrors
          });
        }
        
        // Прочие ошибки MongoDB
        return res.status(500).json({
          message: 'Ошибка при создании пользователя',
          error: mongoError.message || 'Неизвестная ошибка MongoDB'
        });
      }
      
      if (user) {
        if (finalRole === 'player') {
          try {
            await createPlayerCardForUser(user._id, user.name, faceitUrl, nickname);
            if (resolvedFaceitProfile) {
              await linkFaceitAccountToUser(user._id, resolvedFaceitProfile);
            }
          } catch (setupError) {
            console.error('[AuthController] Ошибка инициализации данных игрока после регистрации:', setupError);
            return res.status(500).json({
              message: 'Пользователь создан, но не удалось инициализировать данные игрока',
              error: setupError instanceof Error ? setupError.message : 'Неизвестная ошибка'
            });
          }
        }

        console.log(`[AuthController] Пользователь создан успешно:`, {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          teamName: user.teamName || null
        });
        
        let emailDeliveryFailed = false;
        try {
          await sendVerificationEmail({
            email: user.email,
            name: user.name,
            verificationUrl: getVerifyEmailUrl(verificationToken),
          });
        } catch (mailError) {
          emailDeliveryFailed = true;
          console.error('[AuthController] Ошибка отправки письма подтверждения email:', mailError);
        }

        res.status(201).json({
          message: emailDeliveryFailed
            ? 'Аккаунт создан, но письмо с подтверждением пока не отправлено. Запросите отправку повторно на экране входа.'
            : 'Аккаунт создан. Подтвердите email по ссылке из письма, затем войдите в систему.',
          requiresEmailVerification: true,
          emailDeliveryFailed,
          user: {
            ...buildUserResponse(user),
            faceitConnected: finalRole === 'player' ? Boolean(resolvedFaceitProfile) : false
          },
          warnings: faceitValidationWarning ? [faceitValidationWarning] : []
        });
      } else {
        console.log('[AuthController] Ошибка: не удалось создать пользователя');
        return res.status(400).json({ message: 'Неверные данные пользователя' });
      }
    } catch (createError) {
      console.error('[AuthController] Ошибка при создании пользователя:', createError);
      return res.status(500).json({ 
        message: 'Ошибка при создании пользователя',
        error: createError instanceof Error ? createError.message : 'Неизвестная ошибка'
      });
    }
  } catch (error) {
    console.error('[AuthController] Ошибка регистрации:', error);
    return res.status(500).json({ 
      message: 'Ошибка при регистрации пользователя',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
};

export const forgotPassword = async (req: any, res: any) => {
  const successMessage = 'Если аккаунт существует, письмо со ссылкой для сброса уже отправлено';

  try {
    const email = normalizeEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({ message: 'Укажите email' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: 'База данных инициализируется, повторите запрос через несколько секунд'
      });
    }

    const user = await User.findOne({ email }).select('name email');
    if (!user) {
      return res.json({ message: successMessage });
    }

    try {
      await issuePasswordResetForUser({
        _id: user._id,
        email: user.email,
        name: user.name,
      });
    } catch (mailError) {
      console.error('[AuthController] Ошибка отправки письма для сброса пароля:', mailError);
      return res.status(503).json({
        message: 'Почтовая система временно недоступна. Попробуйте позже.'
      });
    }

    return res.json({ message: successMessage });
  } catch (error) {
    console.error('[AuthController] Ошибка forgot password:', error);
    return res.status(500).json({
      message: 'Ошибка при запуске восстановления пароля',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
};

export const resetPassword = async (req: any, res: any) => {
  try {
    const token = normalizeText(req.body?.token);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!token || !password) {
      return res.status(400).json({ message: 'Необходимо передать токен и новый пароль' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Новый пароль должен содержать не менее 8 символов' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: 'База данных инициализируется, повторите запрос через несколько секунд'
      });
    }

    const hashedToken = hashOpaqueToken(token);
    const user = await User.findOne({
      passwordResetTokenHash: hashedToken,
      passwordResetExpiresAt: { $gt: new Date() },
    }).select('+passwordResetTokenHash +passwordResetExpiresAt +password');

    if (!user) {
      return res.status(400).json({ message: 'Ссылка для сброса пароля недействительна или устарела' });
    }

    user.password = password;
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    user.passwordChangedAt = new Date();
    await user.save();

    return res.json({ message: 'Пароль успешно обновлен' });
  } catch (error) {
    console.error('[AuthController] Ошибка reset password:', error);
    return res.status(500).json({
      message: 'Ошибка при сбросе пароля',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
};

export const resendVerificationEmail = async (req: any, res: any) => {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({ message: 'Укажите email' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: 'База данных инициализируется, повторите запрос через несколько секунд'
      });
    }

    const user = await User.findOne({ email }).select('name email emailVerified');
    if (!user || user.emailVerified) {
      return res.json({ message: EMAIL_VERIFICATION_SUCCESS_MESSAGE });
    }

    const { verificationToken, verificationTokenHash, verificationExpiresAt } = createEmailVerificationPayload();

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          emailVerificationTokenHash: verificationTokenHash,
          emailVerificationExpiresAt: verificationExpiresAt,
        },
      }
    );

    try {
      await sendVerificationEmail({
        email: user.email,
        name: user.name,
        verificationUrl: getVerifyEmailUrl(verificationToken),
      });
    } catch (mailError) {
      console.error('[AuthController] Ошибка повторной отправки письма подтверждения email:', mailError);
      return res.status(503).json({
        message: 'Почтовая система временно недоступна. Попробуйте позже.'
      });
    }

    return res.json({ message: EMAIL_VERIFICATION_SUCCESS_MESSAGE });
  } catch (error) {
    console.error('[AuthController] Ошибка resend verification email:', error);
    return res.status(500).json({
      message: 'Ошибка при повторной отправке письма подтверждения',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
};

export const verifyEmail = async (req: any, res: any) => {
  try {
    const token = normalizeText(req.body?.token);

    if (!token) {
      return res.status(400).json({ message: 'Необходимо передать токен подтверждения' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: 'База данных инициализируется, повторите запрос через несколько секунд'
      });
    }

    const user = await User.findOne({
      emailVerificationTokenHash: hashOpaqueToken(token),
      emailVerificationExpiresAt: { $gt: new Date() },
    }).select('+emailVerificationTokenHash +emailVerificationExpiresAt');

    if (!user) {
      return res.status(400).json({ message: 'Ссылка подтверждения недействительна или устарела' });
    }

    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpiresAt = null;
    await user.save();

    return res.json({ message: 'Email успешно подтвержден. Теперь можно войти в систему.' });
  } catch (error) {
    console.error('[AuthController] Ошибка verify email:', error);
    return res.status(500).json({
      message: 'Ошибка при подтверждении email',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
};

export const changePassword = async (req: any, res: any) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: 'Пользователь не авторизован' });
    }

    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Укажите текущий и новый пароль' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Новый пароль должен содержать не менее 8 символов' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: 'Новый пароль должен отличаться от текущего' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: 'База данных инициализируется, повторите запрос через несколько секунд'
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Текущий пароль указан неверно' });
    }

    user.password = newPassword;
    user.passwordChangedAt = new Date();
    await user.save();

    return res.json({ message: 'Пароль успешно изменен. Выполните вход повторно.' });
  } catch (error) {
    console.error('[AuthController] Ошибка change password:', error);
    return res.status(500).json({
      message: 'Ошибка при смене пароля',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
};

export const updateCurrentUserProfile = async (req: any, res: any) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ success: false, message: 'Пользователь не авторизован' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'База данных инициализируется, повторите запрос через несколько секунд'
      });
    }

    const user = await User.findById(req.user._id).select('name');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }

    const updates: Record<string, unknown> = {};
    let resolvedFaceitProfile: FaceitProfileInfo | null = null;
    let faceitUrlResponse: string | null = null;

    if (req.body?.name !== undefined) {
      if (typeof req.body.name !== 'string') {
        return res.status(400).json({ success: false, message: 'Имя должно быть строкой' });
      }

      const trimmedName = req.body.name.trim();
      if (!trimmedName) {
        return res.status(400).json({ success: false, message: 'Имя не может быть пустым' });
      }

      updates.name = trimmedName;
      user.name = trimmedName;
    }

    const shouldUpdateFaceit = req.body?.faceitUrl !== undefined || req.body?.faceit !== undefined;
    if (shouldUpdateFaceit) {
      const normalizedFaceitUrl = normalizeText(req.body?.faceitUrl || req.body?.faceit);
      if (!normalizedFaceitUrl) {
        return res.status(400).json({ success: false, message: 'faceitUrl обязателен' });
      }

      if (!isFaceitLink(normalizedFaceitUrl)) {
        return res.status(400).json({
          success: false,
          message: 'Некорректная FACEIT ссылка. Ожидается https://faceit.com/...'
        });
      }

      try {
        resolvedFaceitProfile = await faceitService.resolveFaceitProfile(normalizedFaceitUrl);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: `Не удалось получить FACEIT профиль: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
        });
      }

      if (!resolvedFaceitProfile) {
        return res.status(404).json({ success: false, message: 'FACEIT профиль не найден' });
      }

      try {
        await linkFaceitAccountToUser(user._id, resolvedFaceitProfile);
        await createPlayerCardForUser(
          user._id,
          user.name,
          normalizedFaceitUrl,
          resolvedFaceitProfile.nickname || ''
        );
      } catch (error) {
        if (isFaceitOwnershipConflictError(error)) {
          return res.status(409).json({
            success: false,
            message: error.message
          });
        }

        throw error;
      }

      faceitUrlResponse = normalizedFaceitUrl;
    }

    if (!Object.keys(updates).length && !shouldUpdateFaceit) {
      return res.status(400).json({ success: false, message: 'Нет данных для обновления профиля' });
    }

    if (Object.keys(updates).length) {
      await User.findByIdAndUpdate(req.user._id, updates);
    }

    const { user: updatedUser, accessFlags } = await loadUserWithAccessData(req.user._id);
    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }

    return res.json({
      success: true,
      message: shouldUpdateFaceit ? 'Профиль и FACEIT данные обновлены' : 'Профиль обновлен',
      user: buildUserResponse(updatedUser, accessFlags),
      faceitUrl: faceitUrlResponse,
      faceitId: resolvedFaceitProfile?.faceitId || null
    });
  } catch (error) {
    console.error('[AuthController] Ошибка при обновлении профиля:', error);
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({
        success: false,
        message: 'База данных временно недоступна. Повторите попытку через несколько секунд.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении профиля',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
};

export const createPlayerProfile = async (req: any, res: any) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ success: false, message: 'Пользователь не авторизован' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'База данных инициализируется, повторите запрос через несколько секунд'
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }

    applyActiveProfileProjection(user);
    const currentProfiles = getUserProfiles(user);
    const existingPlayerProfile = currentProfiles.find((profile) => profile.role === 'player');

    if (existingPlayerProfile) {
      return res.status(409).json({
        success: false,
        message: 'Профиль игрока уже существует для этого аккаунта'
      });
    }

    const requestedPlayerType = normalizeText(req.body?.playerType) === 'solo' ? 'solo' : 'team';
    const faceitUrl = normalizeText(req.body?.faceitUrl || req.body?.faceit);
    const nickname = normalizeText(req.body?.nickname);

    if (!faceitUrl) {
      return res.status(400).json({
        success: false,
        message: 'Для профиля игрока необходимо указать ссылку на Faceit'
      });
    }

    if (!isFaceitLink(faceitUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Укажите корректную ссылку на профиль Faceit'
      });
    }

    let teamAssignment: { teamId: mongoose.Types.ObjectId | string; teamName: string; teamLogo: string } | null = null;
    if (requestedPlayerType === 'team') {
      const linkedTeamProfile = currentProfiles.find(
        (profile) => profile.role === 'staff' && profile.playerType === 'team' && profile.teamId
      );

      if (!linkedTeamProfile) {
        return res.status(400).json({
          success: false,
          message: 'Командный профиль игрока можно добавить только к staff/team, который уже привязан к команде'
        });
      }

      teamAssignment = {
        teamId: linkedTeamProfile.teamId!,
        teamName: linkedTeamProfile.teamName,
        teamLogo: linkedTeamProfile.teamLogo || ''
      };
    }

    let resolvedFaceitProfile: FaceitProfileInfo | null = null;
    let faceitValidationWarning: string | null = null;
    try {
      resolvedFaceitProfile = await faceitService.resolveFaceitProfile(faceitUrl);
    } catch (faceitError) {
      faceitValidationWarning = faceitError instanceof Error
        ? faceitError.message
        : 'Не удалось проверить Faceit';
      console.warn('[AuthController] Предупреждение проверки Faceit при добавлении player-профиля:', faceitValidationWarning);
    }

    if (resolvedFaceitProfile) {
      const existingFaceitOwner = await FaceitAccount.findOne({ faceitId: resolvedFaceitProfile.faceitId });
      if (existingFaceitOwner && existingFaceitOwner.userId.toString() !== user._id.toString()) {
        return res.status(409).json({
          success: false,
          message: 'Этот Faceit-аккаунт уже привязан к другому игроку'
        });
      }
    }

    user.profiles = upsertUserProfile(user, {
      role: 'player',
      playerType: requestedPlayerType,
      teamId: teamAssignment?.teamId || null,
      teamName: teamAssignment?.teamName || '',
      teamLogo: teamAssignment?.teamLogo || '',
      privilegeKey: ''
    }) as any;

    applyActiveProfileProjection(user);
    await user.save();

    await createPlayerCardForUser(user._id, user.name, faceitUrl, nickname);
    if (resolvedFaceitProfile) {
      await linkFaceitAccountToUser(user._id, resolvedFaceitProfile);
    }

    const { user: updatedUser, accessFlags } = await loadUserWithAccessData(user._id);
    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }

    return res.status(201).json({
      success: true,
      message: 'Профиль игрока успешно добавлен',
      user: buildUserResponse(updatedUser, accessFlags),
      warnings: faceitValidationWarning ? [faceitValidationWarning] : []
    });
  } catch (error) {
    console.error('[AuthController] Ошибка при добавлении player-профиля:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при создании профиля игрока',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
};

export const linkTeamProfile = async (req: any, res: any) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: 'Пользователь не авторизован' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: 'База данных инициализируется, повторите запрос через несколько секунд'
      });
    }

    const teamCode = normalizeText(req.body?.teamCode);
    const confirmRelink = req.body?.confirmRelink === true;

    if (!teamCode) {
      return res.status(400).json({ message: 'Укажите team-код' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    applyActiveProfileProjection(user);
    const activeProfile = getActiveProfile(user);
    const currentProfiles = getUserProfiles(user);
    const resolvedTeamAccess = await findTeamByInviteCode(teamCode);

    if (!resolvedTeamAccess) {
      return res.status(400).json({ message: 'Код команды недействителен или уже устарел' });
    }

    if (activeProfile.role === 'player' && resolvedTeamAccess.invitedRole !== 'player') {
      return res.status(403).json({
        message: 'Игрок может привязаться к команде только по player-коду'
      });
    }

    if (activeProfile.role === 'staff' && resolvedTeamAccess.invitedRole !== 'staff') {
      return res.status(403).json({
        message: 'Стафф может привязаться к команде только по staff-коду'
      });
    }

    const targetRole = activeProfile.role === 'staff' ? 'staff' : 'player';
    const targetProfileKey = `${targetRole}_team`;
    const existingTeamProfile = currentProfiles.find((profile) => profile.key === targetProfileKey);
    const nextTeam = buildTeamLinkSummary(resolvedTeamAccess.team);
    const currentTeam =
      existingTeamProfile?.teamId || existingTeamProfile?.teamName
        ? {
            id: toObjectIdString(existingTeamProfile?.teamId),
            name: existingTeamProfile?.teamName || '',
            logo: existingTeamProfile?.teamLogo || ''
          }
        : null;

    if (existingTeamProfile?.teamId && sameObjectId(existingTeamProfile.teamId, resolvedTeamAccess.team._id)) {
      user.profiles = upsertUserProfile(user, {
        role: targetRole,
        playerType: 'team',
        teamId: resolvedTeamAccess.team._id,
        teamName: resolvedTeamAccess.team.name,
        teamLogo: resolvedTeamAccess.team.logo || '',
        privilegeKey:
          targetRole === 'staff'
            ? existingTeamProfile.privilegeKey || activeProfile.privilegeKey || ''
            : ''
      }) as any;

      applyActiveProfileProjection(user);
      await user.save();

      const { user: updatedUser, accessFlags } = await loadUserWithAccessData(user._id);
      if (!updatedUser) {
        return res.status(404).json({ message: 'Пользователь не найден' });
      }

      return res.json({
        status: 'linked',
        message: 'Team-профиль уже привязан к этой команде',
        targetProfileKey,
        team: nextTeam,
        user: buildUserResponse(updatedUser, accessFlags)
      });
    }

    if (currentTeam?.id && !sameObjectId(currentTeam.id, resolvedTeamAccess.team._id) && !confirmRelink) {
      return res.json({
        status: 'confirmation_required',
        message: `Team-профиль уже привязан к команде «${currentTeam.name || 'Без названия'}». Подтвердите перепривязку к «${nextTeam.name}».`,
        targetProfileKey,
        currentTeam,
        nextTeam
      });
    }

    if (targetRole === 'player') {
      await ensureTeamPlayerCapacity(resolvedTeamAccess.team._id);
    }

    user.profiles = upsertUserProfile(user, {
      role: targetRole,
      playerType: 'team',
      teamId: resolvedTeamAccess.team._id,
      teamName: resolvedTeamAccess.team.name,
      teamLogo: resolvedTeamAccess.team.logo || '',
      privilegeKey:
        targetRole === 'staff'
          ? existingTeamProfile?.privilegeKey || activeProfile.privilegeKey || ''
          : ''
    }) as any;

    applyActiveProfileProjection(user);
    await user.save();

    const { user: updatedUser, accessFlags } = await loadUserWithAccessData(user._id);
    if (!updatedUser) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    return res.json({
      status: 'linked',
      message:
        currentTeam?.id && !sameObjectId(currentTeam.id, resolvedTeamAccess.team._id)
          ? 'Team-профиль успешно перепривязан к новой команде'
          : 'Team-профиль успешно привязан к команде',
      targetProfileKey,
      team: nextTeam,
      user: buildUserResponse(updatedUser, accessFlags)
    });
  } catch (error) {
    console.error('[AuthController] Ошибка привязки team-профиля:', error);
    if (error instanceof Error && error.message === 'Лимит игроков в этой команде уже достигнут') {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({
      message: 'Ошибка при привязке профиля к команде',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
};

export const switchActiveProfile = async (req: any, res: any) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ success: false, message: 'Пользователь не авторизован' });
    }

    const profileKey = normalizeText(req.body?.profileKey);
    if (!profileKey) {
      return res.status(400).json({ success: false, message: 'Не указан profileKey' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }

    const profiles = getUserProfiles(user);
    const nextProfile = profiles.find((profile) => profile.key === profileKey);
    if (!nextProfile) {
      return res.status(404).json({ success: false, message: 'Профиль не найден' });
    }

    user.profiles = profiles as any;
    user.activeProfileKey = nextProfile.key;
    applyActiveProfileProjection(user);
    await user.save();

    const { user: updatedUser, accessFlags } = await loadUserWithAccessData(user._id);
    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }

    return res.json({
      success: true,
      message: `Активный профиль переключен на «${nextProfile.label}»`,
      user: buildUserResponse(updatedUser, accessFlags)
    });
  } catch (error) {
    console.error('[AuthController] Ошибка при переключении профиля:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при переключении профиля',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
};

// Аутентификация пользователя
export const loginUser = async (req: any, res: any) => {
  try {
    console.log('[AuthController] Запрос на вход:', { email: req.body.email });
    
    const email = normalizeEmail(req.body?.email);
    const { password } = req.body || {};
    
    // Проверка на наличие email и пароля
    if (!email || !password) {
      console.log('[AuthController] Ошибка: отсутствует email или пароль');
      return res.status(400).json({ message: 'Необходимо указать email и пароль' });
    }
    
    // Поиск пользователя по email с явным включением пароля
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: 'База данных инициализируется, повторите вход через несколько секунд'
      });
    }

    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      console.log(`[AuthController] Ошибка: пользователь с email ${email} не найден`);
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }
    
    // Проверка пароля
    let isMatch = typeof user.matchPassword === 'function'
      ? await user.matchPassword(password)
      : false;

    // Поддержка legacy-записей: если в старой базе пароль оказался в открытом виде,
    // разрешаем один вход и сразу мигрируем пароль в хэш.
    if (!isMatch && typeof user.password === 'string' && user.password === password) {
      console.warn(`[AuthController] Обнаружен legacy plaintext пароль для ${email}, запускаю миграцию в bcrypt-хэш`);
      user.password = password;
      await user.save();
      isMatch = true;
    }
    
    if (!isMatch) {
      console.log(`[AuthController] Ошибка: неверный пароль для пользователя ${email}`);
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        message: 'Аккаунт заблокирован. Обратитесь к администратору.',
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        message: 'Подтвердите email перед входом в систему',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }
    
    console.log(`[AuthController] Успешный вход пользователя:`, {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });
    
    // Генерация JWT токена
    const token = generateToken(user._id.toString());
    
    const { user: authUser, accessFlags } = await loadUserWithAccessData(user._id);

    res.json({
      token,
      user: buildUserResponse(authUser || user, accessFlags)
    });
    
  } catch (error) {
    console.error('[AuthController] Ошибка входа:', error);
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({
        message: 'База данных временно недоступна. Повторите попытку через несколько секунд.',
        code: 'DB_UNAVAILABLE'
      });
    }
    return res.status(500).json({ 
      message: 'Ошибка сервера при входе',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
};

// Получение данных текущего пользователя
export const getCurrentUser = async (req: any, res: any) => {
  try {
    console.log('[AuthController] Запрос данных текущего пользователя');

    if (!req.user?._id) {
      return res.status(401).json({ message: 'Пользователь не авторизован' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: 'База данных инициализируется, повторите запрос через несколько секунд'
      });
    }
    
    // Получаем актуальную информацию о пользователе из базы данных
    const { user, accessFlags } = await loadUserWithAccessData(req.user._id);
    
    if (!user) {
      console.log('[AuthController] Ошибка: пользователь не найден в базе данных');
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    
    // Логируем данные для отладки
    console.log(`[AuthController] Пользователь найден: ${user.name} (${user._id})`);
    console.log(`[AuthController] Роль: ${user.role}`);
    console.log(`[AuthController] Есть ключ привилегий: ${!!(user.privilegeKey && user.privilegeKey.trim())}`);
    
    res.json(buildUserResponse(user, accessFlags));
  } catch (error) {
    console.error('[AuthController] Ошибка при получении данных текущего пользователя:', error);
    if (isDatabaseUnavailableError(error)) {
      return res.status(503).json({
        message: 'База данных временно недоступна. Повторите попытку через несколько секунд.'
      });
    }
    return res.status(500).json({ 
      message: 'Ошибка сервера при получении данных пользователя',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
}; 
