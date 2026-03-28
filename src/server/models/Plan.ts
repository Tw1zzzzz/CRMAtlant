import mongoose from 'mongoose';

export interface PlanDocument extends mongoose.Document {
  name: string;
  price: number;
  periodDays: number;
  features: string[];
  isActive: boolean;
  robokassaEncodedInvoiceId: string;
  createdAt: Date;
  updatedAt: Date;
}

const planSchema = new mongoose.Schema<PlanDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    periodDays: {
      type: Number,
      required: true,
      min: 1,
    },
    features: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    robokassaEncodedInvoiceId: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Plan = mongoose.models.Plan || mongoose.model<PlanDocument>('Plan', planSchema);

export default Plan;
