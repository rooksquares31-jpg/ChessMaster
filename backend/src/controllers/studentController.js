const User = require('../models/User');
const Submission = require('../models/Submission');
const Correction = require('../models/Correction');
const Homework = require('../models/Homework');
const ProgressReport = require('../models/ProgressReport');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { paginate } = require('../utils/pagination');
const { ROLES, USER_STATUS } = require('../config/constants');

/**
 * GET /api/students
 * Admin: list all students with pagination, search, and status filter.
 */
const getStudents = async (req, res, next) => {
  try {
    const { search, status, page, limit } = req.query;

    const filter = { role: ROLES.STUDENT };
    if (status && status !== 'all') filter.status = status;
    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { username: regex },
        { email: regex },
        { firstName: regex },
        { lastName: regex },
        { grade: regex },
      ];
    }

    const total = await User.countDocuments(filter);
    const { skip, limit: lim, meta } = paginate({ page, limit }, total);

    const students = await User.find(filter)
      .select('-password -refreshToken')
      .skip(skip)
      .limit(lim)
      .sort({ createdAt: -1 });

    return ApiResponse.ok(res, 'Students fetched', students, meta);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/students/:id
 * Admin: get a single student with their progress report.
 */
const getStudentById = async (req, res, next) => {
  try {
    const student = await User.findOne({
      _id: req.params.id,
      role: ROLES.STUDENT,
    }).select('-password -refreshToken');

    if (!student) return next(ApiError.notFound('Student not found'));

    const progress = await ProgressReport.findOne({ studentId: student._id });

    return ApiResponse.ok(res, 'Student fetched', { student, progress });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/students
 * Admin: create a new student account.
 */
const createStudent = async (req, res, next) => {
  try {
    const { username, email, password, firstName, lastName, grade, phone, notes } = req.body;

    const student = await User.create({
      username,
      email,
      password,
      firstName,
      lastName,
      grade,
      phone,
      notes,
      role: ROLES.STUDENT,
    });

    return ApiResponse.created(res, 'Student account created', {
      _id: student._id,
      id: student._id,
      username: student.username,
      email: student.email,
      role: student.role,
      firstName: student.firstName,
      lastName: student.lastName,
      grade: student.grade,
      phone: student.phone,
      notes: student.notes,
      status: student.status,
      createdAt: student.createdAt,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/students/:id
 * Admin: update student profile fields including grade, phone, notes and status.
 */
const updateStudent = async (req, res, next) => {
  try {
    const allowed = [
      'firstName', 'lastName', 'email', 'username',
      'status', 'grade', 'phone', 'notes',
    ];
    const updates = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    // If password provided, update it (triggers the pre-save hash)
    if (req.body.password && req.body.password.trim()) {
      // Use findById + save so the pre-save hook runs
      const student = await User.findOne({ _id: req.params.id, role: ROLES.STUDENT })
        .select('+password');
      if (!student) return next(ApiError.notFound('Student not found'));

      // Apply other updates
      Object.assign(student, updates);
      student.password = req.body.password;
      await student.save();

      const result = await User.findById(student._id).select('-password -refreshToken');
      return ApiResponse.ok(res, 'Student updated', result);
    }

    const student = await User.findOneAndUpdate(
      { _id: req.params.id, role: ROLES.STUDENT },
      updates,
      { new: true, runValidators: true }
    ).select('-password -refreshToken');

    if (!student) return next(ApiError.notFound('Student not found'));

    return ApiResponse.ok(res, 'Student updated', student);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/students/:id
 * Admin: permanently deletes a student and ALL their related data.
 * Cascade order: Corrections → Submissions → Homework assignments → ProgressReport → User.
 */
const deleteStudent = async (req, res, next) => {
  try {
    const student = await User.findOne({ _id: req.params.id, role: ROLES.STUDENT });
    if (!student) return next(ApiError.notFound('Student not found'));

    const studentId = req.params.id;

    // 1. Find all submissions by this student
    const submissions = await Submission.find({ studentId }).select('_id');
    const submissionIds = submissions.map((s) => s._id);

    // 2. Delete all corrections linked to those submissions
    if (submissionIds.length > 0) {
      await Correction.deleteMany({ submissionId: { $in: submissionIds } });
    }

    // 3. Delete all submissions by this student
    await Submission.deleteMany({ studentId });

    // 4. Remove student from all homework assignedStudents arrays
    await Homework.updateMany(
      { assignedStudents: studentId },
      { $pull: { assignedStudents: studentId } }
    );

    // 5. Delete the student's progress report
    await ProgressReport.deleteMany({ studentId });

    // 6. Delete the student account itself
    await User.findByIdAndDelete(studentId);

    return ApiResponse.ok(res, 'Student and all related data permanently deleted', {
      deletedSubmissions: submissionIds.length,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/students/:id/homework
 * Admin: get all homework assigned to a specific student,
 * enriched with their submission and correction data.
 */
const getStudentHomework = async (req, res, next) => {
  try {
    const student = await User.findOne({ _id: req.params.id, role: ROLES.STUDENT });
    if (!student) return next(ApiError.notFound('Student not found'));

    // All homework assigned to this student
    const homeworkList = await Homework.find({ assignedStudents: req.params.id })
      .sort({ dueDate: -1 })
      .lean();

    // All submissions by this student
    const submissions = await Submission.find({ studentId: req.params.id })
      .populate({ path: 'correction' })
      .lean();

    // Build submission map: homeworkId → submission
    const subMap = {};
    submissions.forEach((s) => {
      subMap[s.homeworkId.toString()] = s;
    });

    // Enrich homework with submission + correction data
    const enriched = homeworkList.map((hw) => {
      const sub = subMap[hw._id.toString()] || null;
      const corr = sub?.correction || null;
      return {
        homework: hw,
        submission: sub ? {
          _id: sub._id,
          status: sub.status,
          submittedAt: sub.submittedAt,
          isLate: sub.isLate,
        } : null,
        correction: corr ? {
          _id: corr._id,
          score: corr.score,
          grade: corr.grade,
          feedback: corr.feedback,
          moveAnnotations: corr.moveAnnotations,
          correctedAt: corr.correctedAt,
        } : null,
      };
    });

    return ApiResponse.ok(res, 'Student homework fetched', enriched);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentHomework,
};
