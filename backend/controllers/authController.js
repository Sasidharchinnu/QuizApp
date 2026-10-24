import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js'; // Note the `.js` extension is required

const ONE_DAY = 24 * 60 * 60 * 1000;

// Over HTTPS (production, frontend and backend on different domains) the cookie must be
// SameSite=None + Secure. Over plain HTTP (local dev / docker) use Lax so browsers accept it.
const cookieOptions = (req) => {
  const isHttps = req.secure;
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'None' : 'Lax',
  };
};

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

const issueToken = (req, res, user) => {
  const token = jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
  res.cookie('token', token, { ...cookieOptions(req), maxAge: ONE_DAY });
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    const isMatch = user && await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Login failed for email:', email);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    issueToken(req, res, user);

    console.log(`User logged in: ${email}`);
    res.json({ message: 'Login successful', user: publicUser(user) });
  } catch (err) {
    console.log('Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
};

export const register = async (req, res) => {
  const { name, email, password, role = 'student' } = req.body;

  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (!['student', 'teacher'].includes(role)) {
    return res.status(400).json({ error: 'Role must be student or teacher' });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name: name.trim(), email: normalizedEmail, password: hashedPassword, role });

    // Log the user in straight away
    issueToken(req, res, user);

    console.log(`User registered: ${normalizedEmail} as ${role}`);
    res.status(201).json({ message: 'User registered successfully', user: publicUser(user) });
  } catch (err) {
    console.log('Registration error:', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
};

// GET /api/auth/check → used by the frontend on page load to restore the session
export const checkAuth = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('name email role');
    if (!user) return res.status(401).json({ valid: false, error: 'User no longer exists' });
    res.json({ valid: true, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ valid: false, error: 'Auth check failed' });
  }
};

export const logout = (req, res) => {
  res.clearCookie('token', cookieOptions(req));
  console.log('User logged out.');
  res.json({ message: 'Logged out successfully' });
};
