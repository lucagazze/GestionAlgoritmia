
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Project, ProjectStatus } from '../types';
import { Ghost, CheckCircle2, X, ArrowRight } from 'lucide-react';
import { Button } from './UIComponents';
import { useToast } from './Toast';

export const GhostingAlert = () => {
    const [ghostedQueue, setGhostedQueue] = useState<Project[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        checkForGhosting();
        // Check every 10 minutes
        const interval = setInterval(checkForGhosting, 10 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const checkForGhosting = async () => {
        const snoozedUntil = localStorage.getItem('ghosting_snooze_global');
        if (snoozedUntil && new Date(snoozedUntil) > new Date()) return;

        const projects = await db.projects.getAll();
        const activeProjects = projects.filter(p => p.status === ProjectStatus.ACTIVE);
        
        const today = new Date();
        const ghosted = activeProjects.filter(p => {
            // Check if specifically snoozed
            const clientSnooze = localStorage.getItem(`ghosting_snooze_${p.id}`);
            if (clientSnooze && new Date(clientSnooze) > new Date()) return false;

            if (!p.lastContactDate) return true; // Never contacted
            
            const lastContact = new Date(p.lastContactDate);
            const diffTime = Math.abs(today.getTime() - lastContact.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            return diffDays > 7; // Threshold: 7 days
        });

        if (ghosted.length > 0) {
            setGhostedQueue(ghosted);
            setIsOpen(true);
        }
    };

    const handleContacted = async () => {
        const currentClient = ghostedQueue[currentIndex];
        if (!currentClient) return;

        try {
            await db.projects.update(currentClient.id, { 
                lastContactDate: new Date().toISOString() 
            });
            showToast(`¡Genial! Contacto registrado con ${currentClient.name}`, 'success');
            nextAlert();
        } catch (error) {
            console.error(error);
            showToast('Error al actualizar fecha', 'error');
        }
    };

    const handleSnooze = () => {
        const currentClient = ghostedQueue[currentIndex];
        if (!currentClient) return;

        // Snooze this specific client for 24 hours
        const snoozeDate = new Date();
        snoozeDate.setHours(snoozeDate.getHours() + 24);
        localStorage.setItem(`ghosting_snooze_${currentClient.id}`, snoozeDate.toISOString());
        
        nextAlert();
    };

    const nextAlert = () => {
        if (currentIndex < ghostedQueue.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            setIsOpen(false);
            setGhostedQueue([]); // Clear queue
            setCurrentIndex(0);
        }
    };

    const handleCloseAll = () => {
         // Snooze global check for 1 hour
         const snoozeDate = new Date();
         snoozeDate.setHours(snoozeDate.getHours() + 1);
         localStorage.setItem('ghosting_snooze_global', snoozeDate.toISOString());
         setIsOpen(false);
    }

    if (!isOpen || ghostedQueue.length === 0) return null;

    const currentClient = ghostedQueue[currentIndex];
    const daysSince = currentClient.lastContactDate 
        ? Math.ceil(Math.abs(new Date().getTime() - new Date(currentClient.lastContactDate).getTime()) / (1000 * 60 * 60 * 24))
        : '∞';
    
    const remainingCount = ghostedQueue.length - 1 - currentIndex;

    return (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 border-2 border-indigo-500 rounded-xl shadow-2xl p-4 w-80 relative overflow-hidden">
                {/* Decorative background element */}
                <div className="absolute -top-10 -right-10 w-20 h-20 bg-indigo-500/10 rounded-full blur-xl"></div>

                <div className="flex items-start gap-3 relative z-10">
                    <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg">
                        <Ghost className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wide">
                                Ghosting Alert 👻
                            </h3>
                            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">
                                {currentIndex + 1} / {ghostedQueue.length}
                            </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                            Hace <b>{daysSince} días</b> que no hablas con <br/>
                            <span className="font-semibold text-indigo-600 dark:text-indigo-400">{currentClient.name}</span>.
                        </p>
                        <p className="text-xs text-gray-500 mt-1 italic">
                            ¿Le escribiste hoy?
                        </p>
                    </div>
                    <button onClick={handleCloseAll} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title="Posponer todos">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="mt-4 flex gap-2">
                    <Button 
                        onClick={handleSnooze}
                        variant="ghost" 
                        size="sm" 
                        className="flex-1 text-xs"
                    >
                        Saltar / Posponer
                    </Button>
                    <Button 
                        onClick={handleContacted}
                        size="sm" 
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                    >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Sí, ya le hablé
                    </Button>
                </div>
                {remainingCount > 0 && (
                    <div className="text-center mt-2 text-[10px] text-gray-400">
                        +{remainingCount} más en cola
                    </div>
                )}
            </div>
        </div>
    );
};
