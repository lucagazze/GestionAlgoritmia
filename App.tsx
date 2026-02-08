import React from 'react';
import { HashRouter as Router } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { MainLayout } from './components/layout/MainLayout';

// Force Refresh: 2026-02-08 11:20
export default function App() {
  return (
    <Router>
      <ToastProvider>
        <MainLayout />
      </ToastProvider>
    </Router>
  );
}
