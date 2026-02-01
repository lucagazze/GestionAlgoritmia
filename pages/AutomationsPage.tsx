

import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { AutomationRecipe, ProjectStatus } from '../types';
import { Button, Input, Card, Modal, Label, Badge } from '../components/UIComponents';
import { Workflow, Plus, Trash2, Zap, ArrowRight, Settings2, Filter, CheckCircle2, Play } from 'lucide-react';

export default function AutomationsPage() {
    const [recipes, setRecipes] = useState<AutomationRecipe[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Form State for new Recipe
    const [name, setName] = useState('');
    const [triggerType, setTriggerType] = useState<'PROJECT_STATUS_CHANGE' | 'NEW_PROJECT'>('PROJECT_STATUS_CHANGE');
    const [triggerValue, setTriggerValue] = useState('ACTIVE');
    const [conditionIndustry, setConditionIndustry] = useState('');
    const [taskTitle, setTaskTitle] = useState('');
    const [taskPriority, setTaskPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');
    const [taskDelay, setTaskDelay] = useState(0);

    useEffect(() => { loadRecipes(); }, []);

    const loadRecipes = async () => {
        setLoading(true);
        const data = await db.automations.getAll();
        setRecipes(data);
        setLoading(false);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !taskTitle) return;

        const newRecipe: Omit<AutomationRecipe, 'id'> = {
            name,
            triggerType,
            triggerValue: triggerType === 'PROJECT_STATUS_CHANGE' ? triggerValue : undefined,
            conditions: conditionIndustry ? [{ field: 'industry', operator: 'contains', value: conditionIndustry }] : [],
            actions: [{
                type: 'CREATE_TASK',
                payload: {
                    title: taskTitle,
                    priority: taskPriority,
                    delayDays: taskDelay > 0 ? taskDelay : undefined
                }
            }],
            isActive: true
        };

        await db.automations.create(newRecipe);
        setIsModalOpen(false);
        resetForm();
        loadRecipes();
    };

    const handleDelete = async (id: string) => {
        if(confirm('¿Eliminar esta automatización?')) {
            await db.automations.delete(id);
            loadRecipes();
        }
    };

    const resetForm = () => {
        setName('');
        setTriggerType('PROJECT_STATUS_CHANGE');
        setTriggerValue('ACTIVE');
        setConditionIndustry('');
        setTaskTitle('');
        setTaskPriority('MEDIUM');
        setTaskDelay(0);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
                        <Workflow className="w-8 h-8 text-purple-600" /> Motor de Automatización
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">Crea recetas "Si pasa esto, entonces haz aquello" para escalar operaciones.</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20"><Plus className="w-4 h-4 mr-2" /> Nueva Receta</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Intro Card */}
                <div className="col-span-full bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 p-6 rounded-2xl border border-purple-100 dark:border-purple-800 flex items-center gap-6">
                    <div className="hidden md:flex bg-white dark:bg-slate-900 p-4 rounded-full shadow-sm">
                        <Zap className="w-8 h-8 text-yellow-500 fill-yellow-500" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-purple-900 dark:text-purple-200">Piloto Automático Activado</h3>
                        <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                            Las recetas se ejecutan automáticamente cuando gestionas proyectos en la sección de Clientes. 
                            El sistema detectará cambios de estado y creará tareas sin que muevas un dedo.
                        </p>
                    </div>
                </div>

                {loading ? <div className="col-span-full text-center py-20 text-gray-400">Cargando recetas...</div> : recipes.map(recipe => (
                    <Card key={recipe.id} className="relative overflow-hidden hover:shadow-lg transition-all border-l-4 border-l-purple-500">
                        <div className="p-6 space-y-4">
                            <div className="flex justify-between items-start">
                                <h3 className="font-bold text-gray-900 dark:text-white pr-6">{recipe.name}</h3>
                                <button onClick={() => handleDelete(recipe.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                            </div>

                            <div className="space-y-3">
                                {/* Trigger Visual */}
                                <div className="flex items-center gap-3 text-xs bg-gray-50 dark:bg-slate-800 p-2 rounded-lg">
                                    <Play className="w-3 h-3 text-green-500" />
                                    <span className="font-bold text-gray-500 uppercase tracking-wider">Cuando:</span>
                                    <Badge variant="outline" className="bg-white">
                                        {recipe.triggerType === 'NEW_PROJECT' ? 'Nuevo Cliente' : `Estado: ${recipe.triggerValue}`}
                                    </Badge>
                                </div>

                                {/* Condition Visual */}
                                {recipe.conditions && recipe.conditions.length > 0 && (
                                    <div className="flex items-center gap-3 text-xs bg-gray-50 dark:bg-slate-800 p-2 rounded-lg">
                                        <Filter className="w-3 h-3 text-blue-500" />
                                        <span className="font-bold text-gray-500 uppercase tracking-wider">Si:</span>
                                        <span className="text-gray-700 dark:text-gray-300">
                                            {recipe.conditions[0].field} tiene "{recipe.conditions[0].value}"
                                        </span>
                                    </div>
                                )}

                                {/* Arrow */}
                                <div className="flex justify-center">
                                    <ArrowRight className="w-4 h-4 text-gray-300 rotate-90 md:rotate-0" />
                                </div>

                                {/* Action Visual */}
                                <div className="flex items-center gap-3 text-xs bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 p-2 rounded-lg">
                                    <CheckCircle2 className="w-3 h-3 text-purple-600" />
                                    <span className="font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">Entonces:</span>
                                    <span className="text-purple-900 dark:text-purple-100 font-medium truncate">
                                        Crear Tarea "{recipe.actions[0].payload.title}"
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}

                {recipes.length === 0 && !loading && (
                    <div className="col-span-full py-12 text-center border-2 border-dashed border-gray-200 rounded-2xl">
                        <p className="text-gray-400">No hay recetas configuradas.</p>
                        <Button variant="ghost" onClick={() => setIsModalOpen(true)} className="mt-2 text-purple-600">Crear mi primera automatización</Button>
                    </div>
                )}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Configurar Receta">
                <form onSubmit={handleCreate} className="space-y-6">
                    <div>
                        <Label>Nombre de la Receta</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Onboarding SaaS" autoFocus />
                    </div>

                    <div className="space-y-4 border rounded-xl p-4 bg-gray-50 dark:bg-slate-800/50">
                        <div className="flex items-center gap-2 text-sm font-bold text-green-600 uppercase tracking-wider">
                            <Play className="w-4 h-4"/> 1. Disparador (Trigger)
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Evento</Label>
                                <select className="w-full h-10 rounded-lg border px-2 text-sm" value={triggerType} onChange={e => setTriggerType(e.target.value as any)}>
                                    <option value="PROJECT_STATUS_CHANGE">Cambio de Estado</option>
                                    <option value="NEW_PROJECT">Nuevo Cliente Creado</option>
                                </select>
                            </div>
                            {triggerType === 'PROJECT_STATUS_CHANGE' && (
                                <div>
                                    <Label>Nuevo Estado es...</Label>
                                    <select className="w-full h-10 rounded-lg border px-2 text-sm" value={triggerValue} onChange={e => setTriggerValue(e.target.value)}>
                                        <option value="ONBOARDING">Onboarding</option>
                                        <option value="ACTIVE">Activo (Running)</option>
                                        <option value="COMPLETED">Completado</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4 border rounded-xl p-4 bg-gray-50 dark:bg-slate-800/50">
                        <div className="flex items-center gap-2 text-sm font-bold text-blue-600 uppercase tracking-wider">
                            <Filter className="w-4 h-4"/> 2. Condición (Opcional)
                        </div>
                        <div>
                            <Label>Industria contiene...</Label>
                            <Input value={conditionIndustry} onChange={e => setConditionIndustry(e.target.value)} placeholder="Ej: SaaS (Dejar vacío para aplicar a todos)" />
                        </div>
                    </div>

                    <div className="space-y-4 border rounded-xl p-4 bg-gray-50 dark:bg-slate-800/50">
                        <div className="flex items-center gap-2 text-sm font-bold text-purple-600 uppercase tracking-wider">
                            <CheckCircle2 className="w-4 h-4"/> 3. Acción
                        </div>
                        <div className="space-y-3">
                            <Label>Crear Tarea Automática</Label>
                            <Input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Título de la tarea (Ej: Enviar contrato)" />
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Prioridad</Label>
                                    <select className="w-full h-10 rounded-lg border px-2 text-sm" value={taskPriority} onChange={e => setTaskPriority(e.target.value as any)}>
                                        <option value="HIGH">Alta</option>
                                        <option value="MEDIUM">Media</option>
                                        <option value="LOW">Baja</option>
                                    </select>
                                </div>
                                <div>
                                    <Label>Vencimiento (Días después)</Label>
                                    <Input type="number" value={taskDelay} onChange={e => setTaskDelay(parseInt(e.target.value))} placeholder="0 = Hoy" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white">Activar Receta</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}