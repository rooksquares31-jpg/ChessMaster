const mongoose = require('mongoose');
const { HOMEWORK_STATUS, DIFFICULTY, CATEGORY } = require('../config/constants');

const homeworkSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    // FEN string representing the starting board position
    fenPosition: {
      type: String,
      trim: true,
      // Removed strict regex — FEN has many valid forms; validate in controller if needed
    },
    positions: [
      {
        fen: {
          type: String,
          trim: true,
        },
        correctMove: {
          type: String,
          trim: true,
        },
        explanation: {
          type: String,
          trim: true,
        },
        points: {
          type: Number,
          default: 10,
        },
      },
    ],
    // Reference PGN (the model answer / reference game)
    pgnReference: {
      type: String,
      trim: true,
    },
    // Path/URL to an uploaded PGN file (stored via multer)
    pgnFile: {
      type: String,
    },
    // Textual instructions for the student
    instructions: {
      type: String,
      trim: true,
      maxlength: [5000, 'Instructions cannot exceed 5000 characters'],
    },
    category: {
      type: String,
      enum: Object.values(CATEGORY),
      required: [true, 'Category is required'],
    },
    difficulty: {
      type: String,
      enum: Object.values(DIFFICULTY),
      required: [true, 'Difficulty is required'],
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    assignedStudents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    status: {
      type: String,
      enum: Object.values(HOMEWORK_STATUS),
      default: HOMEWORK_STATUS.ASSIGNED,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    maxScore: {
      type: Number,
      default: 100,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Virtual: is overdue ─────────────────────────────────────────────────────
homeworkSchema.virtual('isOverdue').get(function () {
  return this.dueDate < new Date() && this.status === HOMEWORK_STATUS.ASSIGNED;
});

// ── Index for efficient student dashboard queries ──────────────────────────
homeworkSchema.index({ assignedStudents: 1, dueDate: 1 });
homeworkSchema.index({ createdBy: 1, status: 1 });
homeworkSchema.index({ dueDate: 1, status: 1 });

module.exports = mongoose.model('Homework', homeworkSchema);
