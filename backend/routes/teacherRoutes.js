import express from 'express';
import {
  createBatch,
  createQuiz,
  deleteQuiz,
  getTeacherQuizzes,
  getTeacherDashboard,
  listTeacherBatches,
  getLeaderboard,
  getTeacherProfile,
} from '../controllers/teacherController.js';
import { verifyToken, requireRole, validateIds } from '../middleware/auth.js';

const teacherRouter = express.Router();

// Every teacher route needs a logged-in teacher
teacherRouter.use(verifyToken, requireRole('teacher'));

/**
 * @swagger
 * tags:
 *   name: Teacher
 *   description: Endpoints for teacher actions (requires a teacher login)
 */

/**
 * @swagger
 * /teacher/profile:
 *   get:
 *     summary: Get teacher profile
 *     tags: [Teacher]
 *     responses:
 *       200:
 *         description: Teacher profile data
 */
teacherRouter.get('/profile', getTeacherProfile);

/**
 * @swagger
 * /teacher/dashboard:
 *   get:
 *     summary: Get teacher dashboard stats and recent quizzes
 *     tags: [Teacher]
 *     responses:
 *       200:
 *         description: Teacher dashboard data
 *         content:
 *           application/json:
 *             example:
 *               metrics: { totalQuizzes: 12, activeStudents: 100, avgScore: 74, totalBatches: 5 }
 *               quizzes: []
 */
teacherRouter.get('/dashboard', getTeacherDashboard);

/**
 * @swagger
 * /teacher/batch/create:
 *   post:
 *     summary: Create a new batch
 *     tags: [Teacher]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             name: "CS-A 2025"
 *     responses:
 *       201:
 *         description: Batch created successfully
 *       400:
 *         description: Name missing or already exists
 */
teacherRouter.post('/batch/create', createBatch);

/**
 * @swagger
 * /teacher/batches:
 *   get:
 *     summary: Get all batches of the teacher (with students)
 *     tags: [Teacher]
 *     responses:
 *       200:
 *         description: List of teacher's batches
 */
teacherRouter.get('/batches', listTeacherBatches);

/**
 * @swagger
 * /teacher/quizzes:
 *   get:
 *     summary: Get all quizzes created by the teacher
 *     tags: [Teacher]
 *     responses:
 *       200:
 *         description: List of quizzes
 */
teacherRouter.get('/quizzes', getTeacherQuizzes);

/**
 * @swagger
 * /teacher/quiz/{quizId}:
 *   delete:
 *     summary: Delete a quiz and its results
 *     tags: [Teacher]
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Quiz deleted
 */
teacherRouter.delete('/quiz/:quizId', validateIds('quizId'), deleteQuiz);

/**
 * @swagger
 * /teacher/create-quiz:
 *   post:
 *     summary: Create a quiz manually
 *     tags: [Teacher]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             title: "Math Quiz 1"
 *             batchId: "64aabb112233"
 *             deadline: "2026-12-31T18:00:00.000Z"
 *             duration: 30
 *             questions:
 *               - question: "What is 2 + 2?"
 *                 options: ["3", "4", "5", "6"]
 *                 correctAnswer: 1
 *                 explanation: "2 + 2 equals 4"
 *     responses:
 *       201:
 *         description: Quiz created successfully
 */
teacherRouter.post('/create-quiz', createQuiz);

/**
 * @swagger
 * /teacher/leaderboard:
 *   get:
 *     summary: Get the leaderboard, optionally filtered by batch and/or quiz
 *     tags: [Teacher]
 *     parameters:
 *       - in: query
 *         name: batchId
 *         schema:
 *           type: string
 *       - in: query
 *         name: quizId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Leaderboard data plus filter options
 */
teacherRouter.get('/leaderboard', getLeaderboard);
teacherRouter.get('/leaderboard/:quizId', validateIds('quizId'), getLeaderboard);

export default teacherRouter;
