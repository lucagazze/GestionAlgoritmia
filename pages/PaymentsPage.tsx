
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { Project, Contractor, ProjectStatus } from '../types';
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, DollarSign, Wallet, CalendarRange, BarChart3, History, User, Briefcase, ArrowRight, Check, X, MessageSquare, Edit2, Loader2 } from 'lucide-react';
import { Card, Button, Modal, Badge, Input, Label } from '../components/UIComponents';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

export default function PaymentsPage() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [payments, setPayments] = useState<any[]>([]); // Real payments
    const [referenceDate, setReferenceDate] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'CALENDAR' | 'FORECAST' | 'HISTORY'>('CALENDAR');
    const [selectedPayment, setSelectedPayment] = useState<any>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    
    // NEW: Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, event: any } | null>(null);
    const [isPartialPaymentModalOpen, setIsPartialPaymentModalOpen] = useState(false);
    const [partialAmount, setPartialAmount] = useState('');
    const [selectedEventForPayment, setSelectedEventForPayment] = useState<any>(null);

    // Edit Date State
    const [isEditDateModalOpen, setIsEditDateModalOpen] = useState(false);
    const [newPaymentDate, setNewPaymentDate] = useState('');

    // --- PAYMENT DETAIL MODAL STATE ---
    const [isPaymentDetailModalOpen, setIsPaymentDetailModalOpen] = useState(false);
    const [selectedPaymentDetail, setSelectedPaymentDetail] = useState<any>(null);
    const [activeProposalDetails, setActiveProposalDetails] = useState<any>(null);
    const [loadingProposal, setLoadingProposal] = useState(false);

    const handleEventClick = async (event: any) => {
        setSelectedPaymentDetail(event);
        setIsPaymentDetailModalOpen(true);
        setLoadingProposal(true);
        setActiveProposalDetails(null);

        try {
            // A. Check if payment has snapshot metadata (Historical Data)
            if (event.paymentId) {
                 const fullPayment = payments.find(p => p.id === event.paymentId);
                 if (fullPayment && fullPayment.metadata && fullPayment.metadata.items) {
                     setActiveProposalDetails({
                         items: fullPayment.metadata.items.map((i: any) => ({
                             serviceSnapshotName: i.name,
                             serviceSnapshotCost: i.cost,
                             outsourcingCost: i.outsourcing_cost,
                             contractor: { name: i.partner_name }
                         })),
                         isSnapshot: true
                     });
                     setLoadingProposal(false);
                     return;
                 }
            }

            // B. Fallback: Fetch detailed proposal info (active)
            if (event.projectId) {
                const prop = await db.clients.getActiveProposal(event.projectId);
                setActiveProposalDetails(prop);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingProposal(false);
        }
    };

    // Close context menu on click elsewhere
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    useEffect(() => {
        const load = async () => {
            const [projectsData, paymentsData] = await Promise.all([
                db.projects.getAll(),
                db.payments.getAll()
            ]);
            setProjects(projectsData);
            setPayments(paymentsData);
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
        const events: { type: 'IN' | 'OUT', label: string, amount: number, projectId?: string, paid?: boolean, paymentId?: string, paymentAmount?: number, date?: Date }[] = [];

        // Incoming: Client Billings
        activeProjects.forEach(p => {
            const billDay = p.billingDay || 1;
            if (billDay === day) {
                // Check if paid in this month
                const payment = payments.find(pay => 
                    pay.clientId === p.id && 
                    new Date(pay.date).getMonth() === month &&
                    new Date(pay.date).getFullYear() === year
                );

                const isPaid = !!payment;
                const paidAmount = payment ? payment.amount : 0;
                
                events.push({ 
                    type: 'IN', 
                    label: p.name, 
                    amount: p.monthlyRevenue, 
                    projectId: p.id,
                    paid: isPaid,
                    paymentId: payment?.id,
                    paymentAmount: paidAmount,
                    date: date // Pass the calendar date
                });
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
    }, [activeProjects, payments]); // Update dependency

    const handleContextMenu = (e: React.MouseEvent, event: any) => {
        e.preventDefault();
        e.stopPropagation();
        if (event.type !== 'IN') return; // Only for income
        
        let x = e.clientX;
        let y = e.clientY;

        // Adjust position if too close to edges
        if (x + 200 > window.innerWidth) x -= 200;
        if (y + 250 > window.innerHeight) y -= 250;

        setContextMenu({ x, y, event });
    };

    const handleMarkAsPaid = async (type: 'FULL' | 'PARTIAL') => {
        if (!contextMenu?.event) return;
        const evt = contextMenu.event;
        
        if (type === 'FULL') {
            await db.payments.create({
                clientId: evt.projectId,
                amount: evt.amount,
                date: evt.date ? new Date(evt.date).toISOString() : new Date().toISOString(), // Use event date
                type: 'FULL'
            });
            // Reload
            const paymentsData = await db.payments.getAll();
            setPayments(paymentsData);
        } else {
            setSelectedEventForPayment(evt);
            setIsPartialPaymentModalOpen(true);
        }
        setContextMenu(null);
    };

    const handlePartialPaymentSubmit = async () => {
        if (!selectedEventForPayment || !partialAmount) return;
        
        await db.payments.create({
            clientId: selectedEventForPayment.projectId,
            amount: parseFloat(partialAmount),
            date: selectedEventForPayment.date ? new Date(selectedEventForPayment.date).toISOString() : new Date().toISOString(),
            type: 'PARTIAL'
        });

        const paymentsData = await db.payments.getAll();
        setPayments(paymentsData);
        setIsPartialPaymentModalOpen(false);
        setPartialAmount('');
        setSelectedEventForPayment(null);
    };

    const handleWhatsAppReminder = () => {
        if (!contextMenu?.event) return;
        const evt = contextMenu.event;
        const project = projects.find(p => p.id === evt.projectId);
        if (!project || !project.phone) {
             alert("El cliente no tiene teléfono registrado.");
             return;
        }

        const monthName = referenceDate.toLocaleDateString('es-ES', { month: 'long' });
        const message = `Hola! Te hago un recordatorio por el pago del mes de ${monthName}. Quedo atento, gracias!`;
        const url = `https://wa.me/${project.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
        setContextMenu(null);
    };

    const openEditDateModal = () => {
        if (!contextMenu?.event || !contextMenu.event.paymentId) return;
        // Set initial date from current view or payment date if available
        // We know it is paid because the option will only show if paid
        setNewPaymentDate(new Date().toISOString().split('T')[0]); 
        setIsEditDateModalOpen(true);
        setContextMenu(null);
    };

    const handleUpdatePaymentDate = async () => {
        if (!contextMenu?.event?.paymentId && !selectedPayment?.id) {
            // Handle case where we might need to store the ID when opening modal if context menu is cleared
            // For now, let's rely on finding the payment again or refactoring context handling if needed.
            // Actually, contextMenu is nullified on open. Need to store ID.
        }
    };
    
    // Better implementation: Store ID when opening modal
    const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);

    const openEditDateModalForEvent = (event: any) => {
         if (!event?.paymentId) return;
         setEditingPaymentId(event.paymentId);
         
         // Find current date of payment
         const payment = payments.find(p => p.id === event.paymentId);
         if (payment) {
             setNewPaymentDate(new Date(payment.date).toISOString().split('T')[0]);
         }
         
         setIsEditDateModalOpen(true);
         setContextMenu(null);
    };

    const handleOpenEditDate = () => {
         if (!contextMenu?.event) return;
         openEditDateModalForEvent(contextMenu.event);
    };

    const handleUpdatePaymentDateAction = async () => {
        if (!editingPaymentId || !newPaymentDate) return;

        try {
            await db.payments.update(editingPaymentId, {
                date: new Date(newPaymentDate).toISOString()
            });

            // Reload payments
            const paymentsData = await db.payments.getAll();
            setPayments(paymentsData);
            
            setIsEditDateModalOpen(false);
            setEditingPaymentId(null);
        } catch (error) {
            console.error("Error updating date:", error);
            alert("Error al actualizar la fecha.");
        }
    };


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
                        <TrendingUp className="w-4 h-4" /> Proyección
                    </button>
                    <button 
                        onClick={() => setViewMode('HISTORY')} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'HISTORY' ? 'bg-white dark:bg-slate-700 shadow text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                        <History className="w-4 h-4" /> Historial
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
                                            {events.map((evt, idx) => {
                                                // LOGIC FOR COLOR CODING
                                                const isPast = date < new Date(new Date().setHours(0,0,0,0));
                                                let colorClass = '';

                                                if (evt.type === 'IN') {
                                                    if (evt.paid) {
                                                        // PID: Green (or Yellow if partial)
                                                        colorClass = evt.paymentAmount && evt.paymentAmount < evt.amount 
                                                            ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800' 
                                                            : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
                                                    } else {
                                                        // UNPAID
                                                        if (isPast) {
                                                            // OVERDUE: Red
                                                            colorClass = 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
                                                        } else {
                                                            // PENDING: Gray
                                                            colorClass = 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-700';
                                                        }
                                                    }
                                                } else {
                                                    // OUT (Expenses): Red/Orange default
                                                    colorClass = 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-100 dark:border-orange-800';
                                                }

                                                return (
                                                <div 
                                                    key={idx} 
                                                    onClick={() => handleEventClick(evt)} // ✅ Add Click Handler
                                                    onContextMenu={(e) => handleContextMenu(e, evt)}
                                                    className={`
                                                        text-[10px] px-2 py-1 rounded-md border truncate font-medium flex justify-between items-center cursor-pointer transition-colors relative group
                                                        ${colorClass}
                                                    `}
                                                    title={`${evt.label}: $${evt.amount} ${evt.paid ? `(Pagado: $${evt.paymentAmount})` : ''}`}
                                                >
                                                    <div className="flex items-center gap-1 overflow-hidden">
                                                        {/* EDIT BUTTON (Visible on Hover) */}
                                                        {evt.paymentId && (
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openEditDateModalForEvent(evt);
                                                                }}
                                                                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-opacity"
                                                                title="Cambiar Fecha"
                                                            >
                                                                <Edit2 className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                        <span className="truncate">{evt.label}</span>
                                                    </div>
                                                    <span className="font-bold ml-1">${evt.amount.toLocaleString()}</span>
                                                </div>
                                                );
                                            })}
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

            {/* --- VIEW: HISTORY --- */}
            {viewMode === 'HISTORY' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <Card className="p-6">
                        <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
                             <History className="w-5 h-5"/> Historial de Transacciones
                        </h2>
                        
                        {payments.length === 0 ? (
                            <p className="text-gray-500 text-center py-10">No hay pagos registrados aún.</p>
                        ) : (
                            <div className="space-y-3">
                                {payments.map((payment) => (
                                    <div 
                                        key={payment.id} 
                                        onClick={() => { setSelectedPayment(payment); setIsDetailModalOpen(true); }}
                                        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors p-4 rounded-xl border border-gray-100 dark:border-slate-800 flex justify-between items-center group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                                <DollarSign className="w-5 h-5"/>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white">
                                                    {payment.client?.name || 'Cliente'}
                                                </h4>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(payment.date).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="font-mono font-bold text-lg text-emerald-600 dark:text-emerald-400">
                                                    +${payment.amount.toLocaleString()}
                                                </p>
                                                <Badge variant="outline" className="text-[10px]">PAGADO</Badge>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            )}



    return (
        <div className="space-y-6 pb-20 relative min-h-screen">
             {/* ... (Rest of format) ... */}

             {/* MODAL DETALLE PAGO */}
             <Modal isOpen={isPaymentDetailModalOpen} onClose={() => setIsPaymentDetailModalOpen(false)} title="Detalle del Pago">
                {selectedPaymentDetail && (
                    <div className="space-y-6">
                        <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded-xl text-center">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{selectedPaymentDetail.label}</h3>
                            <p className="text-sm text-gray-500">{new Date(selectedPaymentDetail.date || new Date()).toLocaleDateString()}</p>
                            <p className="text-3xl font-black text-indigo-600 mt-2">${selectedPaymentDetail.amount.toLocaleString()}</p>
                            <div className="flex justify-center gap-2 mt-2">
                                {selectedPaymentDetail.paid && <Badge variant="green">Pagado</Badge>}
                                {activeProposalDetails?.isSnapshot && <Badge variant="blue">Histórico</Badge>}
                            </div>
                        </div>

                        {loadingProposal ? (
                            <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600"/></div>
                        ) : activeProposalDetails ? (
                            <div className="space-y-4">
                                <div>
                                    <Label className="mb-2 block font-bold">Distribución de Ingresos</Label>
                                    <div className="space-y-2">
                                        {/* Agencia */}
                                        <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-800">
                                            <div className="flex items-center gap-3">
                                                <Briefcase className="w-5 h-5 text-emerald-600"/>
                                                <div>
                                                    <p className="font-bold text-gray-900 dark:text-white">Agencia (Tú)</p>
                                                    <p className="text-xs text-emerald-600 font-bold">Ganancia Neta</p>
                                                </div>
                                            </div>
                                            <span className="font-bold text-emerald-700 dark:text-emerald-300 text-lg">
                                                ${(selectedPaymentDetail.amount - (activeProposalDetails.items?.reduce((acc: number, i: any) => acc + (i.outsourcingCost || 0), 0) || 0)).toLocaleString()}
                                            </span>
                                        </div>

                                        {/* Socios (Loop Items) */}
                                        {activeProposalDetails.items?.filter((i: any) => i.outsourcingCost > 0).map((item: any, idx: number) => {
                                            // Find contractor name (Assuming populated or we use ID)
                                            // In our db.clients.getActiveProposal we joined contractor:assignedContractorId(*)
                                            // BUT supabase join syntax might return array or object depending on relationship.
                                            // Let's assume singular object 'contractor'
                                            const partnerName = item.contractor?.name || 'Socio';
                                            
                                            return (
                                                <div key={idx} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                                                    <div className="flex items-center gap-3">
                                                        <User className="w-5 h-5 text-indigo-600"/>
                                                        <div>
                                                            <p className="font-bold text-gray-900 dark:text-white">{partnerName}</p>
                                                            <p className="text-xs text-gray-500">{item.serviceSnapshotName}</p>
                                                        </div>
                                                    </div>
                                                    <span className="font-bold text-red-500 text-lg">
                                                        - ${item.outsourcingCost.toLocaleString()}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                        
                                        {(!activeProposalDetails.items?.some((i: any) => i.outsourcingCost > 0)) && (
                                            <p className="text-center text-sm text-gray-400 py-2">Sin costos de socios asociados.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-4 text-gray-500">
                                <p>No se encontraron detalles detallados del contrato activo.</p>
                            </div>
                        )}

                        <div className="flex justify-end">
                            <Button onClick={() => setIsPaymentDetailModalOpen(false)}>Cerrar</Button>
                        </div>
                    </div>
                )}
             </Modal>

            {/* NEW: Context Menu (Restored) */}
            {contextMenu && (
                <div 
                    className="fixed z-50 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 py-1 w-48 animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-700 mb-1">
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{contextMenu.event.label}</p>
                        <p className="text-[10px] text-gray-500">Acciones de Pago</p>
                    </div>
                    
                    <button onClick={() => handleMarkAsPaid('FULL')} className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center gap-2">
                        <Check className="w-4 h-4" /> Pagó Completo
                    </button>
                    <button onClick={() => handleMarkAsPaid('PARTIAL')} className="w-full text-left px-4 py-2 text-sm text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 flex items-center gap-2">
                        <DollarSign className="w-4 h-4" /> Pagó Parcial...
                    </button>
                    <button onClick={() => handleMarkAsPaid('FULL')} className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2">
                        <X className="w-4 h-4" /> No Pagó (Pendiente)
                    </button>
                    <div className="border-t border-gray-100 dark:border-slate-700 my-1"></div>
                    
                    {contextMenu.event.paymentId && (
                        <button onClick={handleOpenEditDate} className="w-full text-left px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-center gap-2">
                            <CalendarRange className="w-4 h-4" /> Cambiar Fecha
                        </button>
                    )}

                    <button onClick={handleWhatsAppReminder} className="w-full text-left px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" /> Enviar Recordatorio
                    </button>
                </div>
            )}
            
            {/* NEW: Partial Payment Modal */}
            <Modal
                isOpen={isPartialPaymentModalOpen}
                onClose={() => setIsPartialPaymentModalOpen(false)}
                title="Registrar Pago Parcial"
            >
                <div className="space-y-4">
                    <div>
                        <Label>Monto Pagado</Label>
                        <Input 
                            type="number" 
                            value={partialAmount} 
                            onChange={e => setPartialAmount(e.target.value)}
                            placeholder="Ej: 500"
                            autoFocus
                        />
                         {selectedEventForPayment && (
                            <p className="text-xs text-gray-500 mt-1">Total esperado: ${selectedEventForPayment.amount.toLocaleString()}</p>
                        )}
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsPartialPaymentModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handlePartialPaymentSubmit} disabled={!partialAmount}>Registrar</Button>
                    </div>
                </div>
            </Modal>

            {/* NEW: Edit Payment Date Modal */}
            <Modal
                isOpen={isEditDateModalOpen}
                onClose={() => setIsEditDateModalOpen(false)}
                title="Cambiar Fecha de Pago"
            >
                 <div className="space-y-4">
                    <div>
                        <Label>Nueva Fecha</Label>
                        <Input 
                            type="date" 
                            value={newPaymentDate} 
                            onChange={e => setNewPaymentDate(e.target.value)}
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsEditDateModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleUpdatePaymentDateAction}>Guardar Cambios</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
