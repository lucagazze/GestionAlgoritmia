import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { ContentIdea } from '../types';
import { Video, Sparkles, FileText, CheckCircle2 } from 'lucide-react';
import { Badge } from '../components/UIComponents';

export default function PublicContentIdeaPage() {
    const { id } = useParams();
    const [idea, setIdea] = useState<ContentIdea | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (id) fetchIdea(id);
    }, [id]);

    const fetchIdea = async (ideaId: string) => {
        try {
            const { data, error } = await supabase
                .from('content_ideas')
                .select('*')
                .eq('id', ideaId)
                .single();

            if (error) throw error;
            setIdea(data);
        } catch (err: any) {
            console.error("Error fetching public idea:", err);
            setError("No se pudo cargar la idea. Puede que no exista o el enlace sea incorrecto.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
    );

    if (error || !idea) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
            <div className="text-center max-w-md">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                    <Video className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Error</h3>
                <p className="mt-2 text-sm text-gray-500">{error || "Idea no encontrada"}</p>
            </div>
        </div>
    );

    // Simple parser for bolding **text** if it exists in the script (since we'll be adding that feature next)
    // Also handles simple "LO QUE DECIS:" blocks if we want to validte that structure later.
    const renderScript = (text: string) => {
        if (!text) return <p className="text-gray-400 italic">Sin guion...</p>;
        
        // Split by newlines to preserve paragraphs
        return text.split('\n').map((line, i) => {
             // Check if line is a header like "LO QUE DECIS:" or "VISUAL:"
             const isHeader = /^[A-Z\s]+:|\[.*\]/.test(line); // e.g. "VISUAL:" or "[0:00-0:05]"
             const isSpoken = line.trim().startsWith('"') || line.trim().startsWith('LO QUE DECÍS:');

             // Render bold markdown **text**
             const parts = line.split(/(\*\*.*?\*\*)/g);
             
             return (
                 <div key={i} className={`min-h-[1.5em] mb-2 ${isHeader ? 'text-gray-500 font-bold text-xs uppercase tracking-wider mt-4' : 'text-gray-800'}`}>
                     {parts.map((part, j) => {
                         if (part.startsWith('**') && part.endsWith('**')) {
                             return <strong key={j} className="text-indigo-700 bg-indigo-50 px-1 rounded">{part.slice(2, -2)}</strong>;
                         }
                         return part;
                     })}
                 </div>
             );
        });
    };

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-3xl mx-auto">
                {/* Brand Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-black text-white font-bold text-xl mb-4">
                        A
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">
                        {idea.title}
                    </h2>
                    {idea.concept && (
                        <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 sm:mt-4">
                            {idea.concept}
                        </p>
                    )}
                </div>

                <div className="bg-white overflow-hidden shadow-xl rounded-2xl border border-gray-100">
                    {/* Metadata Bar */}
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-wrap gap-4 items-center justify-between">
                         <div className="flex items-center gap-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${idea.platform === 'Instagram' ? 'bg-pink-100 text-pink-800' : 'bg-blue-100 text-blue-800'}`}>
                                {idea.platform}
                            </span>
                            <span className="text-gray-300">|</span>
                            <span className="text-sm font-medium text-gray-600">{idea.contentType}</span>
                         </div>
                         <div className="flex items-center gap-2">
                             <CheckCircle2 className={`w-4 h-4 ${idea.status === 'POSTED' ? 'text-green-500' : 'text-gray-400'}`} />
                             <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{idea.status}</span>
                         </div>
                    </div>

                    <div className="p-8 space-y-8">
                        {/* Hook Section */}
                        {idea.hook && (
                            <div className="bg-rose-50 rounded-xl p-6 border border-rose-100">
                                <h3 className="text-rose-900 font-bold text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4" /> Hook / Gancho
                                </h3>
                                <p className="text-lg font-medium text-rose-800">
                                    {idea.hook}
                                </p>
                            </div>
                        )}

                        {/* Script Section */}
                        <div>
                            <h3 className="text-gray-900 font-bold text-lg mb-4 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-indigo-600" /> Guion
                            </h3>
                            <div className="prose prose-lg text-gray-600 font-serif leading-relaxed max-w-none">
                                {renderScript(idea.script || '')}
                            </div>
                        </div>

                        {/* Visuals Section */}
                        {idea.visuals && (
                            <div className="border-t border-gray-100 pt-8">
                                <h3 className="text-gray-900 font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Video className="w-4 h-4 text-emerald-600" /> Referencias Visuales
                                </h3>
                                <div className="bg-slate-50 rounded-lg p-4 text-slate-700 text-sm whitespace-pre-wrap">
                                    {idea.visuals}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="mt-8 text-center text-sm text-gray-400">
                    Gestión de Contenido por <strong>Algoritmia OS</strong>
                </div>
            </div>
        </div>
    );
}
