const Submission = require('../models/Submission');
const Correction = require('../models/Correction');
const Homework = require('../models/Homework');
const ProgressReport = require('../models/ProgressReport');
const { SUBMISSION_STATUS, HOMEWORK_STATUS } = require('../config/constants');

/**
 * Recalculate and upsert the ProgressReport for a given student.
 * Called after a correction is saved or a submission is updated.
 */
const recalculateProgress = async (studentId) => {
  // All submissions by this student that have been reviewed
  const reviewed = await Submission.find({
    studentId,
    status: SUBMISSION_STATUS.REVIEWED,
  }).populate('homeworkId', 'category');

  const correctionIds = reviewed.map((s) => s._id);
  const corrections = await Correction.find({ submissionId: { $in: correctionIds } });

  // Map submissionId → score for quick lookup
  const scoreMap = new Map(
    corrections.map((c) => [c.submissionId.toString(), c.score])
  );

  const scores = corrections.map((c) => c.score);
  const averageScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  // Total homework assigned to this student
  const totalHomework = await Homework.countDocuments({ assignedStudents: studentId });

  // Overdue count
  const overdueHomework = await Homework.countDocuments({
    assignedStudents: studentId,
    status: HOMEWORK_STATUS.ASSIGNED,
    dueDate: { $lt: new Date() },
  });

  // Monthly scores
  const monthlyMap = new Map();
  corrections.forEach((correction) => {
    const month = correction.correctedAt.toISOString().slice(0, 7); // YYYY-MM
    if (!monthlyMap.has(month)) monthlyMap.set(month, { total: 0, count: 0 });
    const entry = monthlyMap.get(month);
    entry.total += correction.score;
    entry.count += 1;
  });
  const monthlyScores = Array.from(monthlyMap.entries()).map(([month, { total, count }]) => ({
    month,
    average: Math.round(total / count),
    count,
  }));

  // Category scores
  const categoryMap = {};
  reviewed.forEach((sub) => {
    const cat = sub.homeworkId?.category;
    const score = scoreMap.get(sub._id.toString());
    if (cat && score !== undefined) {
      if (!categoryMap[cat]) categoryMap[cat] = { total: 0, count: 0 };
      categoryMap[cat].total += score;
      categoryMap[cat].count += 1;
    }
  });
  const categoryScores = {};
  for (const [cat, { total, count }] of Object.entries(categoryMap)) {
    categoryScores[cat] = Math.round(total / count);
  }
  await ProgressReport.findOneAndUpdate(
    { studentId },
    {
      studentId,
      totalHomework,
      completedHomework: reviewed.length,
      overdueHomework,
      averageScore,
      monthlyScores,
      categoryScores,
      lastUpdated: new Date(),
    },
    { upsert: true, new: true }
  );
};

module.exports = { recalculateProgress };
