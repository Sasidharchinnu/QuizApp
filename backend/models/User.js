import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'teacher'], default: 'student' },
  batches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }] 
});

// email already has a unique index (used for fast login lookup)

const User = mongoose.model('User', userSchema);
export default User;
