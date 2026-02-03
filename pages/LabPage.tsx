import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Project, ProjectStatus } from '../types';
import { Card, Button, Input, Slider, Label } from '../components/UIComponents';
import { Rocket, Target, TrendingUp, DollarSign, Calculator, ArrowRight, UserPlus, MinusCircle, Mail, CheckCircle, AlertCircle } from 'lucide-react';

export default function LabPage() {
    const [currentMRR, setCurrentMRR] = useState(0);
    const [activeClients, setActiveClients] = useState(0);
    
    // Sim Inputs
    const [targetMRR, setTargetMRR] = useState(10000);
    const [avgTicket, setAvgTicket] = useState(1000);
    const [closeRate, setCloseRate] = useState(20); 
    const [leadToCallRate, setLeadToCallRate] = useState(10); 
    
    // Scenario Simulator Inputs
    const [hiringCost, setHiringCost] = useState(500);
    const [newHires, setNewHires] = useState(0);

    // ESTADO PARA EL TEST DE EMAIL
    const [sending, setSending] = useState(false);
    const [emailStatus, setEmailStatus] = useState<'idle' | 'success' | 'error'>('idle');
    
    useEffect(() => {
        const load = async () => {
            const projects = await db.projects.getAll();
            const active = projects.filter(p => p.status === ProjectStatus.ACTIVE || p.status === ProjectStatus.ONBOARDING);
            const mrr = active.reduce((acc, p) => acc + (p.monthlyRevenue || 0), 0);
            setCurrentMRR(mrr);
            setActiveClients(active.length);
            if (active.length > 0) {
                setAvgTicket(Math.round(mrr / active.length));
            }
        };
        load();
    }, []);

    // Reverse Engineering Logic
    const gap = Math.max(0, targetMRR - currentMRR);
    const newClientsNeeded = Math.ceil(gap / (avgTicket || 1));
    const callsNeeded = Math.ceil(newClientsNeeded / (closeRate / 100));
    const leadsNeeded = Math.ceil(callsNeeded / (leadToCallRate / 100));

    // Scenario Logic
    const projectedCost = newHires * hiringCost;
    const breakEvenClients = Math.ceil(projectedCost / (avgTicket || 1));

    // FUNCIÓN PARA PROBAR EL EMAIL
    const handleTestEmail = async () => {
        setSending(true);
        setEmailStatus('idle');
        try {
            const response = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ destEmail: 'info@algoritmiadesarrollos.com.ar' }) // Se auto-envía para probar
            });
            
            if (response.ok) {
                setEmailStatus('success');
                alert("¡Correo enviado! Revisa la bandeja de entrada de info@algoritmiadesarrollos.com.ar");
            } else {
                throw new Error('Falló el envío');
            }
        } catch (error) {
            console.error(error);
            setEmailStatus('error');
            alert("Error al enviar. Asegurate de estar corriendo esto con 'vercel dev' o desplegado en Vercel, ya que 'npm run dev' a veces no carga la carpeta /api localmente.");
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
                        <Rocket className="w-8 h-8 text-purple-600" /> El Laboratorio
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">Simulador de Crecimiento & Ingeniería Inversa de Metas.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Control Panel */}
                <div className="lg:col-span-5 space-y-6">
                    <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-purple-100 dark:border-purple-900/50 shadow-xl shadow-purple-500/5">
                        <div className="p-6 space-y-6">
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><Target className="w-5 h-5 text-purple-600"/> Variables del Experimento</h3>
                            
                            <div>
                                <Label>Tu "Freedom Number" (Meta MRR)</Label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3 text-gray-400 font-bold">$</span>
                                    <Input 
                                        type="number" 
                                        value={targetMRR} 
                                        onChange={e => setTargetMRR(parseFloat(e.target.value) || 0)} 
                                        className="pl-8 text-lg font-bold text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900 focus:ring-purple-500"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <Label className="mb-0">Ticket Promedio ($)</Label>
                                        <span className="text-xs font-bold bg-gray-100 dark:bg-slate-800 px-2 rounded">${avgTicket}</span>
                                    </div>
                                    <Slider min={100} max={5000} step={50} value={avgTicket} onChange={e => setAvgTicket(parseInt(e.target.value))} />
                                </div>

                                <div>
                                    <div className="flex justify-between mb-2">
                                        <Label className="mb-0">Tasa de Cierre (%)</Label>
                                        <span className="text-xs font-bold bg-green-100 text-green-700 px-2 rounded">{closeRate}%</span>
                                    </div>
                                    <Slider min={1} max={100} value={closeRate} onChange={e => setCloseRate(parseInt(e.target.value))} />
                                </div>

                                <div>
                                    <div className="flex justify-between mb-2">
                                        <Label className="mb-0">Calidad de Lead (%)</Label>
                                        <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 rounded">{leadToCallRate}%</span>
                                    </div>
                                    <Slider min={1} max={100} value={leadToCallRate} onChange={e => setLeadToCallRate(parseInt(e.target.value))} />
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Scenario Simulator Widget */}
                    <Card className="border-orange-100 dark:border-orange-900/30">
                        <div className="p-6 space-y-4">
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><Calculator className="w-5 h-5 text-orange-500"/> Simulador de Contratación</h3>
                            
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <Label>Costo Nuevo Hire ($)</Label>
                                    <Input type="number" value={hiringCost} onChange={e => setHiringCost(parseInt(e.target.value))} />
                                </div>
                                <div className="flex flex-col items-center">
                                    <Label>Cantidad</Label>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setNewHires(Math.max(0, newHires - 1))} className="p-1 bg-gray-100 dark:bg-slate-800 rounded hover:bg-gray-200"><MinusCircle className="w-5 h-5"/></button>
                                        <span className="font-bold w-4 text-center">{newHires}</span>
                                        <button onClick={() => setNewHires(newHires + 1)} className="p-1 bg-gray-100 dark:bg-slate-800 rounded hover:bg-gray-200"><UserPlus className="w-5 h-5"/></button>
                                    </div>
                                </div>
                            </div>

                            {newHires > 0 && (
                                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl text-sm border border-orange-100 dark:border-orange-900/50">
                                    <p className="text-orange-900 dark:text-orange-200 font-bold mb-1">Impacto Financiero:</p>
                                    <ul className="list-disc ml-4 space-y-1 text-orange-800 dark:text-orange-300">
                                        <li>Costo extra mensual: <strong>${projectedCost}</strong></li>
                                        <li>Necesitas <strong>{breakEvenClients} clientes extra</strong> solo para cubrir este costo.</li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* NUEVA CARD: ZONA DE PRUEBAS SMTP */}
                    <Card className="border-indigo-100 dark:border-indigo-900/30">
                        <div className="p-6 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Mail className="w-5 h-5 text-indigo-500"/> Test de Conexión
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">Prueba envío con Hostinger</p>
                            </div>
                            <Button 
                                onClick={handleTestEmail} 
                                disabled={sending}
                                className={`
                                    ${emailStatus === 'success' ? 'bg-green-600 hover:bg-green-700' : ''}
                                    ${emailStatus === 'error' ? 'bg-red-600 hover:bg-red-700' : ''}
                                `}
                            >
                                {sending ? 'Enviando...' : emailStatus === 'success' ? '¡Enviado!' : emailStatus === 'error' ? 'Reintentar' : 'Probar Email'}
                            </Button>
                        </div>
                    </Card>
                </div>

                {/* Results Visualization */}
                <div className="lg:col-span-7 space-y-6">
                    <Card className="h-full border-0 shadow-2xl flex flex-col">
                        <div className="p-8 flex-1 bg-white dark:bg-slate-900">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2"><TrendingUp className="w-5 h-5"/> Hoja de Ruta Generada</h3>
                            
                            <div className="flex flex-col gap-0 relative">
                                {/* Step 1: Gap */}
                                <div className="flex items-center gap-4 pb-8 border-l-2 border-dashed border-gray-200 dark:border-slate-700 pl-8 relative">
                                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-gray-200 dark:bg-slate-700"></div>
                                    <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-600 font-bold shrink-0">
                                        <TrendingUp className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Falta para la meta</p>
                                        <p className="text-3xl font-bold text-gray-900 dark:text-white">${gap.toLocaleString()}</p>
                                        <p className="text-xs text-gray-400">Mensuales recurrentes</p>
                                    </div>
                                </div>

                                {/* Step 2: Clients */}
                                <div className="flex items-center gap-4 pb-8 border-l-2 border-purple-100 dark:border-slate-700 pl-8 relative">
                                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-purple-500 ring-4 ring-white dark:ring-slate-900"></div>
                                    <div className="w-16 h-16 rounded-2xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 font-bold shrink-0 shadow-sm">
                                        {newClientsNeeded}
                                    </div>
                                    <div>
                                        <p className="text-lg font-bold text-gray-900 dark:text-white">Nuevos Clientes</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Necesarios a ${avgTicket}/mes</p>
                                    </div>
                                    <ArrowRight className="ml-auto text-gray-300 w-6 h-6"/>
                                </div>

                                {/* Step 3: Calls */}
                                <div className="flex items-center gap-4 pb-8 border-l-2 border-blue-100 dark:border-slate-700 pl-8 relative">
                                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-500 ring-4 ring-white dark:ring-slate-900"></div>
                                    <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 font-bold shrink-0 shadow-sm">
                                        {callsNeeded}
                                    </div>
                                    <div>
                                        <p className="text-lg font-bold text-gray-900 dark:text-white">Reuniones de Venta</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Asumiendo cierre del {closeRate}%</p>
                                    </div>
                                    <ArrowRight className="ml-auto text-gray-300 w-6 h-6"/>
                                </div>

                                {/* Step 4: Leads */}
                                <div className="flex items-center gap-4 pl-8 relative">
                                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-black dark:bg-white ring-4 ring-white dark:ring-slate-900"></div>
                                    <div className="w-16 h-16 rounded-2xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-bold shrink-0 shadow-xl">
                                        {leadsNeeded}
                                    </div>
                                    <div>
                                        <p className="text-lg font-bold text-gray-900 dark:text-white">Leads / Prospectos</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Volumen necesario en el Top of Funnel</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-slate-800 p-6 border-t border-gray-100 dark:border-slate-700 text-center">
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                Para facturar <span className="font-bold text-gray-900 dark:text-white">${targetMRR.toLocaleString()}</span>, tu foco hoy es conseguir <span className="font-bold underline">{leadsNeeded} leads</span> este mes.
                            </p>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
