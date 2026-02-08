import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { AIActionCenter } from '../AIActionCenter';
import { CommandPalette } from '../CommandPalette';
import { db } from '../../services/db';

// Import Pages
import CalculatorPage from '../../pages/CalculatorPage';
import ServicesPage from '../../pages/ServicesPage';
import ProjectsPage from '../../pages/ProjectsPage';
import ProjectDetailPage from '../../pages/ProjectDetailPage';
import TasksPage from '../../pages/TasksPage';
import DashboardPage from '../../pages/DashboardPage';
import PartnersPage from '../../pages/PartnersPage';
import ContractorDetailPage from '../../pages/ContractorDetailPage';
import SettingsPage from '../../pages/SettingsPage';
import SalesCopilotPage from '../../pages/SalesCopilotPage';
import LabPage from '../../pages/LabPage';
import PlaybooksPage from '../../pages/PlaybooksPage';
import ClientPortalPage from '../../pages/ClientPortalPage'; 
import PaymentsPage from '../../pages/PaymentsPage';
import AuditPage from '../../pages/AuditPage';
import AutomationsPage from '../../pages/AutomationsPage';
import QuotationsPage from '../../pages/QuotationsPage';
import RolesPage from '../../pages/RolesPage';
import ContentIdeasPage from '../../pages/ContentIdeasPage';
import ContentIdeaDetailPage from '../../pages/ContentIdeaDetailPage'; // ✅ ADDED

export const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const location = useLocation();

  // Dark Mode Init
  useEffect(() => {
      const isDark = localStorage.getItem('theme') === 'dark';
      setDarkMode(isDark);
      if (isDark) document.documentElement.classList.add('dark');
      
      // Run Recurring Task Automation on App Load
      db.settings.checkAndRunRecurringTasks();
      
      // Check for Expired Contracts (Auto-Pause)
      db.projects.checkExpirations();
  }, []);

  const toggleDarkMode = () => {
      setDarkMode(!darkMode);
      if (!darkMode) {
          document.documentElement.classList.add('dark');
          localStorage.setItem('theme', 'dark');
      } else {
          document.documentElement.classList.remove('dark');
          localStorage.setItem('theme', 'light');
      }
  };

  const isPortal = location.pathname.startsWith('/portal/');

  return (
      <div className="flex min-h-screen bg-[#FAFAFA] dark:bg-[#020617] text-gray-900 dark:text-gray-100 font-sans selection:bg-black dark:selection:bg-white selection:text-white dark:selection:text-black transition-colors duration-300">
        {!isPortal && <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />}
        
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden h-screen relative">
          {/* Mobile Header (Hidden in Portal) */}
          {!isPortal && (
              <div className="md:hidden h-16 border-b border-gray-200 dark:border-slate-800 flex items-center px-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
                <button onClick={() => setSidebarOpen(true)} className="text-gray-900 dark:text-white p-2 -ml-2">
                  <Menu className="w-6 h-6" />
                </button>
                <span className="ml-3 font-bold text-lg text-gray-900 dark:text-white">Algoritmia OS</span>
              </div>
          )}

          <div className={`flex-1 overflow-auto ${isPortal ? '' : 'p-3 md:p-8 lg:p-10'} max-w-[1600px] mx-auto w-full custom-scrollbar pb-24 md:pb-8`}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/calculator" element={<CalculatorPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route path="/partners" element={<PartnersPage />} />
              <Route path="/partners/:id" element={<ContractorDetailPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/content-ideas" element={<ContentIdeasPage />} />
              <Route path="/content-ideas/:id" element={<ContentIdeaDetailPage />} /> {/* ✅ ADDED */}
              <Route path="/roles" element={<RolesPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/quotations" element={<QuotationsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/sales-copilot" element={<SalesCopilotPage />} />
              <Route path="/lab" element={<LabPage />} />
              <Route path="/playbooks" element={<PlaybooksPage />} />
              <Route path="/automations" element={<AutomationsPage />} />
              <Route path="/portal/:token" element={<ClientPortalPage />} />
              <Route path="/audit" element={<AuditPage />} />
            </Routes>
          </div>

          {/* AI Action Center & Global Search (Hidden in Portal) */}
          {!isPortal && (
            <>
              <AIActionCenter />
              <CommandPalette />
            </>
          )}
          
        </main>
      </div>
  );
};
