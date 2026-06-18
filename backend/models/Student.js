const mongoose = require('mongoose');

/**
 * Student model — represents a student whose homework is being checked.
 */
const studentSchema = new mongoose.Schema(
  {
    // TODO: define fields
    // firstName: { type: String, required: true, trim: true },
    // lastName:  { type: String, required: true, trim: true },
    // grade:     { type: String },
    // teacher:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Student', studentSchema);
