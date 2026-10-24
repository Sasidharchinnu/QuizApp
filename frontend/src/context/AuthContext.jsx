import { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "../api/axios";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // user = { id, name, email, role } when logged in, null otherwise
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Ask the backend whether the httpOnly cookie is still valid (runs on page load/refresh)
  const checkAuth = useCallback(async () => {
    try {
      const res = await axios.get("/auth/check");
      setUser(res.data?.valid ? res.data.user : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = (userData) => setUser(userData);

  const logout = async () => {
    try {
      await axios.post("/auth/logout");
    } catch (e) {
      console.error("Logout failed", e);
    } finally {
      setUser(null);
    }
  };

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <AuthContext.Provider value={{ user, token: !!user, loading, login, logout, checkAuth }}>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
