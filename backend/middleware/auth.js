// backend/middleware/auth.js

import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

export const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // contains userId, role
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'Access denied: incorrect role' });
    }
    next();
  };
};

// Rejects requests whose :param values are not valid MongoDB ObjectIds
export const validateIds = (...params) => (req, res, next) => {
  for (const p of params) {
    if (req.params[p] && !mongoose.isValidObjectId(req.params[p])) {
      return res.status(400).json({ error: `Invalid ${p}` });
    }
  }
  next();
};
