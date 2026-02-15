import jwt from 'jsonwebtoken';
import User from '../models/User';

// Генерация JWT токена
const generateToken = (id: string): string => {
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  return jwt.sign({ id }, secret, {
    expiresIn: '30d'
  });
};

// Регистрация нового пользователя
export const registerUser = async (req: any, res: any) => {
  try {
    console.log('[AuthController] Запрос на регистрацию:', {
      email: req.body.email,
      name: req.body.name,
      role: req.body.role
    });
    
    const { name, email, password, role = 'player' } = req.body;
    
    // Улучшенная валидация входных данных
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
        message: 'Пароль должен быть не менее 6 символов' 
      });
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
      return res.status(500).json({ 
        message: 'Ошибка при проверке существования пользователя',
        error: findError instanceof Error ? findError.message : 'Неизвестная ошибка'
      });
    }
    
    console.log('[AuthController] Создание нового пользователя');
    
    try {
      // Проверка допустимости роли - строго только "player" или "staff"
      const validRoles = ['player', 'staff'];
      if (!validRoles.includes(role)) {
        console.log(`[AuthController] Недопустимая роль: ${role}, используем 'player' по умолчанию`);
      }
      const finalRole = validRoles.includes(role) ? role : 'player';
      
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
        role: finalRole
      };
      
      console.log(`[AuthController] Попытка создания пользователя с данными:`, {
        name: userData.name,
        email: userData.email,
        role: userData.role,
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
        console.log(`[AuthController] Пользователь создан успешно:`, {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        });
        
        // Генерация JWT токена
        const token = generateToken(user._id.toString());
        
        res.status(201).json({
          token,
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            createdAt: user.createdAt
          }
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

// Аутентификация пользователя
export const loginUser = async (req: any, res: any) => {
  try {
    console.log('[AuthController] Запрос на вход:', { email: req.body.email });
    
    const { email, password } = req.body;
    
    // Проверка на наличие email и пароля
    if (!email || !password) {
      console.log('[AuthController] Ошибка: отсутствует email или пароль');
      return res.status(400).json({ message: 'Необходимо указать email и пароль' });
    }
    
    // Поиск пользователя по email с явным включением пароля
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      console.log(`[AuthController] Ошибка: пользователь с email ${email} не найден`);
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }
    
    // Проверка пароля
    const isMatch = await user.matchPassword(password);
    
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
    
    // Возвращаем данные пользователя (без пароля)
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      createdAt: user.createdAt
    };
    
    res.json({
      token,
      user: userResponse
    });
    
  } catch (error) {
    console.error('[AuthController] Ошибка входа:', error);
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
    
    // Получаем актуальную информацию о пользователе из базы данных
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      console.log('[AuthController] Ошибка: пользователь не найден в базе данных');
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    
    // Логируем данные для отладки
    console.log(`[AuthController] Пользователь найден: ${user.name} (${user._id})`);
    console.log(`[AuthController] Роль: ${user.role}`);
    console.log(`[AuthController] Есть ключ привилегий: ${!!(user.privilegeKey && user.privilegeKey.trim())}`);
    
    res.json(user);
  } catch (error) {
    console.error('[AuthController] Ошибка при получении данных текущего пользователя:', error);
    return res.status(500).json({ 
      message: 'Ошибка сервера при получении данных пользователя',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
}; 