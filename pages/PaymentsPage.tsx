
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Project, Contractor, ProjectStatus } from '../types';
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, DollarSign, Wallet } from 'lucide-react';
import { Card } from '../components/UIComponents';

export default function PaymentsPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [referenceDate, setReferenceDate] = useState(new Date());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const data = await db.projects.getAll();
            setProjects(data);
            setLoading(false);
        };
        load();
    }, []);

    // --- CALENDAR LOGIC ---
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday
    
    // Grid generation
    const daysArray = Array.from({ length: 42 }, (_, i) => {
        const dayNumber = i - firstDayIndex + 1;
        if (dayNumber > 0 && dayNumber <= daysInMonth) {
            return new Date(year, month, dayNumber);
        }
        return null; // Empty slot or previous/next month filler
    });

    // --- FINANCIAL DATA ---
    const activeProjects = projects.filter(p => p.status === ProjectStatus.ACTIVE);
    
    // Totals for this month
    const totalIn = activeProjects.reduce((acc, p) => acc + (p.monthlyRevenue || 0), 0);
    const totalOut = activeProjects.reduce((acc, p) => acc + (p.outsourcingCost || 0) + (p.internalCost || 0), 0);
    const net = totalIn - totalOut;

    // Events Generator
    const getEventsForDate = (date: Date) => {
        if (!date) return [];
        const day = date.getDate();
        const events: { type: 'IN' | 'OUT', label: string, amount: number }[] = [];

        // Incoming: Client Billings
        activeProjects.forEach(p => {
            const billDay = p.billingDay || 1;
            if (billDay === day) {
                events.push({ type: 'IN', label: p.name, amount: p.monthlyRevenue });
            }
        });

        // Outgoing: Partner Payments (Estimated on day 5)
        // You could make this dynamic later, but for now we simplify.
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

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20 h-full flex flex-col">
            
            {/* Header Stats */}
            <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1">
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Calendario de Pagos</h1>
                    <p className="text-gray-500 mt-1">Flujo de caja proyectado para {referenceDate.toLocaleDateString('es-ES', { month: 'long' })}.</p>
                </div>
                
                <div className="grid grid-cols-3 gap-4 lg:w-[600px]">
                    <Card className="p-4 flex items-center gap-3 bg-emerald-50 border-emerald-100">
                        <div className="p-2 bg-emerald-100 rounded-full text-emerald-600"><TrendingUp className="w-5 h-5"/></div>
                        <div>
                            <p className="text-xs text-emerald-800 font-bold uppercase">Entradas</p>
                            <p className="text-lg font-bold text-emerald-900">${totalIn.toLocaleString()}</p>
                        </div>
                    </Card>
                    <Card className="p-4 flex items-center gap-3 bg-red-50 border-red-100">
                        <div className="p-2 bg-red-100 rounded-full text-red-600"><TrendingDown className="w-5 h-5"/></div>
                        <div>
                            <p className="text-xs text-red-800 font-bold uppercase">Salidas</p>
                            <p className="text-lg font-bold text-red-900">${totalOut.toLocaleString()}</p>
                        </div>
                    </Card>
                    <Card className="p-4 flex items-center gap-3 bg-gray-900 text-white border-gray-800">
                        <div className="p-2 bg-gray-700 rounded-full text-white"><Wallet className="w-5 h-5"/></div>
                        <div>
                            <p className="text-xs text-gray-400 font-bold uppercase">Neto</p>
                            <p className="text-lg font-bold">${net.toLocaleString()}</p>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Calendar Controls */}
            <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
                <button onClick={() => { const d = new Date(referenceDate); d.setMonth(d.getMonth()-1); setReferenceDate(d); }} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"><ChevronLeft className="w-5 h-5"/></button>
                <h2 className="text-lg font-bold capitalize">{referenceDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</h2>
                <button onClick={() => { const d = new Date(referenceDate); d.setMonth(d.getMonth()+1); setReferenceDate(d); }} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"><ChevronRight className="w-5 h-5"/></button>
            </div>

            {/* Calendar Grid */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-[500px]">
                {/* Days Header */}
                <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                        <div key={d} className="py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">{d}</div>
                    ))}
                </div>
                
                {/* Cells */}
                <div className="grid grid-cols-7 flex-1 bg-gray-100 gap-px">
                    {daysArray.map((date, i) => {
                        if (!date) return <div key={i} className="bg-gray-50/50"></div>; // Empty slot
                        
                        const isToday = new Date().toDateString() === date.toDateString();
                        const events = getEventsForDate(date);

                        return (
                            <div key={i} className={`bg-white p-2 flex flex-col gap-1 min-h-[100px] ${isToday ? 'bg-blue-50/30' : ''}`}>
                                <span className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-black text-white' : 'text-gray-400'}`}>
                                    {date.getDate()}
                                </span>
                                
                                <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                                    {events.map((evt, idx) => (
                                        <div 
                                            key={idx} 
                                            className={`
                                                text-[10px] px-2 py-1 rounded-md border truncate font-medium flex justify-between items-center
                                                ${evt.type === 'IN' 
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                                    : 'bg-red-50 text-red-700 border-red-100'
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
    );
}
