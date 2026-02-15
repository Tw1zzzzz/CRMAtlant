import mongoose, { Schema, Document } from 'mongoose';

export interface ISleepEntry extends Document {
  userId: mongoose.Types.ObjectId;
  date: Date;
  hours: number; // 0..24
  comment?: string;
}

const SleepEntrySchema = new Schema<ISleepEntry>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true, index: true },
    hours: { type: Number, required: true, min: 0, max: 24 },
    comment: { type: String, default: '' }
  },
  { timestamps: true }
);

SleepEntrySchema.index({ userId: 1, date: 1 }, { unique: true });

const SleepEntry = mongoose.model<ISleepEntry>('SleepEntry', SleepEntrySchema);
export default SleepEntry;

