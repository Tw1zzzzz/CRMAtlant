import mongoose from 'mongoose';

/**
 * Enum для статуса отчета
 */
export enum ReportStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived'
}

/**
 * Enum для уровня видимости отчета
 */
export enum ReportVisibility {
  PUBLIC = 'public',      // Все игроки видят
  TEAM = 'team',          // Только команда
  STAFF = 'staff',        // Только персонал
  PRIVATE = 'private'     // Только создатель
}

/**
 * Enum для типа отчета
 */
export enum ReportType {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  MATCH_ANALYSIS = 'match_analysis',
  TRAINING = 'training',
  PERFORMANCE = 'performance',
  CUSTOM = 'custom'
}

/**
 * Интерфейс для структурированного контента отчета
 */
export interface ReportContent {
  sections: {
    title: string;
    content: string;
    order: number;
    type: 'text' | 'markdown' | 'chart' | 'table';
  }[];
  attachments?: {
    filename: string;
    path: string;
    mimetype: string;
    size: number;
  }[];
  summary?: string;
  details?: string;
  recommendations?: string[];
  tags?: string[];
}

/**
 * Интерфейс для метаданных корреляции
 */
export interface CorrelationMetadata {
  includedMetrics: string[];
  dateRange: {
    start: Date;
    end: Date;
  };
  playerIds?: mongoose.Types.ObjectId[];
  analysisType: 'correlation' | 'temporal' | 'comparative';
  correlationResults?: {
    metric1: string;
    metric2: string;
    correlation: number;
    significance: number;
  }[];
}

/**
 * Интерфейс для документа TeamReport
 */
interface TeamReportDocument extends mongoose.Document {
  title: string;
  description?: string;
  content: ReportContent;
  type: ReportType;
  status: ReportStatus;
  visibility: ReportVisibility;
  
  // Авторизация и доступ
  createdBy: mongoose.Types.ObjectId;
  assignedTo?: mongoose.Types.ObjectId[];
  viewableBy?: mongoose.Types.ObjectId[];
  
  // Метаданные корреляции
  correlationMetadata?: CorrelationMetadata;
  
  // Временные метки
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  archivedAt?: Date;
  
  // Системные поля
  version: number;
  isDeleted: boolean;

  canBeViewedBy(userId: mongoose.Types.ObjectId): boolean;
  canBeEditedBy(userId: mongoose.Types.ObjectId): boolean;
  softDelete(): Promise<TeamReportDocument>;
}

/**
 * Схема для содержимого отчета
 */
const reportContentSchema = new mongoose.Schema({
  sections: [{
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    content: {
      type: String,
      required: true,
      maxlength: 10000
    },
    order: {
      type: Number,
      required: true,
      min: 0
    },
    type: {
      type: String,
      enum: ['text', 'markdown', 'chart', 'table'],
      default: 'text'
    }
  }],
  attachments: [{
    filename: {
      type: String,
      required: true,
      trim: true
    },
    path: {
      type: String,
      required: true
    },
    mimetype: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true,
      min: 0,
      max: 50 * 1024 * 1024 // 50MB максимум
    }
  }],
  summary: {
    type: String,
    maxlength: 1000,
    trim: true
  },
  details: {
    type: String,
    maxlength: 5000,
    trim: true
  },
  recommendations: [{
    type: String,
    trim: true,
    maxlength: 500
  }],
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 50
  }]
}, { _id: false });

/**
 * Схема для метаданных корреляции
 */
const CorrelationMetadataSchema = new mongoose.Schema({
  includedMetrics: [{
    type: String,
    required: true,
    enum: ['mood', 'energy', 'balance_wheel', 'test_results', 'faceit_stats', 'match_performance']
  }],
  dateRange: {
    start: {
      type: Date,
      required: true
    },
    end: {
      type: Date,
      required: true,
      validate: {
        validator: function(this: any, value: Date) {
          return value > this.dateRange.start;
        },
        message: 'Дата окончания должна быть позже даты начала'
      }
    }
  },
  playerIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  analysisType: {
    type: String,
    enum: ['correlation', 'temporal', 'comparative'],
    required: true
  },
  correlationResults: [{
    metric1: {
      type: String,
      required: true
    },
    metric2: {
      type: String,
      required: true
    },
    correlation: {
      type: Number,
      required: true,
      min: -1,
      max: 1
    },
    significance: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    }
  }]
}, { _id: false });

/**
 * Основная схема TeamReport
 */
const teamReportSchema = new mongoose.Schema<TeamReportDocument>({
  title: {
    type: String,
    required: [true, 'Название отчета обязательно'],
    trim: true,
    minlength: [3, 'Название должно содержать минимум 3 символа'],
    maxlength: [200, 'Название не может превышать 200 символов'],
    index: true
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Описание не может превышать 1000 символов']
  },
  
  content: {
    type: reportContentSchema,
    required: [true, 'Содержимое отчета обязательно'],
    validate: {
      validator: function(value: ReportContent) {
        return value.sections && value.sections.length > 0;
      },
      message: 'Отчет должен содержать хотя бы одну секцию'
    }
  },
  
  type: {
    type: String,
    enum: {
      values: Object.values(ReportType),
      message: 'Недопустимый тип отчета: {VALUE}'
    },
    required: [true, 'Тип отчета обязателен'],
    index: true
  },
  
  status: {
    type: String,
    enum: {
      values: Object.values(ReportStatus),
      message: 'Недопустимый статус: {VALUE}'
    },
    default: ReportStatus.DRAFT,
    index: true
  },
  
  visibility: {
    type: String,
    enum: {
      values: Object.values(ReportVisibility),
      message: 'Недопустимый уровень видимости: {VALUE}'
    },
    default: ReportVisibility.TEAM,
    index: true
  },
  
  // Авторизация и доступ
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Создатель отчета обязателен'],
    index: true
  },
  
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  viewableBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Метаданные корреляции (опционально)
  correlationMetadata: {
    type: CorrelationMetadataSchema,
    default: undefined
  },
  
  // Дополнительные временные метки
  publishedAt: {
    type: Date,
    index: true
  },
  
  archivedAt: {
    type: Date,
    index: true
  },
  
  // Системные поля
  version: {
    type: Number,
    default: 1,
    min: 1
  },
  
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true, // Автоматически добавляет createdAt и updatedAt
  collection: 'teamreports',
  
  // Настройки для JSON сериализации
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  },
  
  toObject: {
    virtuals: true
  }
});

/**
 * Индексы для оптимизации запросов
 */
// Составной индекс для поиска по статусу и видимости
teamReportSchema.index({ status: 1, visibility: 1 });

// Составной индекс для поиска по создателю и дате
teamReportSchema.index({ createdBy: 1, createdAt: -1 });

// Составной индекс для поиска по типу и дате
teamReportSchema.index({ type: 1, createdAt: -1 });

// Текстовый индекс для поиска
teamReportSchema.index({ 
  title: 'text', 
  description: 'text', 
  'content.summary': 'text',
  'content.tags': 'text'
}, {
  weights: {
    title: 10,
    description: 5,
    'content.summary': 3,
    'content.tags': 1
  },
  name: 'report_text_index'
});

/**
 * Виртуальные поля
 */
teamReportSchema.virtual('isPublished').get(function() {
  return this.status === ReportStatus.PUBLISHED;
});

teamReportSchema.virtual('isArchived').get(function() {
  return this.status === ReportStatus.ARCHIVED;
});

teamReportSchema.virtual('daysSinceCreated').get(function() {
  return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24));
});

/**
 * Middleware: pre-save валидация
 */
teamReportSchema.pre('save', function(next) {
  // Автоматически устанавливаем publishedAt при публикации
  if (this.isModified('status') && this.status === ReportStatus.PUBLISHED && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  // Автоматически устанавливаем archivedAt при архивации
  if (this.isModified('status') && this.status === ReportStatus.ARCHIVED && !this.archivedAt) {
    this.archivedAt = new Date();
  }
  
  // Увеличиваем версию при изменении содержимого
  if (this.isModified('content') && !this.isNew) {
    this.version += 1;
  }
  
  // Валидация метаданных корреляции
  if (this.correlationMetadata) {
    const metadata = this.correlationMetadata;
    if (metadata.dateRange.start >= metadata.dateRange.end) {
      return next(new Error('Дата начала должна быть раньше даты окончания'));
    }
    
    if (metadata.includedMetrics.length === 0) {
      return next(new Error('Должна быть включена хотя бы одна метрика'));
    }
  }
  
  next();
});

/**
 * Статические методы
 */
teamReportSchema.statics.findPublished = function() {
  return this.find({ 
    status: ReportStatus.PUBLISHED, 
    isDeleted: false 
  }).sort({ publishedAt: -1 });
};

teamReportSchema.statics.findByType = function(type: ReportType) {
  return this.find({ 
    type, 
    isDeleted: false 
  }).sort({ createdAt: -1 });
};

teamReportSchema.statics.findViewableBy = function(userId: mongoose.Types.ObjectId) {
  return this.find({
    $or: [
      { visibility: ReportVisibility.PUBLIC },
      { createdBy: userId },
      { assignedTo: userId },
      { viewableBy: userId }
    ],
    isDeleted: false
  }).sort({ createdAt: -1 });
};

/**
 * Методы экземпляра
 */
teamReportSchema.methods.canBeViewedBy = function(userId: mongoose.Types.ObjectId): boolean {
  // Создатель всегда может просматривать
  if (this.createdBy.equals(userId)) {
    return true;
  }
  
  // Проверяем уровень видимости
  switch (this.visibility) {
    case ReportVisibility.PUBLIC:
      return true;
    case ReportVisibility.PRIVATE:
      return false;
    case ReportVisibility.TEAM:
    case ReportVisibility.STAFF:
      return this.assignedTo?.some((id: mongoose.Types.ObjectId) => id.equals(userId)) ||
             this.viewableBy?.some((id: mongoose.Types.ObjectId) => id.equals(userId)) ||
             false;
    default:
      return false;
  }
};

teamReportSchema.methods.canBeEditedBy = function(userId: mongoose.Types.ObjectId): boolean {
  // Только создатель может редактировать
  return this.createdBy.equals(userId);
};

teamReportSchema.methods.softDelete = function(): Promise<TeamReportDocument> {
  this.isDeleted = true;
  this.archivedAt = new Date();
  return this.save();
};

/**
 * Экспорт модели
 */
const TeamReport = mongoose.model<TeamReportDocument>('TeamReport', teamReportSchema);
export default TeamReport; 