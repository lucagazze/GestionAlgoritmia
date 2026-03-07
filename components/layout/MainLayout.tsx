import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { AIActionCenter } from '../AIActionCenter';
import { CommandPalette } from '../CommandPalette';
import { db } from '../../services/db';
import { initMetaToken } from '../../services/metaAds';

// Pages
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
import ContentIdeaDetailPage from '../../pages/ContentIdeaDetailPage';
import MarketingProposalPage from '../../pages/MarketingProposalPage';
import NewClientPage from '../../pages/NewClientPage';
import MetaAdsPage from '../../pages/MetaAdsPage';
import AIStudioPage from '../../pages/AIStudioPage';
import { GhostingAlert } from '../GhostingAlert';

export const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const isDark = localStorage.getItem('theme') === 'dark';
    setDarkMode(isDark);
    if (isDark) document.documentElement.classList.add('dark');
    db.settings.checkAndRunRecurringTasks();
    db.projects.checkExpirations();
    initMetaToken();
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const isPortal = location.pathname.startsWith('/portal/');

  return (
    <div className="flex min-h-screen bg-[#f5f5f7] dark:bg-[#0a0a0a] text-zinc-900 dark:text-zinc-100 transition-colors duration-300">
      {!isPortal && (
        <Sidebar
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
        />
      )}

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden h-screen relative">
        {/* Mobile header */}
        {!isPortal && (
          <div className="md:hidden h-14 border-b border-black/[0.06] dark:border-white/[0.05] flex items-center px-4 bg-white/80 dark:bg-[#161618]/80 backdrop-blur-xl sticky top-0 z-30">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-1.5 rounded-[8px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"
            >
              <Menu className="w-[18px] h-[18px]" />
            </button>
            <span className="ml-2 text-[15px] font-semibold text-zinc-900 dark:text-white tracking-[-0.02em]">
              Algoritmia
            </span>
          </div>
        )}

        <div className={`flex-1 overflow-auto ${isPortal ? '' : 'p-4 md:p-8 lg:p-10'} max-w-[1600px] mx-auto w-full pb-24 md:pb-10`}>
          <Routes>
            <Route path="/"                     element={<DashboardPage />} />
            <Route path="/calculator"           element={<CalculatorPage />} />
            <Route path="/payments"             element={<PaymentsPage />} />
            <Route path="/projects"             element={<ProjectsPage />} />
            <Route path="/projects/new"         element={<NewClientPage />} />
            <Route path="/projects/:id"         element={<ProjectDetailPage />} />
            <Route path="/partners"             element={<PartnersPage />} />
            <Route path="/partners/:id"         element={<ContractorDetailPage />} />
            <Route path="/tasks"                element={<TasksPage />} />
            <Route path="/content-ideas"        element={<ContentIdeasPage />} />
            <Route path="/content-ideas/:id"    element={<ContentIdeaDetailPage />} />
            <Route path="/roles"                element={<RolesPage />} />
            <Route path="/services"             element={<ServicesPage />} />
            <Route path="/quotations"           element={<QuotationsPage />} />
            <Route path="/settings"             element={<SettingsPage />} />
            <Route path="/sales-copilot"        element={<SalesCopilotPage />} />
            <Route path="/lab"                  element={<LabPage />} />
            <Route path="/playbooks"            element={<PlaybooksPage />} />
            <Route path="/automations"          element={<AutomationsPage />} />
            <Route path="/portal/:token"        element={<ClientPortalPage />} />
            <Route path="/audit"                element={<AuditPage />} />
            <Route path="/marketing-proposal"   element={<MarketingProposalPage />} />
            <Route path="/meta-ads"             element={<MetaAdsPage />} />
            <Route path="/ai-studio"            element={<AIStudioPage />} />
          </Routes>
        </div>

        {!isPortal && (
          <>
            <AIActionCenter />
            <CommandPalette />
            <GhostingAlert />
          </>
        )}
      </main>
    </div>
  );
};
