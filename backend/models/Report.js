const mongoose = require('mongoose');

/**
 * Report model — a summary report generated for a student or class.
 */
const reportSchema = new mongoose.Schema(
  {
    // TODO: define fields
    // student:     { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    // generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // period:      { type: String },   // e.g. "2025-Q1"
    // summary:     { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);
