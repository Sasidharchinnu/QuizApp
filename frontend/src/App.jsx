import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import TeacherDashboard from './pages/teacher/Dashboard';
import StudentDashboard from './pages/student/Dashboard';
import TeacherUpload from './pages/teacher/Upload';
import TeacherManualCreate from './pages/teacher/ManualCreate';
import TeacherLeaderboard from './pages/teacher/Leaderboard';
import StudentQuiz from './pages/student/Quiz';
import StudentResult from './pages/student/Result';
import StudentAskAI from './pages/student/AskAI';
import CreateBatch from './pages/teacher/CreateBatch';
import TeacherQuizzes from './pages/teacher/TeacherQuizzes';
import JoinBatch from './pages/student/JoinBatch';
import StudentMyResults from './pages/student/StudentMyResult';
import ActiveQuizzes from './pages/student/ActiveQuizzes';

const teacher = (page) => <ProtectedRoute role="teacher">{page}</ProtectedRoute>;
const student = (page) => <ProtectedRoute role="student">{page}</ProtectedRoute>;

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/teacher/dashboard" element={teacher(<TeacherDashboard />)} />
          <Route path="/teacher/upload" element={teacher(<TeacherUpload />)} />
          <Route path="/teacher/manual-create" element={teacher(<TeacherManualCreate />)} />
          <Route path="/teacher/leaderboard" element={teacher(<TeacherLeaderboard />)} />
          <Route path="/teacher/batches/create" element={teacher(<CreateBatch />)} />
          <Route path="/teacher/quizzes" element={teacher(<TeacherQuizzes />)} />

          <Route path="/student/dashboard" element={student(<StudentDashboard />)} />
          <Route path="/student/quiz/:quizId" element={student(<StudentQuiz />)} />
          <Route path="/student/result/:quizId" element={student(<StudentResult />)} />
          <Route path="/student/ask-ai" element={student(<StudentAskAI />)} />
          <Route path="/student/join-batch" element={student(<JoinBatch />)} />
          <Route path="/student/my-results" element={student(<StudentMyResults />)} />
          <Route path="/student/active-quizzes" element={student(<ActiveQuizzes />)} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
