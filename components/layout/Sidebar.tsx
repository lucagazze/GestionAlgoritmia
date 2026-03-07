import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Briefcase, Activity, CalendarDays, Calculator, FileText, CheckSquare,
  Users, Rocket, Book, MessageSquareMore, LayoutGrid, Workflow, Settings,
  X, Sun, Moon, Globe, Megaphone, Target, Sparkles, HardDrive,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const sections = [
  {
    title: 'Principal',
    items: [
      { path: '/',                   icon: Home,             label: 'Inicio' },
      { path: '/projects',           icon: Briefcase,        label: 'Clientes' },
      { path: '/meta-ads',           icon: Target,           label: 'Meta Ads' },
      { path: '/payments',           icon: CalendarDays,     label: 'Pagos' },
      { path: '/tasks',              icon: CheckSquare,      label: 'Tareas' },
      { path: '/content-ideas',      icon: FileText,         label: 'Contenido' },
    ],
  },
  {
    title: 'Ventas',
    items: [
      { path: '/calculator',         icon: Calculator,       label: 'Cotizar' },
      { path: '/quotations',         icon: FileText,         label: 'Presupuestos' },
      { path: '/marketing-proposal', icon: Megaphone,        label: 'Propuesta Ads' },
      { path: '/audit',              icon: Activity,         label: 'Auditoría' },
    ],
  },
  {
    title: 'Estrategia',
    items: [
      { path: '/ai-studio',          icon: Sparkles,         label: 'AI Studio',  ai: true },
      { path: '/sales-copilot',      icon: MessageSquareMore,label: 'Copiloto IA' },
      { path: '/lab',                icon: Rocket,           label: 'The Lab' },
      { path: '/playbooks',          icon: Book,             label: 'Playbooks' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { path: '/roles',              icon: Users,            label: 'Roles' },
      { path: '/partners',           icon: Users,            label: 'Equipo' },
      { path: '/services',           icon: LayoutGrid,       label: 'Catálogo' },
      { path: '/automations',        icon: Workflow,         label: 'Automations' },
      { path: '/settings',           icon: Settings,         label: 'Ajustes' },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, darkMode, toggleDarkMode }) => {
  const location = useLocation();

  const NavItem = ({ path, icon: Icon, label, ai }: {
    path: string; icon: any; label: string; ai?: boolean;
  }) => {
    const isActive = location.pathname === path
      || (path === '/projects' && location.pathname.startsWith('/projects/'));

    if (ai) {
      return (
        <Link
          to={path}
          onClick={() => window.innerWidth < 768 && setIsOpen(false)}
          className={`group flex items-center gap-2.5 px-3 py-[7px] rounded-[8px] text-[13px] font-medium transition-all duration-150 ${
            isActive
              ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-[0_2px_8px_rgba(124,58,237,0.35)]'
              : 'text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10'
          }`}
        >
          <Icon className="w-[15px] h-[15px] flex-shrink-0" />
          <span className="flex-1 tracking-[-0.01em]">{label}</span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full tracking-wide ${
            isActive ? 'bg-white/20 text-white' : 'bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400'
          }`}>AI</span>
        </Link>
      );
    }

    return (
      <Link
        to={path}
        onClick={() => window.innerWidth < 768 && setIsOpen(false)}
        className={`group flex items-center gap-2.5 px-3 py-[7px] rounded-[8px] text-[13px] font-medium transition-all duration-150 ${
          isActive
            ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06]'
        }`}
      >
        <Icon className={`w-[15px] h-[15px] flex-shrink-0 transition-none ${
          isActive ? 'text-white dark:text-zinc-900' : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'
        }`} />
        <span className="tracking-[-0.01em]">{label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[220px]
        bg-white/90 dark:bg-[#161618]/95
        backdrop-blur-2xl
        border-r border-black/[0.06] dark:border-white/[0.05]
        flex flex-col
        transform transition-transform duration-300 ease-in-out
        md:translate-x-0 md:static md:h-screen
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>

        {/* Logo */}
        <div className="h-[60px] flex items-center px-5 border-b border-black/[0.05] dark:border-white/[0.04] flex-shrink-0">
          <div className="w-7 h-7 rounded-[8px] bg-zinc-900 dark:bg-white flex items-center justify-center flex-shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
            <span className="text-white dark:text-zinc-900 text-[11px] font-bold tracking-tight">A</span>
          </div>
          <div className="ml-3 flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-zinc-900 dark:text-white tracking-[-0.02em] leading-none">Algoritmia</p>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-600 font-medium mt-0.5 tracking-wider">OS · 2026</p>
          </div>
          <button
            className="md:hidden p-1.5 rounded-[6px] text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"
            onClick={() => setIsOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.08em] px-3 mb-1">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map(item => (
                  <NavItem key={item.path} {...item} />
                ))}
              </div>
            </div>
          ))}

          {/* Shortcuts */}
          <div className="border-t border-black/[0.05] dark:border-white/[0.04] pt-4">
            <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.08em] px-3 mb-1">
              Accesos
            </p>
            <div className="space-y-0.5">
              <a
                href="https://algoritmiadesarrollos.com.ar/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.5 px-3 py-[7px] rounded-[8px] text-[13px] font-medium text-zinc-500 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-all duration-150"
              >
                <Globe className="w-[15px] h-[15px] text-zinc-400 dark:text-zinc-600" />
                <span className="tracking-[-0.01em]">Mi Web</span>
              </a>
              <a
                href="https://drive.google.com/drive/u/0/my-drive"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.5 px-3 py-[7px] rounded-[8px] text-[13px] font-medium text-zinc-500 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-all duration-150"
              >
                <HardDrive className="w-[15px] h-[15px] text-zinc-400 dark:text-zinc-600" />
                <span className="tracking-[-0.01em]">Google Drive</span>
              </a>
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className="flex-shrink-0 px-3 py-3 border-t border-black/[0.05] dark:border-white/[0.04]">
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-8 h-8 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center text-[11px] font-bold flex-shrink-0 shadow-[0_1px_4px_rgba(0,0,0,0.15)]">
              LU
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-zinc-900 dark:text-white tracking-[-0.01em] leading-none">Luca</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">Admin</p>
              </div>
            </div>
            <button
              onClick={toggleDarkMode}
              className="p-1.5 rounded-[7px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition-all flex-shrink-0"
            >
              {darkMode
                ? <Sun className="w-4 h-4 text-amber-400" />
                : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
