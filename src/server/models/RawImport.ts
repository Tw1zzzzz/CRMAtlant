import mongoose, { Schema, Document } from 'mongoose';

export interface IRawImport extends Document {
  uploadedBy: mongoose.Types.ObjectId | null;
  uploadedAt: Date;
  kind: 'cs2_excel';
  mode: 'team' | 'player';
  fileName: string;
  filePath: string;
  inferredDate: Date | null;
  report: {
    totalRows: number;
    okRows: number;
    rejectedRows: number;
    errorsSample: Array<{ row: number; nickname?: string; reason: string }>;
  };
}

const RawImportSchema = new Schema<IRawImport>(
  {
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    uploadedAt: { type: Date, default: Date.now },
    kind: { type: String, enum: ['cs2_excel'], required: true },
    mode: { type: String, enum: ['team', 'player'], required: true },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    inferredDate: { type: Date, default: null },
    report: {
      totalRows: { type: Number, required: true, default: 0 },
      okRows: { type: Number, required: true, default: 0 },
      rejectedRows: { type: Number, required: true, default: 0 },
      errorsSample: { type: Array, default: [] }
    }
  },
  { timestamps: false }
);

RawImportSchema.index({ kind: 1, uploadedAt: -1 });

const RawImport = mongoose.model<IRawImport>('RawImport', RawImportSchema);
export default RawImport;

