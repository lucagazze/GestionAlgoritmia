
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { Project, Contractor, ProjectStatus } from '../types';
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, DollarSign, Wallet, CalendarRange, BarChart3 } from 'lucide-react';
import { Card, Button } from '../components/UIComponents';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

export default function PaymentsPage() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [referenceDate, setReferenceDate] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'CALENDAR' | 'FORECAST'>('CALENDAR');

    useEffect(() => {
        const load = async () => {
            const data = await db.projects.getAll();
            setProjects(data);
            setLoading(false);
        };
        load();
    }, []);

    // --- FINANCIAL DATA COMMON ---
    const activeProjects = projects.filter(p => p.status === ProjectStatus.ACTIVE);

    // --- CALENDAR LOGIC ---
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday
    
    const daysArray = Array.from({ length: 42 }, (_, i) => {
        const dayNumber = i - firstDayIndex + 1;
        if (dayNumber > 0 && dayNumber <= daysInMonth) {
            return new Date(year, month, dayNumber);
        }
        return null; 
    });

    const totalIn = activeProjects.reduce((acc, p) => acc + (p.monthlyRevenue || 0), 0);
    const totalOut = activeProjects.reduce((acc, p) => acc + (p.outsourcingCost || 0) + (p.internalCost || 0), 0);
    const net = totalIn - totalOut;

    const getEventsForDate = (date: Date) => {
        if (!date) return [];
        const day = date.getDate();
        const events: { type: 'IN' | 'OUT', label: string, amount: number, projectId?: string }[] = [];

        // Incoming: Client Billings
        activeProjects.forEach(p => {
            const billDay = p.billingDay || 1;
            if (billDay === day) {
                events.push({ type: 'IN', label: p.name, amount: p.monthlyRevenue, projectId: p.id });
            }
        });

        // Outgoing: Partner Payments (Estimated on day 5)
        if (day === 5) {
            activeProjects.forEach(p => {
                if (p.outsourcingCost && p.outsourcingCost > 0) {
                    events.push({ type: 'OUT', label: `Socio (${p.name})`, amount: p.outsourcingCost });
                }
            });
        }
        
        // Internal Costs (Estimated on day 1)
        if (day === 1) {
             activeProjects.forEach(p => {
                if (p.internalCost && p.internalCost > 0) {
                    events.push({ type: 'OUT', label: `Interno (${p.name})`, amount: p.internalCost });
                }
            });
        }

        return events;
    };

    // --- FORECAST LOGIC (90 DAYS) ---
    const forecastData = useMemo(() => {
        const data = [];
        const today = new Date();
        
        for (let i = 0; i < 3; i++) {
            const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
            const monthName = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
            
            // Assume active projects stay active (Conservative projection)
            // Future improvement: Check contract end dates if available
            const projectedIn = activeProjects.reduce((acc, p) => acc + (p.monthlyRevenue || 0), 0);
            const projectedOut = activeProjects.reduce((acc, p) => acc + (p.outsourcingCost || 0) + (p.internalCost || 0), 0);
            
            data.push({
                name: monthName,
                ingresos: projectedIn,
                gastos: projectedOut,
                neto: projectedIn - projectedOut
            });
        }
        return data;
    }, [activeProjects]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20 h-full flex flex-col">
            
            {/* Header & View Switcher */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Finanzas</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Control de caja y proyecciones.</p>
                </div>
                
                <div className="bg-gray-100 dark:bg-slate-800 p-1 rounded-xl flex">
                    <button 
                        onClick={() => setViewMode('CALENDAR')} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'CALENDAR' ? 'bg-white dark:bg-slate-700 shadow text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                        <CalendarRange className="w-4 h-4" /> Calendario
                    </button>
                    <button 
                        onClick={() => setViewMode('FORECAST')} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'FORECAST' ? 'bg-white dark:bg-slate-700 shadow text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                        <TrendingUp className="w-4 h-4" /> Proyección 90 Días
                    </button>
                </div>
            </div>

            {/* --- VIEW: CALENDAR --- */}
            {viewMode === 'CALENDAR' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="p-4 flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900">
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900 rounded-full text-emerald-600 dark:text-emerald-400"><TrendingUp className="w-5 h-5"/></div>
                            <div>
                                <p className="text-xs text-emerald-800 dark:text-emerald-300 font-bold uppercase">Entradas (Mes)</p>
                                <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">${totalIn.toLocaleString()}</p>
                            </div>
                        </Card>
                        <Card className="p-4 flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900">
                            <div className="p-2 bg-red-100 dark:bg-red-900 rounded-full text-red-600 dark:text-red-400"><TrendingDown className="w-5 h-5"/></div>
                            <div>
                                <p className="text-xs text-red-800 dark:text-red-300 font-bold uppercase">Salidas (Mes)</p>
                                <p className="text-lg font-bold text-red-900 dark:text-red-100">${totalOut.toLocaleString()}</p>
                            </div>
                        </Card>
                        <Card className="p-4 flex items-center gap-3 bg-gray-900 dark:bg-white text-white dark:text-black border-gray-800">
                            <div className="p-2 bg-gray-700 dark:bg-gray-200 rounded-full text-white dark:text-black"><Wallet className="w-5 h-5"/></div>
                            <div>
                                <p className="text-xs text-gray-400 dark:text-gray-600 font-bold uppercase">Neto Estimado</p>
                                <p className="text-lg font-bold">${net.toLocaleString()}</p>
                            </div>
                        </Card>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                        <div className="flex justify-between items-center p-3 border-b border-gray-200 dark:border-slate-800">
                            <button onClick={() => { const d = new Date(referenceDate); d.setMonth(d.getMonth()-1); setReferenceDate(d); }} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-gray-600 dark:text-gray-400"><ChevronLeft className="w-5 h-5"/></button>
                            <h2 className="text-lg font-bold capitalize text-gray-900 dark:text-white">{referenceDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</h2>
                            <button onClick={() => { const d = new Date(referenceDate); d.setMonth(d.getMonth()+1); setReferenceDate(d); }} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-gray-600 dark:text-gray-400"><ChevronRight className="w-5 h-5"/></button>
                        </div>
                        
                        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                                <div key={d} className="py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">{d}</div>
                            ))}
                        </div>
                        
                        <div className="grid grid-cols-7 bg-gray-100 dark:bg-slate-800 gap-px">
                            {daysArray.map((date, i) => {
                                if (!date) return <div key={i} className="bg-gray-50/50 dark:bg-slate-900/50"></div>;
                                
                                const isToday = new Date().toDateString() === date.toDateString();
                                const events = getEventsForDate(date);

                                return (
                                    <div key={i} className={`bg-white dark:bg-slate-900 p-2 flex flex-col gap-1 min-h-[100px] ${isToday ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                                        <span className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-black dark:bg-white text-white dark:text-black' : 'text-gray-400'}`}>
                                            {date.getDate()}
                                        </span>
                                        
                                        <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                                            {events.map((evt, idx) => (
                                                <div 
                                                    key={idx} 
                                                    onClick={() => evt.projectId && navigate(`/projects/${evt.projectId}?tab=PROFILE`)}
                                                    className={`
                                                        text-[10px] px-2 py-1 rounded-md border truncate font-medium flex justify-between items-center cursor-pointer transition-colors
                                                        ${evt.type === 'IN' 
                                                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40' 
                                                            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-100 dark:border-red-800'
                                                        }
                                                    `}
                                                    title={`${evt.label}: $${evt.amount}`}
                                                >
                                                    <span className="truncate flex-1">{evt.label}</span>
                                                    <span className="font-bold ml-1">${evt.amount.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* --- VIEW: FORECAST --- */}
            {viewMode === 'FORECAST' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {forecastData.map((month, idx) => (
                            <Card key={idx} className={`p-6 border-t-4 ${idx === 0 ? 'border-t-black dark:border-t-white' : 'border-t-gray-200 dark:border-t-slate-700'} relative overflow-hidden`}>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-lg capitalize text-gray-900 dark:text-white">{month.name}</h3>
                                    {idx === 0 && <span className="text-[10px] font-bold bg-black text-white px-2 py-1 rounded">ACTUAL</span>}
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Ingresos</span>
                                        <span className="font-bold text-green-600">+${month.ingresos.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Gastos Fijos</span>
                                        <span className="font-bold text-red-600">-${month.gastos.toLocaleString()}</span>
                                    </div>
                                    <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center">
                                        <span className="font-bold text-gray-900 dark:text-white">Flujo Neto</span>
                                        <span className={`text-xl font-bold ${month.neto >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-600'}`}>
                                            ${month.neto.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>

                    <Card className="p-6 h-[400px] flex flex-col">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2 shrink-0">
                            <BarChart3 className="w-5 h-5"/> Tendencia de Liquidez (3 Meses)
                        </h3>
                        <div className="w-full flex-1 min-h-0 min-w-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={forecastData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                    <CartesianGrid stroke="#f5f5f5" vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                                    <Tooltip 
                                        contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff'}}
                                        itemStyle={{color: '#fff'}}
                                        cursor={{fill: 'transparent'}}
                                    />
                                    <Legend />
                                    <Bar dataKey="ingresos" name="Ingresos" barSize={20} fill="#10b981" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="gastos" name="Gastos" barSize={20} fill="#ef4444" radius={[4, 4, 0, 0]} />
                                    <Line type="monotone" dataKey="neto" name="Flujo Neto" stroke="#4f46e5" strokeWidth={3} dot={{r: 4}} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
