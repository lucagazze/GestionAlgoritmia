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

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-black"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
  
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
