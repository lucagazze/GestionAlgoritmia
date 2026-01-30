import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Calculator, LayoutGrid, CheckSquare, Briefcase, Menu, X, ArrowUpRight, Home, Globe, Palette } from 'lucide-react';
import CalculatorPage from './pages/CalculatorPage';
import ServicesPage from './pages/ServicesPage';
import ProjectsPage from './pages/ProjectsPage';
import TasksPage from './pages/TasksPage';
import DashboardPage from './pages/DashboardPage';

const Sidebar = ({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (v: boolean) => void }) => {
  const location = useLocation();
  
  const links = [
    { path: '/', icon: <Home className="w-5 h-5" />, label: 'Inicio' },
    { path: '/projects', icon: <Briefcase className="w-5 h-5" />, label: 'Proyectos & Pagos' },
    { path: '/tasks', icon: <CheckSquare className="w-5 h-5" />, label: 'Tareas' },
    { path: '/calculator', icon: <Calculator className="w-5 h-5" />, label: 'Calculadora' },
    { path: '/services', icon: <LayoutGrid className="w-5 h-5" />, label: 'Catálogo' },
  ];

  const NavItem: React.FC<{ path: string, icon: React.ReactNode, label: string }> = ({ path, icon, label }) => {
    const isActive = location.pathname === path;
    return (
      <Link 
        to={path} 
        onClick={() => window.innerWidth < 768 && setIsOpen(false)}
        className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group relative ${
          isActive 
          ? 'bg-black text-white shadow-lg shadow-black/20' 
          : 'text-gray-500 hover:text-black hover:bg-white'
        }`}
      >
        {icon}
        {label}
        {isActive && <div className="absolute right-3 w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>}
      </Link>
    );
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden" 
          onClick={() => setIsOpen(false)}
        />
      )}
      
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-gray-50/80 backdrop-blur-xl border-r border-gray-200 transform transition-transform duration-300 ease-in-out
        md:translate-x-0 md:static md:h-screen flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-20 flex items-center px-8 border-b border-gray-100">
          <div className="w-8 h-8 bg-black rounded-lg mr-3 flex items-center justify-center text-white font-bold tracking-tighter">AL</div>
          <div>
            <span className="font-bold text-lg tracking-tight block leading-none">Algoritmia</span>
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Agency OS 3.0</span>
          </div>
          <button className="ml-auto md:hidden" onClick={() => setIsOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-6 space-y-2 flex-1">
          {links.map(link => <NavItem key={link.path} {...link} />)}
          
          <div className="pt-8 mt-4 border-t border-gray-200/50 space-y-1">
             <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Accesos Directos</p>
             
             <a href="https://algoritmiadesarrollos.com.ar/" target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-2 text-sm text-gray-500 hover:text-black transition-colors hover:bg-gray-100/50 rounded-lg">
                <Globe className="w-4 h-4 text-indigo-500" /> Mi Web
             </a>

             <a href="https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1015285380135120&business_id=1149946139536218&breakdown_regrouping=true&nav_source=no_referrer" target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-2 text-sm text-gray-500 hover:text-black transition-colors hover:bg-gray-100/50 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-blue-500 ml-1 mr-1"></div> Meta Ads
             </a>
             
             <a href="https://drive.google.com/drive/u/0/my-drive" target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-2 text-sm text-gray-500 hover:text-black transition-colors hover:bg-gray-100/50 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-green-500 ml-1 mr-1"></div> Google Drive
             </a>

             <a href="https://www.canva.com/projects" target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-2 text-sm text-gray-500 hover:text-black transition-colors hover:bg-gray-100/50 rounded-lg">
                <Palette className="w-4 h-4 text-cyan-500" /> Canva
             </a>
          </div>
        </nav>

        <div className="p-6 border-t border-gray-200 bg-white/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gray-900 to-gray-700 flex items-center justify-center text-xs font-bold text-white shadow-md">
              LU
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Luca</p>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <p className="text-xs text-gray-500">Algoritmia Admin</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <Router>
      <div className="flex min-h-screen bg-[#FAFAFA] text-gray-900 font-sans selection:bg-black selection:text-white">
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
        
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden h-screen">
          {/* Mobile Header */}
          <div className="md:hidden h-16 border-b border-gray-200 flex items-center px-4 bg-white/80 backdrop-blur-md sticky top-0 z-30">
            <button onClick={() => setSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <span className="ml-4 font-bold text-lg">Algoritmia OS</span>
          </div>

          <div className="flex-1 overflow-auto p-4 md:p-8 lg:p-10 max-w-[1600px] mx-auto w-full">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/calculator" element={<CalculatorPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/services" element={<ServicesPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}
