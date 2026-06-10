import mongoose, { Document, Schema } from 'mongoose';

export type NutritionMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type NutritionQuality = 'good' | 'normal' | 'heavy' | 'skipped';

export interface INutritionEntry extends Document {
  userId: mongoose.Types.ObjectId;
  date: Date;
  time: string;
  mealType: NutritionMealType;
  quality: NutritionQuality;
  satiety: number;
  hydration: number;
  comment?: string;
  photoUrl?: string;
  photoOriginalName?: string;
  photoMimeType?: string;
  photoSize?: number;
}

const NutritionEntrySchema = new Schema<INutritionEntry>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true, index: true },
    time: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/
    },
    mealType: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', 'snack'],
      required: true
    },
    quality: {
      type: String,
      enum: ['good', 'normal', 'heavy', 'skipped'],
      required: true
    },
    satiety: { type: Number, required: true, min: 1, max: 5 },
    hydration: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', maxlength: 500 },
    photoUrl: { type: String, default: '' },
    photoOriginalName: { type: String, default: '', maxlength: 255 },
    photoMimeType: { type: String, default: '' },
    photoSize: { type: Number, default: 0 }
  },
  { timestamps: true }
);

NutritionEntrySchema.index({ userId: 1, date: 1, mealType: 1, time: 1 });
NutritionEntrySchema.index({ date: 1, mealType: 1 });

const NutritionEntry = mongoose.model<INutritionEntry>('NutritionEntry', NutritionEntrySchema);

export default NutritionEntry;
