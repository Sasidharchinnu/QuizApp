import express from 'express';
import { login, register, logout, checkAuth } from '../controllers/authController.js';
import { verifyToken } from '../middleware/auth.js';

const authRouter = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User authentication endpoints
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Log in a user (sets an httpOnly "token" cookie)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid email or password
 */
authRouter.post('/login', login);

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user (also logs them in)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [student, teacher]
 *     responses:
 *       201:
 *         description: User registered successfully
 *       409:
 *         description: Email already in use
 */
authRouter.post('/register', register);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Log out a user
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
authRouter.post('/logout', logout);

/**
 * @swagger
 * /auth/check:
 *   get:
 *     summary: Check if the JWT cookie is valid and return the logged-in user
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Token valid
 *         content:
 *           application/json:
 *             example:
 *               valid: true
 *               user: { name: "John", email: "john@example.com", role: "student" }
 */
authRouter.get('/check', verifyToken, checkAuth);

export default authRouter;
