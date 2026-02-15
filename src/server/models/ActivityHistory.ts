import mongoose, { Schema, Document } from 'mongoose';

export interface ActivityHistoryDocument extends Document {
  userId: mongoose.Types.ObjectId;
  action: string;
  entityType: string;
  entityId?: mongoose.Types.ObjectId;
  details?: any;
  timestamp: Date;
}

const ActivityHistorySchema: Schema = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  action: { 
    type: String, 
    required: true,
    enum: ['create', 'update', 'delete', 'login', 'logout', 'test_complete', 'mood_track', 'file_upload', 'balance_wheel']
  },
  entityType: { 
    type: String, 
    required: true,
    enum: ['user', 'mood', 'test', 'file', 'balance_wheel', 'system']
  },
  entityId: { 
    type: Schema.Types.ObjectId,
    default: null
  },
  details: {
    type: Schema.Types.Mixed,
    default: {}
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: false });

// Создание индекса для быстрой выборки по пользователю и времени
ActivityHistorySchema.index({ userId: 1, timestamp: -1 });
ActivityHistorySchema.index({ timestamp: -1 });

const ActivityHistory = mongoose.model<ActivityHistoryDocument>('ActivityHistory', ActivityHistorySchema);

export default ActivityHistory; 