
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Project, ProjectStatus } from '../types';
import { Card, Button, Input, Slider, Label } from '../components/UIComponents';
import { Rocket, Target, TrendingUp, DollarSign, Calculator, ArrowRight } from 'lucide-react';

export default function LabPage() {
    const [currentMRR, setCurrentMRR] = useState(0);
    const [activeClients, setActiveClients] = useState(0);
    
    // Sim Inputs
    const [targetMRR, setTargetMRR] = useState(10000);
    const [avgTicket, setAvgTicket] = useState(1000);
    const [closeRate, setCloseRate] = useState(20); // %
    const [leadToCallRate, setLeadToCallRate] = useState(10); // % of leads that book a call
    
    useEffect(() => {
        const load = async () => {
            const projects = await db.projects.getAll();
            const active = projects.filter(p => p.status === ProjectStatus.ACTIVE || p.status === ProjectStatus.ONBOARDING);
            const mrr = active.reduce((acc, p) => acc + (p.monthlyRevenue || 0), 0);
            setCurrentMRR(mrr);
            setActiveClients(active.length);
            // Auto-set average ticket based on real data if available
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

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
                        <Rocket className="w-8 h-8 text-purple-600" /> El Laboratorio
                    </h1>
                    <p className="text-gray-500 mt-2">Simulador de Crecimiento & Ingeniería Inversa de Metas.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Control Panel */}
                <div className="lg:col-span-5 space-y-6">
                    <Card className="bg-white/80 backdrop-blur-sm border-purple-100 shadow-xl shadow-purple-500/5">
                        <div className="p-6 space-y-6">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2"><Target className="w-5 h-5 text-purple-600"/> Variables del Experimento</h3>
                            
                            <div>
                                <Label>Tu "Freedom Number" (Meta MRR)</Label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3 text-gray-400 font-bold">$</span>
                                    <Input 
                                        type="number" 
                                        value={targetMRR} 
                                        onChange={e => setTargetMRR(parseFloat(e.target.value) || 0)} 
                                        className="pl-8 text-lg font-bold text-purple-700 border-purple-200 focus:ring-purple-500"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <Label className="mb-0">Ticket Promedio ($)</Label>
                                        <span className="text-xs font-bold bg-gray-100 px-2 rounded">${avgTicket}</span>
                                    </div>
                                    <Slider min={100} max={5000} step={50} value={avgTicket} onChange={e => setAvgTicket(parseInt(e.target.value))} />
                                </div>

                                <div>
                                    <div className="flex justify-between mb-2">
                                        <Label className="mb-0">Tasa de Cierre (%)</Label>
                                        <span className="text-xs font-bold bg-green-100 text-green-700 px-2 rounded">{closeRate}%</span>
                                    </div>
                                    <Slider min={1} max={100} value={closeRate} onChange={e => setCloseRate(parseInt(e.target.value))} />
                                    <p className="text-[10px] text-gray-400 mt-1">De cada 10 reuniones, cierras {Math.round(10 * (closeRate/100))}.</p>
                                </div>

                                <div>
                                    <div className="flex justify-between mb-2">
                                        <Label className="mb-0">Calidad de Lead (% Agenda)</Label>
                                        <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 rounded">{leadToCallRate}%</span>
                                    </div>
                                    <Slider min={1} max={100} value={leadToCallRate} onChange={e => setLeadToCallRate(parseInt(e.target.value))} />
                                    <p className="text-[10px] text-gray-400 mt-1">% de leads que terminan en llamada.</p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="bg-gradient-to-br from-gray-900 to-gray-800 text-white">
                        <div className="p-6">
                            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Estado Actual</h3>
                            <div className="flex justify-between items-end">
                                <span className="text-3xl font-bold tracking-tight">${currentMRR.toLocaleString()}</span>
                                <span className="text-sm font-medium bg-white/10 px-3 py-1 rounded-full">{activeClients} Clientes</span>
                            </div>
                            <div className="mt-4 h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-green-400 transition-all duration-1000" style={{ width: `${Math.min(100, (currentMRR / targetMRR) * 100)}%` }}></div>
                            </div>
                            <p className="text-xs text-gray-400 mt-2 text-right">{Math.round((currentMRR / targetMRR) * 100)}% de la meta</p>
                        </div>
                    </Card>
                </div>

                {/* Results Visualization */}
                <div className="lg:col-span-7 space-y-6">
                    <Card className="h-full border-0 shadow-2xl flex flex-col">
                        <div className="p-8 flex-1 bg-white">
                            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2"><Calculator className="w-5 h-5"/> Hoja de Ruta Generada</h3>
                            
                            <div className="flex flex-col gap-0 relative">
                                {/* The Funnel Visual */}
                                
                                {/* Step 1: Gap */}
                                <div className="flex items-center gap-4 pb-8 border-l-2 border-dashed border-gray-200 pl-8 relative">
                                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-gray-200"></div>
                                    <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 font-bold shrink-0">
                                        <TrendingUp className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 uppercase font-bold tracking-wider">Falta para la meta</p>
                                        <p className="text-3xl font-bold text-gray-900">${gap.toLocaleString()}</p>
                                        <p className="text-xs text-gray-400">Mensuales recurrentes</p>
                                    </div>
                                </div>

                                {/* Step 2: Clients */}
                                <div className="flex items-center gap-4 pb-8 border-l-2 border-purple-100 pl-8 relative">
                                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-purple-500 ring-4 ring-white"></div>
                                    <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 font-bold shrink-0 shadow-sm">
                                        {newClientsNeeded}
                                    </div>
                                    <div>
                                        <p className="text-lg font-bold text-gray-900">Nuevos Clientes</p>
                                        <p className="text-sm text-gray-500">Necesarios a ${avgTicket}/mes</p>
                                    </div>
                                    <ArrowRight className="ml-auto text-gray-300 w-6 h-6"/>
                                </div>

                                {/* Step 3: Calls */}
                                <div className="flex items-center gap-4 pb-8 border-l-2 border-blue-100 pl-8 relative">
                                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-500 ring-4 ring-white"></div>
                                    <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold shrink-0 shadow-sm">
                                        {callsNeeded}
                                    </div>
                                    <div>
                                        <p className="text-lg font-bold text-gray-900">Reuniones de Venta</p>
                                        <p className="text-sm text-gray-500">Asumiendo cierre del {closeRate}%</p>
                                    </div>
                                    <ArrowRight className="ml-auto text-gray-300 w-6 h-6"/>
                                </div>

                                {/* Step 4: Leads */}
                                <div className="flex items-center gap-4 pl-8 relative">
                                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-black ring-4 ring-white"></div>
                                    <div className="w-16 h-16 rounded-2xl bg-black text-white flex items-center justify-center font-bold shrink-0 shadow-xl">
                                        {leadsNeeded}
                                    </div>
                                    <div>
                                        <p className="text-lg font-bold text-gray-900">Leads / Prospectos</p>
                                        <p className="text-sm text-gray-500">Volumen necesario en el Top of Funnel</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-50 p-6 border-t border-gray-100 text-center">
                            <p className="text-sm text-gray-600">
                                Para facturar <span className="font-bold text-gray-900">${targetMRR.toLocaleString()}</span>, tu foco hoy es conseguir <span className="font-bold underline">{leadsNeeded} leads</span> este mes.
                            </p>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
