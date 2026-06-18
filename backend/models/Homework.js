const mongoose = require('mongoose');

/**
 * Homework model — represents a homework assignment uploaded for checking.
 */
const homeworkSchema = new mongoose.Schema(
  {
    // TODO: define fields
    // title:      { type: String, required: true },
    // student:    { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    // subject:    { type: String },
    // fileUrl:    { type: String },   // path or cloud URL of uploaded file
    // status:     { type: String, enum: ['pending', 'checked'], default: 'pending' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Homework', homeworkSchema);
