import React, { useState, useEffect } from 'react';
import TeacherLayout from '../../components/TeacherLayout';
import { Plus, Trash2, Save } from 'lucide-react';
import axios, { getErrorMessage } from '../../api/axios';

const ManualCreate = () => {
  const [quizData, setQuizData] = useState({
    title: '',
    batch: '',
    deadline: '',
    duration: 30, // Default duration in minutes
    questions: [
      {
        id: 1,
        question: '',
        options: ['', '', '', ''],
        correct: 0,
        explanation: ''
      }
    ]
  });

  const [batches, setBatches] = useState([]);
  const [status, setStatus] = useState({ type: '', text: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const res = await axios.get('/teacher/batches');
        setBatches(res.data);
      } catch (err) {
        console.error('❌ Failed to fetch batches:', err);
      }
    };
    fetchBatches();
  }, []);

  const addQuestion = () => {
    const newQuestion = {
      id: Date.now(),
      question: '',
      options: ['', '', '', ''],
      correct: 0,
      explanation: ''
    };
    setQuizData({ ...quizData, questions: [...quizData.questions, newQuestion] });
  };

  const deleteQuestion = (id) => {
    setQuizData({
      ...quizData,
      questions: quizData.questions.filter(q => q.id !== id)
    });
  };

  const updateQuestion = (id, field, value) => {
    setQuizData({
      ...quizData,
      questions: quizData.questions.map(q =>
        q.id === id ? { ...q, [field]: value } : q
      )
    });
  };

  const updateOption = (id, index, value) => {
    setQuizData({
      ...quizData,
      questions: quizData.questions.map(q =>
        q.id === id
          ? { ...q, options: q.options.map((opt, i) => (i === index ? value : opt)) }
          : q
      )
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', text: '' });
    setSaving(true);

    try {
      const formattedQuestions = quizData.questions.map(q => ({
        question: q.question,
        options: q.options,
        correctAnswer: q.correct, // index of the correct option
        explanation: q.explanation
      }));

      const payload = {
        title: quizData.title,
        batchId: quizData.batch,
        deadline: quizData.deadline ? new Date(quizData.deadline).toISOString() : null,
        duration: Number(quizData.duration),
        questions: formattedQuestions
      };

      await axios.post('/teacher/create-quiz', payload);

      setStatus({ type: 'success', text: `Quiz "${quizData.title}" created successfully!` });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setQuizData({
        title: '',
        batch: '',
        deadline: '',
        duration: 30,
        questions: [
          {
            id: 1,
            question: '',
            options: ['', '', '', ''],
            correct: 0,
            explanation: ''
          }
        ]
      });
    } catch (err) {
      setStatus({ type: 'error', text: getErrorMessage(err, 'Failed to create quiz') });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <TeacherLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Quiz</h1>
          <p className="text-gray-600">Build custom quizzes with your own questions and answers</p>
        </div>

        {status.text && (
          <div className={`max-w-4xl mx-auto mb-6 p-3 rounded-lg ${
            status.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
          }`}>
            {status.text}
          </div>
        )}
        {batches.length === 0 && (
          <div className="max-w-4xl mx-auto mb-6 p-3 rounded-lg bg-yellow-50 text-yellow-800">
            You don't have any batches yet. Create one under "Batches" first.
          </div>
        )}

        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8">
          {/* Quiz Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Quiz Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quiz Title</label>
                <input
                  type="text"
                  value={quizData.title}
                  onChange={(e) => setQuizData({ ...quizData, title: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  placeholder="Enter quiz title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Batch</label>
                <select
                  value={quizData.batch}
                  onChange={(e) => setQuizData({ ...quizData, batch: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Choose a batch...</option>
                  {batches.map(batch => (
                    <option key={batch._id} value={batch._id}>
                      {batch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Deadline (optional)</label>
                <input
                  type="datetime-local"
                  value={quizData.deadline}
                  onChange={(e) => setQuizData({ ...quizData, deadline: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration (in minutes)</label>
                <input
                  type="number"
                  value={quizData.duration}
                  onChange={(e) => setQuizData({ ...quizData, duration: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  placeholder="30"
                  min="1"
                  required
                />
              </div>
            </div>
          </div>

          {/* Questions Section */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Questions</h2>
              <button
                type="button"
                onClick={addQuestion}
                className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <Plus className="h-5 w-5 mr-2" /> Add Question
              </button>
            </div>

            {quizData.questions.map((q, index) => (
              <div key={q.id} className="mb-6 border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Question {index + 1}</h3>
                  {quizData.questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => deleteQuestion(q.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <textarea
                  className="w-full p-3 mb-4 border border-gray-300 rounded-lg"
                  placeholder="Enter question text"
                  value={q.question}
                  onChange={(e) => updateQuestion(q.id, 'question', e.target.value)}
                  required
                />

                {q.options.map((option, idx) => (
                  <div key={idx} className="flex items-center space-x-2 mb-3">
                    <input
                      type="radio"
                      name={`correct-${q.id}`}
                      checked={q.correct === idx}
                      onChange={() => updateQuestion(q.id, 'correct', idx)}
                      className="h-4 w-4 text-blue-600"
                    />
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(q.id, idx, e.target.value)}
                      className="flex-1 p-3 border border-gray-300 rounded-lg"
                      placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                      required
                    />
                  </div>
                ))}
                <p className="text-xs text-gray-500 mb-2">Select the radio button next to the correct answer.</p>
                <input
                  type="text"
                  value={q.explanation}
                  onChange={(e) => updateQuestion(q.id, 'explanation', e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-lg text-sm"
                  placeholder="Explanation shown to students after submitting (optional)"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-60"
            >
              <Save className="h-5 w-5 mr-2" /> {saving ? 'Saving...' : 'Create Quiz'}
            </button>
          </div>
        </form>
      </div>
    </TeacherLayout>
  );
};

export default ManualCreate;
