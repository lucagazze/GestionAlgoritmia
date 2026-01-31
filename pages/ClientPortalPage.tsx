
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../services/db';
import { Project } from '../types';
import { Card, Button } from '../components/UIComponents';
import { Loader2, ExternalLink, Calendar, CheckCircle2, AlertCircle, ShieldCheck, Download, CreditCard } from 'lucide-react';

export default function ClientPortalPage() {
    const { token } = useParams<{ token: string }>();
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) loadProject();
    }, [token]);

    const loadProject = async () => {
        if (!token) return;
        const data = await db.projects.getByToken(token);
        setProject(data);
        setLoading(false);
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;

    if (!project) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-500 gap-4">
            <ShieldCheck className="w-12 h-12 text-gray-300" />
            <p className="font-medium">Enlace no válido o expirado.</p>
        </div>
    );

    const isPaymentPending = () => {
        if (!project.lastPaymentDate) return true;
        const last = new Date(project.lastPaymentDate);
        const now = new Date();
        return last.getMonth() !== now.getMonth() || last.getFullYear() !== now.getFullYear();
    };

    return (
        <div className="min-h-screen bg-[#FAFAFA] font-sans text-gray-900 selection:bg-black selection:text-white">
            
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-3xl mx-auto px-6 py-6 flex justify-between items-center">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Portal de Cliente</p>
                        <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
                    </div>
                    <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center font-bold text-sm shadow-lg">
                        {project.name.charAt(0)}
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
                
                {/* 1. Status Section */}
                <section>
                    <div className="flex justify-between items-end mb-4">
                        <h2 className="text-lg font-bold">Estado del Proyecto</h2>
                        <span className="text-sm font-bold bg-black text-white px-2 py-0.5 rounded-md">{project.progress}%</span>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden mb-4">
                            <div 
                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-1000 ease-out" 
                                style={{ width: `${project.progress}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 font-medium uppercase tracking-wider">
                            <span>Inicio</span>
                            <span>En Proceso</span>
                            <span>Finalizado</span>
                        </div>
                    </div>
                </section>

                {/* 2. The Vault (Assets) */}
                <section>
                    <h2 className="text-lg font-bold mb-4">The Vault (Tus Recursos)</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {project.resources && project.resources.length > 0 ? (
                            project.resources.map((res, idx) => (
                                <a 
                                    key={idx} 
                                    href={res.url} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="group bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-black/20 transition-all flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-gray-50 rounded-lg text-gray-500 group-hover:text-black group-hover:bg-gray-100 transition-colors">
                                            {res.type === 'DRIVE' ? <Download className="w-5 h-5"/> : <ExternalLink className="w-5 h-5"/>}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-gray-800">{res.name}</p>
                                            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{res.type}</p>
                                        </div>
                                    </div>
                                    <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-black" />
                                </a>
                            ))
                        ) : (
                            <div className="col-span-full py-8 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                <p>Aún no hay recursos compartidos.</p>
                            </div>
                        )}
                    </div>
                </section>

                {/* 3. Payments */}
                <section>
                    <h2 className="text-lg font-bold mb-4">Próximo Pago</h2>
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-full ${isPaymentPending() ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                                <CreditCard className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Fee Mensual</p>
                                <p className="text-2xl font-bold tracking-tight">${project.monthlyRevenue.toLocaleString()}</p>
                            </div>
                        </div>
                        
                        <div className="text-right">
                             {isPaymentPending() ? (
                                 <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">
                                     <AlertCircle className="w-4 h-4" />
                                     <span className="text-sm font-bold">Pendiente (Vence día {project.billingDay})</span>
                                 </div>
                             ) : (
                                 <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                                     <CheckCircle2 className="w-4 h-4" />
                                     <span className="text-sm font-bold">Al día este mes</span>
                                 </div>
                             )}
                        </div>
                    </div>
                </section>
                
                <footer className="pt-10 pb-6 text-center text-xs text-gray-400">
                    <p>Powered by Algoritmia OS</p>
                </footer>
            </div>
        </div>
    );
}
