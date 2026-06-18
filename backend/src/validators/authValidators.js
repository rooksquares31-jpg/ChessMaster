const { body } = require('express-validator');

const loginValidator = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const registerValidator = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a number'),
  body('firstName').optional().trim().isLength({ max: 50 }).withMessage('First name too long'),
  body('lastName').optional().trim().isLength({ max: 50 }).withMessage('Last name too long'),
  body('grade').optional().trim().isLength({ max: 50 }).withMessage('Grade too long'),
  body('phone').optional().trim().isLength({ max: 30 }).withMessage('Phone too long'),
  body('notes').optional().trim().isLength({ max: 1000 }).withMessage('Notes too long'),
];

/**
 * Validator for admin updating a student — password is optional on updates.
 */
const updateStudentValidator = [
  body('username')
    .optional().trim()
    .isLength({ min: 3, max: 30 }).withMessage('Username must be 3–30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username: letters, numbers and _ only'),
  body('email')
    .optional()
    .isEmail().withMessage('Valid email required')
    .normalizeEmail(),
  body('password')
    .optional()
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a number'),
  body('firstName').optional().trim().isLength({ max: 50 }).withMessage('First name too long'),
  body('lastName').optional().trim().isLength({ max: 50 }).withMessage('Last name too long'),
  body('grade').optional().trim().isLength({ max: 50 }).withMessage('Grade too long'),
  body('phone').optional().trim().isLength({ max: 30 }).withMessage('Phone too long'),
  body('notes').optional().trim().isLength({ max: 1000 }).withMessage('Notes too long'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Invalid status'),
];

module.exports = { loginValidator, registerValidator, updateStudentValidator };
