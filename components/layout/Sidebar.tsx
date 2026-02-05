import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, Briefcase, Activity, CalendarDays, Calculator, FileText, CheckSquare, 
  Users, Rocket, Book, MessageSquareMore, LayoutGrid, Workflow, Settings, 
  X, Sun, Moon, Globe 
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, darkMode, toggleDarkMode }) => {
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
              { path: '/quotations', icon: <FileText className="w-5 h-5" />, label: 'Presupuestos', color: 'text-pink-600 dark:text-pink-400' },
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
          <img src="/logo.png" alt="Algoritmia Logo" className="w-8 h-8 mr-3 object-contain" />
          <div>
            <span className="font-bold text-lg tracking-tight block leading-none text-gray-900 dark:text-white">Algoritmia</span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">2026</span>
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
