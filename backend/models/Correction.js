const mongoose = require('mongoose');

/**
 * Correction model — stores the AI or manual correction result for a homework.
 */
const correctionSchema = new mongoose.Schema(
  {
    // TODO: define fields
    // homework:  { type: mongoose.Schema.Types.ObjectId, ref: 'Homework', required: true },
    // score:     { type: Number, min: 0, max: 100 },
    // feedback:  { type: String },
    // checkedBy: { type: String, enum: ['ai', 'teacher'], default: 'ai' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Correction', correctionSchema);
