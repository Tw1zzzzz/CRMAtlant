import mongoose from 'mongoose';

export type CalendarEventScope = 'personal' | 'team';

export interface CalendarEventDocument extends mongoose.Document {
  title: string;
  description?: string;
  location?: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  color: string;
  scope: CalendarEventScope;
  ownerUserId?: mongoose.Types.ObjectId | null;
  teamId?: mongoose.Types.ObjectId | null;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const calendarEventSchema = new mongoose.Schema<CalendarEventDocument>(
  {
    title: {
      type: String,
      required: [true, 'Название события обязательно'],
      trim: true,
      maxlength: [160, 'Название события должно быть не длиннее 160 символов'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [4000, 'Описание события должно быть не длиннее 4000 символов'],
    },
    location: {
      type: String,
      default: '',
      trim: true,
      maxlength: [240, 'Место события должно быть не длиннее 240 символов'],
    },
    startAt: {
      type: Date,
      required: [true, 'Время начала обязательно'],
    },
    endAt: {
      type: Date,
      required: [true, 'Время окончания обязательно'],
    },
    allDay: {
      type: Boolean,
      default: false,
    },
    color: {
      type: String,
      default: '#3590FF',
      trim: true,
    },
    scope: {
      type: String,
      enum: ['personal', 'team'],
      required: true,
      index: true,
    },
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      required: function (this: CalendarEventDocument) {
        return this.scope === 'personal';
      },
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
      required: function (this: CalendarEventDocument) {
        return this.scope === 'team';
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

calendarEventSchema.index({ scope: 1, ownerUserId: 1, startAt: 1, endAt: 1 });
calendarEventSchema.index({ scope: 1, teamId: 1, startAt: 1, endAt: 1 });

calendarEventSchema.pre('validate', function (next) {
  if (this.scope === 'personal') {
    this.teamId = null;
  }

  if (this.scope === 'team') {
    this.ownerUserId = null;
  }

  if (!(this.startAt instanceof Date) || Number.isNaN(this.startAt.getTime())) {
    return next(new Error('Некорректная дата начала события'));
  }

  if (!(this.endAt instanceof Date) || Number.isNaN(this.endAt.getTime())) {
    return next(new Error('Некорректная дата окончания события'));
  }

  if (this.startAt.getTime() >= this.endAt.getTime()) {
    return next(new Error('Дата окончания должна быть позже даты начала'));
  }

  return next();
});

const CalendarEvent =
  mongoose.models.CalendarEvent ||
  mongoose.model<CalendarEventDocument>('CalendarEvent', calendarEventSchema);

export default CalendarEvent;
