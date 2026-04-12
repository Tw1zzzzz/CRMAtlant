import mongoose from 'mongoose';

export type AdminAuditAction =
  | 'grant_superadmin'
  | 'grant_user_subscription'
  | 'grant_team_subscription'
  | 'send_password_reset'
  | 'block_user'
  | 'unblock_user';

export interface AdminAuditLogDocument extends mongoose.Document {
  actorUserId?: mongoose.Types.ObjectId | null;
  targetUserId?: mongoose.Types.ObjectId | null;
  targetTeamId?: mongoose.Types.ObjectId | null;
  action: AdminAuditAction;
  meta?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const adminAuditLogSchema = new mongoose.Schema<AdminAuditLogDocument>(
  {
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    targetTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
      index: true,
    },
    action: {
      type: String,
      enum: [
        'grant_superadmin',
        'grant_user_subscription',
        'grant_team_subscription',
        'send_password_reset',
        'block_user',
        'unblock_user',
      ],
      required: true,
      index: true,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const AdminAuditLog =
  mongoose.models.AdminAuditLog ||
  mongoose.model<AdminAuditLogDocument>('AdminAuditLog', adminAuditLogSchema);

export default AdminAuditLog;
