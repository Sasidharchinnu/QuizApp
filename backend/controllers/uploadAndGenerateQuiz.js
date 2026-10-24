import multer from 'multer';
// Import the library file directly: the package's index.js runs a debug test when imported as ESM
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import Quiz from '../models/Quiz.js';
import Batch from '../models/Batch.js';
import client from '../redisClient.js';
import { generateText, AIConfigError } from './aiController.js';

const MAX_TEXT_CHARS = 30000; // keep the prompt within a reasonable size

// Keep the file in memory, we only need its text
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
});

// Middleware to export and use in the router
export const uploadMiddleware = upload.single('file');

// Validate and normalise the questions returned by the AI (or sent by the client)
const normaliseQuestions = (questions) => {
  if (!Array.isArray(questions)) return [];
  return questions
    .map(q => {
      const options = Array.isArray(q.options) ? q.options.map(o => String(o).trim()) : [];
      const correct = Number(q.correct ?? q.correctAnswer);
      return {
        question: String(q.question || '').trim(),
        options,
        correct,
        explanation: String(q.explanation || '').trim(),
      };
    })
    .filter(q =>
      q.question &&
      q.options.length >= 2 &&
      q.options.every(Boolean) &&
      Number.isInteger(q.correct) &&
      q.correct >= 0 &&
      q.correct < q.options.length
    );
};

// POST /api/teacher/upload-and-generate  (multipart: file, batchId, numQuestions)
export const uploadAndGenerateQuiz = async (req, res) => {
  const { batchId } = req.body;
  const numQuestions = Math.min(Math.max(parseInt(req.body.numQuestions) || 10, 1), 30);

  if (!batchId) {
    return res.status(400).json({ error: 'Batch ID is required' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Please upload a PDF file' });
  }

  try {
    let text;
    try {
      ({ text } = await pdfParse(req.file.buffer));
    } catch (err) {
      console.error('PDF parse error:', err.message);
      return res.status(422).json({ error: 'Could not read this PDF. It may be corrupted or password protected.' });
    }
    const content = (text || '').replace(/\s+/g, ' ').trim();

    if (content.length < 100) {
      return res.status(422).json({
        error: 'Could not read enough text from this PDF. Scanned/image-only PDFs are not supported.',
      });
    }

    const prompt = `You are a teacher creating a multiple-choice quiz from study material.
Create exactly ${numQuestions} questions based ONLY on the material below.
Each question must have exactly 4 options and exactly one correct answer.

Return ONLY a JSON object in this exact format:
{"title": "short quiz title", "questions": [{"question": "...", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "one sentence why"}]}
"correct" is the 0-based index of the correct option.

MATERIAL:
${content.slice(0, MAX_TEXT_CHARS)}`;

    const raw = await generateText(prompt, { json: true });

    let parsed;
    try {
      // Strip ```json fences just in case the model adds them
      parsed = JSON.parse(raw.replace(/^```(json)?/i, '').replace(/```$/, '').trim());
    } catch {
      console.error('AI returned invalid JSON:', raw.slice(0, 500));
      return res.status(502).json({ error: 'AI returned an invalid response. Please try again.' });
    }

    const questions = normaliseQuestions(parsed.questions);
    if (questions.length === 0) {
      return res.status(502).json({ error: 'AI could not generate questions from this PDF. Please try again.' });
    }

    return res.status(200).json({ quiz: { title: parsed.title || '', questions } });
  } catch (err) {
    if (err instanceof AIConfigError) {
      return res.status(503).json({ error: 'AI quiz generation is not configured on the server (missing GOOGLE_API_KEY)' });
    }
    console.error('Quiz generation failed:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to generate quiz from PDF' });
  }
};

// POST /api/teacher/publish-quiz → save the (possibly edited) AI quiz
export const publishQuiz = async (req, res) => {
  const { batchId, quiz } = req.body;
  const teacherId = req.user.userId;

  const questions = normaliseQuestions(quiz?.questions);
  if (!batchId || questions.length === 0) {
    return res.status(400).json({ error: 'Invalid quiz or batchId' });
  }
  if (!quiz.title?.trim()) {
    return res.status(400).json({ error: 'Quiz title is required' });
  }

  try {
    const batch = await Batch.findOne({ _id: batchId, teacher: teacherId });
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found or not yours' });
    }

    const newQuiz = await Quiz.create({
      title: quiz.title.trim(),
      createdBy: teacherId,
      batch: batchId,
      source: 'ai',
      deadline: quiz.deadline || null,
      duration: Number(quiz.duration) || 30,
      questions: questions.map(q => ({
        question: q.question,
        options: q.options,
        correctAnswer: q.correct,
        explanation: q.explanation,
      })),
    });

    // New quiz → teacher's quiz list and students' batch lists are stale
    await client.del(`teacherQuizzes:${teacherId}`);
    await client.delPattern(`student:*:batch:${batchId}:quizzes`);
    await client.delPattern(`leaderboard:${teacherId}:*`);

    res.status(201).json({ message: 'Quiz published!', quizId: newQuiz._id });
  } catch (err) {
    console.error('Publish quiz error:', err.message);
    res.status(500).json({ error: 'Server error while saving quiz' });
  }
};
