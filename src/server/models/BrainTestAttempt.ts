import mongoose from 'mongoose';

const brainTestAttemptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    batterySessionId: {
      type: String,
      trim: true,
      index: true
    },
    testKey: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    domain: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['in_progress', 'completed', 'abandoned'],
      default: 'in_progress',
      required: true
    },
    seed: {
      type: String,
      trim: true
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    completedAt: {
      type: Date
    },
    durationMs: {
      type: Number,
      min: 0
    },
    rawMetrics: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    derivedMetrics: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    rawCompositeScore: {
      type: Number,
      min: 0,
      max: 100
    },
    formScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    },
    validityStatus: {
      type: String,
      enum: ['valid', 'invalid'],
      default: 'valid',
      required: true
    },
    invalidReasons: {
      type: [String],
      default: []
    },
    clientMeta: {
      viewport: {
        width: { type: Number, min: 0 },
        height: { type: Number, min: 0 }
      },
      userAgent: { type: String, trim: true },
      deviceType: { type: String, trim: true },
      refreshRate: { type: Number, min: 0 }
    },
    configSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    legacyTestEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestEntry',
      default: null
    }
  },
  { timestamps: true }
);

brainTestAttemptSchema.index({ userId: 1, testKey: 1, completedAt: -1 });
brainTestAttemptSchema.index({ userId: 1, batterySessionId: 1, completedAt: -1 });

const BrainTestAttempt = mongoose.model('BrainTestAttempt', brainTestAttemptSchema);

export default BrainTestAttempt;
