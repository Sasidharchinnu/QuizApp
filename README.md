# QuizAI — AI-Powered Quiz Platform for Teachers & Students

A full-stack MERN app where **teachers** create quizzes (by hand or by uploading a PDF that **Google Gemini** turns into questions) and assign them to batches, and **students** join batches, take timed quizzes, see detailed results and ask an **AI tutor** for help.

- Live API docs (Swagger): https://quizapp-backend-frj2.onrender.com/api-docs/
- Project guides: [`docs/project-overview.html`](docs/project-overview.html) (what the project is) and [`docs/interview-guide.html`](docs/interview-guide.html) (how to explain it + interview Q&A). Open them in a browser.

## Features

| Teacher | Student |
|---|---|
| Register / login (JWT in httpOnly cookie) | Register / login |
| Create batches and see who joined | Join / leave batches |
| Create quizzes manually (with explanations) | Dashboard with quizzes per batch and status (available / completed / overdue) |
| Upload a PDF → AI generates MCQs → review / edit → publish | Take a timed quiz (auto-submits when time runs out) |
| Dashboard: total quizzes, students, average score | Detailed result with correct answers and explanations |
| Leaderboard filtered by batch / quiz, export to Excel | All past results |
| Delete quizzes | Ask AI tutor (Gemini) |

## Tech stack

- **Frontend:** React 18, Vite, React Router 7, Tailwind CSS, Axios, lucide-react, SheetJS (xlsx export)
- **Backend:** Node.js, Express 5, MongoDB + Mongoose, JWT + bcrypt, Multer + pdf-parse, Google Gemini API, Redis cache (optional, with in-memory fallback), Swagger
- **DevOps:** Docker, docker-compose, nginx

## Run locally

Requirements: Node.js 18+ and MongoDB (local or a free MongoDB Atlas cluster).

```bash
# 1. Backend
cd backend
cp .env.example .env        # then edit .env (MONGO_URI, JWT_SECRET, GOOGLE_API_KEY)
npm install
npm run dev                 # http://localhost:5000  (Swagger: /api-docs)

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

`GOOGLE_API_KEY` (free from https://aistudio.google.com/app/apikey) is only needed for **Ask AI** and **Generate quiz from PDF**. Everything else works without it. `REDIS_URL` is optional; without it an in-memory cache is used.

### Run with Docker

```bash
docker compose up --build   # app at http://localhost:3001, API at http://localhost:5001
```

To enable AI features in Docker, create `backend/.env` with `GOOGLE_API_KEY=...`.

## Environment variables

**backend/.env**

| Name | Required | Description |
|---|---|---|
| `MONGO_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | Secret used to sign login tokens |
| `GOOGLE_API_KEY` | for AI | Google Gemini API key |
| `GEMINI_MODEL` | no | Defaults to `gemini-2.5-flash` |
| `REDIS_URL` | no | Redis connection URL; falls back to in-memory cache |
| `CLIENT_URLS` | no | Extra allowed frontend origins (comma separated) |
| `PORT` | no | Defaults to `5000` |

**frontend** (build time)

| Name | Description |
|---|---|
| `VITE_API_URL` | API base URL. Defaults to `http://localhost:5000/api` in dev and the Render backend in production builds |

## Project structure

```
backend/
  index.js                 Express app, CORS, routes, Swagger
  config/db.js             MongoDB connection
  middleware/auth.js       verifyToken, requireRole, validateIds
  models/                  User, Batch, Quiz, Result (+ Doubt)
  controllers/             auth, student, teacher, AI, PDF upload
  routes/                  /api/auth, /api/student, /api/teacher (with Swagger docs)
  redisClient.js           Cache wrapper (Redis or in-memory)
frontend/
  src/api/axios.js         Axios instance (sends cookies)
  src/context/AuthContext  Logged-in user, restored on refresh via /auth/check
  src/components/          Layouts + ProtectedRoute (role based)
  src/pages/               auth, student and teacher pages
docs/                      Project overview + interview guide (HTML)
```

## Main API endpoints

| Method | Endpoint | Who |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | anyone |
| GET | `/api/auth/check` | logged in |
| POST | `/api/teacher/batch/create` · GET `/api/teacher/batches` | teacher |
| POST | `/api/teacher/create-quiz` · DELETE `/api/teacher/quiz/:quizId` | teacher |
| POST | `/api/teacher/upload-and-generate` → `/api/teacher/publish-quiz` | teacher |
| GET | `/api/teacher/dashboard`, `/api/teacher/quizzes`, `/api/teacher/leaderboard` | teacher |
| GET | `/api/student/batches` · POST `/api/student/join-batch` · DELETE `/api/student/leave-batch/:id` | student |
| GET | `/api/student/batch/:batchId/quizzes`, `/api/student/active-quizzes` | student |
| GET | `/api/student/quiz/:quizId` · POST `/api/student/submit` | student |
| GET | `/api/student/result/:quizId`, `/api/student/my-results` | student |
| POST | `/api/student/ask-ai` | student |

Full details in Swagger at `/api-docs`.
