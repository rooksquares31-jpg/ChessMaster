const Submission = require('../models/Submission');
const Homework = require('../models/Homework');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { paginate } = require('../utils/pagination');
const { ROLES, SUBMISSION_STATUS, HOMEWORK_STATUS } = require('../config/constants');

/**
 * POST /api/submissions
 * Student: submit a solution for an assigned homework.
 */
const createSubmission = async (req, res, next) => {
  try {
    const { homeworkId, submittedSolution, pgnText, moveSequence } = req.body;

    // Verify the homework exists and is assigned to this student
    const homework = await Homework.findOne({
      _id: homeworkId,
      assignedStudents: req.user._id,
    });
    if (!homework) {
      return next(ApiError.notFound('Homework not found or not assigned to you'));
    }

    // Check for duplicate submission
    const existing = await Submission.findOne({
      studentId: req.user._id,
      homeworkId,
    });
    if (existing) {
      return next(ApiError.conflict('You have already submitted for this homework'));
    }

    const isLate = homework.dueDate < new Date();

    const submission = await Submission.create({
      studentId: req.user._id,
      homeworkId,
      submittedSolution,
      pgnText,
      moveSequence,
      pgnFile: req.file ? req.file.path : undefined,
      isLate,
    });

    // Update homework status to submitted if all students have submitted
    // (simplified: mark as submitted on first submission)
    if (homework.status === HOMEWORK_STATUS.ASSIGNED) {
      homework.status = HOMEWORK_STATUS.SUBMITTED;
      await homework.save();
    }

    await submission.populate('homeworkId', 'title category difficulty dueDate positions');
    return ApiResponse.created(res, 'Submission created', submission);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/submissions
 * Admin: all submissions. Student: their own submissions.
 */
const getSubmissions = async (req, res, next) => {
  try {
    const { homeworkId, studentId, status, page, limit } = req.query;
    const filter = {};

    if (req.user.role === ROLES.STUDENT) {
      filter.studentId = req.user._id;
    } else if (studentId) {
      filter.studentId = studentId;
    }
    if (homeworkId) filter.homeworkId = homeworkId;
    if (status) filter.status = status;

    const total = await Submission.countDocuments(filter);
    const { skip, limit: lim, meta } = paginate({ page, limit }, total);

    const submissions = await Submission.find(filter)
      .populate('studentId', 'username email firstName lastName')
      .populate('homeworkId', 'title category difficulty dueDate maxScore positions')
      .populate({ path: 'correction' })
      .skip(skip)
      .limit(lim)
      .sort({ submittedAt: -1 });

    return ApiResponse.ok(res, 'Submissions fetched', submissions, meta);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/submissions/:id
 */
const getSubmissionById = async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('studentId', 'username email firstName lastName')
      .populate('homeworkId', 'title category difficulty dueDate fenPosition pgnReference maxScore positions')
      .populate({ path: 'correction' });

    if (!submission) return next(ApiError.notFound('Submission not found'));

    // Students can only view their own submissions
    if (
      req.user.role === ROLES.STUDENT &&
      submission.studentId._id.toString() !== req.user._id.toString()
    ) {
      return next(ApiError.forbidden('Access denied'));
    }

    return ApiResponse.ok(res, 'Submission fetched', submission);
  } catch (err) {
    next(err);
  }
};

module.exports = { createSubmission, getSubmissions, getSubmissionById };
