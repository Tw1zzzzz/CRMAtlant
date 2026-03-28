import mongoose from 'mongoose';

export interface TeamDocument extends mongoose.Document {
  name: string;
  createdBy: mongoose.Types.ObjectId;
  playerLimit: number;
  playerInviteCodeHash: string;
  staffInviteCodeHash: string;
  playerInviteCodeUpdatedAt: Date;
  staffInviteCodeUpdatedAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const teamSchema = new mongoose.Schema<TeamDocument>(
  {
    name: {
      type: String,
      required: [true, 'Название команды обязательно'],
      trim: true,
      maxlength: [80, 'Название команды должно быть не длиннее 80 символов'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    playerLimit: {
      type: Number,
      default: 7,
      min: 1,
      max: 50,
    },
    playerInviteCodeHash: {
      type: String,
      required: true,
      select: false,
    },
    staffInviteCodeHash: {
      type: String,
      required: true,
      select: false,
    },
    playerInviteCodeUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    staffInviteCodeUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

teamSchema.index({ name: 1, createdBy: 1 }, { unique: true });

const Team = mongoose.model<TeamDocument>('Team', teamSchema);

export default Team;
