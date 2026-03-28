import User from '../models/User';
import Subscription from '../models/Subscription';
import Team from '../models/Team';
import PlayerCard from '../models/PlayerCard';
import FaceitAccount from '../models/FaceitAccount';
import { sendPasswordResetEmail } from '../services/mailService';
import faceitService, { FaceitProfileInfo } from '../services/faceitService';
import { createOpaqueToken, hashOpaqueToken } from '../utils/securityTokens';
import { signJwt } from '../utils/jwt';
import { buildSubscriptionSummary, buildSubscriptionAccessFlags, hasPerformanceCoachCrmAccess } from '../utils/subscriptionAccess';
import mongoose from 'mongoose';

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

const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const isFaceitLink = (value: string): boolean => /^https?:\/\/(www\.)?faceit\.com\//i.test(value);
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

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

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    playerType: user.playerType,
    teamId: user.teamId || null,
    teamName: user.teamName || '',
    avatar: user.avatar,
    privilegeKey: user.privilegeKey,
    staffHasPrivilegeKey: Boolean(user.role === 'staff' && typeof user.privilegeKey === 'string' && user.privilegeKey.trim()),
    subscription,
    hasPerformanceCoachCrmAccess: accessFlags.hasPerformanceCoachCrmAccess || hasPerformanceCoachCrmAccess(subscription),
    hasCorrelationAnalysisAccess: accessFlags.hasCorrelationAnalysisAccess,
    hasGameStatsAccess: accessFlags.hasGameStatsAccess,
    completedTests: user.completedTests,
    completedBalanceWheel: user.completedBalanceWheel,
    createdAt: user.createdAt,
    baselineAssessmentCompleted,
    baselineAssessment: user.baselineAssessment || null
  };
};

const loadUserWithAccessData = async (userId: mongoose.Types.ObjectId | string) => {
  const [user, activeSubscriptions] = await Promise.all([
    User.findById(userId)
      .select('-password')
      .populate({
        path: 'subscription',
        populate: {
          path: 'planId',
          model: 'Plan',
        },
      }),
    Subscription.find({
      userId,
      status: 'active',
      expiresAt: { $gt: new Date() },
    }).populate('planId'),
  ]);

  const accessFlags = buildSubscriptionAccessFlags(
    activeSubscriptions.map((subscription) => buildSubscriptionSummary(subscription))
  );

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
    '+playerInviteCodeHash +staffInviteCodeHash name playerLimit isActive'
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

const getResetPasswordUrl = (token: string): string => {
  const clientUrl = normalizeText(process.env.CLIENT_URL);
  if (!clientUrl) {
    throw new Error('CLIENT_URL не настроен');
  }

  return `${clientUrl.replace(/\/+$/g, '')}/reset-password?token=${encodeURIComponent(token)}`;
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
    let teamAssignment: { teamId: mongoose.Types.ObjectId; teamName: string } | null = null;

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

      const userData = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role: finalRole,
        playerType: finalPlayerType,
        ...(teamAssignment
          ? {
              teamId: teamAssignment.teamId,
              teamName: teamAssignment.teamName,
            }
          : {}),
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
        
        // Генерация JWT токена
        const token = generateToken(user._id.toString());
        
        res.status(201).json({
          token,
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

    const resetToken = createOpaqueToken(24);
    const resetTokenHash = hashOpaqueToken(resetToken);
    const resetExpiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetTokenHash: resetTokenHash,
          passwordResetExpiresAt: resetExpiresAt,
        },
      }
    );

    try {
      await sendPasswordResetEmail({
        email: user.email,
        name: user.name,
        resetUrl: getResetPasswordUrl(resetToken),
      });
    } catch (mailError) {
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            passwordResetTokenHash: null,
            passwordResetExpiresAt: null,
          },
        }
      );

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
