import mongoose from 'mongoose';

export type SubscriptionStatus = 'pending' | 'active' | 'expired' | 'cancelled';

export interface SubscriptionDocument extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  status: SubscriptionStatus;
  startedAt: Date | null;
  expiresAt: Date | null;
  robokassaInvoiceId: string;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new mongoose.Schema<SubscriptionDocument>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'expired', 'cancelled'],
      default: 'pending',
      index: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    robokassaInvoiceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const Subscription =
  mongoose.models.Subscription || mongoose.model<SubscriptionDocument>('Subscription', subscriptionSchema);

export default Subscription;
