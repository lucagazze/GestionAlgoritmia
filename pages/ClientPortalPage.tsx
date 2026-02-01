

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../services/db';
import { Project, Deliverable, PortalMessage } from '../types';
import { Card, Button, Input, Modal, Label, Textarea } from '../components/UIComponents';
import { Loader2, ExternalLink, Calendar, CheckCircle2, AlertCircle, ShieldCheck, Download, CreditCard, UploadCloud, MessageSquare, Send, FileText, X } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ClientPortalPage() {
    const { token } = useParams<{ token: string }>();
    const [project, setProject] = useState<Project | null>(null);
    const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
    const [messages, setMessages] = useState<PortalMessage[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Upload/Feedback State
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [selectedDeliv, setSelectedDeliv] = useState<Deliverable | null>(null);
    const [feedbackText, setFeedbackText] = useState('');
    
    // Chat State
    const [chatInput, setChatInput] = useState('');
    const chatRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (token) loadProject();
    }, [token]);

    useEffect(() => {
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }, [messages]);

    const loadProject = async () => {
        if (!token) return;
        const data = await db.projects.getByToken(token);
        if (data) {
            setProject(data);
            const [delivs, msgs] = await Promise.all([
                db.portal.getDeliverables(data.id),
                db.portal.getMessages(data.id)
            ]);
            setDeliverables(delivs);
            setMessages(msgs);
        }
        setLoading(false);
    };

    const handleApprove = async (deliv: Deliverable) => {
        if(confirm("¿Aprobar esta entrega?")) {
            await db.portal.updateDeliverable(deliv.id, { status: 'APPROVED' });
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            loadProject();
        }
    };

    const handleRequestChanges = (deliv: Deliverable) => {
        setSelectedDeliv(deliv);
        setIsFeedbackModalOpen(true);
    };

    const submitFeedback = async () => {
        if (!selectedDeliv || !feedbackText) return;
        await db.portal.updateDeliverable(selectedDeliv.id, { status: 'CHANGES_REQUESTED', feedback: feedbackText });
        setIsFeedbackModalOpen(false);
        setFeedbackText('');
        loadProject();
    };

    const handleSendMessage = async () => {
        if (!chatInput.trim() || !project) return;
        await db.portal.sendMessage({
            projectId: project.id,
            sender: 'CLIENT',
            content: chatInput
        });
        setChatInput('');
        const msgs = await db.portal.getMessages(project.id);
        setMessages(msgs);
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;

    if (!project) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 text-gray-500 gap-4">
            <ShieldCheck className="w-12 h-12 text-gray-300" />
            <p className="font-medium">Enlace no válido o expirado.</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 font-sans text-gray-900 dark:text-white selection:bg-black selection:text-white">
            
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-20">
                <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Portal de Cliente</p>
                        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">{project.name}</h1>
                    </div>
                    <div className="w-10 h-10 bg-black dark:bg-white text-white dark:text-black rounded-xl flex items-center justify-center font-bold text-sm shadow-lg">
                        {project.name.charAt(0)}
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* LEFT: Project Status & Deliverables */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Status Bar */}
                    <section>
                        <div className="flex justify-between items-end mb-4">
                            <h2 className="text-lg font-bold">Progreso Actual</h2>
                            <span className="text-sm font-bold bg-black dark:bg-white text-white dark:text-black px-2 py-0.5 rounded-md">{project.progress}%</span>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
                            <div className="h-4 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden mb-4">
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

                    {/* Deliverables Zone */}
                    <section>
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><UploadCloud className="w-5 h-5"/> Entregables Pendientes</h2>
                        {deliverables.length === 0 ? (
                            <div className="bg-gray-50 dark:bg-slate-900/50 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-2xl p-8 text-center text-gray-400">
                                <p>No hay entregas pendientes de revisión por el momento.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {deliverables.map(deliv => (
                                    <div key={deliv.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${deliv.status === 'APPROVED' ? 'bg-green-100 text-green-600' : deliv.status === 'CHANGES_REQUESTED' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                                    <FileText className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-lg">{deliv.name}</h3>
                                                    <a href={deliv.url} target="_blank" className="text-sm text-blue-500 hover:underline flex items-center gap-1 mt-1">Ver Archivo <ExternalLink className="w-3 h-3"/></a>
                                                </div>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${deliv.status === 'APPROVED' ? 'bg-green-50 border-green-200 text-green-700' : deliv.status === 'CHANGES_REQUESTED' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
                                                {deliv.status === 'APPROVED' ? 'APROBADO' : deliv.status === 'CHANGES_REQUESTED' ? 'CAMBIOS SOLICITADOS' : 'PENDIENTE'}
                                            </span>
                                        </div>

                                        {deliv.status === 'PENDING' && (
                                            <div className="flex gap-3 mt-6 border-t border-gray-100 dark:border-slate-800 pt-4">
                                                <Button onClick={() => handleApprove(deliv)} className="flex-1 bg-green-600 hover:bg-green-700 text-white border-transparent">
                                                    <CheckCircle2 className="w-4 h-4 mr-2" /> Aprobar
                                                </Button>
                                                <Button onClick={() => handleRequestChanges(deliv)} variant="secondary" className="flex-1 bg-red-50 text-red-600 hover:bg-red-100 border-red-100">
                                                    <AlertCircle className="w-4 h-4 mr-2" /> Solicitar Cambios
                                                </Button>
                                            </div>
                                        )}
                                        {deliv.feedback && (
                                            <div className="mt-4 bg-red-50 dark:bg-red-900/10 p-3 rounded-lg text-sm text-red-800 dark:text-red-300 border border-red-100 dark:border-red-900">
                                                <strong>Feedback:</strong> "{deliv.feedback}"
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>

                {/* RIGHT: Chat & Resources */}
                <div className="space-y-8">
                    
                    {/* Chat Widget */}
                    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm h-[500px] flex flex-col">
                        <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-blue-500" />
                            <h3 className="font-bold text-sm">Chat con Project Manager</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-slate-950" ref={chatRef}>
                            {messages.length === 0 && <p className="text-center text-xs text-gray-400 mt-10">Envía un mensaje para comenzar...</p>}
                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.sender === 'CLIENT' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] p-3 rounded-xl text-sm ${msg.sender === 'CLIENT' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'}`}>
                                        <p>{msg.content}</p>
                                        <div className={`text-[10px] mt-1 text-right ${msg.sender === 'CLIENT' ? 'text-blue-200' : 'text-gray-400'}`}>
                                            {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-3 border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <div className="flex gap-2">
                                <Input 
                                    value={chatInput} 
                                    onChange={e => setChatInput(e.target.value)} 
                                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                                    placeholder="Escribe aquí..." 
                                    className="flex-1 text-sm h-10"
                                />
                                <Button size="sm" onClick={handleSendMessage}><Send className="w-4 h-4"/></Button>
                            </div>
                        </div>
                    </div>

                    {/* Resources Mini */}
                    <section>
                        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-3">Recursos Compartidos</h2>
                        <div className="space-y-2">
                            {project.resources?.map((res, idx) => (
                                <a key={idx} href={res.url} target="_blank" className="block p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl hover:border-blue-300 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <ExternalLink className="w-4 h-4 text-gray-400"/>
                                        <span className="text-sm font-medium">{res.name}</span>
                                    </div>
                                </a>
                            ))}
                            {(!project.resources || project.resources.length === 0) && <p className="text-xs text-gray-400 italic">No hay recursos.</p>}
                        </div>
                    </section>
                </div>
            </div>

            <Modal isOpen={isFeedbackModalOpen} onClose={() => setIsFeedbackModalOpen(false)} title="Solicitar Cambios">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">Describe qué cambios necesitas para el entregable <strong>{selectedDeliv?.name}</strong>:</p>
                    <Textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)} placeholder="Ej: Cambiar el color del logo a azul..." className="min-h-[150px]" />
                    <div className="flex justify-end pt-2">
                        <Button onClick={submitFeedback} className="bg-red-600 hover:bg-red-700 text-white border-transparent">Enviar Solicitud</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}