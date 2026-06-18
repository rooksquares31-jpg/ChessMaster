/**
 * Application-wide constants.
 * Import from here rather than scattering magic strings across the codebase.
 */

const ROLES = Object.freeze({
  ADMIN: 'admin',
  STUDENT: 'student',
});

const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});

const HOMEWORK_STATUS = Object.freeze({
  ASSIGNED: 'assigned',
  SUBMITTED: 'submitted',
  CORRECTED: 'corrected',
  OVERDUE: 'overdue',
});

const SUBMISSION_STATUS = Object.freeze({
  PENDING: 'pending',
  REVIEWED: 'reviewed',
});

const DIFFICULTY = Object.freeze({
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
});

const CATEGORY = Object.freeze({
  TACTICS: 'tactics',
  MATE_IN_ONE: 'mate-in-one',
  MATE_IN_TWO: 'mate-in-two',
  ENDGAME: 'endgame',
  OPENING: 'opening',
  MIDDLEGAME: 'middlegame',
  CALCULATION: 'calculation',
  STRATEGY: 'strategy',
});

module.exports = {
  ROLES,
  USER_STATUS,
  HOMEWORK_STATUS,
  SUBMISSION_STATUS,
  DIFFICULTY,
  CATEGORY,
};
