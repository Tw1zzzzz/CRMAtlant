import mongoose, { Schema, Document } from 'mongoose';

export interface IAnalyticsCache extends Document {
  userId: mongoose.Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  gameType: string;
  stats: {
    totalMatches: number;
    avgElo: number;
    winRate: number;
    [key: string]: any;
  };
  chartsData: Record<string, any>;
  updatedAt: Date;
}

const AnalyticsCacheSchema: Schema = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  periodStart: { 
    type: Date, 
    required: true 
  },
  periodEnd: { 
    type: Date, 
    required: true 
  },
  gameType: {
    type: String,
    default: 'all',
    trim: true,
  },
  stats: {
    totalMatches: { type: Number, default: 0 },
    avgElo: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    // Другие статистические данные могут быть добавлены динамически
  },
  chartsData: {
    type: Schema.Types.Mixed,
    default: {}
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Индекс для быстрого поиска кэша для конкретного пользователя и периода
AnalyticsCacheSchema.index({ userId: 1, periodStart: 1, periodEnd: 1, gameType: 1 });

// TTL-индекс: автоматическое удаление документов, не обновлявшихся более 1 дня
AnalyticsCacheSchema.index({ updatedAt: 1 }, { 
  expireAfterSeconds: 60 * 60 * 24 // 1 день
});

export default mongoose.model<IAnalyticsCache>('AnalyticsCache', AnalyticsCacheSchema); 
