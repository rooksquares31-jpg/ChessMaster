const mongoose = require('mongoose');
const { SUBMISSION_STATUS } = require('../config/constants');

const submissionSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student ID is required'],
    },
    homeworkId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Homework',
      required: [true, 'Homework ID is required'],
    },
    // Student's written solution / move commentary
    submittedSolution: {
      type: String,
      trim: true,
      maxlength: [5000, 'Solution text cannot exceed 5000 characters'],
    },
    // Inline PGN text submitted by the student
    pgnText: {
      type: String,
      trim: true,
    },
    // Path/URL of uploaded PGN file
    pgnFile: {
      type: String,
    },
    // Move sequence as an array (e.g. ['e4', 'e5', 'Nf3'])
    moveSequence: [
      {
        type: String,
        trim: true,
      },
    ],
    status: {
      type: String,
      enum: Object.values(SUBMISSION_STATUS),
      default: SUBMISSION_STATUS.PENDING,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    // Whether the submission was late relative to the homework due date
    isLate: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Prevent duplicate submissions from the same student ────────────────────
submissionSchema.index({ studentId: 1, homeworkId: 1 }, { unique: true });
submissionSchema.index({ homeworkId: 1, status: 1 });
submissionSchema.index({ studentId: 1, submittedAt: -1 });

// ── Virtual: correction for this submission ─────────────────────────────────
submissionSchema.virtual('correction', {
  ref: 'Correction',
  localField: '_id',
  foreignField: 'submissionId',
  justOne: true,
});

module.exports = mongoose.model('Submission', submissionSchema);
