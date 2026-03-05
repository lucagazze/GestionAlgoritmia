
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { Project, Contractor, ProjectStatus, ContractorPayment } from '../types';
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, DollarSign, Wallet, CalendarRange, BarChart3, History, User, Briefcase, ArrowRight, Check, X, MessageSquare, Edit2, Loader2, Users, Ban } from 'lucide-react';
import { Card, Button, Modal, Badge, Input, Label, Select } from '../components/UIComponents';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { formatMoney } from '../utils/currency';

export default function PaymentsPage() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [payments, setPayments] = useState<any[]>([]); // Real payments
    const [contractors, setContractors] = useState<Contractor[]>([]);
    const [contractorPayments, setContractorPayments] = useState<ContractorPayment[]>([]);

    interface CalendarEvent {
        type: 'IN' | 'OUT';
        label: string;
        amount: number;
        projectId?: string;
        paid?: boolean;
        cancelled?: boolean;
        paymentId?: string;
        paymentAmount?: number;
        date?: Date;
        notes?: string;
        description?: string;
        currency?: 'ARS' | 'USD';
    }

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

    // Contractor Payment Modal
    const [isContractorPaymentModalOpen, setIsContractorPaymentModalOpen] = useState(false);
    const [selectedContractorId, setSelectedContractorId] = useState('');
    const [contractorPaymentAmount, setContractorPaymentAmount] = useState('');

    // Edit Date State
    const [isEditDateModalOpen, setIsEditDateModalOpen] = useState(false);
    const [newPaymentDate, setNewPaymentDate] = useState('');

    // --- PAYMENT DETAIL MODAL STATE ---
    const [isPaymentDetailModalOpen, setIsPaymentDetailModalOpen] = useState(false);
    const [selectedPaymentDetail, setSelectedPaymentDetail] = useState<any>(null);
    const [activeProposalDetails, setActiveProposalDetails] = useState<any>(null);
    const [loadingProposal, setLoadingProposal] = useState(false);

    // Manual Transaction Modal State
    const [isManualTransactionModalOpen, setIsManualTransactionModalOpen] = useState(false);
    const [manualType, setManualType] = useState<'IN' | 'OUT'>('IN');
    const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
    const [manualAmount, setManualAmount] = useState('');
    const [manualDescription, setManualDescription] = useState('');
    const [manualEntityId, setManualEntityId] = useState(''); // ClientId or ContractorId

    const handleOpenManualTransaction = (type: 'IN' | 'OUT') => {
        setManualType(type);
        setManualDate(new Date().toISOString().split('T')[0]);
        setManualAmount('');
        setManualDescription('');
        setManualEntityId('');
        setIsManualTransactionModalOpen(true);
    };

    const submitManualTransaction = async () => {
        if (!manualAmount || !manualEntityId) return;

        try {
            if (manualType === 'IN') {
                 // Creating Payment (Income)
                 await db.payments.create({
                     clientId: manualEntityId,
                     amount: parseFloat(manualAmount),
                     date: new Date(manualDate).toISOString(),
                     notes: manualDescription,
                     type: 'FULL' // Assume full for manual entry or generic
                 });
            } else {
                // Creating ContractorPayment (Expense)
                await db.contractorPayments.create({
                    contractor_id: manualEntityId,
                    amount: parseFloat(manualAmount),
                    date: new Date(manualDate).toISOString(),
                    description: manualDescription
                    // client_id optional, skipping for generic manual entry
                });
            }

            // Reload Data
            const [paymentsData, contractorPaymentsData] = await Promise.all([
                db.payments.getAll(),
                db.contractorPayments.getAll()
            ]);
            setPayments(paymentsData);
            setContractorPayments(contractorPaymentsData);
            setIsManualTransactionModalOpen(false);
        } catch (e) {
            console.error(e);
            alert("Error al crear transacción");
        }
    };

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
            const [projectsData, paymentsData, contractorsData, contractorPaymentsData] = await Promise.all([
                db.projects.getAll(),
                db.payments.getAll(),
                db.contractors.getAll(),
                db.contractorPayments.getAll()
            ]);
            setProjects(projectsData);
            setPayments(paymentsData);
            setContractors(contractorsData);
            setContractorPayments(contractorPaymentsData);
            setLoading(false);

            // 🐛 DEBUG: Check billingDay and dates
            console.log("🐛 PAYMENTS PAGE DEBUG:", projectsData.map(p => ({
                name: p.name,
                status: p.status,
                billingDay: p.billingDay,
                contractStartDate: p.contractStartDate,
                createdAt: p.createdAt
            })));
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

    // Define getEventsForDate BEFORE monthlyTotals
    const getEventsForDate = (date: Date) => {
        if (!date) return [];
        const events: CalendarEvent[] = [];
        const day = date.getDate();
        const eventMonth = date.getMonth();
        const eventYear = date.getFullYear();

        // 1. ACTUAL PAYMENTS (IN) - Show on specific date (skip cancelled markers)
        payments.forEach(pay => {
            const payDate = new Date(pay.date);
            if (payDate.getDate() === day && payDate.getMonth() === eventMonth && payDate.getFullYear() === eventYear) {
                // Show cancelled markers as a special visual-only event
                if (pay.metadata?.cancelled) {
                    if (!pay.metadata?.isExpense) {
                        // Cancelled income — show as struck-through in calendar
                        const clientName = pay.client?.name || projects.find(p => p.id === pay.client_id || p.id === pay.clientId)?.name || 'Cliente';
                        // Find the project's monthlyRevenue to display the original amount
                        const proj = projects.find(p => p.id === pay.client_id || p.id === pay.clientId);
                        events.push({
                            type: 'IN',
                            label: clientName,
                            amount: proj?.monthlyRevenue || 0,
                            paid: true,
                            cancelled: true,
                            paymentId: pay.id,
                            paymentAmount: 0,
                            date: date,
                            notes: pay.notes,
                            currency: pay.client?.currency || proj?.currency || 'ARS'
                        });
                    } else {
                        // Cancelled expense
                        const proj = projects.find(p => p.id === pay.client_id || p.id === pay.clientId);
                        events.push({
                            type: 'OUT',
                            label: `Socio (${proj?.name || 'Proyecto'})`,
                            amount: proj?.outsourcingCost || 0,
                            paid: true,
                            cancelled: true,
                            paymentId: pay.id,
                            paymentAmount: 0,
                            date: date,
                            notes: pay.notes,
                            currency: proj?.currency || 'ARS'
                        });
                    }
                    return; // Don't add as normal payment
                }

                const clientName = pay.client?.name || projects.find(p => p.id === pay.client_id || p.id === pay.clientId)?.name || 'Cliente';
                events.push({
                    type: 'IN',
                    label: clientName,
                    amount: pay.amount,
                    paid: true,
                    paymentId: pay.id,
                    paymentAmount: pay.amount,
                    date: date,
                    notes: pay.notes,
                    currency: pay.client?.currency || projects.find(p => p.id === pay.client_id || p.id === pay.clientId)?.currency || 'ARS'
                });
            }
        });

        // 2. ACTUAL EXPENSES (OUT) - Show on specific date
        contractorPayments.forEach(cp => {
            const cpDate = new Date(cp.date);
            if (cpDate.getDate() === day && cpDate.getMonth() === eventMonth && cpDate.getFullYear() === eventYear) {
                 const contractorName = contractors.find(c => c.id === cp.contractor_id)?.name || 'Socio';
                 events.push({
                     type: 'OUT',
                     label: contractorName,
                     amount: cp.amount,
                     paid: true,
                     paymentId: cp.id,
                     paymentAmount: cp.amount,
                     date: date,
                     description: cp.description, // ✅ Add Description
                     currency: projects.find(p => p.id === cp.client_id)?.currency || 'ARS'
                 });
            }
        });

        // 3. PROJECTED INCOME (IN) - Only show if NOT paid fully
        activeProjects.forEach(p => {
            // Check Dates
            const pStart = p.contractStartDate ? new Date(p.contractStartDate) : new Date(p.createdAt);
            const projectStart = new Date(pStart);
            projectStart.setHours(0, 0, 0, 0);
            
            const projectEnd = p.contractEndDate ? new Date(p.contractEndDate) : null;
            if (projectEnd) projectEnd.setHours(23, 59, 59, 999);

            if (date < projectStart) return;
            if (projectEnd && date > projectEnd) return;

            // Billing Day
            const billDay = p.billingDay || 1;
            if (billDay === day) {
                // Check valid payments for this month
                const paidAmount = payments
                    .filter(pay => {
                        const payDate = new Date(pay.date);
                        return (pay.clientId === p.id || pay.client_id === p.id) && payDate.getMonth() === eventMonth && payDate.getFullYear() === eventYear;
                    })
                    .reduce((acc, pay) => acc + pay.amount, 0);
                
                // If fully paid, DON'T show projection (Actuals are already shown)
                // If partially paid, show remainder? 
                // Let's simpler: If Paid Amount >= Monthly Revenue, don't show projection.
                // Check if this month was explicitly cancelled ("no se va a pagar")
                const isCancelled = payments.some(pay => {
                    const payDate = new Date(pay.date);
                    return (pay.clientId === p.id || pay.client_id === p.id)
                        && payDate.getMonth() === eventMonth
                        && payDate.getFullYear() === eventYear
                        && pay.metadata?.cancelled === true
                        && !pay.metadata?.isExpense;
                });
                if (isCancelled) return; // Already shown as cancelled marker above

                if (paidAmount >= p.monthlyRevenue) return;

                const remaining = p.monthlyRevenue - paidAmount;
                
                events.push({ 
                    type: 'IN', 
                    label: `${p.name} (Pendiente)`, 
                    amount: remaining, 
                    paid: false,
                    projectId: p.id,
                    paymentAmount: paidAmount,
                    date: date,
                    currency: p.currency || 'ARS'
                });
            }
        });

        // 4. PROJECTED EXPENSES (OUT) - Only show if NOT paid
        if (day === 5) {
            activeProjects.forEach(p => {
                const projectStart = new Date(p.createdAt);
                projectStart.setHours(0, 0, 0, 0);
                const projectEnd = p.contractEndDate ? new Date(p.contractEndDate) : null;
                if (projectEnd) projectEnd.setHours(23, 59, 59, 999);

                if (date < projectStart) return;
                if (projectEnd && date > projectEnd) return;

                if (p.outsourcingCost && p.outsourcingCost > 0) {
                     const paidAmount = contractorPayments
                        .filter(cp => {
                            const cpDate = new Date(cp.date);
                            return cp.client_id === p.id && cpDate.getMonth() === eventMonth && cpDate.getFullYear() === eventYear;
                        })
                        .reduce((sum, cp) => sum + cp.amount, 0);

                    // Check if this expense was cancelled for this month
                    const isExpenseCancelled = payments.some(pay => {
                        const payDate = new Date(pay.date);
                        return (pay.clientId === p.id || pay.client_id === p.id)
                            && payDate.getMonth() === eventMonth
                            && payDate.getFullYear() === eventYear
                            && pay.metadata?.cancelled === true
                            && pay.metadata?.isExpense === true;
                    });
                    if (isExpenseCancelled) return; // Already shown as cancelled marker above

                    if (paidAmount >= p.outsourcingCost) return;

                    const remaining = p.outsourcingCost - paidAmount;

                    events.push({ 
                        type: 'OUT', 
                        label: `Socio (${p.name}) (Pendiente)`, 
                        amount: remaining,
                        paid: false,
                        projectId: p.id,
                        paymentAmount: paidAmount,
                        date: date,
                        currency: p.currency || 'ARS'
                    });
                }
            });
        }
        
        if (day === 1) {
            activeProjects.forEach(p => {
                if (p.internalCost && p.internalCost > 0) {
                    events.push({ type: 'OUT', label: `Interno (${p.name})`, amount: p.internalCost, currency: p.currency || 'ARS' });
                }
            });
        }

        return events;
    };

    const monthlyTotals = useMemo(() => {
        let totalInUSD = 0;
        let totalOutUSD = 0;
        let totalInARS = 0;
        let totalOutARS = 0;

        // Iterate through all days in the displayed month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const events = getEventsForDate(date);
            
            events.forEach(evt => {
                if (evt.type === 'IN') {
                    if (evt.currency === 'ARS') totalInARS += evt.amount;
                    else totalInUSD += evt.amount;
                } else if (evt.type === 'OUT') {
                    if (evt.currency === 'ARS') totalOutARS += evt.amount;
                    else totalOutUSD += evt.amount;
                }
            });
        }

        return {
            totalInUSD,
            totalOutUSD,
            netUSD: totalInUSD - totalOutUSD,
            totalInARS,
            totalOutARS,
            netARS: totalInARS - totalOutARS,
        };
    }, [year, month, daysInMonth, activeProjects, payments]);

    const { totalInUSD, totalOutUSD, netUSD, totalInARS, totalOutARS, netARS } = monthlyTotals;
        
    // --- FORECAST LOGIC (90 DAYS) ---
    const forecastData = useMemo(() => {
        const data = [];
        const today = new Date();
        
        for (let i = 0; i < 3; i++) {
            const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
            const monthName = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
            
            const projectedInUSD = activeProjects.filter(p => p.currency === 'USD').reduce((acc, p) => acc + (p.monthlyRevenue || 0), 0);
            const projectedOutUSD = activeProjects.filter(p => p.currency === 'USD').reduce((acc, p) => acc + (p.outsourcingCost || 0) + (p.internalCost || 0), 0);
            const projectedInARS = activeProjects.filter(p => !p.currency || p.currency === 'ARS').reduce((acc, p) => acc + (p.monthlyRevenue || 0), 0);
            const projectedOutARS = activeProjects.filter(p => !p.currency || p.currency === 'ARS').reduce((acc, p) => acc + (p.outsourcingCost || 0) + (p.internalCost || 0), 0);
            
            data.push({
                name: monthName,
                ingresosUSD: projectedInUSD,
                gastosUSD: projectedOutUSD,
                netoUSD: projectedInUSD - projectedOutUSD,
                ingresosARS: projectedInARS,
                gastosARS: projectedOutARS,
                netoARS: projectedInARS - projectedOutARS,
            });
        }
        return data;
    }, [activeProjects, payments]); // Update dependency

    const handleContextMenu = (e: React.MouseEvent, event: any) => {
        e.preventDefault();
        e.stopPropagation();
        // Allow context menu for IN events and ALL OUT events (both projected and actual)
        if (!event.paymentId && event.type !== 'IN' && event.type !== 'OUT') return; 
        
        let x = e.clientX;
        let y = e.clientY;

        // Adjust position if too close to edges
        if (x + 200 > window.innerWidth) x -= 200;
        if (y + 250 > window.innerHeight) y -= 250;

        setContextMenu({ x, y, event });
    };

    const handleMarkWontPay = async () => {
        if (!contextMenu?.event) return;
        const evt = contextMenu.event;
        setContextMenu(null);

        const eventDate = evt.date ? new Date(evt.date).toISOString() : new Date().toISOString();

        try {
            if (evt.type === 'IN' && evt.projectId) {
                // Store cancellation as a zero-amount payment with cancelled flag in metadata
                await db.payments.create({
                    clientId: evt.projectId,
                    amount: 0,
                    date: eventDate,
                    type: 'FULL',
                    notes: 'No se va a pagar (cancelado)',
                    metadata: { cancelled: true }
                });
            } else if (evt.type === 'OUT' && evt.projectId) {
                // For projected OUT events, store a zero-amount contractor payment as flag
                // Use the first available contractor, or a sentinel value via Payment with isExpense flag
                await db.payments.create({
                    clientId: evt.projectId,
                    amount: 0,
                    date: eventDate,
                    type: 'FULL',
                    notes: 'Gasto cancelado (no se va a pagar)',
                    metadata: { cancelled: true, isExpense: true }
                });
            }

            const paymentsData = await db.payments.getAll();
            setPayments(paymentsData);
        } catch (e) {
            console.error(e);
            alert('Error al marcar como cancelado');
        }
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

    const handleDeletePayment = async () => {
        if (!contextMenu?.event?.paymentId) return;
        
        if (!confirm('¿Eliminar esta transacción? Esta acción no se puede deshacer.')) return;
        
        try {
            if (contextMenu.event.type === 'IN') {
                 await db.payments.delete(contextMenu.event.paymentId);
                 const paymentsData = await db.payments.getAll();
                 setPayments(paymentsData);
                 alert("Ingreso eliminado");
            } else {
                 await db.contractorPayments.delete(contextMenu.event.paymentId);
                  const contractorPaymentsData = await db.contractorPayments.getAll();
                 setContractorPayments(contractorPaymentsData);
                 alert("Gasto eliminado");
            }
        } catch (e) {
            console.error(e);
            alert("Error al eliminar");
        }
        setContextMenu(null);
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



    const handleMarkContractorPaid = () => {
        if (!contextMenu?.event) return;
        const evt = contextMenu.event;
        
        // Pre-fill amount
        setContractorPaymentAmount(evt.amount.toString());
        // Try to find if there is only one contractor assigned, otherwise empty
        setSelectedContractorId('');
        
        setIsContractorPaymentModalOpen(true);
        setContextMenu(null);
    };

    const openContractorPaymentModal = () => {
         if (!contextMenu?.event) return;
         setSelectedEventForPayment(contextMenu.event);
         // Calculate remaining amount
         const remaining = contextMenu.event.amount - (contextMenu.event.paymentAmount || 0);
         setContractorPaymentAmount(remaining > 0 ? remaining.toString() : '0');
         setIsContractorPaymentModalOpen(true);
         setContextMenu(null);
    };

    const submitContractorPayment = async () => {
        if (!selectedContractorId || !contractorPaymentAmount || !selectedEventForPayment) return;

        try {
            await db.contractorPayments.create({
                contractor_id: selectedContractorId,
                client_id: selectedEventForPayment.projectId,
                amount: parseFloat(contractorPaymentAmount),
                date: selectedEventForPayment.date ? new Date(selectedEventForPayment.date).toISOString() : new Date().toISOString(),
                description: 'Pago a cuenta de proyecto'
            });

            // Reload
            const [paymentsData, contractorPaymentsData] = await Promise.all([
                db.payments.getAll(),
                db.contractorPayments.getAll()
            ]);
            setPayments(paymentsData);
            setContractorPayments(contractorPaymentsData);
            
            setIsContractorPaymentModalOpen(false);
            setContractorPaymentAmount('');
            setSelectedContractorId('');
            setSelectedEventForPayment(null);
        } catch (e) {
            console.error(e);
            alert('Error al registrar pago');
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
                        onClick={() => handleOpenManualTransaction('IN')} 
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all mr-2 shadow-lg"
                    >
                        <DollarSign className="w-4 h-4" /> Registrar Transacción
                    </button>

                    <button 
                        onClick={() => setViewMode('CALENDAR')} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'CALENDAR' ? 'bg-white dark:bg-slate-700 shadow text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                        <CalendarRange className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => setViewMode('FORECAST')} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'FORECAST' ? 'bg-white dark:bg-slate-700 shadow text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                        <TrendingUp className="w-4 h-4" /> 
                    </button>
                    <button 
                        onClick={() => setViewMode('HISTORY')} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'HISTORY' ? 'bg-white dark:bg-slate-700 shadow text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                        <History className="w-4 h-4" /> 
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
                                <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">{formatMoney(totalInUSD, 'USD')}</p>
                                {totalInARS > 0 && <p className="text-sm font-bold text-emerald-700 dark:text-emerald-200">{formatMoney(totalInARS, 'ARS')}</p>}
                            </div>
                        </Card>
                        <Card className="p-4 flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900">
                            <div className="p-2 bg-red-100 dark:bg-red-900 rounded-full text-red-600 dark:text-red-400"><TrendingDown className="w-5 h-5"/></div>
                            <div>
                                <p className="text-xs text-red-800 dark:text-red-300 font-bold uppercase">Salidas (Mes)</p>
                                <p className="text-lg font-bold text-red-900 dark:text-red-100">{formatMoney(totalOutUSD, 'USD')}</p>
                                {totalOutARS > 0 && <p className="text-sm font-bold text-red-700 dark:text-red-200">{formatMoney(totalOutARS, 'ARS')}</p>}
                            </div>
                        </Card>
                        <Card className="p-4 flex items-center gap-3 bg-gray-900 dark:bg-white text-white dark:text-black border-gray-800">
                            <div className="p-2 bg-gray-700 dark:bg-gray-200 rounded-full text-white dark:text-black"><Wallet className="w-5 h-5"/></div>
                            <div>
                                <p className="text-xs text-gray-400 dark:text-gray-600 font-bold uppercase">Neto Estimado</p>
                                <p className="text-lg font-bold">{formatMoney(netUSD, 'USD')}</p>
                                {netARS !== 0 && <p className="text-sm font-bold">{formatMoney(netARS, 'ARS')}</p>}
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
                                                let colorClass = '';

                                                if (evt.cancelled) {
                                                    // CANCELLED: Muted purple/slate with strikethrough
                                                    colorClass = 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 opacity-60 line-through';
                                                } else if (evt.type === 'IN') {
                                                    if (evt.paid) {
                                                        // Check if PARTIAL or FULL payment
                                                        const payment = payments.find(p => p.id === evt.paymentId);
                                                        if (payment?.type === 'PARTIAL') {
                                                            // PARTIAL: Yellow
                                                            colorClass = 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
                                                        } else {
                                                            // FULL: Green
                                                            colorClass = 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
                                                        }
                                                    } else {
                                                        // UNPAID: Check if overdue
                                                        const today = new Date();
                                                        today.setHours(0, 0, 0, 0);
                                                        const eventDate = new Date(date);
                                                        eventDate.setHours(0, 0, 0, 0);
                                                        
                                                        if (eventDate < today) {
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
                                                    title={
                                                        evt.paid 
                                                            ? (evt.paymentAmount && evt.paymentAmount < evt.amount 
                                                                ? `${evt.label}: ${formatMoney(evt.amount, evt.currency || 'USD')}\nPagado: ${formatMoney(evt.paymentAmount, evt.currency || 'USD')}\nFalta: ${formatMoney(evt.amount - evt.paymentAmount, evt.currency || 'USD')}` 
                                                                : `${evt.label}: ${formatMoney(evt.amount, evt.currency || 'USD')} (Pagado Completo)`)
                                                            : `${evt.label}: ${formatMoney(evt.amount, evt.currency || 'USD')} (Pendiente)`
                                                    }
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
                                                    <span className="font-bold ml-1">{formatMoney(evt.amount, evt.currency || 'USD')}</span>
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
                                        <div className="text-right">
                                            <span className="font-bold text-green-600">+{formatMoney(month.ingresosUSD, 'USD')}</span>
                                            {month.ingresosARS > 0 && <div className="font-bold text-green-600 text-xs">+{formatMoney(month.ingresosARS, 'ARS')}</div>}
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Gastos Fijos</span>
                                        <div className="text-right">
                                            <span className="font-bold text-red-600">-{formatMoney(month.gastosUSD, 'USD')}</span>
                                            {month.gastosARS > 0 && <div className="font-bold text-red-600 text-xs">-{formatMoney(month.gastosARS, 'ARS')}</div>}
                                        </div>
                                    </div>
                                    <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center">
                                        <span className="font-bold text-gray-900 dark:text-white">Flujo Neto</span>
                                        <div className="text-right">
                                            <span className={`text-xl font-bold ${month.netoUSD >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-600'}`}>
                                                {formatMoney(month.netoUSD, 'USD')}
                                            </span>
                                            {month.netoARS !== 0 && (
                                                <div className={`text-sm font-bold ${month.netoARS >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-600'}`}>
                                                    {formatMoney(month.netoARS, 'ARS')}
                                                </div>
                                            )}
                                        </div>
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




             {/* MODAL DETALLE PAGO */}
             <Modal isOpen={isPaymentDetailModalOpen} onClose={() => setIsPaymentDetailModalOpen(false)} title="Detalle del Pago">
                {selectedPaymentDetail && (
                    <div className="space-y-6">
                        <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded-xl text-center">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{selectedPaymentDetail.label}</h3>
                            <p className="text-sm text-gray-500">{new Date(selectedPaymentDetail.date || new Date()).toLocaleDateString()}</p>
                            <p className="text-3xl font-black text-indigo-600 mt-2">{formatMoney(selectedPaymentDetail.amount, selectedPaymentDetail.currency || 'ARS')}</p>
                            
                            {/* DESCRIPTION / NOTES */}
                            {(selectedPaymentDetail.notes || selectedPaymentDetail.description) && (
                                <div className="mt-3 p-2 bg-white dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700 text-sm text-gray-600 dark:text-gray-300 italic">
                                    "{selectedPaymentDetail.notes || selectedPaymentDetail.description}"
                                </div>
                            )}

                            <div className="flex justify-center gap-2 mt-2">
                                {selectedPaymentDetail.paid && <Badge variant="green">Pagado</Badge>}
                                {activeProposalDetails?.isSnapshot && <Badge variant="blue">Histórico</Badge>}
                            </div>
                        </div>

                        {/* PARTIAL PAYMENT BREAKDOWN */}
                        {selectedPaymentDetail.paid && selectedPaymentDetail.paymentAmount && selectedPaymentDetail.paymentAmount < selectedPaymentDetail.amount && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <DollarSign className="w-5 h-5 text-yellow-600" />
                                    <h4 className="font-bold text-gray-900 dark:text-white">Pago Parcial</h4>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white dark:bg-slate-800 p-3 rounded-lg">
                                        <p className="text-xs text-gray-500 mb-1">Pagado</p>
                                        <p className="text-xl font-bold text-green-600">{formatMoney(selectedPaymentDetail.paymentAmount, selectedPaymentDetail.currency || 'ARS')}</p>
                                    </div>
                                    <div className="bg-white dark:bg-slate-800 p-3 rounded-lg">
                                        <p className="text-xs text-gray-500 mb-1">Falta</p>
                                        <p className="text-xl font-bold text-red-600">{formatMoney(selectedPaymentDetail.amount - selectedPaymentDetail.paymentAmount, selectedPaymentDetail.currency || 'ARS')}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {loadingProposal ? (
                            <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600"/></div>
                        ) : activeProposalDetails ? (
                            <div className="space-y-4">
                                {/* Services List */}
                                <div>
                                    <Label className="mb-2 block font-bold">Servicios Incluidos</Label>
                                    <div className="space-y-2">
                                        {activeProposalDetails.items?.map((item: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600">
                                                        <Briefcase className="w-4 h-4"/>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-900 dark:text-white text-sm">{item.serviceSnapshotName}</p>
                                                        {item.serviceSnapshotDescription && <p className="text-xs text-gray-500">{item.serviceSnapshotDescription}</p>}
                                                    </div>
                                                </div>
                                                {/* Optional: Show cost if you want to be transparent, or hide it if it's internal */}
                                            </div>
                                        ))}
                                    </div>
                                </div>

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
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-red-500 text-lg">
                                                            - ${item.outsourcingCost.toLocaleString()}
                                                        </span>
                                                        {item.contractor?.id && (
                                                            <Button 
                                                                size="sm" 
                                                                className="h-7 px-2 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
                                                                onClick={() => {
                                                                    // Open Contractor Payment Modal pre-filled
                                                                    setSelectedContractorId(item.contractor.id);
                                                                    setContractorPaymentAmount(item.outsourcingCost.toString());
                                                                    setIsContractorPaymentModalOpen(true);
                                                                    setIsPaymentDetailModalOpen(false); // Close current modal? Or keep open? User preference.
                                                                    // Usually easier to close invalidating `loadingProposal` state if we return.
                                                                    // Let's close it to avoid modal stacking issues unless we handle z-index well.
                                                                }}
                                                            >
                                                                Pagar
                                                            </Button>
                                                        )}
                                                    </div>
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
                                <p>No se encontraron detalles del contrato activo.</p>
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
                        <p className="text-[10px] text-gray-500">Acciones</p>
                    </div>
                    
                    {contextMenu.event.type === 'IN' && (
                        <>
                            <button onClick={() => handleMarkAsPaid('FULL')} className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center gap-2">
                                <Check className="w-4 h-4" /> Pagó Completo
                            </button>
                            <button onClick={() => handleMarkAsPaid('PARTIAL')} className="w-full text-left px-4 py-2 text-sm text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 flex items-center gap-2">
                                <DollarSign className="w-4 h-4" /> Pagó Parcial...
                            </button>
                            <div className="border-t border-gray-100 dark:border-slate-700 my-1"></div>
                        </>
                    )}

                    {/* Won't Pay - show for any projected (unpaid) event */}
                    {!contextMenu.event.paid && (
                        <>
                            <div className="border-t border-gray-100 dark:border-slate-700 my-1"></div>
                            <button onClick={handleMarkWontPay} className="w-full text-left px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2">
                                <Ban className="w-4 h-4" /> No se va a pagar
                            </button>
                        </>
                    )}

                    {contextMenu.event.type === 'OUT' && !contextMenu.event.cancelled && (
                        <>
                            <button onClick={openContractorPaymentModal} className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2">
                                <DollarSign className="w-4 h-4" /> Registrar Pago Socio
                            </button>
                             <div className="border-t border-gray-100 dark:border-slate-700 my-1"></div>
                        </>
                    )}
                    
                    {contextMenu.event.paymentId && (
                        <>
                            <button onClick={handleOpenEditDate} className="w-full text-left px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-center gap-2">
                                <CalendarRange className="w-4 h-4" /> Cambiar Fecha
                            </button>
                            <button onClick={handleDeletePayment} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2">
                                <X className="w-4 h-4" /> Desmarcar Pago
                            </button>
                        </>
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
                            <p className="text-xs text-gray-500 mt-1">Total esperado: {formatMoney(selectedEventForPayment.amount, selectedEventForPayment.currency || 'ARS')}</p>
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

            {/* MODAL PAGO A CONTRATISTA */}
            <Modal isOpen={isContractorPaymentModalOpen} onClose={() => setIsContractorPaymentModalOpen(false)} title="Registrar Pago a Socio">
                <div className="space-y-4">
                    <div>
                        <Label>Socio / Contratista</Label>
                        <Select 
                            value={selectedContractorId} 
                            onChange={(e) => setSelectedContractorId(e.target.value)}
                        >
                            <option value="">Seleccionar...</option>
                            {contractors.map(c => (
                                <option key={c.id} value={c.id}>{c.name} ({c.role})</option>
                            ))}
                        </Select>
                    </div>
                    <div>
                        <Label>Monto a Pagar</Label>
                        <Input 
                            type="number" 
                            value={contractorPaymentAmount} 
                            onChange={(e) => setContractorPaymentAmount(e.target.value)} 
                        />
                    </div>
                    <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
                        <p className="text-xs text-gray-500">Proyecto Asociado</p>
                        <p className="font-bold text-gray-900 dark:text-white">
                            {projects.find(p => p.id === selectedEventForPayment?.projectId)?.name || 'Desconocido'}
                        </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setIsContractorPaymentModalOpen(false)}>Cancelar</Button>
                        <Button onClick={submitContractorPayment} disabled={!selectedContractorId || !contractorPaymentAmount}>
                             Registrar Pago
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* MODAL MANUAL TRANSACTION */}
            <Modal isOpen={isManualTransactionModalOpen} onClose={() => setIsManualTransactionModalOpen(false)} title="Registrar Transacción">
                <div className="space-y-4">
                    <div className="flex gap-2 mb-4">
                        <button 
                            onClick={() => setManualType('IN')}
                            className={`flex-1 py-2 px-4 rounded-lg font-bold border ${manualType === 'IN' ? 'bg-emerald-100 dark:bg-emerald-900 border-emerald-500 text-emerald-700 dark:text-emerald-300' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'}`}
                        >
                            Ingreso (Cobro)
                        </button>
                        <button 
                            onClick={() => setManualType('OUT')}
                            className={`flex-1 py-2 px-4 rounded-lg font-bold border ${manualType === 'OUT' ? 'bg-red-100 dark:bg-red-900 border-red-500 text-red-700 dark:text-red-300' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'}`}
                        >
                            Salida (Pago)
                        </button>
                    </div>

                    <div>
                        <Label>{manualType === 'IN' ? 'Cliente' : 'Socio / Contratista'}</Label>
                        <Select 
                            value={manualEntityId} 
                            onChange={(e) => setManualEntityId(e.target.value)}
                        >
                            <option value="">Seleccionar...</option>
                            {manualType === 'IN' 
                                ? projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                                : contractors.map(c => <option key={c.id} value={c.id}>{c.name} ({c.role})</option>)
                            }
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Monto</Label>
                            <Input 
                                type="number" 
                                value={manualAmount} 
                                onChange={(e) => setManualAmount(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <Label>Fecha</Label>
                            <Input 
                                type="date" 
                                value={manualDate} 
                                onChange={(e) => setManualDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Descripción / Notas</Label>
                        <Input 
                            value={manualDescription} 
                            onChange={(e) => setManualDescription(e.target.value)}
                            placeholder={manualType === 'IN' ? 'Ej: Pago Mensual Marzo' : 'Ej: Pago por Diseño Web'}
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 dark:border-slate-800">
                        <Button variant="ghost" onClick={() => setIsManualTransactionModalOpen(false)}>Cancelar</Button>
                        <Button onClick={submitManualTransaction} disabled={!manualEntityId || !manualAmount}>
                             Guardar Transacción
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
