// src/api/axios.js
import axios from "axios";

// VITE_API_URL wins if set (e.g. "/api" in Docker). Otherwise: local backend in dev,
// the hosted Render backend in production builds.
const baseURL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:5000/api" : "https://quizapp-backend-frj2.onrender.com/api");

const instance = axios.create({
  baseURL,
  withCredentials: true, // very important for cookies
});

// Pull a readable error message out of any API error
export const getErrorMessage = (err, fallback = "Something went wrong") =>
  err?.response?.data?.error || err?.response?.data?.message || fallback;

export default instance;
