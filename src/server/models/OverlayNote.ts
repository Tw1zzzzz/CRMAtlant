import mongoose from 'mongoose';

export interface OverlayNoteDocument extends mongoose.Document {
 userId: mongoose.Types.ObjectId;
 title: string;
 content: string;
 gameId?: number | null;
 position: {
  x: number;
  y: number;
 };
 size: {
  width: number;
  height: number;
 };
 opacity: number;
 pinned: boolean;
 createdAt: Date;
 updatedAt: Date;
}

const overlayNoteSchema = new mongoose.Schema<OverlayNoteDocument>(
 {
  userId: {
   type: mongoose.Schema.Types.ObjectId,
   ref: 'User',
   required: true,
   index: true,
  },
  title: {
   type: String,
   default: '',
   trim: true,
   maxlength: [120, 'Name заметки должно быть не длиннее 120 символов'],
  },
  content: {
   type: String,
   default: '',
   maxlength: [12000, 'Текст заметки должен быть не длиннее 12000 символов'],
  },
  gameId: {
   type: Number,
   default: null,
   index: true,
  },
  position: {
   x: {
    type: Number,
    default: 24,
    min: 0,
    max: 10000,
   },
   y: {
    type: Number,
    default: 24,
    min: 0,
    max: 10000,
   },
  },
  size: {
   width: {
    type: Number,
    default: 420,
    min: 260,
    max: 1400,
   },
   height: {
    type: Number,
    default: 320,
    min: 220,
    max: 1200,
   },
  },
  opacity: {
   type: Number,
   default: 0.88,
   min: 0.25,
   max: 1,
  },
  pinned: {
   type: Boolean,
   default: true,
  },
 },
 {
  timestamps: true,
 }
);

overlayNoteSchema.index({ userId: 1, updatedAt: -1 });
overlayNoteSchema.index({ userId: 1, gameId: 1, updatedAt: -1 });

const OverlayNote =
 mongoose.models.OverlayNote ||
 mongoose.model<OverlayNoteDocument>('OverlayNote', overlayNoteSchema);

export default OverlayNote;
