import mongoose from 'mongoose';

const moodEntrySchema = new mongoose.Schema({
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
  timeOfDay: {
    type: String,
    enum: ['morning', 'afternoon', 'evening'],
    required: true
  },
  mood: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  energy: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  stress: {
    type: Number,
    required: false,
    min: 1,
    max: 10
  },
  fatigue: {
    type: Number,
    required: false,
    min: 1,
    max: 10
  },
  focus: {
    type: Number,
    required: false,
    min: 1,
    max: 10
  },
  readinessSelfScore: {
    type: Number,
    required: false,
    min: 1,
    max: 10
  },
  painNote: {
    type: String,
    required: false,
    maxlength: 500
  },
  comment: {
    type: String,
    required: false
  }
}, { timestamps: true });

const MoodEntry = mongoose.model('MoodEntry', moodEntrySchema);

export default MoodEntry;
