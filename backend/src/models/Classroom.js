const mongoose = require('mongoose');

/**
 * Classroom — a live session created by an admin/coach.
 * Students join using a 6-character invite code.
 */
const classroomSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Classroom title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    // 6-char alphanumeric invite code, e.g. "X9K2PL"
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 6,
      maxlength: 6,
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Students explicitly invited/added by admin
    invitedStudents: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ],
    // Students currently in the live session (runtime state)
    activeParticipants: [
      {
        userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        socketId: { type: String },
        joinedAt: { type: Date, default: Date.now },
        // Admin-controlled permissions
        canControlBoard: { type: Boolean, default: false },
        isMuted:         { type: Boolean, default: false },
      },
    ],
    // Live chessboard state shared by the room
    boardFen: {
      type: String,
      default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    },
    // Move history for the session
    moveHistory: [
      {
        from:      String,
        to:        String,
        san:       String,
        fen:       String,
        movedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ['waiting', 'live', 'ended'],
      default: 'waiting',
    },
    startedAt: { type: Date },
    endedAt:   { type: Date },
  },
  { timestamps: true }
);

// Index for quick code lookup — unique is already declared on the field above
classroomSchema.index({ host: 1, status: 1 });

module.exports = mongoose.model('Classroom', classroomSchema);
