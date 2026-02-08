import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { ContentIdea } from '../types';
import { Button, Badge } from '../components/UIComponents';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Video, 
  Instagram, 
  Youtube, 
  Linkedin, 
  FileText, 
  Calendar,
  Sparkles
} from 'lucide-react';

export default function ContentIdeasPage() {
  const navigate = useNavigate();
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'UNPUBLISHED'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'POST' | 'AD'>('ALL');
  const [sortOrder, setSortOrder] = useState<'NEWEST' | 'OLDEST'>('NEWEST');

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, id: string } | null>(null);

  useEffect(() => {
    loadData();
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setContextMenu({ x: e.pageX, y: e.pageY, id });
  };

  const handleFastStatusUpdate = async (id: string, status: string) => {
    try {
        await db.contentIdeas.update(id, { status: status as any });
        setIdeas(prev => prev.map(idea => idea.id === id ? { ...idea, status: status as any } : idea));
        setContextMenu(null);
    } catch (error) {
        console.error("Error updating status:", error);
    }
  };

  const loadData = async () => {
    try {
      const data = await db.contentIdeas.getAll();
      setIdeas(data);
    } catch (err) {
      console.error("Failed to load ideas", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar esta idea?')) {
      await db.contentIdeas.delete(id);
      loadData();
    }
  };

  const filteredIdeas = ideas.filter(idea => {
    const matchesSearch = idea.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          idea.concept.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter === 'PUBLISHED') matchesStatus = idea.status === 'POSTED';
    if (statusFilter === 'UNPUBLISHED') matchesStatus = idea.status !== 'POSTED';

    const matchesType = typeFilter === 'ALL' || idea.contentType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  }).sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === 'NEWEST' ? dateB - dateA : dateA - dateB;
  });

  const getPlatformIcon = (platform?: string) => {
    switch (platform) {
      case 'YouTube': return <Youtube className="w-4 h-4 text-red-600" />;
      case 'LinkedIn': return <Linkedin className="w-4 h-4 text-blue-700" />;
      case 'TikTok': return <Video className="w-4 h-4 text-black dark:text-white" />;
      default: return <Instagram className="w-4 h-4 text-pink-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'IDEA': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      case 'SCRIPTED': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'FILMED': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'EDITED': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'POSTED': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50/50 dark:bg-slate-950/50">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 md:px-8 pb-0 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Generador de Ideas</h1>
          <p className="text-gray-500 dark:text-gray-400">Gestiona y organiza tu contenido para redes sociales.</p>
        </div>
        <Button onClick={() => navigate('/content-ideas/new')} className="shadow-lg shadow-blue-500/20">
          <Plus className="w-4 h-4 mr-2" /> Nueva Idea
        </Button>
      </div>

      {/* Filters */}
      <div className="p-6 md:px-8 py-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Buscar ideas..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
          />
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto items-center">
            
            {/* Type Filter */}
            <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-lg">
                <button 
                    onClick={() => setTypeFilter('ALL')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${typeFilter === 'ALL' ? 'bg-white dark:bg-slate-700 shadow text-black dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Todos
                </button>
                <button 
                    onClick={() => setTypeFilter('POST')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${typeFilter === 'POST' ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Post
                </button>
                <button 
                    onClick={() => setTypeFilter('AD')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${typeFilter === 'AD' ? 'bg-white dark:bg-slate-700 shadow text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Ads
                </button>
            </div>

            {/* Status Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto bg-white dark:bg-slate-900 p-1 rounded-xl border border-gray-100 dark:border-slate-800">
             {[
                { id: 'ALL', label: 'Todos' },
                { id: 'UNPUBLISHED', label: 'No Publicado' },
                { id: 'PUBLISHED', label: 'Publicado' }
            ].map(filter => (
                <button
                key={filter.id}
                onClick={() => setStatusFilter(filter.id as any)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    statusFilter === filter.id 
                    ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm' 
                    : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
                >
                {filter.label}
                </button>
            ))}
            </div>

            {/* Sort Order */}
             <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-xl border border-gray-100 dark:border-slate-800">
                <button
                    onClick={() => setSortOrder('NEWEST')}
                    className={`p-2 rounded-lg transition-all ${sortOrder === 'NEWEST' ? 'bg-gray-100 dark:bg-slate-800 text-black dark:text-white' : 'text-gray-400 hover:text-gray-600'}`}
                    title="Más recientes"
                >
                    <Calendar className="w-4 h-4 transform rotate-180" />
                </button>
                <button
                    onClick={() => setSortOrder('OLDEST')}
                    className={`p-2 rounded-lg transition-all ${sortOrder === 'OLDEST' ? 'bg-gray-100 dark:bg-slate-800 text-black dark:text-white' : 'text-gray-400 hover:text-gray-600'}`}
                    title="Más antiguos"
                >
                    <Calendar className="w-4 h-4" />
                </button>
             </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="flex-1 overflow-y-auto p-6 md:px-8 pt-0">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredIdeas.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay ideas registradas aún.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredIdeas.map(idea => (
              <div 
                key={idea.id} 
                onClick={() => navigate(`/content-ideas/${idea.id}`)}
                onContextMenu={(e) => handleContextMenu(e, idea.id)}
                className="group bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-5 hover:shadow-xl transition-all duration-300 flex flex-col h-full transform hover:-translate-y-1 relative cursor-pointer"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-gray-50 dark:bg-slate-800 rounded-lg">
                      {getPlatformIcon(idea.platform)}
                    </span>
                    {idea.contentType === 'AD' && (
                        <Badge className="bg-purple-100 text-purple-700 border-purple-200">AD 📢</Badge>
                    )}
                     {idea.contentType === 'POST' && (
                        <Badge className="bg-blue-50 text-blue-700 border-blue-100">POST 📝</Badge>
                    )}
                    <Badge className={getStatusColor(idea.status)}>{idea.status}</Badge>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button 
                        onClick={(e) => { e.stopPropagation(); navigate(`/content-ideas/${idea.id}`); }}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-400 hover:text-blue-500 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(idea.id); }}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Card Content */}
                <div className="flex-1 space-y-3">
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white line-clamp-2 leading-tight">
                    {idea.title}
                  </h3>
                  
                  {idea.concept && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 bg-gray-50 dark:bg-slate-800/50 p-3 rounded-xl italic">
                      "{idea.concept}"
                    </p>
                  )}

                  {(idea.hook || idea.script) && (
                    <div className="flex gap-4 pt-2">
                      {idea.hook && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                          <Sparkles className="w-3 h-3 text-yellow-500" /> Hook
                        </div>
                      )}
                      {idea.script && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                          <FileText className="w-3 h-3 text-blue-500" /> Guion
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    Creado: {new Date(idea.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Context Menu */}
        {contextMenu && (
          <div
            className="fixed z-50 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-xl py-2 w-56 animate-in fade-in zoom-in-95 duration-100"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-slate-700 mb-1">
              Cambiar Estado
            </div>
            <button
              onClick={() => handleFastStatusUpdate(contextMenu.id, 'IDEA')}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-gray-400"></span>
              💡 En Idea
            </button>
            <button
              onClick={() => handleFastStatusUpdate(contextMenu.id, 'SCRIPTED')}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              📝 Guionizado
            </button>
             <button
              onClick={() => handleFastStatusUpdate(contextMenu.id, 'FILMED')}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-purple-400"></span>
              🎥 Grabado
            </button>
             <button
              onClick={() => handleFastStatusUpdate(contextMenu.id, 'EDITED')}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-orange-400"></span>
              🎬 Editado
            </button>
            <button
              onClick={() => handleFastStatusUpdate(contextMenu.id, 'POSTED')}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              ✅ Publicado / Terminado 
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
