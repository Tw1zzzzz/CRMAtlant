import mongoose, { Schema, Document } from 'mongoose';

// Интерфейс для статистики одной стороны (CT или T)
interface SideStats {
  // Общие показатели матчей
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number; // Автоматически рассчитывается

  // Статистика раундов
  totalRounds: number;
  roundsWon: number;
  roundsLost: number;
  roundWinRate: number; // Автоматически рассчитывается
  
  // Средние показатели раундов
  averageRoundsWon: number; // Автоматически рассчитывается
  averageRoundsLost: number; // Автоматически рассчитывается
  
  // Пистолетные раунды
  pistolRounds: number;
  pistolRoundsWon: number;
  pistolWinRate: number; // Автоматически рассчитывается
}

// Основной интерфейс для игровых показателей
export interface IGameStats extends Document {
  userId: mongoose.Types.ObjectId;
  date: Date;
  
  // Общая статистика (суммарная по обеим сторонам)
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number; // Автоматически рассчитывается
  
  // K/D статистика (общая)
  kills: number;
  deaths: number;
  assists: number;
  kdRatio: number; // Автоматически рассчитывается
  
  // Статистика по сторонам
  ctSide: SideStats;
  tSide: SideStats;
  
  // Общая статистика раундов (сумма CT + T)
  totalRounds: number; // Автоматически рассчитывается
  roundsWon: number; // Автоматически рассчитывается
  roundsLost: number; // Автоматически рассчитывается
  roundWinRate: number; // Автоматически рассчитывается
  averageRoundsWon: number; // Автоматически рассчитывается
  averageRoundsLost: number; // Автоматически рассчитывается
  
  // Общая статистика пистолетных раундов
  totalPistolRounds: number; // Автоматически рассчитывается
  pistolRoundsWon: number; // Автоматически рассчитывается
  pistolWinRate: number; // Автоматически рассчитывается
}

// Схема для статистики одной стороны
const SideStatsSchema = new Schema<SideStats>({
  // Общие показатели матчей
  totalMatches: { type: Number, required: true, min: 0, default: 0 },
  wins: { type: Number, required: true, min: 0, default: 0 },
  losses: { type: Number, required: true, min: 0, default: 0 },
  draws: { type: Number, required: true, min: 0, default: 0 },
  winRate: { type: Number, default: 0, min: 0, max: 100 },

  // Статистика раундов
  totalRounds: { type: Number, required: true, min: 0, default: 0 },
  roundsWon: { type: Number, required: true, min: 0, default: 0 },
  roundsLost: { type: Number, required: true, min: 0, default: 0 },
  roundWinRate: { type: Number, default: 0, min: 0, max: 100 },
  
  // Средние показатели раундов
  averageRoundsWon: { type: Number, default: 0, min: 0 },
  averageRoundsLost: { type: Number, default: 0, min: 0 },
  
  // Пистолетные раунды
  pistolRounds: { type: Number, required: true, min: 0, default: 0 },
  pistolRoundsWon: { type: Number, required: true, min: 0, default: 0 },
  pistolWinRate: { type: Number, default: 0, min: 0, max: 100 }
});

// Основная схема игровых показателей
const GameStatsSchema = new Schema<IGameStats>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  
  // Общая статистика
  totalMatches: { type: Number, required: true, min: 0, default: 0 },
  wins: { type: Number, required: true, min: 0, default: 0 },
  losses: { type: Number, required: true, min: 0, default: 0 },
  draws: { type: Number, required: true, min: 0, default: 0 },
  winRate: { type: Number, default: 0, min: 0, max: 100 },
  
  // K/D статистика
  kills: { type: Number, required: true, min: 0, default: 0 },
  deaths: { type: Number, required: true, min: 0, default: 0 },
  assists: { type: Number, required: true, min: 0, default: 0 },
  kdRatio: { type: Number, default: 0, min: 0 },
  
  // Статистика по сторонам
  ctSide: { type: SideStatsSchema, required: true },
  tSide: { type: SideStatsSchema, required: true },
  
  // Общая статистика раундов
  totalRounds: { type: Number, default: 0, min: 0 },
  roundsWon: { type: Number, default: 0, min: 0 },
  roundsLost: { type: Number, default: 0, min: 0 },
  roundWinRate: { type: Number, default: 0, min: 0, max: 100 },
  averageRoundsWon: { type: Number, default: 0, min: 0 },
  averageRoundsLost: { type: Number, default: 0, min: 0 },
  
  // Общая статистика пистолетных раундов
  totalPistolRounds: { type: Number, default: 0, min: 0 },
  pistolRoundsWon: { type: Number, default: 0, min: 0 },
  pistolWinRate: { type: Number, default: 0, min: 0, max: 100 }
}, {
  timestamps: true
});

// Функция для расчета статистики одной стороны
function calculateSideStats(sideStats: SideStats): void {
  // Расчет Win-Rate для матчей
  if (sideStats.totalMatches > 0) {
    sideStats.winRate = Math.round((sideStats.wins / sideStats.totalMatches) * 100 * 100) / 100;
  } else {
    sideStats.winRate = 0;
  }

  // Расчет Win-Rate для раундов
  if (sideStats.totalRounds > 0) {
    sideStats.roundWinRate = Math.round((sideStats.roundsWon / sideStats.totalRounds) * 100 * 100) / 100;
  } else {
    sideStats.roundWinRate = 0;
  }

  // Расчет средних показателей раундов
  if (sideStats.totalMatches > 0) {
    sideStats.averageRoundsWon = Math.round((sideStats.roundsWon / sideStats.totalMatches) * 100) / 100;
    sideStats.averageRoundsLost = Math.round((sideStats.roundsLost / sideStats.totalMatches) * 100) / 100;
  } else {
    sideStats.averageRoundsWon = 0;
    sideStats.averageRoundsLost = 0;
  }

  // Расчет Win-Rate для пистолетных раундов
  if (sideStats.pistolRounds > 0) {
    sideStats.pistolWinRate = Math.round((sideStats.pistolRoundsWon / sideStats.pistolRounds) * 100 * 100) / 100;
  } else {
    sideStats.pistolWinRate = 0;
  }
}

// Middleware для автоматического расчета показателей перед сохранением
GameStatsSchema.pre('save', function(next) {
  // Расчет статистики для каждой стороны
  calculateSideStats(this.ctSide);
  calculateSideStats(this.tSide);

  // Расчет общей статистики матчей
  this.totalMatches = this.ctSide.totalMatches + this.tSide.totalMatches;
  this.wins = this.ctSide.wins + this.tSide.wins;
  this.losses = this.ctSide.losses + this.tSide.losses;
  this.draws = this.ctSide.draws + this.tSide.draws;

  if (this.totalMatches > 0) {
    this.winRate = Math.round((this.wins / this.totalMatches) * 100 * 100) / 100;
  } else {
    this.winRate = 0;
  }

  // Расчет K/D ratio
  if (this.deaths > 0) {
    this.kdRatio = Math.round((this.kills / this.deaths) * 100) / 100;
  } else {
    this.kdRatio = this.kills;
  }

  // Расчет общей статистики раундов
  this.totalRounds = this.ctSide.totalRounds + this.tSide.totalRounds;
  this.roundsWon = this.ctSide.roundsWon + this.tSide.roundsWon;
  this.roundsLost = this.ctSide.roundsLost + this.tSide.roundsLost;

  if (this.totalRounds > 0) {
    this.roundWinRate = Math.round((this.roundsWon / this.totalRounds) * 100 * 100) / 100;
  } else {
    this.roundWinRate = 0;
  }

  if (this.totalMatches > 0) {
    this.averageRoundsWon = Math.round((this.roundsWon / this.totalMatches) * 100) / 100;
    this.averageRoundsLost = Math.round((this.roundsLost / this.totalMatches) * 100) / 100;
  } else {
    this.averageRoundsWon = 0;
    this.averageRoundsLost = 0;
  }

  // Расчет общей статистики пистолетных раундов
  this.totalPistolRounds = this.ctSide.pistolRounds + this.tSide.pistolRounds;
  this.pistolRoundsWon = this.ctSide.pistolRoundsWon + this.tSide.pistolRoundsWon;

  if (this.totalPistolRounds > 0) {
    this.pistolWinRate = Math.round((this.pistolRoundsWon / this.totalPistolRounds) * 100 * 100) / 100;
  } else {
    this.pistolWinRate = 0;
  }

  next();
});

// Создание индексов для оптимизации запросов
GameStatsSchema.index({ userId: 1, date: 1 });
GameStatsSchema.index({ date: 1 });
GameStatsSchema.index({ userId: 1 });

const GameStats = mongoose.model<IGameStats>('GameStats', GameStatsSchema);

export default GameStats;