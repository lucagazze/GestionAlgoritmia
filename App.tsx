
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Calculator, LayoutGrid, CheckSquare, Briefcase, Menu, X, ArrowUpRight, Home, Globe, Palette, Users, Settings, MessageSquareMore, PieChart, Wallet, CreditCard, Rocket, Book, CalendarDays, Moon, Sun, Activity, Workflow } from 'lucide-react';
import CalculatorPage from './pages/CalculatorPage';
import ServicesPage from './pages/ServicesPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import TasksPage from './pages/TasksPage';
import DashboardPage from './pages/DashboardPage';
import PartnersPage from './pages/PartnersPage';
import SettingsPage from './pages/SettingsPage';
import SalesCopilotPage from './pages/SalesCopilotPage';
import LabPage from './pages/LabPage';
import PlaybooksPage from './pages/PlaybooksPage';
import ClientPortalPage from './pages/ClientPortalPage'; 
import PaymentsPage from './pages/PaymentsPage';
import AuditPage from './pages/AuditPage';
import AutomationsPage from './pages/AutomationsPage';
import { AIActionCenter } from './components/AIActionCenter';
import { CommandPalette } from './components/CommandPalette';
import { db } from './services/db';
import { ToastProvider } from './components/Toast';

const Sidebar = ({ isOpen, setIsOpen, darkMode, toggleDarkMode }: { isOpen: boolean, setIsOpen: (v: boolean) => void, darkMode: boolean, toggleDarkMode: () => void }) => {
  const location = useLocation();
  
  const sections = [
      {
          title: "PRINCIPAL",
          items: [
              { path: '/', icon: <Home className="w-5 h-5" />, label: 'Inicio', color: 'text-gray-900 dark:text-white' },
              { path: '/projects', icon: <Briefcase className="w-5 h-5" />, label: 'Clientes (Ops)', color: 'text-blue-600 dark:text-blue-400' },
              { path: '/audit', icon: <Activity className="w-5 h-5" />, label: 'Auditoría', color: 'text-red-600 dark:text-red-400' },
              { path: '/payments', icon: <CalendarDays className="w-5 h-5" />, label: 'Pagos', color: 'text-emerald-600 dark:text-emerald-400' },
              { path: '/calculator', icon: <Calculator className="w-5 h-5" />, label: 'Cotizar', color: 'text-gray-600 dark:text-gray-300' },
              { path: '/tasks', icon: <CheckSquare className="w-5 h-5" />, label: 'Tareas', color: 'text-orange-600 dark:text-orange-400' },
              { path: '/partners', icon: <Users className="w-5 h-5" />, label: 'Equipo', color: 'text-purple-600 dark:text-purple-400' },
          ]
      },
      {
          title: "ESTRATEGIA",
          items: [
              { path: '/lab', icon: <Rocket className="w-5 h-5" />, label: 'The Lab', color: 'text-pink-600 dark:text-pink-400' },
              { path: '/playbooks', icon: <Book className="w-5 h-5" />, label: 'Playbooks', color: 'text-amber-600 dark:text-amber-400' },
              { path: '/sales-copilot', icon: <MessageSquareMore className="w-5 h-5" />, label: 'Copiloto IA', color: 'text-indigo-600 dark:text-indigo-400' },
          ]
      },
      {
          title: "SISTEMA",
          items: [
              { path: '/services', icon: <LayoutGrid className="w-5 h-5" />, label: 'Catálogo', color: 'text-gray-600 dark:text-gray-400' },
              { path: '/automations', icon: <Workflow className="w-5 h-5" />, label: 'Automations', color: 'text-purple-600 dark:text-purple-400' },
              { path: '/settings', icon: <Settings className="w-5 h-5" />, label: 'Ajustes', color: 'text-gray-600 dark:text-gray-400' },
          ]
      }
  ];

  const NavItem: React.FC<{ path: string, icon: React.ReactNode, label: string, color: string }> = ({ path, icon, label, color }) => {
    const isActive = location.pathname === path || (path === '/projects' && location.pathname.includes('/projects/'));
    return (
      <Link 
        to={path} 
        onClick={() => window.innerWidth < 768 && setIsOpen(false)}
        className={`flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 group relative ${
          isActive 
          ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg shadow-black/20 dark:shadow-white/10' 
          : 'text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-white/80 dark:hover:bg-slate-800'
        }`}
      >
        <span className={isActive ? 'text-white dark:text-black' : color}>{icon}</span>
        {label}
        {isActive && <div className="absolute right-3 w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>}
      </Link>
    );
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden" 
          onClick={() => setIsOpen(false)}
        />
      )}
      
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-gray-50/95 dark:bg-slate-900/95 backdrop-blur-xl border-r border-gray-200 dark:border-slate-800 transform transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none
        md:translate-x-0 md:static md:h-screen flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-20 flex items-center px-8 border-b border-gray-100 dark:border-slate-800">
          <div className="w-8 h-8 bg-black dark:bg-white rounded-lg mr-3 flex items-center justify-center text-white dark:text-black font-bold tracking-tighter">AL</div>
          <div>
            <span className="font-bold text-lg tracking-tight block leading-none text-gray-900 dark:text-white">Algoritmia</span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">Agency OS 3.1</span>
          </div>
          <button className="ml-auto md:hidden text-gray-500 dark:text-gray-400 p-1 hover:bg-gray-200 rounded-md" onClick={() => setIsOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-6 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
          {sections.map((section, idx) => (
              <div key={idx}>
                  <p className="px-4 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">{section.title}</p>
                  <div className="space-y-1">
                      {section.items.map(link => <NavItem key={link.path} {...link} />)}
                  </div>
              </div>
          ))}
          
          <div className="pt-6 border-t border-gray-200/50 dark:border-slate-800 space-y-1">
             <p className="px-4 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">Accesos Directos</p>
             
             <a href="https://algoritmiadesarrollos.com.ar/" target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 font-medium hover:text-black dark:hover:text-white transition-colors hover:bg-gray-100/50 dark:hover:bg-slate-800 rounded-lg">
                <Globe className="w-4 h-4 text-indigo-500" /> Mi Web
             </a>
             
             <a href="https://drive.google.com/drive/u/0/my-drive" target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 font-medium hover:text-black dark:hover:text-white transition-colors hover:bg-gray-100/50 dark:hover:bg-slate-800 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-green-500 ml-1 mr-1"></div> Google Drive
             </a>
          </div>
        </nav>

        <div className="p-6 border-t border-gray-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center text-xs font-bold shadow-md">
                  LU
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Luca</p>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Admin</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={toggleDarkMode}
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                  {darkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-indigo-600" />}
              </button>
          </div>
        </div>
      </aside>
    </>
  );
};

const MainLayout = () => {
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
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/services" element={<ServicesPage />} />
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

export default function App() {
  return (
    <Router>
      <ToastProvider>
        <MainLayout />
      </ToastProvider>
    </Router>
  );
}
