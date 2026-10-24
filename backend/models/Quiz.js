import mongoose from 'mongoose';

const quizSchema = new mongoose.Schema({
  title: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // teacher
  batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
  // Kept so older quizzes still validate; all new quizzes are 'manual'
  source: { type: String, enum: ['ai', 'manual'], default: 'manual' },
  deadline: { type: Date, default: null }, // null = no deadline
  duration: { type: Number, required: true, default: 30 }, // ✅ duration in minutes
  avgScore: { type: Number, default: 0 },
  questions: [
    {
      question: { type: String, required: true },
      options: [{ type: String, required: true }],
      correctAnswer: { type: Number, required: true }, // index into options
      explanation: { type: String, default: '' }
    }
  ]
}, { timestamps: true });

quizSchema.index({ createdBy: 1, createdAt: -1 }); // Teacher queries
quizSchema.index({ batch: 1, deadline: 1 });       // Student batch queries

const Quiz = mongoose.model('Quiz', quizSchema);
export default Quiz;

