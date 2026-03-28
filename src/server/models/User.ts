import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import type {
  BaselineAnswerInput,
  BaselineRole,
  BaselineRoundStrength,
  BaselineSidePreference,
  BaselinePersonalitySummary
} from '../utils/baselineAssessment';

interface BaselineAssessment {
  completedAt?: Date;
  personality?: {
    answers: BaselineAnswerInput[];
    summary: BaselinePersonalitySummary;
  };
  cs2Role?: {
    primaryRole: BaselineRole;
    secondaryRole?: BaselineRole;
    sidePreference: BaselineSidePreference;
    roundStrength: BaselineRoundStrength;
  };
}

interface UserDocument extends mongoose.Document {
  name: string;
  email: string;
  password: string;
  role: string;
  playerType?: string;
  teamId?: mongoose.Types.ObjectId | null;
  teamName?: string;
  avatar?: string;
  faceitAccountId?: mongoose.Types.ObjectId;
  privilegeKey?: string;
  subscription?: mongoose.Types.ObjectId | null;
  passwordResetTokenHash?: string | null;
  passwordResetExpiresAt?: Date | null;
  passwordChangedAt?: Date | null;
  matchPassword(enteredPassword: string): Promise<boolean>;
  completedTests?: boolean;
  completedBalanceWheel?: boolean;
  baselineAssessment?: BaselineAssessment;
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
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    teamName: {
      type: String,
      default: '',
      trim: true,
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
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      default: null,
    },
    passwordResetTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    passwordResetExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    completedTests: {
      type: Boolean,
      default: false,
    },
    completedBalanceWheel: {
      type: Boolean,
      default: false,
    },
    baselineAssessment: {
      completedAt: {
        type: Date,
        default: null,
      },
      personality: {
        answers: {
          type: [
            {
              questionId: { type: String, required: true },
              optionId: { type: String, required: true }
            }
          ],
          default: []
        },
        summary: {
          archetype: { type: String, default: '' },
          headline: { type: String, default: '' },
          description: { type: String, default: '' },
          styleTags: { type: [String], default: [] },
          axes: {
            tempo: { type: Number, default: 0 },
            communication: { type: Number, default: 0 },
            decisionStyle: { type: Number, default: 0 },
            pressureResponse: { type: Number, default: 0 }
          }
        }
      },
      cs2Role: {
        primaryRole: { type: String, default: '' },
        secondaryRole: { type: String, default: '' },
        sidePreference: { type: String, default: '' },
        roundStrength: { type: String, default: '' }
      }
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
    if (!this.isNew) {
      this.passwordChangedAt = new Date();
    }
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
