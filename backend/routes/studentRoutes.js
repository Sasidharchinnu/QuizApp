import express from 'express';
import {
  joinBatch,
  submitQuiz,
  getStudentResult,
  getStudentProfile,
  getAllBatches,
  getQuizzesByBatch,
  getStudentQuizById,
  getAllResultsForStudent,
  getStudentStats,
  getStudentQuizCounts,
  leaveBatch,
  getActiveQuizzesForStudent,
} from '../controllers/studentController.js';
import { verifyToken, requireRole, validateIds } from '../middleware/auth.js';

const studentRouter = express.Router();

// Every student route needs a logged-in student
studentRouter.use(verifyToken, requireRole('student'));

/**
 * @swagger
 * tags:
 *   name: Student
 *   description: Endpoints for student actions (requires a student login)
 */

/**
 * @swagger
 * /student/profile:
 *   get:
 *     summary: Get student profile with joined batches
 *     tags: [Student]
 *     responses:
 *       200:
 *         description: Student profile data
 *         content:
 *           application/json:
 *             example:
 *               _id: "64aabb112233"
 *               name: "John Doe"
 *               email: "john@example.com"
 *               role: "student"
 *               batches: [{ _id: "64aabb112299", name: "CS-A 2025" }]
 */
studentRouter.get('/profile', getStudentProfile);

/**
 * @swagger
 * /student/submit:
 *   post:
 *     summary: Submit a quiz (score is calculated on the server)
 *     tags: [Student]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             quizId: "64bbcc223344"
 *             timeSpent: "4m 12s"
 *             answers:
 *               - questionIndex: 0
 *                 selectedOption: 2
 *               - questionIndex: 1
 *                 selectedOption: 0
 *     responses:
 *       201:
 *         description: Quiz submitted successfully
 *       409:
 *         description: Quiz already submitted
 */
studentRouter.post('/submit', submitQuiz);

/**
 * @swagger
 * /student/result/{quizId}:
 *   get:
 *     summary: Get the detailed result for a specific quiz
 *     tags: [Student]
 *     parameters:
 *       - in: path
 *         name: quizId
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Quiz result data
 *         content:
 *           application/json:
 *             example:
 *               quizTitle: "Math Quiz 1"
 *               score: 80
 *               totalQuestions: 10
 *               correctAnswers: 8
 */
studentRouter.get('/result/:quizId', validateIds('quizId'), getStudentResult);

/**
 * @swagger
 * /student/my-results:
 *   get:
 *     summary: Get all quiz results for the student
 *     tags: [Student]
 *     responses:
 *       200:
 *         description: List of quiz results
 */
studentRouter.get('/my-results', getAllResultsForStudent);

/**
 * @swagger
 * /student/batches:
 *   get:
 *     summary: Get all available batches
 *     tags: [Student]
 *     responses:
 *       200:
 *         description: List of batches
 */
studentRouter.get('/batches', getAllBatches);

/**
 * @swagger
 * /student/join-batch:
 *   post:
 *     summary: Join a batch
 *     tags: [Student]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             batchId: "64f2e8d67f23b67c23a8c1a2"
 *     responses:
 *       200:
 *         description: Successfully joined the batch
 *       400:
 *         description: Missing batchId or already joined
 */
studentRouter.post('/join-batch', joinBatch);

/**
 * @swagger
 * /student/leave-batch/{batchId}:
 *   delete:
 *     summary: Leave a batch
 *     tags: [Student]
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully left the batch
 *       404:
 *         description: Batch not found
 */
studentRouter.delete('/leave-batch/:batchId', validateIds('batchId'), leaveBatch);

/**
 * @swagger
 * /student/quiz/{quizId}:
 *   get:
 *     summary: Get quiz questions to attempt (correct answers are hidden)
 *     tags: [Student]
 *     parameters:
 *       - in: path
 *         name: quizId
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Quiz details
 *       403:
 *         description: Not in batch or deadline passed
 *       409:
 *         description: Already submitted
 */
studentRouter.get('/quiz/:quizId', validateIds('quizId'), getStudentQuizById);

/**
 * @swagger
 * /student/active-quizzes:
 *   get:
 *     summary: Get quizzes the student can still attempt
 *     tags: [Student]
 *     responses:
 *       200:
 *         description: List of active quizzes
 */
studentRouter.get('/active-quizzes', getActiveQuizzesForStudent);

/**
 * @swagger
 * /student/batch/{batchId}/quizzes:
 *   get:
 *     summary: Get quizzes of a batch with this student's status (available / completed / overdue)
 *     tags: [Student]
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of quizzes for the batch
 */
studentRouter.get('/batch/:batchId/quizzes', validateIds('batchId'), getQuizzesByBatch);

/**
 * @swagger
 * /student/stats:
 *   get:
 *     summary: Get student statistics
 *     tags: [Student]
 *     responses:
 *       200:
 *         description: Average score and number of quizzes taken
 */
studentRouter.get('/stats', getStudentStats);

/**
 * @swagger
 * /student/quiz-counts:
 *   get:
 *     summary: Get total and active quiz counts for the student
 *     tags: [Student]
 *     responses:
 *       200:
 *         description: Number of quizzes
 */
studentRouter.get('/quiz-counts', getStudentQuizCounts);

export default studentRouter;
