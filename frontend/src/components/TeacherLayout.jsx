import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  BarChart3,
  LogOut,
  GraduationCap,
  FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const TeacherLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth(); // route access is guarded by ProtectedRoute

  const navigation = [
    { name: 'Dashboard', href: '/teacher/dashboard', icon: LayoutDashboard },
    { name: 'Create Quiz', href: '/teacher/manual-create', icon: BookOpen },
    { name: 'My Quizzes', href: '/teacher/quizzes', icon: FileText },
    { name: 'Leaderboard', href: '/teacher/leaderboard', icon: BarChart3 },
    { name: 'Batches', href: '/teacher/batches/create', icon: Users },
  ];

  const isActive = (path) => location.pathname === path;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 sticky top-0 h-screen bg-white shadow-lg border-r border-gray-200 flex flex-col justify-between">
          <div>
          <div className="p-6">
            <div className="flex items-center space-x-2">
              <GraduationCap className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">QuizApp</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">Teacher Dashboard</p>
            <p className="text-xs text-gray-400 mt-1 truncate">{user?.name}</p>
          </div>

          <nav className="mt-6">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-6 py-3 text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                      : 'text-gray-700 hover:text-blue-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          </div>

          <div className="p-6">
            <button
              onClick={handleLogout}
              className="flex items-center text-gray-700 hover:text-red-600 transition-colors"
            >
              <LogOut className="h-5 w-5 mr-3" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
};

export default TeacherLayout;
