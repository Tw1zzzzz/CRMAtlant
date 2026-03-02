import mongoose from 'mongoose';

const testEntrySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    default: Date.now,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  link: {
    type: String,
    required: false
  },
  screenshotUrl: {
    type: String,
    required: false
  },
  isWeeklyTest: {
    type: Boolean,
    default: false,
    required: true
  },
  testType: {
    type: String,
    default: 'generic',
    trim: true
  },
  scoreNormalized: {
    type: Number,
    min: 0,
    max: 100
  },
  rawScore: {
    type: Number
  },
  unit: {
    type: String,
    trim: true
  },
  durationSec: {
    type: Number,
    min: 0
  },
  attempts: {
    type: Number,
    min: 1,
    default: 1
  },
  stateSnapshot: {
    fatigue: { type: Number, min: 0, max: 10 },
    focus: { type: Number, min: 0, max: 10 },
    stress: { type: Number, min: 0, max: 10 },
    sleepHours: { type: Number, min: 0, max: 24 },
    mood: { type: Number, min: 0, max: 10 },
    energy: { type: Number, min: 0, max: 10 }
  },
  context: {
    matchType: { type: String, trim: true },
    map: { type: String, trim: true },
    role: { type: String, trim: true },
    source: { type: String, trim: true },
    notes: { type: String, trim: true }
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  measuredAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const TestEntry = mongoose.model('TestEntry', testEntrySchema);

export default TestEntry; 
