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
            const { data, error: fetchError } = await supabase
                .from('contentidea')
                .select('*')
                .eq('id', ideaId)
                .single();

            if (fetchError) throw fetchError;
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
        <div className="min-h-screen bg-gray-50/50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Brand Header */}
                <div className="text-center">
                    <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-black text-white font-bold text-2xl mb-6 shadow-lg shadow-gray-200">
                        A
                    </div>
                    <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">
                        {idea.title}
                    </h2>
                    {idea.concept && (
                        <p className="mt-4 max-w-2xl mx-auto text-xl md:text-2xl text-gray-500 font-light leading-relaxed">
                            {idea.concept}
                        </p>
                    )}
                </div>

                <div className="bg-white overflow-hidden shadow-2xl shadow-gray-200/50 rounded-3xl border border-gray-100">
                    {/* Metadata Bar */}
                    <div className="bg-gray-50/50 backdrop-blur-sm px-8 py-6 border-b border-gray-100 flex flex-wrap gap-6 items-center justify-between">
                         <div className="flex items-center gap-4">
                            <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold tracking-wide shadow-sm ${idea.platform === 'Instagram' ? 'bg-pink-100 text-pink-700' : idea.platform === 'TikTok' ? 'bg-black text-white' : 'bg-blue-100 text-blue-800'}`}>
                                {idea.platform}
                            </span>
                            <span className="text-gray-300 transform scale-150">|</span>
                            <span className="text-base font-medium text-gray-600 uppercase tracking-wide">{idea.contentType}</span>
                         </div>
                         {idea.scheduledDate && (
                             <div className="text-gray-500 font-medium text-sm flex items-center gap-2">
                                 📅 {new Date(idea.scheduledDate).toLocaleDateString()}
                             </div>
                         )}
                    </div>

                    <div className="p-8 md:p-12 space-y-12">
                        {/* Hook Section */}
                        {idea.hook && (
                            <div className="bg-rose-50/50 rounded-2xl p-8 border border-rose-100 relative group hover:shadow-md transition-shadow">
                                <span className="absolute -top-3 -left-2 bg-rose-100 text-rose-600 p-2 rounded-lg shadow-sm transform -rotate-6 group-hover:rotate-0 transition-transform">
                                    <Sparkles className="w-5 h-5" />
                                </span>
                                <h3 className="text-rose-900/60 font-bold text-xs uppercase tracking-widest mb-3 ml-2">
                                    Hook / Gancho
                                </h3>
                                <p className="text-xl md:text-2xl font-bold text-rose-900 font-serif leading-relaxed">
                                    "{idea.hook}"
                                </p>
                            </div>
                        )}

                        {/* Script Section */}
                        <div className="space-y-6">
                            <h3 className="text-gray-900 font-bold text-xl flex items-center gap-3 pb-4 border-b border-gray-100">
                                <FileText className="w-6 h-6 text-indigo-600" /> Guion
                            </h3>
                            <div className="prose prose-xl prose-slate max-w-none font-serif leading-loose text-gray-700">
                                {renderScript(idea.script || '')}
                            </div>
                        </div>

                        {/* Visuals Section */}
                        {idea.visuals && (
                            <div className="bg-emerald-50/30 rounded-2xl p-8 border border-emerald-100/50">
                                <h3 className="text-emerald-900 font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Video className="w-5 h-5 text-emerald-600" /> Referencias Visuales
                                </h3>
                                <div className="text-emerald-900/80 text-lg leading-relaxed whitespace-pre-wrap font-medium">
                                    {idea.visuals}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="text-center pb-8">
                    <p className="text-sm text-gray-400 font-medium">
                        Gestión de Contenido por <span className="text-gray-600 font-bold">Algoritmia OS</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
