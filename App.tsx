import React from 'react';
import { HashRouter as Router } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { MainLayout } from './components/layout/MainLayout';

export default function App() {
  return (
    <Router>
      <ToastProvider>
        <MainLayout />
      </ToastProvider>
    </Router>
  );
}
