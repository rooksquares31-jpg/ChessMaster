const mongoose = require('mongoose');

const progressReportSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // one report doc per student, updated in place
    },
    totalHomework: {
      type: Number,
      default: 0,
      min: 0,
    },
    completedHomework: {
      type: Number,
      default: 0,
      min: 0,
    },
    overdueHomework: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    // Score history: [{ month: '2025-01', average: 72 }]
    monthlyScores: [
      {
        month: { type: String }, // 'YYYY-MM'
        average: { type: Number, min: 0, max: 100 },
        count: { type: Number, min: 0 },
      },
    ],
    // Category-specific averages — stored as a flexible map
    categoryScores: {
      type: Map,
      of: Number,
      default: {},
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// ── Virtual: completion rate (%) ────────────────────────────────────────────
progressReportSchema.virtual('completionRate').get(function () {
  if (this.totalHomework === 0) return 0;
  return Math.round((this.completedHomework / this.totalHomework) * 100);
});

module.exports = mongoose.model('ProgressReport', progressReportSchema);
