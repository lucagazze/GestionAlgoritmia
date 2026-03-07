import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { MainLayout } from './components/layout/MainLayout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import PublicContentIdeaPage from './pages/PublicContentIdeaPage'; // Future implementation

// Protected Route Component
const ProtectedRoute = () => {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#f5f5f7] dark:bg-[#0a0a0a]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-[12px] bg-zinc-900 dark:bg-white flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.15)]">
          <span className="text-white dark:text-zinc-900 text-[14px] font-bold">A</span>
        </div>
        <div className="w-5 h-5 border-2 border-zinc-300 dark:border-zinc-700 border-t-zinc-900 dark:border-t-white rounded-full animate-spin" />
      </div>
    </div>
  );
  
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            
            {/* Public Routes - defined here to bypass MainLayout authentication check */}
            <Route path="/p/:id" element={<PublicContentIdeaPage />} />

            {/* Application Routes - Wrapped in MainLayout */}
            {/* Note: MainLayout currently contains the Routes logic, which is duplicating/conflicting if we nest Routes here */}
            {/* Strategy: We render MainLayout as the element for /*, and MainLayout handles internal routing */}
            {/* BUT, we need to protect MainLayout. So we wrap it in ProtectedRoute */}
            
            <Route element={<ProtectedRoute />}>
               <Route path="/*" element={<MainLayout />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}
