const mongoose = require('mongoose');

/**
 * User model — represents teachers / admins who log in to the system.
 * Extend this schema with fields like name, email, passwordHash, role, etc.
 */
const userSchema = new mongoose.Schema(
  {
    // TODO: define fields
    // name:  { type: String, required: true, trim: true },
    // email: { type: String, required: true, unique: true, lowercase: true },
    // role:  { type: String, enum: ['admin', 'teacher'], default: 'teacher' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
