import mongoose, { Document, Schema } from 'mongoose';

/**
 * Интерфейс для экранного времени игрока
 */
export interface IScreenTime extends Document {
  userId: mongoose.Types.ObjectId;
  date: Date;
  totalTime: number; // Общее время за экраном
  entertainment: number; // Развлечения (игры, видео, фильмы)
  communication: number; // Общение (соцсети, мессенджеры, звонки)
  browser: number; // Браузер (серфинг, новости, покупки)
  study: number; // Учеба (курсы, обучающие материалы, работа)
  calculatedTotal: number; // Автоматически рассчитанная сумма
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Схема для экранного времени
 */
const ScreenTimeSchema = new Schema<IScreenTime>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  totalTime: {
    type: Number,
    required: true,
    min: 0,
    max: 24,
    default: 0
  },
  entertainment: {
    type: Number,
    required: true,
    min: 0,
    max: 24,
    default: 0
  },
  communication: {
    type: Number,
    required: true,
    min: 0,
    max: 24,
    default: 0
  },
  browser: {
    type: Number,
    required: true,
    min: 0,
    max: 24,
    default: 0
  },
  study: {
    type: Number,
    required: true,
    min: 0,
    max: 24,
    default: 0
  },
  calculatedTotal: {
    type: Number,
    required: true,
    min: 0,
    max: 24,
    default: 0
  }
}, {
  timestamps: true,
  collection: 'screentimes'
});

// Индексы для оптимизации запросов
ScreenTimeSchema.index({ userId: 1, date: 1 }, { unique: true });
ScreenTimeSchema.index({ date: 1 });

// Middleware для автоматического расчета суммы категорий
ScreenTimeSchema.pre('save', function(next) {
  this.calculatedTotal = this.entertainment + this.communication + this.browser + this.study;
  next();
});

/**
 * Модель экранного времени
 */
const ScreenTime = mongoose.model<IScreenTime>('ScreenTime', ScreenTimeSchema);

export default ScreenTime; 