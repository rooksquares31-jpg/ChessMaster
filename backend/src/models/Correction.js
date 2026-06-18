const mongoose = require('mongoose');

const correctionSchema = new mongoose.Schema(
  {
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
      required: [true, 'Submission ID is required'],
      unique: true, // one correction per submission
    },
    score: {
      type: Number,
      required: [true, 'Score is required'],
      min: [0, 'Score cannot be negative'],
      max: [100, 'Score cannot exceed 100'],
    },
    grade: {
      type: String,
      enum: ['A', 'B', 'C', 'D', 'F'],
    },
    feedback: {
      type: String,
      trim: true,
      default: '',
      maxlength: [5000, 'Feedback cannot exceed 5000 characters'],
    },
    // Annotated PGN with comments/variations added by the admin
    annotatedPgn: {
      type: String,
      trim: true,
    },
    // Specific move-by-move annotations [{ move: 'e4', comment: '...' }]
    moveAnnotations: [
      {
        move: { type: String, trim: true },
        comment: { type: String, trim: true },
        quality: {
          type: String,
          enum: ['excellent', 'good', 'inaccuracy', 'mistake', 'blunder'],
        },
      },
    ],
    correctedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    correctedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// ── Auto-compute letter grade from score ────────────────────────────────────
correctionSchema.pre('save', function () {
  if (this.isModified('score')) {
    if (this.score >= 90) this.grade = 'A';
    else if (this.score >= 80) this.grade = 'B';
    else if (this.score >= 70) this.grade = 'C';
    else if (this.score >= 60) this.grade = 'D';
    else this.grade = 'F';
  }
});

// submissionId already has a unique index from the schema field definition above
correctionSchema.index({ correctedBy: 1 });

module.exports = mongoose.model('Correction', correctionSchema);
