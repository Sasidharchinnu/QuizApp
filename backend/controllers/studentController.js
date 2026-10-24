import User from '../models/User.js';
import Quiz from '../models/Quiz.js';
import Result from '../models/Result.js';
import Batch from '../models/Batch.js';

import client from '../redisClient.js';

const isMember = (student, batchId) =>
  student?.batches?.some(b => b.toString() === batchId.toString());

const isPastDeadline = (quiz) => quiz.deadline && new Date(quiz.deadline) < new Date();

// GET /api/student/quiz/:quizId → quiz questions WITHOUT the correct answers
export const getStudentQuizById = async (req, res) => {
  try {
    const { quizId } = req.params;
    const studentId = req.user.userId;

    const quiz = await Quiz.findById(quizId).select('title duration deadline batch questions');
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const student = await User.findById(studentId).select('batches');
    if (!isMember(student, quiz.batch)) {
      return res.status(403).json({ error: 'You are not a member of this quiz\'s batch' });
    }
    if (await Result.exists({ quiz: quizId, student: studentId })) {
      return res.status(409).json({ error: 'You have already submitted this quiz', alreadySubmitted: true });
    }
    if (isPastDeadline(quiz)) {
      return res.status(403).json({ error: 'The deadline for this quiz has passed' });
    }

    // Hide correct answers from students
    const safeQuestions = quiz.questions.map(q => ({
      question: q.question,
      options: q.options
    }));

    res.json({
      _id: quiz._id,
      title: quiz.title,
      duration: quiz.duration || 30, // in minutes
      deadline: quiz.deadline,
      questions: safeQuestions
    });

  } catch (err) {
    console.error('Error fetching quiz for student:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// POST /api/student/submit → score is always calculated on the server
export const submitQuiz = async (req, res) => {
  const { quizId, timeSpent, answers } = req.body;
  const studentId = req.user.userId;

  if (!quizId || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'Invalid input data' });
  }

  try {
    const quiz = await Quiz.findById(quizId);
    if (!quiz || !quiz.questions?.length) {
      return res.status(404).json({ error: 'Quiz not found or has no questions' });
    }

    const student = await User.findById(studentId).select('batches');
    if (!isMember(student, quiz.batch)) {
      return res.status(403).json({ error: 'You are not a member of this quiz\'s batch' });
    }

    // Keep only valid answers, one per question
    const cleanAnswers = [];
    const seen = new Set();
    for (const a of answers) {
      const qi = Number(a?.questionIndex);
      const opt = a?.selectedOption;
      if (!Number.isInteger(qi) || qi < 0 || qi >= quiz.questions.length || seen.has(qi)) continue;
      seen.add(qi);
      cleanAnswers.push({
        questionIndex: qi,
        selectedOption: Number.isInteger(opt) ? opt : undefined,
      });
    }

    const correct = cleanAnswers.filter(
      a => quiz.questions[a.questionIndex].correctAnswer === a.selectedOption
    ).length;

    const score = Math.round((correct / quiz.questions.length) * 100);

    // The unique index on (quiz, student) also blocks double submissions
    const result = await Result.create({
      quiz: quizId,
      student: studentId,
      score,
      correctAnswers: correct,
      timeSpent: String(timeSpent || 'Unknown'),
      answers: cleanAnswers,
    });

    // Update quiz average score
    const [{ avg } = { avg: score }] = await Result.aggregate([
      { $match: { quiz: quiz._id } },
      { $group: { _id: null, avg: { $avg: '$score' } } },
    ]);
    quiz.avgScore = Math.round(avg);
    await quiz.save();

    // Invalidate caches affected by this submission
    await client.del([
      `studentResults:${studentId}`,
      `student:${studentId}:batch:${quiz.batch}:quizzes`,
    ]);
    await client.delPattern(`leaderboard:${quiz.createdBy}:*`);

    res.status(201).json({ message: 'Quiz submitted successfully', result });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Quiz already submitted' });
    }
    console.error('Quiz submission failed:', error.message);
    res.status(500).json({ error: 'Quiz submission failed' });
  }
};


// GET all results for a student with Redis caching
export const getAllResultsForStudent = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const cacheKey = `studentResults:${studentId}`;

    // Check Redis cache
    const cachedResults = await client.get(cacheKey);
    if (cachedResults) {
      return res.json(JSON.parse(cachedResults));
    }

    // Fetch from DB if not cached
    const results = await Result.find({ student: studentId })
      .populate('quiz', 'title questions')
      .sort({ completedAt: -1 });

    const formatted = results
      .filter(result => result.quiz !== null)
      .map(result => ({
        quizId: result.quiz._id,
        quizTitle: result.quiz.title,
        score: result.score,
        correctAnswers: result.correctAnswers,
        totalQuestions: result.quiz.questions.length,
        completedAt: result.completedAt,
        timeSpent: result.timeSpent,
      }));

    // Cache results for 10 minutes
    await client.setEx(cacheKey, 600, JSON.stringify(formatted));

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching student results:', err.message);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
};


// GET /api/student/result/:quizId → detailed result with correct answers
export const getStudentResult = async (req, res) => {
  try {
    const { quizId } = req.params;
    const studentId = req.user.userId;

    // Results never change after submission, so they can be cached for a while
    const cacheKey = `studentResult:${studentId}:${quizId}`;

    const cachedResult = await client.get(cacheKey);
    if (cachedResult) {
      return res.json(JSON.parse(cachedResult));
    }

    const result = await Result.findOne({ quiz: quizId, student: studentId });
    if (!result) return res.status(404).json({ error: 'Result not found' });

    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    const responseData = {
      quizTitle: quiz.title,
      score: result.score,
      correctAnswers: result.correctAnswers,
      totalQuestions: quiz.questions.length,
      completedAt: result.completedAt,
      timeSpent: result.timeSpent,
      questions: quiz.questions.map((q, index) => {
        const answer = result.answers.find(a => a.questionIndex === index);
        const userAnswer = answer?.selectedOption ?? -1;

        return {
          id: index + 1,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer, // index
          userAnswer,
          isCorrect: userAnswer === q.correctAnswer,
          explanation: q.explanation || ''
        };
      })
    };

    // Store in Redis for 1 hour
    await client.setEx(cacheKey, 3600, JSON.stringify(responseData));

    res.json(responseData);
  } catch (error) {
    console.error('Fetch result error:', error.message);
    res.status(500).json({ error: 'Failed to fetch result' });
  }
};


// GET /api/student/profile
export const getStudentProfile = async (req, res) => {
  try {
    const student = await User.findById(req.userId)
      .populate('batches', 'name') // Only bring batch name
      .select('-password'); // hide password

    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json(student);
  } catch (err) {
    console.error('Error fetching student profile:', err.message);
    res.status(500).json({ message: 'Failed to load student profile' });
  }
};


// GET /api/student/active-quizzes → not yet attempted and deadline not passed
export const getActiveQuizzesForStudent = async (req, res) => {
  try {
    const studentId = req.user.userId;

    const student = await User.findById(studentId).select('batches');
    if (!student?.batches?.length) {
      return res.json([]);
    }

    const now = new Date();

    const activeQuizzes = await Quiz.find({
      batch: { $in: student.batches },
      $or: [{ deadline: null }, { deadline: { $gte: now } }],
    })
      .populate('batch', 'name')
      .lean();

    const completedQuizIds = new Set(
      (await Result.find({ student: studentId }).select('quiz')).map(r => r.quiz.toString())
    );

    const filteredQuizzes = activeQuizzes
      .filter(quiz => !completedQuizIds.has(quiz._id.toString()))
      // quizzes without a deadline go last
      .sort((a, b) => (a.deadline ? new Date(a.deadline) : Infinity) - (b.deadline ? new Date(b.deadline) : Infinity))
      .map(quiz => ({
        _id: quiz._id,
        title: quiz.title,
        batchName: quiz.batch?.name,
        deadline: quiz.deadline,
        duration: quiz.duration,
        questionCount: quiz.questions.length, // never send questions/answers here
      }));

    res.json(filteredQuizzes);

  } catch (err) {
    console.error('Error in getActiveQuizzesForStudent:', err.message);
    res.status(500).json({ error: 'Failed to fetch active quizzes' });
  }
};


// GET /api/student/batches → list all batches
export const getAllBatches = async (req, res) => {
  try {
    const cachedBatches = await client.get('allBatches');
    if (cachedBatches) {
      return res.json(JSON.parse(cachedBatches));
    }

    const batches = await Batch.find()
      .select('name teacher createdAt')
      .populate('teacher', 'name')
      .sort({ createdAt: -1 });

    // Cache for 1 hour (invalidated when a batch is created)
    await client.setEx('allBatches', 3600, JSON.stringify(batches));

    res.json(batches);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch batches', error: err.message });
  }
};

// POST /api/student/join-batch
export const joinBatch = async (req, res) => {
  try {
    const { batchId } = req.body;
    if (!batchId) {
      return res.status(400).json({ message: 'batchId is required' });
    }

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ message: 'Invalid batch ID' });
    }

    const student = await User.findOne({ _id: req.userId, role: 'student' });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    if (batch.students.some(id => id.equals(student._id))) {
      return res.status(400).json({ message: 'You have already joined this batch' });
    }

    // $addToSet keeps both sides consistent even with concurrent requests
    await Batch.updateOne({ _id: batch._id }, { $addToSet: { students: student._id } });
    await User.updateOne({ _id: student._id }, { $addToSet: { batches: batch._id } });

    await client.del(`student:${student._id}:batch:${batchId}:quizzes`);

    console.log(`Student ${student.name} added to batch ${batch.name}`);
    res.json({ message: 'Successfully joined the batch', batch: batch.name });

  } catch (err) {
    console.error('Error in joinBatch:', err.message);
    res.status(500).json({ message: 'Error joining batch', error: err.message });
  }
};

// DELETE /api/student/leave-batch/:batchId
export const leaveBatch = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const { batchId } = req.params;

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found' });
    }

    await Batch.updateOne({ _id: batchId }, { $pull: { students: studentId } });
    await User.updateOne({ _id: studentId }, { $pull: { batches: batchId } });

    await client.del(`student:${studentId}:batch:${batchId}:quizzes`);

    res.json({ message: 'Successfully left the batch' });

  } catch (error) {
    console.error('Error in leaveBatch:', error);
    res.status(500).json({ message: 'Failed to leave the batch' });
  }
};


// GET /api/student/batch/:batchId/quizzes → quizzes of a batch with status for this student
export const getQuizzesByBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const studentId = req.user.userId;
    const cacheKey = `student:${studentId}:batch:${batchId}:quizzes`;

    const cached = await client.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const student = await User.findById(studentId).select('batches');
    if (!student) return res.status(404).json({ message: 'Student not found' });
    if (!isMember(student, batchId)) return res.status(403).json({ message: 'You are not a member of this batch' });

    const quizzes = await Quiz.find({ batch: batchId }).sort({ deadline: 1 }).lean();

    // One query for all results instead of one per quiz
    const results = await Result.find({ student: studentId, quiz: { $in: quizzes.map(q => q._id) } })
      .select('quiz score')
      .lean();
    const resultByQuiz = new Map(results.map(r => [r.quiz.toString(), r]));

    const quizzesWithStatus = quizzes.map(quiz => {
      const result = resultByQuiz.get(quiz._id.toString());
      let status = 'available';
      if (result) status = 'completed';
      else if (isPastDeadline(quiz)) status = 'overdue';

      return {
        _id: quiz._id,
        title: quiz.title,
        duration: quiz.duration,
        deadline: quiz.deadline,
        questionCount: quiz.questions.length, // never send correct answers to students
        status,
        score: result?.score ?? null,
      };
    });

    await client.setEx(cacheKey, 300, JSON.stringify(quizzesWithStatus));

    res.json(quizzesWithStatus);

  } catch (err) {
    console.error('Error fetching quizzes:', err);
    res.status(500).json({ message: 'Failed to fetch quizzes', error: err.message });
  }
};


// GET /api/student/stats
export const getStudentStats = async (req, res) => {
  try {
    const studentId = req.user.userId;

    const results = await Result.find({ student: studentId });

    let avgScore = 0;
    if (results.length > 0) {
      const total = results.reduce((sum, r) => sum + r.score, 0);
      avgScore = Math.round(total / results.length);
    }

    res.json({ averageScore: avgScore, quizzesTaken: results.length });
  } catch (err) {
    console.error('Error fetching stats:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};


// GET /api/student/quiz-counts
export const getStudentQuizCounts = async (req, res) => {
  try {
    const studentId = req.user.userId;

    const student = await User.findById(studentId).select('batches');
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const quizzes = await Quiz.find({ batch: { $in: student.batches } }).select('deadline').lean();
    const completedQuizIds = new Set(
      (await Result.find({ student: studentId }).select('quiz')).map(r => r.quiz.toString())
    );

    const activeQuizzes = quizzes.filter(
      q => !completedQuizIds.has(q._id.toString()) && !isPastDeadline(q)
    ).length;

    return res.json({ totalQuizzes: quizzes.length, activeQuizzes });

  } catch (err) {
    console.error('Error fetching quiz counts:', err.message);
    res.status(500).json({ error: 'Failed to fetch quiz data' });
  }
};
