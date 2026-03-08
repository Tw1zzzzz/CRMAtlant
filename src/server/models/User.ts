import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

interface UserDocument extends mongoose.Document {
  name: string;
  email: string;
  password: string;
  role: string;
  playerType?: string;
  avatar?: string;
  faceitAccountId?: mongoose.Types.ObjectId;
  privilegeKey?: string;
  matchPassword(enteredPassword: string): Promise<boolean>;
  completedTests?: boolean;
  completedBalanceWheel?: boolean;
  _updateTimestamp?: number;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Имя обязательно"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email обязателен"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Введите корректный email",
      ],
    },
    password: {
      type: String,
      required: [true, "Пароль обязателен"],
      minlength: [6, "Пароль должен быть не менее 6 символов"],
      select: false, // Не включать пароль при запросах по умолчанию
    },
    role: {
      type: String,
      enum: ["player", "staff"],
      default: "player",
    },
    playerType: {
      type: String,
      enum: ["solo", "team"],
      default: "team",
    },
    avatar: {
      type: String,
      default: "",
    },
    faceitAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FaceitAccount',
      default: null
    },
    privilegeKey: {
      type: String,
      default: "",
    },
    completedTests: {
      type: Boolean,
      default: false,
    },
    completedBalanceWheel: {
      type: Boolean,
      default: false,
    },
    _updateTimestamp: {
      type: Number,
      default: () => Date.now()
    },
  },
  {
    timestamps: true,
  }
);

// Хеширование пароля перед сохранением
userSchema.pre("save", async function (next) {
  try {
    console.log('[User Model] Хеширование пароля при сохранении');
    
    // Проверяем, существует ли this и был ли пароль изменен
    if (!this.isModified("password")) {
      console.log('[User Model] Пароль не был изменен, пропускаем хеширование');
      return next();
    }
    
    // Проверка наличия пароля
    if (!this.password) {
      console.error('[User Model] Отсутствует пароль для хеширования');
      return next(new Error('Пароль не указан'));
    }
    
    // Хеширование пароля
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    console.log('[User Model] Пароль успешно хеширован');
    next();
  } catch (error) {
    console.error('[User Model] Ошибка при хешировании пароля:', error);
    next(error as Error);
  }
});

// Метод для сравнения паролей
userSchema.methods.matchPassword = async function (enteredPassword: string): Promise<boolean> {
  try {
    console.log('[User Model] Сравнение паролей');
    
    // Проверка наличия пароля
    if (!this.password || !enteredPassword) {
      console.error('[User Model] Отсутствует пароль для сравнения');
      return false;
    }
    
    const isMatch = await bcrypt.compare(enteredPassword, this.password);
    console.log(`[User Model] Результат сравнения паролей: ${isMatch ? 'успешно' : 'не совпадает'}`);
    return isMatch;
  } catch (error) {
    console.error('[User Model] Ошибка при сравнении паролей:', error);
    return false;
  }
};

// Создаем и экспортируем модель
const User = mongoose.model<UserDocument>("User", userSchema);

export default User; 
