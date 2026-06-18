const Homework = require('../models/Homework');
const User = require('../models/User');
const Submission = require('../models/Submission');
const Correction = require('../models/Correction');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { paginate } = require('../utils/pagination');
const { ROLES, HOMEWORK_STATUS } = require('../config/constants');

/**
 * POST /api/homework
 * Admin: create a new homework assignment.
 */
const createHomework = async (req, res, next) => {
  try {
    const {
      title, description, fenPosition, pgnReference,
      instructions, category, difficulty, dueDate,
      assignedStudents, maxScore, positions,
    } = req.body;

    const homework = await Homework.create({
      title,
      description,
      fenPosition,
      pgnReference,
      instructions,
      category,
      difficulty,
      dueDate,
      assignedStudents: assignedStudents || [],
      maxScore,
      positions: positions || [],
      createdBy: req.user._id,
      // If a PGN file was uploaded via multipart form
      pgnFile: req.file ? req.file.path : undefined,
    });

    await homework.populate('createdBy', 'username email');
    return ApiResponse.created(res, 'Homework created', homework);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/homework
 * Admin: all homework. Student: only their assigned homework.
 */
const getHomework = async (req, res, next) => {
  try {
    const { status, category, difficulty, search, page, limit } = req.query;

    const filter = {};

    // Students can only see their own assigned homework
    if (req.user.role === ROLES.STUDENT) {
      filter.assignedStudents = req.user._id;
    }

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (difficulty) filter.difficulty = difficulty;
    if (search) filter.title = new RegExp(search, 'i');

    const total = await Homework.countDocuments(filter);
    const { skip, limit: lim, meta } = paginate({ page, limit }, total);

    const homework = await Homework.find(filter)
      .populate('createdBy', 'username email')
      .populate('assignedStudents', 'username email firstName lastName')
      .skip(skip)
      .limit(lim)
      .sort({ dueDate: 1 });

    return ApiResponse.ok(res, 'Homework fetched', homework, meta);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/homework/:id
 */
const getHomeworkById = async (req, res, next) => {
  try {
    const homework = await Homework.findById(req.params.id)
      .populate('createdBy', 'username email')
      .populate('assignedStudents', 'username email firstName lastName');

    if (!homework) return next(ApiError.notFound('Homework not found'));

    // Students can only view their own
    if (
      req.user.role === ROLES.STUDENT &&
      !homework.assignedStudents.some((s) => s._id.toString() === req.user._id.toString())
    ) {
      return next(ApiError.forbidden('You are not assigned to this homework'));
    }

    return ApiResponse.ok(res, 'Homework fetched', homework);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/homework/:id
 * Admin only.
 */
const updateHomework = async (req, res, next) => {
  try {
    const allowed = [
      'title', 'description', 'fenPosition', 'pgnReference',
      'instructions', 'category', 'difficulty', 'dueDate',
      'status', 'maxScore', 'positions',
    ];
    const updates = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (req.file) updates.pgnFile = req.file.path;

    const homework = await Homework.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate('createdBy', 'username email');

    if (!homework) return next(ApiError.notFound('Homework not found'));

    return ApiResponse.ok(res, 'Homework updated', homework);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/homework/:id
 * Admin only. Cascades: deletes corrections → submissions → homework.
 * Also removes the homework from all students' assignedStudents arrays.
 */
const deleteHomework = async (req, res, next) => {
  try {
    const homework = await Homework.findById(req.params.id);
    if (!homework) return next(ApiError.notFound('Homework not found'));

    // 1. Find all submissions for this homework
    const submissions = await Submission.find({ homeworkId: req.params.id }).select('_id');
    const submissionIds = submissions.map((s) => s._id);

    // 2. Delete all corrections linked to those submissions
    if (submissionIds.length > 0) {
      await Correction.deleteMany({ submissionId: { $in: submissionIds } });
    }

    // 3. Delete all submissions for this homework
    await Submission.deleteMany({ homeworkId: req.params.id });

    // 4. Delete the homework itself
    await Homework.findByIdAndDelete(req.params.id);

    return ApiResponse.ok(res, 'Homework and all related data deleted', {
      deletedSubmissions: submissionIds.length,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/homework/assign
 * Admin: assign homework to one or multiple students.
 */
const assignHomework = async (req, res, next) => {
  try {
    const { homeworkId, studentIds } = req.body;

    // Verify all student IDs exist and are actual students
    const students = await User.find({
      _id: { $in: studentIds },
      role: ROLES.STUDENT,
    }).select('_id');

    if (students.length !== studentIds.length) {
      return next(ApiError.badRequest('One or more student IDs are invalid'));
    }

    const homework = await Homework.findByIdAndUpdate(
      homeworkId,
      { $addToSet: { assignedStudents: { $each: studentIds } } },
      { new: true }
    ).populate('assignedStudents', 'username email firstName lastName');

    if (!homework) return next(ApiError.notFound('Homework not found'));

    return ApiResponse.ok(res, 'Homework assigned successfully', homework);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createHomework,
  getHomework,
  getHomeworkById,
  updateHomework,
  deleteHomework,
  assignHomework,
};
