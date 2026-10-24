// controllers/aiController.js
import axios from 'axios';

const GEMINI_MODEL = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// Thrown when the AI feature cannot be used because it is not configured
export class AIConfigError extends Error {}

/**
 * Send a prompt to Google Gemini and return the text reply.
 * Pass { json: true } to ask Gemini to answer with raw JSON.
 */
export const generateText = async (prompt, { json = false } = {}) => {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new AIConfigError('GOOGLE_API_KEY is not set on the server');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL()}:generateContent`;
  const response = await axios.post(
    url,
    {
      contents: [{ parts: [{ text: prompt }] }],
      ...(json && { generationConfig: { responseMimeType: 'application/json' } }),
    },
    {
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      timeout: 60000,
    }
  );

  return response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
};

// POST /api/student/ask-ai
export const askAI = async (req, res) => {
  const question = req.body?.question?.trim();
  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }
  if (question.length > 2000) {
    return res.status(400).json({ error: 'Question is too long (max 2000 characters)' });
  }

  try {
    const prompt =
      'You are a friendly tutor helping a student. Answer clearly and concisely, ' +
      'using simple language and short examples where useful.\n\nStudent question: ' + question;
    const answer = await generateText(prompt);

    if (!answer) {
      return res.json({ answer: "Sorry, I couldn't generate a response. Please try again." });
    }
    res.json({ answer });
  } catch (error) {
    if (error instanceof AIConfigError) {
      console.error(error.message);
      return res.status(503).json({ error: 'AI tutor is not configured on the server (missing GOOGLE_API_KEY)' });
    }
    console.error('Google AI API error:', error.response?.data || error.message);
    res.status(502).json({ error: 'Failed to fetch AI response' });
  }
};
