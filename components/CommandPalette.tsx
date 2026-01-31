
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Briefcase, CheckSquare, Users, FileText, Settings, ArrowRight, Command, Book, Rocket, Zap } from 'lucide-react';
import { db } from '../services/db';
import { sounds } from '../services/sounds';
import { Project, Task, Service, Contractor, SOP, TaskStatus } from '../types';

interface SearchResult {
    id: string;
    type: 'PROJECT' | 'TASK' | 'SERVICE' | 'PARTNER' | 'PAGE' | 'SOP' | 'ACTION';
    title: string;
    subtitle?: string;
    url?: string;
    action?: () => void;
    icon: React.ElementType;
}

export const CommandPalette = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Data Store
    const [projects, setProjects] = useState<Project[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [partners, setPartners] = useState<Contractor[]>([]);
    const [sops, setSops] = useState<SOP[]>([]);

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setIsOpen((open) => !open);
            }
            if (e.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('keydown', down);
        
        // Load data on mount to have it ready
        Promise.all([
            db.projects.getAll(),
            db.tasks.getAll(),
            db.services.getAll(),
            db.contractors.getAll(),
            db.sops.getAll()
        ]).then(([p, t, s, c, so]) => {
            setProjects(p);
            setTasks(t);
            setServices(s);
            setPartners(c);
            setSops(so);
        });

        return () => document.removeEventListener('keydown', down);
    }, []);

    useEffect(() => {
        if (!isOpen) {
            setQuery('');
            return;
        }
    }, [isOpen]);

    useEffect(() => {
        if (!query) {
            setResults([
                { id: 'p-dash', type: 'PAGE', title: 'Dashboard', url: '/', icon: Briefcase },
                { id: 'p-proj', type: 'PAGE', title: 'Proyectos & CRM', url: '/projects', icon: Briefcase },
                { id: 'p-lab', type: 'PAGE', title: 'The Lab (Simulador)', url: '/lab', icon: Rocket },
                { id: 'p-book', type: 'PAGE', title: 'Playbooks (SOPs)', url: '/playbooks', icon: Book },
                { id: 'p-task', type: 'PAGE', title: 'Tareas', url: '/tasks', icon: CheckSquare },
                { id: 'p-calc', type: 'PAGE', title: 'Calculadora', url: '/calculator', icon: FileText },
                { id: 'p-set', type: 'PAGE', title: 'Ajustes', url: '/settings', icon: Settings },
            ]);
            return;
        }

        const lowerQuery = query.toLowerCase();
        const found: SearchResult[] = [];

        // --- QUICK ACTIONS LOGIC ---
        if (lowerQuery.startsWith('>')) {
            const clean = lowerQuery.replace('>', '').trim();
            if (clean) {
                found.push({
                    id: 'act-task',
                    type: 'ACTION',
                    title: `Crear Tarea: "${clean}"`,
                    subtitle: 'Enter para crear rápida',
                    icon: Zap,
                    action: async () => {
                        await db.tasks.create({ title: clean, status: TaskStatus.TODO, priority: 'MEDIUM' });
                        alert("Tarea creada!");
                        window.dispatchEvent(new Event('task-created'));
                        setIsOpen(false);
                    }
                });
            }
        }

        // Projects
        projects.forEach(p => {
            if (p.name.toLowerCase().includes(lowerQuery)) {
                found.push({ id: p.id, type: 'PROJECT', title: p.name, subtitle: p.status, url: `/projects/${p.id}`, icon: Briefcase });
            }
        });

        // SOPs
        sops.forEach(s => {
            if (s.title.toLowerCase().includes(lowerQuery) || s.content.toLowerCase().includes(lowerQuery)) {
                found.push({ id: s.id, type: 'SOP', title: s.title, subtitle: s.category, url: '/playbooks', icon: Book });
            }
        });

        // Tasks
        tasks.forEach(t => {
            if (t.title.toLowerCase().includes(lowerQuery)) {
                found.push({ id: t.id, type: 'TASK', title: t.title, subtitle: t.status, url: '/tasks', icon: CheckSquare });
            }
        });

        // Partners
        partners.forEach(p => {
            if (p.name.toLowerCase().includes(lowerQuery)) {
                found.push({ id: p.id, type: 'PARTNER', title: p.name, subtitle: p.role, url: '/partners', icon: Users });
            }
        });

        // Services
        services.forEach(s => {
            if (s.name.toLowerCase().includes(lowerQuery)) {
                found.push({ id: s.id, type: 'SERVICE', title: s.name, subtitle: `$${s.baseCost}`, url: '/services', icon: FileText });
            }
        });

        setResults(found.slice(0, 10));
        setSelectedIndex(0);

    }, [query, projects, tasks, services, partners, sops]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % results.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (results[selectedIndex]) {
                handleSelect(results[selectedIndex]);
            }
        }
    };

    const handleSelect = (result: SearchResult) => {
        sounds.click();
        if (result.type === 'ACTION' && result.action) {
            result.action();
        } else if (result.url) {
            navigate(result.url);
            setIsOpen(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] px-4">
            <div className="absolute inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)}></div>
            
            <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-slate-800 flex flex-col">
                <div className="flex items-center px-4 border-b border-gray-100 dark:border-slate-800">
                    <Search className="w-5 h-5 text-gray-400 mr-3" />
                    <input 
                        className="flex-1 h-14 text-lg bg-transparent border-none outline-none text-gray-800 dark:text-white placeholder:text-gray-400"
                        placeholder="Buscar o escribir '>' para comandos..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                    />
                    <div className="hidden md:flex items-center gap-1">
                        <kbd className="px-2 py-1 text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700">ESC</kbd>
                    </div>
                </div>

                <div className="max-h-[300px] overflow-y-auto p-2">
                    {results.length === 0 ? (
                        <div className="py-8 text-center text-gray-400 text-sm">No se encontraron resultados.</div>
                    ) : (
                        results.map((res, idx) => (
                            <div 
                                key={res.id}
                                onClick={() => handleSelect(res)}
                                className={`flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-colors ${idx === selectedIndex ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-200' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                            >
                                <div className={`p-2 rounded-lg ${idx === selectedIndex ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'bg-gray-100 dark:bg-slate-800 text-gray-500'}`}>
                                    <res.icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm truncate">{res.title}</div>
                                    {res.subtitle && <div className="text-xs opacity-60 truncate">{res.subtitle}</div>}
                                </div>
                                {idx === selectedIndex && <ArrowRight className="w-4 h-4 opacity-50" />}
                            </div>
                        ))
                    )}
                </div>
                
                <div className="bg-gray-50 dark:bg-slate-800/50 px-4 py-2 text-[10px] text-gray-400 border-t border-gray-100 dark:border-slate-800 flex justify-between">
                    <span>Usa "&gt;" para acciones rápidas</span>
                    <span className="flex items-center gap-1"><Command className="w-3 h-3"/> + K</span>
                </div>
            </div>
        </div>
    );
};
