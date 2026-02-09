import React, { useState } from 'react';
import { Project, ProjectStatus } from '../../types';
import { Modal, Input, Label, Textarea, Button } from '../UIComponents';
import { Sparkles, Loader2, Save } from 'lucide-react';
import { ai } from '../../services/ai';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
    onSave: (updatedData: Partial<Project>) => Promise<void>;
}

export function EditProjectModal({ isOpen, onClose, project, onSave }: Props) {
    const [formData, setFormData] = useState<Partial<Project>>({
        name: project.name,
        industry: project.industry,
        monthlyRevenue: project.monthlyRevenue,
        billingDay: project.billingDay,
        status: project.status,
        // Strategic Context
        targetAudience: project.targetAudience,
        contextProblem: project.contextProblem,
        contextObjectives: project.contextObjectives,
        growthStrategy: project.growthStrategy,
    });

    const [businessDescription, setBusinessDescription] = useState(''); // New State for AI Input
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleGenerateContext = async () => {
        if (!formData.name || !formData.industry) {
            alert("Por favor ingresa Nombre e Industria primero.");
            return;
        }

        setIsGenerating(true);
        try {
            const context = await ai.generateProjectContext(formData.name, formData.industry, businessDescription);
            if (context) {
                setFormData(prev => ({
                    ...prev,
                    targetAudience: context.targetAudience,
                    contextProblem: context.problem,
                    contextObjectives: context.objectives,
                    growthStrategy: context.strategy
                }));
            }
        } catch (error) {
            console.error("Error generating context:", error);
            alert("Error al generar contexto con IA.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(formData);
            onClose();
        } catch (error) {
            console.error("Error saving project:", error);
            alert("Error al guardar cambios.");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Editar Perfil del Proyecto">
            <div className="space-y-6">
                
                {/* SECTION 1: CORE DATA + AI GENERATOR */}
                <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl space-y-4 border border-indigo-100 dark:border-indigo-900/30">
                    <div className="flex items-center justify-between">
                        <Label className="text-indigo-600 dark:text-indigo-400 font-bold uppercase text-xs tracking-wider">Datos Principales</Label>
                        <button 
                            onClick={handleGenerateContext}
                            disabled={isGenerating || !formData.name || !formData.industry}
                            className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-bold rounded-lg shadow-lg hover:shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            {isGenerating ? 'Generando...' : 'Completar con IA'}
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label className="text-xs mb-1.5 block">Nombre del Cliente / Proyecto</Label>
                            <Input 
                                value={formData.name || ''} 
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 font-semibold"
                            />
                        </div>
                        <div>
                            <Label className="text-xs mb-1.5 block">Industria / Rubro</Label>
                            <Input 
                                value={formData.industry || ''} 
                                onChange={e => setFormData({...formData, industry: e.target.value})}
                                placeholder="Ej: Odontología, E-commerce..."
                                className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700"
                            />
                        </div>
                    </div>

                    {/* AI INPUT FIELD */}
                    <div>
                        <Label className="text-xs mb-1.5 block text-indigo-600 font-bold">Descripción del Negocio (Para la IA)</Label>
                        <Textarea 
                            value={businessDescription}
                            onChange={e => setBusinessDescription(e.target.value)}
                            placeholder="Pega aquí toda la info bruta: qué venden, quiénes son, pitch de ventas... La IA usará esto para completar el contexto."
                            className="bg-white dark:bg-slate-800 border-indigo-200 focus:border-indigo-500 min-h-[80px]"
                        />
                         <div className="flex justify-end mt-2">
                            <p className="text-[10px] text-gray-400 mr-auto">Cuanta más info pegues aquí, mejor será el autocompletado.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-indigo-100 dark:border-indigo-900/30 pt-4">
                            <div>
                            <Label className="text-xs mb-1.5 block text-gray-500">Fee Mensual ($)</Label>
                            <Input 
                                type="number"
                                value={formData.monthlyRevenue || 0} 
                                onChange={e => setFormData({...formData, monthlyRevenue: parseFloat(e.target.value)})}
                                className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700"
                            />
                        </div>
                            <div>
                            <Label className="text-xs mb-1.5 block text-gray-500">Día de Cobro</Label>
                            <Input 
                                type="number"
                                value={formData.billingDay || 1} 
                                onChange={e => setFormData({...formData, billingDay: parseInt(e.target.value)})}
                                className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700"
                            />
                        </div>
                        <div className="col-span-2">
                            <Label className="text-xs mb-1.5 block text-gray-500">Estado</Label>
                            <select 
                                value={formData.status || ProjectStatus.ACTIVE}
                                onChange={e => setFormData({...formData, status: e.target.value as ProjectStatus})}
                                className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                {Object.values(ProjectStatus).map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* SECTION 2: STRATEGIC CONTEXT (AI FILLABLE) */}
                <div className="space-y-4">
                        <Label className="uppercase text-xs font-bold text-gray-400 tracking-wider flex items-center gap-2">
                        Contexto Estratégico {formData.name && formData.industry && !formData.targetAudience && <span className="text-[10px] font-normal text-indigo-500 lowercase">(usa el botón de IA arriba 👆)</span>}
                        </Label>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs text-gray-500">Público Objetivo</Label>
                            <Textarea 
                                value={formData.targetAudience || ''}
                                onChange={e => setFormData({...formData, targetAudience: e.target.value})}
                                placeholder="¿A quién le vendemos?"
                                className="h-24 resize-none bg-gray-50 dark:bg-slate-800 border-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-gray-500">Situación Actual / Dolores</Label>
                            <Textarea 
                                value={formData.contextProblem || ''}
                                onChange={e => setFormData({...formData, contextProblem: e.target.value})}
                                placeholder="¿Qué problemas tienen hoy?"
                                className="h-24 resize-none bg-gray-50 dark:bg-slate-800 border-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-gray-500">Objetivos Principales (Punto B)</Label>
                            <Textarea 
                                value={formData.contextObjectives || ''}
                                onChange={e => setFormData({...formData, contextObjectives: e.target.value})}
                                placeholder="¿Qué quieren lograr?"
                                className="h-24 resize-none bg-gray-50 dark:bg-slate-800 border-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-gray-500">Estrategia Macro</Label>
                            <Textarea 
                                value={formData.growthStrategy || ''}
                                onChange={e => setFormData({...formData, growthStrategy: e.target.value})}
                                placeholder="Enfoque general..."
                                className="h-24 resize-none bg-gray-50 dark:bg-slate-800 border-none"
                            />
                        </div>
                    </div>
                </div>

                {/* FOOTER */}
                <div className="pt-4 flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Guardar Cambios
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
