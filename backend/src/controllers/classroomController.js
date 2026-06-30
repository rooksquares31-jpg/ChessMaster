const Classroom = require('../models/Classroom');
const User      = require('../models/User');
const ApiError  = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { ROLES }   = require('../config/constants');

/** Generate a random 6-char uppercase code */
const generateCode = () =>
  Math.random().toString(36).substring(2, 8).toUpperCase();

/** Ensure code is unique */
const uniqueCode = async () => {
  let code, exists;
  do {
    code   = generateCode();
    exists = await Classroom.findOne({ code });
  } while (exists);
  return code;
};

/* ── POST /api/classrooms ─────────────────────────────────────── */
const createClassroom = async (req, res, next) => {
  try {
    const { title, description, studentIds = [] } = req.body;

    // Validate invited students exist
    if (studentIds.length > 0) {
      const count = await User.countDocuments({ _id: { $in: studentIds }, role: ROLES.STUDENT });
      if (count !== studentIds.length)
        return next(ApiError.badRequest('One or more student IDs are invalid'));
    }

    const code = await uniqueCode();

    const classroom = await Classroom.create({
      title,
      description,
      code,
      host: req.user._id,
      invitedStudents: studentIds,
    });

    await classroom.populate('invitedStudents', 'username firstName lastName email');
    await classroom.populate('host', 'username firstName lastName email');

    return ApiResponse.created(res, 'Classroom created', classroom);
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/classrooms ─────────────────────────────────────── */
const getClassrooms = async (req, res, next) => {
  try {
    const filter = req.user.role === ROLES.ADMIN
      ? { host: req.user._id }
      : { invitedStudents: req.user._id };

    const classrooms = await Classroom.find(filter)
      .populate('host', 'username firstName lastName')
      .sort({ createdAt: -1 });

    return ApiResponse.ok(res, 'Classrooms fetched', classrooms);
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/classrooms/:id ────────────────────────────────── */
const getClassroomById = async (req, res, next) => {
  try {
    const classroom = await Classroom.findById(req.params.id)
      .populate('host', 'username firstName lastName email')
      .populate('invitedStudents', 'username firstName lastName email')
      .populate('activeParticipants.userId', 'username firstName lastName');

    if (!classroom) return next(ApiError.notFound('Classroom not found'));
    return ApiResponse.ok(res, 'Classroom fetched', classroom);
  } catch (err) {
    next(err);
  }
};

/* ── POST /api/classrooms/join ──────────────────────────────── */
/**
 * ANY authenticated user can join with a valid code.
 * If they aren't already in invitedStudents, they are added automatically
 * (open-join, like Google Meet link sharing).
 */
const joinByCode = async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) return next(ApiError.badRequest('Code is required'));

    const classroom = await Classroom.findOne({ code: code.trim().toUpperCase() })
      .populate('host', 'username firstName lastName');

    if (!classroom) return next(ApiError.notFound('Invalid classroom code — please check and try again'));
    if (classroom.status === 'ended')
      return next(ApiError.badRequest('This session has already ended'));

    const isHost = classroom.host._id.toString() === req.user._id.toString();

    // Auto-add student to invitedStudents if not already there
    if (!isHost) {
      const alreadyInvited = classroom.invitedStudents.some(
        (s) => s.toString() === req.user._id.toString()
      );
      if (!alreadyInvited) {
        classroom.invitedStudents.push(req.user._id);
        await classroom.save();
      }
    }

    return ApiResponse.ok(res, 'Code accepted — you may join', {
      classroomId: classroom._id,
      title:       classroom.title,
      code:        classroom.code,
      host:        classroom.host,
      status:      classroom.status,
    });
  } catch (err) {
    next(err);
  }
};

/* ── PUT /api/classrooms/:id ────────────────────────────────── */
const updateClassroom = async (req, res, next) => {
  try {
    const { title, description, studentIds, status } = req.body;
    const updates = {};
    if (title)       updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status)      updates.status = status;
    if (studentIds)  updates.invitedStudents = studentIds;

    if (updates.status === 'live' && !updates.startedAt) updates.startedAt = new Date();
    if (updates.status === 'ended') updates.endedAt = new Date();

    const classroom = await Classroom.findOneAndUpdate(
      { _id: req.params.id, host: req.user._id },
      updates,
      { new: true }
    )
      .populate('host', 'username firstName lastName')
      .populate('invitedStudents', 'username firstName lastName email');

    if (!classroom) return next(ApiError.notFound('Classroom not found'));
    return ApiResponse.ok(res, 'Classroom updated', classroom);
  } catch (err) {
    next(err);
  }
};

/* ── DELETE /api/classrooms/:id ─────────────────────────────── */
const deleteClassroom = async (req, res, next) => {
  try {
    const classroom = await Classroom.findOneAndDelete({
      _id: req.params.id,
      host: req.user._id,
    });
    if (!classroom) return next(ApiError.notFound('Classroom not found'));
    return ApiResponse.ok(res, 'Classroom deleted');
  } catch (err) {
    next(err);
  }
};

/* ── POST /api/classrooms/:id/invite ───────────────────────── */
const addStudents = async (req, res, next) => {
  try {
    const { studentIds } = req.body;
    const classroom = await Classroom.findOneAndUpdate(
      { _id: req.params.id, host: req.user._id },
      { $addToSet: { invitedStudents: { $each: studentIds } } },
      { new: true }
    ).populate('invitedStudents', 'username firstName lastName email');

    if (!classroom) return next(ApiError.notFound('Classroom not found'));
    return ApiResponse.ok(res, 'Students added', classroom);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createClassroom,
  getClassrooms,
  getClassroomById,
  joinByCode,
  updateClassroom,
  deleteClassroom,
  addStudents,
};
