import mongoose, { Schema, Document } from 'mongoose';

export interface IPlayerCard extends Document {
  userId: mongoose.Types.ObjectId;
  contacts: {
    vk: string;
    telegram: string;
    faceit: string;
    steam: string;
    nickname: string;
  };
  roadmap: string; // путь к изображению
  mindmap: string; // путь к изображению
  communicationLine: string; // текст коммуникативной линии
  communicationImage: string; // путь к изображению коммуникативной линии
  updatedAt: Date;
}

const PlayerCardSchema: Schema = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true,
    unique: true
  },
  contacts: {
    vk: { type: String, default: '' },
    telegram: { type: String, default: '' },
    faceit: { type: String, default: '' },
    steam: { type: String, default: '' },
    nickname: { type: String, default: '' }
  },
  roadmap: { 
    type: String, 
    default: '' 
  },
  mindmap: { 
    type: String, 
    default: '' 
  },
  communicationLine: {
    type: String,
    default: ''
  },
  communicationImage: {
    type: String,
    default: ''
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

export default mongoose.model<IPlayerCard>('PlayerCard', PlayerCardSchema); 