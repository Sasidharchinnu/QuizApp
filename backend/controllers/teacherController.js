import mongoose from 'mongoose';
import Quiz from '../models/Quiz.js';
import Batch from '../models/Batch.js';
import Result from '../models/Result.js';
import User from '../models/User.js';

import client from '../redisClient.js';


// GET /api/teacher/leaderboard?batchId=&quizId=
export const getLeaderboard = async (req, res) => {
  try {
    const teacherId = req.user.userId;
    const batchId = req.query.batchId || undefined;
    const quizId = req.params.quizId || req.query.quizId || undefined;

    if ((batchId && !mongoose.isValidObjectId(batchId)) || (quizId && !mongoose.isValidObjectId(quizId))) {
      return res.status(400).json({ error: 'Invalid batchId or quizId' });
    }

    // Generate a unique cache key for this leaderboard view
    const cacheKey = `leaderboard:${teacherId}:${batchId || 'all'}:${quizId || 'all'}`;

    const cachedData = await client.get(cacheKey);
    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    if (batchId) {
      const batch = await Batch.findById(batchId);
      if (!batch) return res.status(404).json({ error: 'Batch not found' });
      if (!batch.teacher.equals(teacherId))
        return res.status(403).json({ error: 'Not authorized for this batch' });
    }

    // Dropdown options: all of the teacher's batches, and quizzes of the selected batch
    const batchOptions = await Batch.find({ teacher: teacherId }).select('_id name').sort({ name: 1 });
    const quizOptionsQuery = { createdBy: teacherId, ...(batchId && { batch: batchId }) };
    const quizOptions = await Quiz.find(quizOptionsQuery).select('_id title').sort({ createdAt: -1 });

    // Quizzes that the leaderboard is calculated for
    const quizIds = quizId
      ? quizOptions.filter(q => q._id.equals(quizId)).map(q => q._id)
      : quizOptions.map(q => q._id);

    const results = await Result.find({ quiz: { $in: quizIds } })
      .populate('student', 'name email')
      .populate('quiz', 'title')
      .sort({ score: -1, completedAt: 1 });

    const leaderboard = results
      .filter(r => r.student) // skip results of deleted users
      .map((r, idx) => ({
        rank: idx + 1,
        studentId: r.student._id,
        name: r.student.name,
        email: r.student.email,
        quizTitle: r.quiz?.title || 'Deleted quiz',
        score: r.score,
        timeSpent: r.timeSpent,
        submittedAt: r.completedAt
      }));

    const responseData = {
      leaderboard,
      batchOptions,
      quizOptions: quizOptions.map(q => ({ id: q._id, title: q.title }))
    };

    // Cache for 5 minutes
    await client.setEx(cacheKey, 300, JSON.stringify(responseData));

    res.json(responseData);
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
};


// GET /api/teacher/profile
export const getTeacherProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('name email role');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ name: user.name, email: user.email, role: user.role });
  } catch (err) {
    console.error('Profile fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};


// GET /api/teacher/dashboard
export const getTeacherDashboard = async (req, res) => {
  try {
    const teacherId = req.user.userId;

    const quizzes = await Quiz.find({ createdBy: teacherId })
      .populate('batch', 'name students')
      .sort({ createdAt: -1 });

    const totalQuizzes = quizzes.length;

    // Count unique students across all of this teacher's batches
    const batches = await Batch.find({ teacher: teacherId }).select('students');
    const uniqueStudentIds = new Set(batches.flatMap(b => b.students.map(id => id.toString())));
    const activeStudents = uniqueStudentIds.size;

    // Average score only over quizzes that have at least one submission
    const quizIds = quizzes.map(q => q._id);
    const submissionCounts = await Result.aggregate([
      { $match: { quiz: { $in: quizIds } } },
      { $group: { _id: '$quiz', count: { $sum: 1 } } },
    ]);
    const countByQuiz = new Map(submissionCounts.map(s => [s._id.toString(), s.count]));
    const attempted = quizzes.filter(q => countByQuiz.has(q._id.toString()));
    const avgScore = attempted.length > 0
      ? Math.round(attempted.reduce((sum, q) => sum + (q.avgScore || 0), 0) / attempted.length)
      : 0;

    const recentQuizzes = quizzes.slice(0, 5).map(quiz => ({
      _id: quiz._id,
      title: quiz.title,
      batch: quiz.batch?.name || 'N/A',
      students: quiz.batch?.students?.length || 0,
      submissions: countByQuiz.get(quiz._id.toString()) || 0,
      avgScore: quiz.avgScore || 0
    }));

    res.json({
      metrics: {
        totalQuizzes,
        activeStudents,
        avgScore,
        totalBatches: batches.length
      },
      quizzes: recentQuizzes
    });

  } catch (err) {
    console.error('Dashboard fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};


// POST /api/teacher/create-quiz → manually created quiz
export const createQuiz = async (req, res) => {
  const { title, questions, batchId, deadline, duration } = req.body;
  const teacherId = req.user.userId;

  if (!title?.trim() || !batchId || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'Title, batch and at least one question are required' });
  }

  // correctAnswer can be the option index (preferred) or the option text
  const formattedQuestions = [];
  for (const q of questions) {
    const options = Array.isArray(q.options) ? q.options.map(o => String(o).trim()) : [];
    const correctIndex = Number.isInteger(q.correctAnswer) ? q.correctAnswer : options.indexOf(q.correctAnswer);

    if (!q.question?.trim() || options.length < 2 || options.some(o => !o)) {
      return res.status(400).json({ error: 'Every question needs text and at least 2 non-empty options' });
    }
    if (correctIndex < 0 || correctIndex >= options.length) {
      return res.status(400).json({ error: `Correct answer not found in options for question "${q.question}"` });
    }

    formattedQuestions.push({
      question: q.question.trim(),
      options,
      correctAnswer: correctIndex,
      explanation: q.explanation?.trim() || '',
    });
  }

  try {
    const batch = await Batch.findOne({ _id: batchId, teacher: teacherId });
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found or not yours' });
    }

    const quiz = await Quiz.create({
      title: title.trim(),
      questions: formattedQuestions,
      source: 'manual',
      createdBy: teacherId,
      batch: batchId,
      deadline: deadline || null,
      duration: Number(duration) || 30,
    });

    // Invalidate caches that now miss this quiz
    await client.del(`teacherQuizzes:${teacherId}`);
    await client.delPattern(`student:*:batch:${batchId}:quizzes`);
    await client.delPattern(`leaderboard:${teacherId}:*`);

    res.status(201).json(quiz);
  } catch (err) {
    console.error('Create quiz error:', err.message);
    res.status(500).json({ error: 'Quiz creation failed' });
  }
};


// DELETE /api/teacher/quiz/:quizId
export const deleteQuiz = async (req, res) => {
  try {
    const teacherId = req.user.userId;
    const quiz = await Quiz.findOne({ _id: req.params.quizId, createdBy: teacherId });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    await Result.deleteMany({ quiz: quiz._id });
    await quiz.deleteOne();

    await client.del(`teacherQuizzes:${teacherId}`);
    await client.delPattern(`student:*:batch:${quiz.batch}:quizzes`);
    await client.delPattern(`studentResult*`);
    await client.delPattern(`leaderboard:${teacherId}:*`);

    res.json({ message: 'Quiz deleted' });
  } catch (err) {
    console.error('Delete quiz error:', err.message);
    res.status(500).json({ error: 'Failed to delete quiz' });
  }
};


// ==================== CREATE BATCH ====================
export const createBatch = async (req, res) => {
  try {
    const name = req.body.name?.trim();
    const teacherId = req.user.userId;

    if (!name) {
      return res.status(400).json({ error: 'Batch name is required' });
    }

    const existingBatch = await Batch.findOne({ name });
    if (existingBatch) {
      return res.status(400).json({ error: 'Batch name already exists' });
    }

    const newBatch = await Batch.create({ name, teacher: teacherId, students: [] });

    // Invalidate cached batch list shown to students
    await client.del('allBatches');
    await client.delPattern(`leaderboard:${teacherId}:*`);

    res.status(201).json({ message: 'Batch created', batch: newBatch });
  } catch (error) {
    console.error('Batch creation error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== LIST BATCHES ====================
export const listTeacherBatches = async (req, res) => {
  try {
    const teacherId = req.user.userId;
    const batches = await Batch.find({ teacher: teacherId })
      .populate('students', 'name email')
      .sort({ createdAt: -1 });
    res.json(batches);
  } catch (err) {
    console.error('Fetch batches error:', err.message);
    res.status(500).json({ error: 'Failed to load batches' });
  }
};


// GET /api/teacher/quizzes
export const getTeacherQuizzes = async (req, res) => {
  try {
    const teacherId = req.user.userId;
    const cacheKey = `teacherQuizzes:${teacherId}`;

    const cachedQuizzes = await client.get(cacheKey);
    if (cachedQuizzes) {
      return res.json({ quizzes: JSON.parse(cachedQuizzes) });
    }

    const quizzes = await Quiz.find({ createdBy: teacherId })
      .populate('batch', 'name')
      .sort({ createdAt: -1 });

    // Cache for 10 minutes
    await client.setEx(cacheKey, 600, JSON.stringify(quizzes));

    res.json({ quizzes });

  } catch (err) {
    console.error('Error fetching quizzes:', err);
    res.status(500).json({ error: 'Failed to load quizzes' });
  }
};
