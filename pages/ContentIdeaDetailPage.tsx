import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { ai } from '../services/ai';
import { ContentIdea } from '../types';
import { Button, Input, Textarea, Select, Badge } from '../components/UIComponents';
import { ArrowLeft, Save, Trash2, Video, FileText, Sparkles, Calendar, CheckCircle2, Wand2, Maximize2, ZoomIn, ZoomOut, Bold, Share2, Edit3, Eye } from 'lucide-react';
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
  const [viewMode, setViewMode] = useState<'EDIT' | 'READ'>('READ');

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

  // History for Undo/Redo
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoAction = useRef(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (id && id !== 'new') {
      loadData(id);
    }
  }, [id]);

  // Initialize history
  useEffect(() => {
    if (formData.script && history.length === 0) {
        setHistory([formData.script]);
        setHistoryIndex(0);
    }
  }, [formData.script]);

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

  const handleManualBold = () => {
      if (viewMode === 'READ') {
          handleReadModeBold();
          return;
      }

      if (!textareaRef.current) return;
      
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formData.script || '';
      
      if (start === end) return; 

      const selectedText = text.substring(start, end);
      const before = text.substring(0, start);
      const after = text.substring(end);

      let newText = "";
      let newSelectionStart = start;
      let newSelectionEnd = end;

      // Scenario 1: User selected EXACTLY "**text**" -> Remove marks
      if (selectedText.startsWith('**') && selectedText.endsWith('**') && selectedText.length >= 4) {
          newText = before + selectedText.slice(2, -2) + after;
          newSelectionEnd -= 4; 
      } 
      // Scenario 2: User selected "text" but it is surrounded by ** in the outer text
      else if (before.endsWith('**') && after.startsWith('**')) {
          newText = before.slice(0, -2) + selectedText + after.slice(2);
          newSelectionStart -= 2;
          newSelectionEnd -= 2;
      }
      // Scenario 3: Regular case -> Add marks
      else {
          newText = before + "**" + selectedText + "**" + after;
          newSelectionStart += 2; 
          newSelectionEnd += 2;   
      }
      
      setFormData(prev => ({ ...prev, script: newText }));
      
      setTimeout(() => {
          if (textareaRef.current) {
              textareaRef.current.focus();
              textareaRef.current.setSelectionRange(newSelectionStart, newSelectionEnd);
          }
           setHistory(prev => {
                const current = prev.slice(0, historyIndex + 1);
                setHistoryIndex(current.length);
                return [...current, newText];
           });
      }, 0);
  };

  const handleReadModeBold = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

      const range = selection.getRangeAt(0);
      let startNode = range.startContainer;
      
      let lineDiv = startNode as HTMLElement;
      // Traverse up to find the line container
      while (lineDiv && (lineDiv.nodeType !== Node.ELEMENT_NODE || !lineDiv.hasAttribute('data-line'))) {
          if (!lineDiv.parentElement) return; 
          lineDiv = lineDiv.parentElement;
      }
      
      const lineIndex = parseInt(lineDiv.getAttribute('data-line') || '-1');
      if (lineIndex === -1) return;

      const rawLine = formData.script?.split('\n')[lineIndex] || '';
      
      // Calculate Visual Offsets relative to the lineDiv
      const getVisualOffset = (node: Node, offset: number, root: HTMLElement): number => {
          const preCaretRange = range.cloneRange();
          preCaretRange.selectNodeContents(root);
          preCaretRange.setEnd(node, offset);
          return preCaretRange.toString().length;
      };

      const visualStart = getVisualOffset(range.startContainer, range.startOffset, lineDiv);
      const visualEnd = getVisualOffset(range.endContainer, range.endOffset, lineDiv);
      
      if (visualStart === visualEnd) return;

      // Map Visual Index -> Raw Index (skipping '**')
      let visualIdx = 0;
      const map = new Map<number, number>(); 
      
      for (let i = 0; i < rawLine.length; i++) {
        if (rawLine.substring(i, i+2) === '**') {
            i++; 
            continue;
        }
        map.set(visualIdx, i);
        visualIdx++;
      }
      map.set(visualIdx, rawLine.length);

      const rawStart = map.get(visualStart);
      const rawEnd = map.get(visualEnd);

      if (rawStart === undefined || rawEnd === undefined) return;

      const before = rawLine.substring(0, rawStart);
      const selectedInfo = rawLine.substring(rawStart, rawEnd);
      const after = rawLine.substring(rawEnd);
      
      let newText = "";
      
      // Toggle logic
      if (before.endsWith('**') && after.startsWith('**')) {
           newText = before.slice(0, -2) + selectedInfo + after.slice(2);
      } else {
          newText = before + "**" + selectedInfo + "**" + after;
      }

      const allLines = formData.script?.split('\n') || [];
      allLines[lineIndex] = newText;
      const finalScript = allLines.join('\n');

      setFormData(prev => ({ ...prev, script: finalScript }));
      
      // Update history
      setHistory(prev => {
           const current = prev.slice(0, historyIndex + 1);
           setHistoryIndex(current.length);
           return [...current, finalScript];
      });
  };

  const handleUndo = () => {
      if (historyIndex > 0) {
          isUndoRedoAction.current = true;
          const prevScript = history[historyIndex - 1];
          setFormData(prev => ({ ...prev, script: prevScript }));
          setHistoryIndex(prev => prev - 1);
          showToast("Deshacer", "info");
      }
  };

  const handleScriptChangeWithHistory = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newVal = e.target.value;
      setFormData({ ...formData, script: newVal });

      if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
      
      historyTimeoutRef.current = setTimeout(() => {
          setHistory(prev => {
               const current = prev.slice(0, historyIndex + 1);
               if (current.length > 0 && current[current.length - 1] !== newVal) {
                   setHistoryIndex(current.length);
                   return [...current, newVal];
               } else if (current.length === 0) {
                   setHistoryIndex(0);
                   return [newVal];
               }
               return prev;
          });
      }, 1000); 
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      // Ctrl+Z for Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
          e.preventDefault();
          handleUndo();
      }
      
      // Ctrl+B for Bold
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
          e.preventDefault();
          handleManualBold();
      }
  };

  const handleSave = async () => {
    if (!formData.title) {
        showToast("El título es obligatorio", "error");
        return;
    }
    setSaving(true);
    try {
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
      if (error?.message?.includes("Could not find the 'content_type' column")) {
          alert("⚠️ ERROR DE BASE DE DATOS: Falta la columna 'content_type'.\n\nPor favor, ve a Supabase > SQL Editor y ejecuta el script de migración.");
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

  const handleCompleteMetadata = async () => {
    if (!formData.script || formData.script.length < 10) {
        showToast("Escribe un guion primero para poder analizarlo", "error");
        return;
    }

    setGenerating(true);
    try {
        const analysis = await ai.analyzeScript(formData.script);
        if (analysis) {
            setFormData(prev => ({
                ...prev,
                title: prev.title || analysis.title,
                concept: prev.concept || analysis.concept,
                hook: prev.hook || analysis.hook,
                visuals: prev.visuals || analysis.visuals,
                platform: prev.platform || analysis.platform,
                contentType: prev.contentType || analysis.contentType
            }));
            showToast("✨ Datos completados desde el guion", "success");
        } else {
            showToast("No se pudo analizar el guion", "error");
        }
    } catch (error) {
        console.error("AI Analysis Error", error);
        showToast("Error al conectar con la IA", "error");
    } finally {
        setGenerating(false);
    }
  };

  const handleGenerateIdeas = async () => {
      if (!formData.concept) return;
      
      setGenerating(true);
      try {
          const ideas = await ai.generateContentScript('IDEA', {
              platform: formData.platform,
              topic: formData.concept,
              context: "El objetivo es educar y vender servicios."
          });
          
          if (ideas) {
              setFormData(prev => ({ ...prev, script: (prev.script ? prev.script + "\n\n" : "") + "--- IDEAS GENERADAS ---\n" + ideas }));
              showToast("✨ Ideas generadas y añadidas al editor", "success");
          }
      } catch (e) {
          console.error(e);
      } finally {
          setGenerating(false);
      }
  };

  const handleAutoFormatScript = () => {
      if (!formData.script) return;

      const lines = formData.script.split('\n');
      const formattedLines = lines.map(line => {
          const trimmed = line.trim();
          
          const isSpoken = trimmed.startsWith('"') || trimmed.startsWith('“') || trimmed.startsWith('LO QUE DECÍS:');

          if (isSpoken && !trimmed.includes('**')) {
               if (trimmed.startsWith('"') || trimmed.startsWith('“')) {
                   return `**${trimmed}**`; 
               }
               if (trimmed.startsWith('LO QUE DECÍS:')) {
                   return trimmed.replace(/LO QUE DECÍS:\s*"?([^"]*)"?/, 'LO QUE DECÍS: "**$1**"');
               }
               return `**${trimmed}**`;
          }
          return line;
      });

      setFormData({ ...formData, script: formattedLines.join('\n') });
      setViewMode('READ'); 
      showToast("✨ Guion formateado: Texto hablado en negrita", "success");
  };

  const handleCopyPublicLink = () => {
      const url = `${window.location.origin}/#/p/${id}`;
      navigator.clipboard.writeText(url);
      showToast("Enlace público copiado al portapapeles", "success");
  };

  const renderScriptContent = () => {
      if (!formData.script) return null;
      
      return formData.script.split('\n').map((line, i) => {
          const parts = line.split(/(\*\*.*?\*\*)/g);
          
          return (
              <div key={i} data-line={i} className="min-h-[1em] mb-1">
                  {parts.map((part, j) => {
                      if (part.startsWith('**') && part.endsWith('**')) {
                          return <strong key={j} className="text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1 rounded">{part.slice(2, -2)}</strong>;
                      }
                      return <span key={j}>{part}</span>;
                  })}
              </div>
          );
      });
  };

  if (loading) {
     return (
        <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
     );
  }

  const Toolbar = () => (
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-white/90 dark:bg-black/90 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => isFullScreen ? setIsFullScreen(false) : navigate('/content-ideas')}>
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
          
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                  onClick={() => setViewMode('EDIT')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'EDIT' ? 'bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'}`}
              >
                  <Edit3 className="w-4 h-4" /> Editar
              </button>
              <button
                  onClick={() => setViewMode('READ')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'READ' ? 'bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'}`}
              >
                  <Eye className="w-4 h-4" /> Leer
              </button>
          </div>

          <div className="flex items-center gap-2">
               <Button 
                    onClick={handleManualBold}
                    variant="ghost"
                    className="h-8 w-8 p-0 text-gray-600 hover:bg-gray-200 rounded-full"
                    title="Resaltar texto seleccionado"
               >
                   <Bold className="w-4 h-4" />
               </Button>
               <Button 
                    onClick={handleAutoFormatScript}
                    variant="secondary"
                    className="gap-2 text-indigo-600 bg-indigo-50 border-indigo-100 hover:bg-indigo-100 text-xs h-8"
               >
                   <Sparkles className="w-3 h-3" />
                   <span className="hidden sm:inline">Auto-Resaltar</span>
               </Button>
          </div>
      </div>
  );

  return (
    <>
      {isFullScreen && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-black flex flex-col">
           <Toolbar />
           <div className="flex-1 overflow-auto bg-gray-50 dark:bg-black relative">
               <div className="w-full min-h-full bg-white dark:bg-black shadow-none p-8 md:p-12">
                  {viewMode === 'READ' ? (
                      <div 
                        className="w-full h-full font-serif leading-relaxed text-gray-900 dark:text-gray-100 whitespace-pre-wrap outline-none"
                        style={{ fontSize: `${fontSize}px`, minHeight: '80vh' }}
                      >
                          {renderScriptContent()}
                      </div>
                  ) : (
                      <textarea
                          ref={textareaRef}
                          value={formData.script}
                          onChange={handleScriptChangeWithHistory}
                          onKeyDown={handleKeyDown}
                          placeholder="Escribe tu guion aquí..."
                          className="w-full h-full bg-transparent border-none resize-none focus:ring-0 p-0 font-serif leading-relaxed text-gray-900 dark:text-gray-100"
                          style={{ fontSize: `${fontSize}px`, minHeight: '80vh', outline: 'none' }}
                      />
                  )}
               </div>
           </div>
        </div>
      )}

      {!isFullScreen && (
        <div className="min-h-screen bg-gray-50/50 dark:bg-slate-950/50 p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            
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
                    <Button 
                        onClick={handleCopyPublicLink} 
                        variant="outline" 
                        className="gap-2 hidden md:flex"
                        title="Copiar enlace público"
                    >
                        <Share2 className="w-4 h-4" />
                        <span className="hidden lg:inline">Compartir</span>
                    </Button>

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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
                
                <div className="lg:col-span-4 space-y-6">
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
                                    onClick={handleCompleteMetadata} 
                                    disabled={generating}
                                    variant="secondary"
                                    className="h-8 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200"
                                 >
                                     <Sparkles className="w-3 h-3 mr-1" />
                                     {generating ? 'Analizando...' : 'Completar Datos'}
                                 </Button>
                                 <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">Documento Principal</span>
                             </div>
                        </div>
                       
                        <div className="flex items-center gap-2 mb-2 bg-gray-50 dark:bg-slate-800 rounded-lg p-1 self-start">
                              <button
                                  onClick={() => setViewMode('EDIT')}
                                  className={`px-3 py-1 rounded text-xs font-semibold ${viewMode === 'EDIT' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
                              >
                                  Editar
                              </button>
                              <button
                                  onClick={() => setViewMode('READ')}
                                  className={`px-3 py-1 rounded text-xs font-semibold ${viewMode === 'READ' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
                              >
                                  Leer
                              </button>
                        </div>

                        {viewMode === 'READ' ? (
                            <div 
                              className="w-full h-full font-serif leading-relaxed text-gray-900 dark:text-gray-100 whitespace-pre-wrap outline-none bg-gray-50/30 p-4 rounded-xl"
                              style={{ fontSize: `${fontSize}px`, minHeight: '60vh' }}
                            >
                                {renderScriptContent()}
                            </div>
                        ) : (
                            <textarea
                                ref={textareaRef}
                                value={formData.script}
                                onChange={handleScriptChangeWithHistory}
                                onKeyDown={handleKeyDown}
                                placeholder="Escribe tu guion aquí..."
                                className="flex-1 w-full p-6 bg-gray-50 dark:bg-slate-800/50 border-0 rounded-xl focus:ring-0 resize-none text-lg leading-relaxed dark:text-white font-serif placeholder-gray-400"
                                style={{ outline: "none", minHeight: '60vh' }}
                            />
                        )}
                    </div>
                </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
