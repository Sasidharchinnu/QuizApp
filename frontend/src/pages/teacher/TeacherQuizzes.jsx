import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios, { getErrorMessage } from '../../api/axios'; // axios instance with withCredentials
import TeacherLayout from '../../components/TeacherLayout';

const TeacherQuizzes = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
  const fetchQuizzes = async () => {
    try {
      const res = await axios.get('/teacher/quizzes'); // ✅ correct path
      setQuizzes(res.data.quizzes || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching quizzes:', err.response?.data || err.message);
      setError('Failed to load quizzes');
      setLoading(false);
    }
  };

  fetchQuizzes();
}, []);

  const handleDelete = async (quiz) => {
    if (!window.confirm(`Delete "${quiz.title}"? All student results for it will also be deleted.`)) return;
    try {
      await axios.delete(`/teacher/quiz/${quiz._id}`);
      setQuizzes(prev => prev.filter(q => q._id !== quiz._id));
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to delete quiz'));
    }
  };


  return (
    <TeacherLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-900">My Quizzes</h1>

        {loading ? (
          <p className="text-gray-600">Loading quizzes...</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : quizzes.length === 0 ? (
          <p className="text-gray-500">No quizzes created yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded-xl shadow border border-gray-200">
              <thead>
                <tr className="bg-gray-100 text-gray-700 text-sm uppercase">
                  <th className="px-6 py-3 text-left">Title</th>
                  <th className="px-6 py-3 text-left">Batch</th>
                  <th className="px-6 py-3 text-left">Deadline</th>
                  <th className="px-6 py-3 text-left">Questions</th>
                  <th className="px-6 py-3 text-left">Source</th>
                  <th className="px-6 py-3 text-left">Avg. Score</th>
                  <th className="px-6 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {quizzes.map((quiz) => (
                  <tr key={quiz._id} className="border-t text-gray-700 hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">{quiz.title}</td>
                    <td className="px-6 py-4">{quiz.batch?.name || 'N/A'}</td>
                    <td className="px-6 py-4">
                      {quiz.deadline
                        ? new Date(quiz.deadline).toLocaleString()
                        : 'No deadline'}
                    </td>
                    <td className="px-6 py-4">{quiz.questions?.length || 0}</td>
                    <td className="px-6 py-4 capitalize">{quiz.source}</td>
                    <td className="px-6 py-4">{quiz.avgScore}%</td>
                    <td className="px-6 py-4 space-x-3 whitespace-nowrap">
                      <Link to={`/teacher/leaderboard?quizId=${quiz._id}`} className="text-blue-600 hover:underline text-sm">
                        Results
                      </Link>
                      <button onClick={() => handleDelete(quiz)} className="text-red-600 hover:underline text-sm">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </TeacherLayout>
  );
};

export default TeacherQuizzes;
