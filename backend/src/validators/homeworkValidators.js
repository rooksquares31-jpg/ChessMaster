const { body } = require('express-validator');
const { DIFFICULTY, CATEGORY } = require('../config/constants');

const createHomeworkValidator = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description too long'),
  body('category')
    .isIn(Object.values(CATEGORY))
    .withMessage(`Category must be one of: ${Object.values(CATEGORY).join(', ')}`),
  body('difficulty')
    .isIn(Object.values(DIFFICULTY))
    .withMessage(`Difficulty must be one of: ${Object.values(DIFFICULTY).join(', ')}`),
  body('dueDate')
    .isISO8601()
    .withMessage('Due date must be a valid ISO 8601 date')
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Due date must be in the future');
      }
      return true;
    }),
  body('fenPosition').optional().trim().notEmpty().withMessage('FEN position cannot be blank if provided'),
  body('pgnReference').optional().trim(),
  body('instructions')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Instructions too long'),
  body('maxScore')
    .optional()
    .isFloat({ min: 0, max: 10000 })
    .withMessage('Max score must be a positive number'),
];

const updateHomeworkValidator = [
  body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Title too long'),
  body('description').optional().trim().isLength({ max: 2000 }).withMessage('Description too long'),
  body('category')
    .optional()
    .isIn(Object.values(CATEGORY))
    .withMessage(`Invalid category`),
  body('difficulty')
    .optional()
    .isIn(Object.values(DIFFICULTY))
    .withMessage('Invalid difficulty'),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid ISO 8601 date'),
];

const assignHomeworkValidator = [
  body('homeworkId').isMongoId().withMessage('Valid homework ID is required'),
  body('studentIds')
    .isArray({ min: 1 })
    .withMessage('studentIds must be a non-empty array'),
  body('studentIds.*').isMongoId().withMessage('Each student ID must be a valid MongoDB ID'),
];

module.exports = {
  createHomeworkValidator,
  updateHomeworkValidator,
  assignHomeworkValidator,
};
