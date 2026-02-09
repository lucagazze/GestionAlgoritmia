import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { ai } from '../services/ai';
import { ContentIdea } from '../types';
import { Button, Input, Textarea, Select, Badge } from '../components/UIComponents';
import { ArrowLeft, Save, Trash2, Video, FileText, Sparkles, Calendar, CheckCircle2, Wand2, Maximize2, Minimize2, ZoomIn, ZoomOut } from 'lucide-react';
import { useToast } from '../components/Toast';

export default function ContentIdeaDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(!!id && id !== 'new');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [fontSize, setFontSize] = useState(18);

  const [formData, setFormData] = useState<Partial<ContentIdea>>({
    title: '',
    concept: '',
    hook: '',
    script: '',
    visuals: '',
    platform: 'Instagram',
    contentType: 'POST',
    status: 'IDEA',
    scheduledDate: ''
  });

  useEffect(() => {
    if (id && id !== 'new') {
      loadData(id);
    }
  }, [id]);

  const loadData = async (ideaId: string) => {
    try {
      const ideas = await db.contentIdeas.getAll();
      const idea = ideas.find(i => i.id === ideaId);
      if (idea) {
        setFormData(idea);
      } else {
        navigate('/content-ideas');
      }
    } catch (err) {
      console.error("Failed to load idea", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title) {
        showToast("El título es obligatorio", "error");
        return;
    }
    setSaving(true);
    try {
      // Validar si contentType existe en el objeto antes de guardar
      // Esto ayuda a depurar si el estado se está perdiendo
      console.log("Saving Idea Data:", formData);

      // Sanitize data specifically for timestamps
      const sanitizedData = {
          ...formData,
          scheduledDate: formData.scheduledDate === '' ? null : formData.scheduledDate
      };

      if (id && id !== 'new') {
        await db.contentIdeas.update(id, sanitizedData);
      } else {
        await db.contentIdeas.create(sanitizedData as any);
      }
      showToast("Idea guardada correctamente", "success");
      navigate('/content-ideas');
    } catch (error: any) {
      console.error("Error saving idea:", error);
      
      // Manejo específico del error de columna faltante
      if (error?.message?.includes("Could not find the 'content_type' column")) {
          alert("⚠️ ERROR DE BASE DE DATOS: Falta la columna 'content_type'.\n\nPor favor, ve a Supabase > SQL Editor y ejecuta el script de migración '20240208_add_content_type.sql'.");
      } else {
          showToast(`Error al guardar: ${error.message || 'Intente nuevamente'}`, "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (id && id !== 'new' && confirm('¿Estás seguro de eliminar esta idea?')) {
      await db.contentIdeas.delete(id);
      navigate('/content-ideas');
    }
  };

  const handleGenerateScript = async () => {
    if (!formData.title && !formData.concept) {
        showToast("Escribe al menos un Título o Concepto para generar", "error");
        return;
    }

    setGenerating(true);
    try {
        const script = await ai.generateContentScript('SCRIPT', {
            platform: formData.platform,
            title: formData.title,
            concept: formData.concept,
            hook: formData.hook
        });

        if (script) {
            setFormData(prev => ({ ...prev, script }));
            showToast("✨ Guion generado con IA", "success");
        } else {
            showToast("No se pudo generar el guion", "error");
        }
    } catch (error) {
        console.error("AI Gen Error", error);
        showToast("Error al conectar con la IA", "error");
    } finally {
        setGenerating(false);
    }
  };

  const handleGenerateIdeas = async () => {
      // Esta función podría usarse para generar ideas desde cero (títulos/conceptos)
      // Por ahora la dejamos preparada o la integramos si el usuario lo pide explícitamente en otro flujo
      // Implementamos autocompletado de HOOK si está vacío
      if (!formData.concept) return;
      
      setGenerating(true);
      try {
          const ideas = await ai.generateContentScript('IDEA', {
              platform: formData.platform,
              topic: formData.concept,
              context: "El objetivo es educar y vender servicios de desarrollo de software."
          });
          
          if (ideas) {
              setFormData(prev => ({ ...prev, script: prev.script + "\n\n--- IDEAS GENERADAS ---\n" + ideas }));
              showToast("✨ Ideas generadas y añadidas al editor", "success");
          }
      } catch (e) {
          console.error(e);
      } finally {
          setGenerating(false);
      }
  };


  if (loading) {
     return (
        <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
     );
  }



  return (
    <>
      {/* Full Screen Overlay */}
      {isFullScreen && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-black flex flex-col">
           {/* Toolbar */}
           <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-white/90 dark:bg-black/90 backdrop-blur-sm sticky top-0 z-10">
              <div className="flex items-center gap-4">
                  <Button variant="ghost" onClick={() => setIsFullScreen(false)}>
                      <ArrowLeft className="w-6 h-6" /> <span className="ml-2 font-bold">Volver</span>
                  </Button>
                  <div className="h-6 w-px bg-gray-200 dark:bg-gray-800 mx-2"></div>
                  <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-900 rounded-full p-1">
                      <Button variant="ghost" size="sm" onClick={() => setFontSize(prev => Math.max(12, prev - 2))} className="rounded-full w-8 h-8 p-0">
                          <ZoomOut className="w-4 h-4" />
                      </Button>
                      <span className="text-xs font-mono w-8 text-center">{fontSize}px</span>
                      <Button variant="ghost" size="sm" onClick={() => setFontSize(prev => Math.min(64, prev + 2))} className="rounded-full w-8 h-8 p-0">
                          <ZoomIn className="w-4 h-4" />
                      </Button>
                  </div>
              </div>
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  Modo Teleprompter / Lectura
              </div>
           </div>

           {/* Editor / Reader */}
           <div className="flex-1 overflow-auto bg-gray-50 dark:bg-black relative">
               <div className="w-full min-h-full bg-white dark:bg-black shadow-none p-8 md:p-12">
                  <textarea
                      value={formData.script}
                      onChange={e => setFormData({ ...formData, script: e.target.value })}
                      placeholder="Escribe tu guion aquí..."
                      className="w-full h-full bg-transparent border-none resize-none focus:ring-0 p-0 font-serif leading-relaxed text-gray-900 dark:text-gray-100"
                      style={{ fontSize: `${fontSize}px`, minHeight: '80vh', outline: 'none' }}
                  />
               </div>
           </div>
        </div>
      )}

      {/* Normal Layout */}
      {!isFullScreen && (
        <div className="min-h-screen bg-gray-50/50 dark:bg-slate-950/50 p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between sticky top-0 z-10 bg-gray-50/90 dark:bg-slate-950/90 backdrop-blur-md py-4 mb-8 border-b border-gray-200/50 dark:border-slate-800/50">
               <div className="flex items-center gap-4 w-full md:w-auto flex-1">
                   <button 
                      onClick={() => navigate('/content-ideas')}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full transition-colors flex-shrink-0"
                    >
                       <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                   </button>
                   <input
                      type="text"
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Título de la Propuesta / Idea"
                      className="text-2xl md:text-3xl font-bold bg-transparent border-none focus:ring-0 text-gray-900 dark:text-white placeholder-gray-300 w-full"
                   />
               </div>

               <div className="flex items-center gap-3 w-full md:w-auto flex-shrink-0">
                   <Select
                        value={formData.status}
                        onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                        className="w-full md:w-48 font-semibold border-none shadow-sm bg-white dark:bg-slate-900"
                    >
                        <option value="IDEA">💡 En Idea</option>
                        <option value="SCRIPTED">📝 Guionizado</option>
                        <option value="FILMED">🎥 Grabado</option>
                        <option value="EDITED">🎬 Editado</option>
                        <option value="POSTED">✅ Publicado</option>
                    </Select>

                   <Button onClick={handleSave} disabled={saving} className="whitespace-nowrap flex items-center gap-2">
                       <Save className="w-4 h-4" />
                       {saving ? 'Guardando...' : 'Guardar'}
                   </Button>
                   
                   {id !== 'new' && (
                       <Button variant="destructive" onClick={handleDelete} className="p-3">
                           <Trash2 className="w-4 h-4" />
                       </Button>
                   )}
               </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
                
                {/* Sidebar / Metadata (Lighter Column) */}
                <div className="lg:col-span-4 space-y-6">
                    
                    {/* Platform & Type */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                           <Video className="w-4 h-4 text-blue-500" /> Plataforma & Tipo
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-400 uppercase">Plataforma</label>
                                <Select
                                    value={formData.platform}
                                    onChange={e => setFormData({ ...formData, platform: e.target.value as any })}
                                >
                                    <option value="Instagram">Instagram</option>
                                    <option value="TikTok">TikTok</option>
                                    <option value="YouTube">YouTube</option>
                                    <option value="LinkedIn">LinkedIn</option>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-400 uppercase">Tipo</label>
                                <Select
                                    value={formData.contentType || 'POST'}
                                    onChange={e => setFormData({ ...formData, contentType: e.target.value as any })}
                                    className={formData.contentType === 'AD' ? 'bg-purple-50 text-purple-700 font-bold' : 'bg-blue-50 text-blue-700 font-bold'}
                                >
                                    <option value="POST">Post</option>
                                    <option value="AD">Ad / Anuncio</option>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Concept & Hook */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-6">
                        <div className="space-y-2">
                             <label className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-sm">
                                <Sparkles className="w-4 h-4 text-yellow-500" /> Concepto
                            </label>
                            <Input 
                                value={formData.concept}
                                onChange={e => setFormData({ ...formData, concept: e.target.value })}
                                placeholder="¿De qué trata? Contexto general..."
                            />
                             <div className="flex justify-end">
                                  <button 
                                    onClick={handleGenerateIdeas}
                                    disabled={generating || !formData.concept}
                                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold disabled:opacity-50"
                                  >
                                      <Wand2 className="w-3 h-3" /> Generar Ideas relacionadas
                                  </button>
                             </div>
                        </div>
                        <div className="space-y-2">
                            <label className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-sm">
                                🎯 Hook (3-5 seg)
                            </label>
                            <Textarea 
                                value={formData.hook}
                                onChange={e => setFormData({ ...formData, hook: e.target.value })}
                                placeholder="Los primeros 3 segundos que atrapan..."
                                className="bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 min-h-[100px] text-lg font-medium text-red-900 dark:text-red-200 placeholder-red-300"
                            />
                        </div>
                    </div>

                    {/* Visuals */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                           <Video className="w-4 h-4 text-green-500" /> Visuals / Escenas
                        </h3>
                        <Textarea 
                            value={formData.visuals}
                            onChange={e => setFormData({ ...formData, visuals: e.target.value })}
                            placeholder="Descripción de la parte visual, b-roll, overlays..."
                            className="h-32"
                        />
                    </div>
                </div>

                {/* Main Script Editor (Wider Column) */}
                <div className="lg:col-span-8 flex flex-col h-full">
                    <div className="flex-1 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-md flex flex-col gap-4 min-h-[600px] lg:min-h-[calc(100vh-200px)]">
                        <div className="flex items-center justify-between">
                             <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-2">
                                <FileText className="w-6 h-6 text-blue-600" /> Guion (Script)
                            </h3>
                             <div className="flex items-center gap-2">
                                 <Button 
                                    onClick={() => setIsFullScreen(true)}
                                    variant="ghost"
                                    className="h-8 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white"
                                    title="Modo Pantalla Completa / Teleprompter"
                                 >
                                     <Maximize2 className="w-4 h-4 mr-1" /> Ampliar
                                 </Button>
                                 <Button 
                                    onClick={handleGenerateScript} 
                                    disabled={generating}
                                    variant="secondary"
                                    className="h-8 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200"
                                 >
                                     <Wand2 className="w-3 h-3 mr-1" />
                                     {generating ? 'Escribiendo...' : 'Mejorar con IA'}
                                 </Button>
                                 <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">Documento Principal</span>
                             </div>
                        </div>
                       
                        <textarea
                            value={formData.script}
                            onChange={e => setFormData({ ...formData, script: e.target.value })}
                            placeholder="Escribe el guion aquí... Tienes todo el espacio. O usa 'Mejorar con IA' para generar una base."
                            className="flex-1 w-full p-6 bg-gray-50 dark:bg-slate-800/50 border-0 rounded-xl focus:ring-0 resize-none text-lg leading-relaxed dark:text-white font-serif placeholder-gray-400"
                            style={{ outline: "none" }}
                        />
                    </div>
                </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
