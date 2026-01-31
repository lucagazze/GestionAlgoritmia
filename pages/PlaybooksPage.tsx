
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { ai } from '../services/ai';
import { SOP } from '../types';
import { Button, Input, Card, Modal, Label, Textarea, Badge } from '../components/UIComponents';
import { Book, Plus, Search, Sparkles, Edit2, Trash2, Loader2, FileText, ChevronRight } from 'lucide-react';

const CATEGORIES = ['SALES', 'ONBOARDING', 'FULFILLMENT', 'ADMIN', 'OTHER'];

export default function PlaybooksPage() {
    const [sops, setSops] = useState<SOP[]>([]);
    const [search, setSearch] = useState('');
    const [filterCat, setFilterCat] = useState('ALL');
    const [loading, setLoading] = useState(true);
    
    // Editor State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSop, setEditingSop] = useState<SOP | null>(null);
    const [formData, setFormData] = useState({ title: '', category: 'OTHER', content: '' });
    
    // AI Gen
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => { loadSops(); }, []);

    const loadSops = async () => {
        setLoading(true);
        const data = await db.sops.getAll();
        setSops(data);
        setLoading(false);
    };

    const handleGenerateAI = async () => {
        if(!formData.title) { alert("Ponle un título primero."); return; }
        setIsGenerating(true);
        try {
            const prompt = `Escribe un Procedimiento Operativo Estándar (SOP) detallado y profesional para: "${formData.title}". 
            Formato Markdown. Incluye: 1. Objetivo, 2. Prerrequisitos, 3. Pasos numerados paso a paso, 4. Criterios de éxito.
            Sé conciso y directo.`;
            
            const content = await ai.chat([{role: 'user', content: prompt}]);
            setFormData(prev => ({ ...prev, content: content || prev.content }));
        } catch(e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!formData.title) return;
        
        if (editingSop) {
            await db.sops.update(editingSop.id, formData as any);
        } else {
            await db.sops.create(formData as any);
        }
        setIsModalOpen(false);
        loadSops();
    };

    const openModal = (sop?: SOP) => {
        if(sop) {
            setEditingSop(sop);
            setFormData({ title: sop.title, category: sop.category, content: sop.content });
        } else {
            setEditingSop(null);
            setFormData({ title: '', category: 'OTHER', content: '' });
        }
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if(confirm("¿Eliminar este proceso?")) {
            await db.sops.delete(id);
            loadSops();
        }
    };

    const filtered = sops.filter(s => {
        const matchSearch = s.title.toLowerCase().includes(search.toLowerCase());
        const matchCat = filterCat === 'ALL' || s.category === filterCat;
        return matchSearch && matchCat;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
                        <Book className="w-8 h-8 text-black" /> Playbooks & SOPs
                    </h1>
                    <p className="text-gray-500 mt-2">La base de conocimiento de tu agencia. Estandariza para escalar.</p>
                </div>
                <Button onClick={() => openModal()} className="shadow-lg"><Plus className="w-4 h-4 mr-2" /> Nuevo Proceso</Button>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <Input placeholder="Buscar procesos..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-gray-50 border-transparent focus:bg-white" />
                </div>
                <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                    <button onClick={() => setFilterCat('ALL')} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${filterCat === 'ALL' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Todos</button>
                    {CATEGORIES.map(c => (
                        <button key={c} onClick={() => setFilterCat(c)} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${filterCat === c ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{c}</button>
                    ))}
                </div>
            </div>

            {loading ? <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-300"/></div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.map(sop => (
                        <div key={sop.id} onClick={() => openModal(sop)} className="group bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg hover:border-black/20 transition-all cursor-pointer flex flex-col h-64">
                            <div className="flex justify-between items-start mb-4">
                                <Badge variant="outline" className="bg-gray-50">{sop.category}</Badge>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                    <button onClick={(e) => {e.stopPropagation(); handleDelete(sop.id)}} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                                </div>
                            </div>
                            <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2">{sop.title}</h3>
                            <div className="flex-1 overflow-hidden relative">
                                <p className="text-sm text-gray-500 line-clamp-4 whitespace-pre-wrap">{sop.content}</p>
                                <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-white to-transparent"></div>
                            </div>
                            <div className="pt-4 mt-auto flex items-center text-xs font-bold text-blue-600">
                                Leer Documento <ChevronRight className="w-3 h-3 ml-1" />
                            </div>
                        </div>
                    ))}
                    {filtered.length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
                            No se encontraron playbooks.
                        </div>
                    )}
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingSop ? "Editar Playbook" : "Nuevo Procedimiento"}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Título del Proceso (Ej: Onboarding Cliente)" autoFocus className="font-bold text-lg" />
                    
                    <div className="flex justify-between items-center">
                        <select 
                            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-black"
                            value={formData.category} 
                            onChange={e => setFormData({...formData, category: e.target.value})}
                        >
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        
                        <button type="button" onClick={handleGenerateAI} disabled={isGenerating} className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-2 rounded-lg font-bold flex items-center transition-colors">
                            {isGenerating ? <Loader2 className="w-3 h-3 mr-2 animate-spin"/> : <Sparkles className="w-3 h-3 mr-2"/>}
                            {isGenerating ? "Redactando..." : "Autocompletar con IA"}
                        </button>
                    </div>

                    <Textarea 
                        value={formData.content} 
                        onChange={e => setFormData({...formData, content: e.target.value})} 
                        className="min-h-[300px] font-mono text-sm leading-relaxed" 
                        placeholder="Describe el paso a paso aquí..." 
                    />
                    
                    <div className="flex justify-end pt-2">
                        <Button type="submit">Guardar Playbook</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
