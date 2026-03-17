import mongoose, { Schema, Document } from 'mongoose';

export interface IFaceitAccount extends Document {
  userId: mongoose.Types.ObjectId;
  faceitId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  createdAt: Date;
}

const FaceitAccountSchema: Schema = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  faceitId: { 
    type: String, 
    required: true 
  },
  accessToken: {
    type: String,
    default: ''
  },
  refreshToken: {
    type: String,
    default: ''
  },
  tokenExpiresAt: {
    type: Date,
    default: () => new Date('2100-01-01T00:00:00.000Z')
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Создание индексов для быстрой выборки
FaceitAccountSchema.index({ faceitId: 1 });
FaceitAccountSchema.index({ userId: 1 });

export default mongoose.model<IFaceitAccount>('FaceitAccount', FaceitAccountSchema); 