const Correction = require('../models/Correction');
const Submission = require('../models/Submission');
const Homework = require('../models/Homework');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { SUBMISSION_STATUS, HOMEWORK_STATUS } = require('../config/constants');
const { recalculateProgress } = require('../services/progressService');

/**
 * POST /api/corrections
 * Admin: submit a correction for a submission.
 */
const createCorrection = async (req, res, next) => {
  try {
    const { submissionId, score, feedback, annotatedPgn, moveAnnotations } = req.body;

    const submission = await Submission.findById(submissionId).populate('homeworkId');
    if (!submission) return next(ApiError.notFound('Submission not found'));

    // Prevent double-correcting
    const existing = await Correction.findOne({ submissionId });
    if (existing) return next(ApiError.conflict('This submission has already been corrected'));

    const correction = await Correction.create({
      submissionId,
      score,
      feedback: feedback || '',
      annotatedPgn,
      moveAnnotations,
      correctedBy: req.user._id,
    });

    // Mark submission as reviewed
    submission.status = SUBMISSION_STATUS.REVIEWED;
    await submission.save();

    // Mark homework as corrected
    if (submission.homeworkId) {
      submission.homeworkId.status = HOMEWORK_STATUS.CORRECTED;
      await submission.homeworkId.save();
    }

    // Async progress recalculation (non-blocking)
    recalculateProgress(submission.studentId).catch((err) =>
      console.error('Progress recalculation failed:', err)
    );

    await correction.populate('correctedBy', 'username email');
    return ApiResponse.created(res, 'Correction saved', correction);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/corrections/offline
 * Admin: grade offline homework — auto-creates a submission if none exists,
 * then saves (or updates) the correction. This supports the use case where
 * students do homework on paper/offline and the admin enters marks manually.
 */
const createOfflineCorrection = async (req, res, next) => {
  try {
    const { studentId, homeworkId, score, feedback, moveAnnotations } = req.body;

    if (!studentId || !homeworkId) {
      return next(ApiError.badRequest('studentId and homeworkId are required'));
    }

    // Verify homework exists and student is assigned
    const homework = await Homework.findById(homeworkId);
    if (!homework) return next(ApiError.notFound('Homework not found'));

    // Auto-create a submission record if one doesn't exist yet
    let submission = await Submission.findOne({ studentId, homeworkId });
    if (!submission) {
      // Build a position-result move sequence from moveAnnotations
      const moveSeq = (moveAnnotations || []).map((a) => a.move || '');
      submission = await Submission.create({
        studentId,
        homeworkId,
        submittedSolution: `Offline assessment graded by admin. Score: ${score}%`,
        moveSequence: moveSeq,
        status: SUBMISSION_STATUS.REVIEWED,
        isLate: homework.dueDate < new Date(),
      });

      // Mark homework submitted + corrected
      homework.status = HOMEWORK_STATUS.CORRECTED;
      await homework.save();
    }

    // Check for existing correction — update if found, create if not
    let correction = await Correction.findOne({ submissionId: submission._id });
    if (correction) {
      correction.score = score;
      correction.feedback = feedback || '';
      correction.moveAnnotations = moveAnnotations || correction.moveAnnotations;
      correction.correctedBy = req.user._id;
      correction.correctedAt = new Date();
      await correction.save();
    } else {
      correction = await Correction.create({
        submissionId: submission._id,
        score,
        feedback: feedback || '',
        moveAnnotations,
        correctedBy: req.user._id,
      });

      // Ensure submission is marked reviewed
      submission.status = SUBMISSION_STATUS.REVIEWED;
      await submission.save();

      // Ensure homework is corrected
      homework.status = HOMEWORK_STATUS.CORRECTED;
      await homework.save();
    }

    // Recalculate student progress
    recalculateProgress(studentId).catch((err) =>
      console.error('Progress recalculation failed:', err)
    );

    await correction.populate('correctedBy', 'username email');
    return ApiResponse.ok(res, 'Offline correction saved', { correction, submission });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/corrections/:id
 * Get a correction by its ID (admin always, student only if it's theirs).
 */
const getCorrectionById = async (req, res, next) => {
  try {
    const correction = await Correction.findById(req.params.id)
      .populate('correctedBy', 'username email')
      .populate({
        path: 'submissionId',
        populate: [
          { path: 'studentId', select: 'username email firstName lastName' },
          { path: 'homeworkId', select: 'title category difficulty maxScore fenPosition pgnReference' },
        ],
      });

    if (!correction) return next(ApiError.notFound('Correction not found'));

    return ApiResponse.ok(res, 'Correction fetched', correction);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/corrections/:id
 * Admin: update an existing correction.
 * Also ensures the linked submission + homework stay in the corrected/reviewed state.
 */
const updateCorrection = async (req, res, next) => {
  try {
    const { score, feedback, annotatedPgn, moveAnnotations } = req.body;

    const correction = await Correction.findByIdAndUpdate(
      req.params.id,
      { score, feedback: feedback || '', annotatedPgn, moveAnnotations, correctedAt: new Date() },
      { new: true, runValidators: true }
    ).populate('correctedBy', 'username email');

    if (!correction) return next(ApiError.notFound('Correction not found'));

    // Ensure submission is still marked as reviewed and homework as corrected
    const submission = await Submission.findById(correction.submissionId).populate('homeworkId');
    if (submission) {
      if (submission.status !== SUBMISSION_STATUS.REVIEWED) {
        submission.status = SUBMISSION_STATUS.REVIEWED;
        await submission.save();
      }
      if (submission.homeworkId && submission.homeworkId.status !== HOMEWORK_STATUS.CORRECTED) {
        submission.homeworkId.status = HOMEWORK_STATUS.CORRECTED;
        await submission.homeworkId.save();
      }
      // Recalculate student progress after update
      recalculateProgress(submission.studentId).catch(console.error);
    }

    return ApiResponse.ok(res, 'Correction updated', correction);
  } catch (err) {
    next(err);
  }
};

module.exports = { createCorrection, createOfflineCorrection, getCorrectionById, updateCorrection };

