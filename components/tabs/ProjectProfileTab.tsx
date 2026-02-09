import React from 'react';
import { Project } from '../../types';
import { Card, Input, Label, Textarea } from '../UIComponents';
import { Building, MapPin, Wallet, BarChart3, Clock, Phone, User, Palette, Plus, ExternalLink, Globe, Trash2 } from 'lucide-react';

interface Props {
    formData: Partial<Project>;
    setFormData: (data: Partial<Project>) => void;
}

export function ProjectProfileTab({ formData, setFormData }: Props) {
    
    // Funciones auxiliares
    const handleColorChange = (index: number, newColor: string) => {
        const newColors = [...(formData.brandColors || [])];
        newColors[index] = newColor;
        setFormData({...formData, brandColors: newColors});
    };

    const handleAddColor = () => {
       setFormData({...formData, brandColors: [...(formData.brandColors || []), '#000000']});
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in">
                        
            {/* 1. HERO / IDENTITY */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                    <Card className="h-full p-8 border-none shadow-xl bg-gradient-to-br from-white to-gray-50 dark:from-slate-900 dark:to-slate-800/50 rounded-3xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-32 bg-blue-500/5 dark:bg-blue-400/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                        <div className="relative z-10 space-y-6">
                            <div>
                                <Label className="uppercase text-xs font-bold text-gray-400 tracking-wider">Cliente / Proyecto</Label>
                                <Input 
                                    className="text-3xl md:text-4xl font-black bg-transparent border-none shadow-none p-0 h-auto focus-visible:ring-0 mt-2 text-gray-900 dark:text-white placeholder:text-gray-200" 
                                    value={formData.name || ''} 
                                    onChange={e => setFormData({...formData, name: e.target.value})} 
                                    placeholder="Nombre del Cliente" 
                                />
                            </div>
                            <div>
                                <Label className="uppercase text-xs font-bold text-gray-400 tracking-wider">Industria</Label>
                                <div className="flex items-center gap-2 mt-2">
                                    <Building className="w-5 h-5 text-gray-400"/>
                                    <Input 
                                        className="font-medium bg-transparent border-none shadow-none p-0 h-auto focus-visible:ring-0 text-xl text-gray-700 dark:text-gray-300 placeholder:text-gray-300"
                                        value={formData.industry || ''}
                                        onChange={e => setFormData({...formData, industry: e.target.value})}
                                        placeholder="Ej: E-commerce, SaaS, Inmobiliaria..."
                                    />
                                </div>
                            </div>
                            <div>
                                <Label className="uppercase text-xs font-bold text-gray-400 tracking-wider">Ubicación</Label>
                                <div className="flex items-center gap-2 mt-2">
                                    <MapPin className="w-5 h-5 text-gray-400"/>
                                    <Input 
                                        className="font-medium bg-transparent border-none shadow-none p-0 h-auto focus-visible:ring-0 text-gray-700 dark:text-gray-300 placeholder:text-gray-300"
                                        value={formData.location || ''}
                                        onChange={e => setFormData({...formData, location: e.target.value})}
                                        placeholder="Ciudad, País"
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* 2. SERVICE AGREEMENT CARD (Compact & Unified) */}
                <Card className="h-full p-6 border-none shadow-lg bg-white dark:bg-slate-900 rounded-3xl relative overflow-hidden flex flex-col justify-between">
                    <div className="space-y-6 relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-emerald-100/50 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400"><Wallet className="w-6 h-6"/></div>
                            <div>
                                <Label className="uppercase text-[10px] font-bold text-gray-400 tracking-widest">Fee Mensual</Label>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-sm font-medium text-gray-400">$</span>
                                    <Input 
                                        type="number"
                                        className="text-3xl font-black bg-transparent border-none shadow-none p-0 w-32 focus-visible:ring-0 text-gray-900 dark:text-white"
                                        value={formData.monthlyRevenue || 0}
                                        onChange={e => setFormData({...formData, monthlyRevenue: parseFloat(e.target.value)})}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 dark:border-slate-800 pt-4 space-y-4">
                            <div>
                                <Label className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-1"><BarChart3 className="w-3 h-3"/> Detalle del Servicio</Label>
                                <Textarea 
                                    className="bg-gray-50 dark:bg-slate-800 border-none resize-none text-xs h-20" 
                                    placeholder="Ej: Community Manager + Ads (3 campañas)..."
                                    value={formData.serviceDetails || ''} // Assuming serviceDetails exists on Project/Client type based on earlier logs but confirming... formData is Partial<Project>, Project extends Client. Client has no serviceDetails in types.ts seen earlier? Wait.
                                    // Step 917 types.ts content for Client/Project: 
                                    // Project extends Client. 
                                    // Project has: internalCost, publicToken, progress, growthStrategy, serviceDetails.
                                    // YES, serviceDetails is there at line 101 of types.ts view.
                                    onChange={e => setFormData({...formData, serviceDetails: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="flex items-center gap-2 text-[10px] font-bold text-gray-400"><Clock className="w-3 h-3"/> Día de Cobro</Label>
                                    <Input 
                                        type="number" 
                                        className="h-8 bg-gray-50 dark:bg-slate-800 border-none font-bold text-center" 
                                        value={formData.billingDay || 1} 
                                        onChange={e => setFormData({...formData, billingDay: parseInt(e.target.value)})}
                                    />
                                </div>
                                <div>
                                    <Label className="flex items-center gap-2 text-[10px] font-bold text-gray-400"><User className="w-3 h-3"/> Partner</Label>
                                    <Input // Ideally a select but keeping simple for refactor
                                        className="h-8 bg-gray-50 dark:bg-slate-800 border-none font-bold text-center text-xs" 
                                        value={formData.partnerName || 'Sin asignar'}
                                        disabled
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Decorative Blob */}
                    <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl"></div>
                </Card>
            </div>

            {/* 3. CONTEXTO ESTRATÉGICO & CONTACTO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* COLUMNA IZQUIERDA: EL CEREBRO DEL CLIENTE */}
                <div className="space-y-6">
                     <Card className="p-6 border-none shadow-md bg-white dark:bg-slate-900 rounded-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                        <Label className="uppercase text-xs font-bold text-indigo-500 tracking-wider mb-4 flex items-center gap-2">
                            <span className="bg-indigo-100 dark:bg-indigo-900/30 p-1 rounded">🎯</span> El Norte Estratégico
                        </Label>
                        
                        <div className="space-y-4">
                            <div>
                                <Label className="text-xs text-gray-500 mb-1">Objetivo Principal</Label>
                                <Textarea 
                                    className="bg-gray-50 dark:bg-slate-800 border-none resize-none min-h-[80px] text-sm font-medium" 
                                    placeholder="¿Qué quieren lograr? (Punto B)"
                                    value={formData.contextObjectives || ''} // ✅ Lee del estado
                                    onChange={e => setFormData({...formData, contextObjectives: e.target.value})} // ✅ Escribe al estado
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-gray-500 mb-1">Situación Actual (Dolores)</Label>
                                <Textarea 
                                    className="bg-gray-50 dark:bg-slate-800 border-none resize-none min-h-[80px] text-sm" 
                                    placeholder="¿Qué les duele hoy? (Punto A)"
                                    value={formData.contextProblem || ''}
                                    onChange={e => setFormData({...formData, contextProblem: e.target.value})}
                                />
                            </div>
                        </div>
                     </Card>

                     <Card className="p-6 border-none shadow-md bg-white dark:bg-slate-900 rounded-2xl">
                        <Label className="uppercase text-xs font-bold text-gray-400 tracking-wider mb-2 block">Público Objetivo</Label>
                        <Input 
                            className="bg-gray-50 dark:bg-slate-800 border-none font-medium"
                            placeholder="¿A quién le venden?"
                            value={formData.targetAudience || ''}
                            onChange={e => setFormData({...formData, targetAudience: e.target.value})}
                        />
                     </Card>

                     {/* Mantenemos la Estrategia de Crecimiento que ya tenías */}
                     <Card className="p-6 border-none shadow-md bg-white dark:bg-slate-900 rounded-2xl">
                        <Label className="uppercase text-xs font-bold text-gray-400 tracking-wider mb-2 block">Estrategia Macro</Label>
                        <Textarea 
                            className="bg-gray-50 dark:bg-slate-800 border-none resize-none h-24 text-sm leading-relaxed" 
                            placeholder="Roadmap a largo plazo..."
                            value={formData.growthStrategy || ''}
                            onChange={e => setFormData({...formData, growthStrategy: e.target.value})}
                        />
                     </Card>
                </div>

                {/* COLUMNA DERECHA: CONTACTO & BRAND (Lo que ya tenías) */}
                <div className="space-y-6">
                    {/* CONTACT INFO */}
                    <Card className="p-6 border-none shadow-md bg-white dark:bg-slate-900 rounded-2xl">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Phone className="w-5 h-5 text-green-500"/> Contacto Directo</h3>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
                                <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                                    <Phone className="w-5 h-5"/>
                                </div>
                                <Input 
                                    className="bg-transparent border-none shadow-none font-medium"
                                    value={formData.phone || ''} 
                                    onChange={e => setFormData({...formData, phone: e.target.value})} 
                                    placeholder="+54 9 11..." 
                                />
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
                                 <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                    <User className="w-5 h-5"/>
                                </div>
                                <Input 
                                    className="bg-transparent border-none shadow-none font-medium"
                                    value={formData.email || ''} 
                                     onChange={e => setFormData({...formData, email: e.target.value})} 
                                    placeholder="email@..." 
                                />
                            </div>
                        </div>
                    </Card>

                    {/* BRAND KIT */}
                     <Card className="p-6 border-none shadow-md bg-white dark:bg-slate-900 rounded-2xl relative overflow-hidden">
                         <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full -mr-10 -mt-10"></div>
                        <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 relative z-10"><Palette className="w-5 h-5 text-purple-500"/> Identidad Visual</h3>
                        <div className="flex gap-3 relative z-10 flex-wrap">
                            {(formData.brandColors || ['#000000', '#ffffff']).map((color, i) => (
                                <div key={i} className="group relative w-12 h-12">
                                    <div 
                                        className="w-12 h-12 rounded-full shadow-sm border border-black/5 dark:border-white/10 transition-transform hover:scale-110 absolute inset-0"
                                        style={{backgroundColor: color}}
                                    ></div>
                                    <input 
                                        type="color" 
                                        value={color}
                                        onChange={(e) => handleColorChange(i, e.target.value)}
                                        className="opacity-0 w-full h-full absolute inset-0 cursor-pointer"
                                    />
                                </div>
                            ))}
                            <button 
                                className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 dark:border-slate-700 flex items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors"
                                onClick={handleAddColor}
                            >
                                <Plus className="w-4 h-4"/>
                            </button>
                        </div>
                    </Card>
                </div>
            </div>

            {/* RESOURCES SECTION */}
            <Card className="p-6 space-y-4 h-full border-none shadow-md bg-white dark:bg-slate-900 rounded-2xl">
                 <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-2">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><ExternalLink className="w-4 h-4"/> Recursos (The Vault)</h3>
                    <button onClick={() => setFormData({...formData, resources: [...(formData.resources||[]), {id: Date.now().toString(), name: 'Nuevo Link', url: '', type: 'OTHER'}]})} className="text-xs bg-black dark:bg-white text-white dark:text-black px-2 py-1 rounded flex items-center"><Plus className="w-3 h-3 mr-1"/> Agregar</button>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                    {formData.resources?.length === 0 && <p className="text-gray-400 text-xs italic">Sin recursos guardados.</p>}
                    {formData.resources?.map((r, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800 p-2 rounded-lg border border-gray-100 dark:border-slate-700 group">
                            <div className="p-2 bg-white dark:bg-slate-900 rounded shadow-sm"><Globe className="w-4 h-4 text-gray-400"/></div>
                            <div className="flex-1">
                                <input className="text-xs font-bold bg-transparent border-none w-full focus:ring-0 p-0 text-gray-900 dark:text-white" value={r.name} onChange={e => {const n=[...formData.resources!]; n[idx].name=e.target.value; setFormData({...formData, resources:n})}} />
                                <input className="text-[10px] text-blue-500 bg-transparent border-none w-full focus:ring-0 p-0" value={r.url} placeholder="https://..." onChange={e => {const n=[...formData.resources!]; n[idx].url=e.target.value; setFormData({...formData, resources:n})}} />
                            </div>
                            <a href={r.url} target="_blank" className="p-1 text-gray-400 hover:text-blue-500"><ExternalLink className="w-3 h-3"/></a>
                            <button onClick={() => {const n=[...formData.resources!]; n.splice(idx,1); setFormData({...formData, resources:n})}} className="p-1 text-gray-300 hover:text-red-500"><Trash2 className="w-3 h-3"/></button>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}
