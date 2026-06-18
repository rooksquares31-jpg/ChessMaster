const User = require('../models/User');
const Homework = require('../models/Homework');
const Submission = require('../models/Submission');
const Correction = require('../models/Correction');
const ProgressReport = require('../models/ProgressReport');
const { ROLES, USER_STATUS, SUBMISSION_STATUS, HOMEWORK_STATUS } = require('../config/constants');

/**
 * Build the admin analytics dashboard payload.
 */
const getAdminDashboard = async () => {
  const [
    totalStudents,
    activeStudents,
    totalHomework,
    totalSubmissions,
    pendingCorrections,
    allCorrections,
    topStudents,
    monthlyTrend,
  ] = await Promise.all([
    // Counts
    User.countDocuments({ role: ROLES.STUDENT }),
    User.countDocuments({ role: ROLES.STUDENT, status: USER_STATUS.ACTIVE }),
    Homework.countDocuments(),
    Submission.countDocuments(),
    Submission.countDocuments({ status: SUBMISSION_STATUS.PENDING }),

    // Average class score
    Correction.find().select('score'),

    // Leaderboard: top 10 students by average score
    ProgressReport.find()
      .sort({ averageScore: -1 })
      .limit(10)
      .populate('studentId', 'username firstName lastName email'),

    // Monthly submission trend (last 6 months)
    Submission.aggregate([
      {
        $match: {
          submittedAt: { $gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$submittedAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { month: '$_id', count: 1, _id: 0 } },
    ]),
  ]);

  const scores = allCorrections.map((c) => c.score);
  const averageClassScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  const overdueHomework = await Homework.countDocuments({
    status: HOMEWORK_STATUS.ASSIGNED,
    dueDate: { $lt: new Date() },
  });

  return {
    overview: {
      totalStudents,
      activeStudents,
      totalHomework,
      totalSubmissions,
      pendingCorrections,
      averageClassScore,
      overdueHomework,
    },
    leaderboard: topStudents.map((r) => ({
      student: r.studentId,
      averageScore: r.averageScore,
      completedHomework: r.completedHomework,
      completionRate: r.totalHomework
        ? Math.round((r.completedHomework / r.totalHomework) * 100)
        : 0,
    })),
    monthlyTrend,
  };
};

/**
 * Get analytics for a single student.
 * Uses the student's OWN submission records to compute pending/overdue counts,
 * not hw.status (which is a global field that flips when ANY student acts).
 */
const getStudentAnalytics = async (studentId) => {
  const report = await ProgressReport.findOne({ studentId }).populate(
    'studentId',
    'username firstName lastName email'
  );

  const recentSubmissions = await Submission.find({ studentId })
    .sort({ submittedAt: -1 })
    .limit(5)
    .populate('homeworkId', 'title category difficulty');

  // Get all homework assigned to this student
  const allAssignedHw = await Homework.find(
    { assignedStudents: studentId },
    '_id dueDate'
  ).lean();

  // Get this student's submissions (to check which homework they've submitted)
  const mySubmissions = await Submission.find({ studentId }, 'homeworkId').lean();
  const submittedHwIds = new Set(mySubmissions.map((s) => s.homeworkId.toString()));

  const now = new Date();
  let pendingCount = 0;
  let overdueCount = 0;

  allAssignedHw.forEach((hw) => {
    const hasSubmission = submittedHwIds.has(hw._id.toString());
    if (!hasSubmission) {
      if (hw.dueDate < now) overdueCount++;
      else pendingCount++;
    }
  });

  return {
    report: report || { totalHomework: 0, completedHomework: 0, averageScore: 0 },
    pendingHomework: pendingCount,
    overdueHomework: overdueCount,
    recentSubmissions,
  };
};

module.exports = { getAdminDashboard, getStudentAnalytics };
