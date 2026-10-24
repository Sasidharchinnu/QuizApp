import React, { useEffect, useState } from 'react';
import axios, { getErrorMessage } from '../../api/axios'; // Uses instance with withCredentials: true
import TeacherLayout from '../../components/TeacherLayout';

const CreateBatch = () => {
  const [batchName, setBatchName] = useState('');
  const [batches, setBatches] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchBatches = async () => {
    try {
      const res = await axios.get('/teacher/batches');
      setBatches(res.data || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load batches.'));
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    try {
      // Students join batches themselves from their dashboard
      const res = await axios.post('/teacher/batch/create', { name: batchName });

      setMessage(`Batch "${res.data.batch.name}" created successfully. Students can now join it.`);
      setBatchName('');
      fetchBatches();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create batch.'));
    }
  };

  return (
    <TeacherLayout>
      <div className="max-w-3xl mx-auto mt-10 px-6 space-y-8">
        <div className="p-6 bg-white shadow rounded-lg">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Create a New Batch</h2>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block font-medium text-gray-700 mb-1">Batch Name</label>
              <input
                type="text"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                required
                className="w-full border border-gray-300 p-2 rounded-lg focus:outline-none focus:ring focus:ring-blue-300"
                placeholder="e.g., CS-A 2025"
              />
            </div>

            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Create Batch
            </button>

            {message && <p className="mt-4 text-green-600 font-medium">{message}</p>}
            {error && <p className="mt-4 text-red-600 font-medium">{error}</p>}
          </form>
        </div>

        <div className="p-6 bg-white shadow rounded-lg">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Your Batches</h2>
          {batches.length === 0 ? (
            <p className="text-gray-500">No batches yet.</p>
          ) : (
            <ul className="space-y-3">
              {batches.map((batch) => (
                <li key={batch._id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-800">{batch.name}</span>
                    <span className="text-sm text-gray-500">{batch.students.length} student(s)</span>
                  </div>
                  {batch.students.length > 0 && (
                    <p className="text-sm text-gray-600 mt-2">
                      {batch.students.map((s) => s.name).join(', ')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </TeacherLayout>
  );
};

export default CreateBatch;
