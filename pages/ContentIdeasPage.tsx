import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { ContentIdea, ContentFolder } from '../types';
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
  Sparkles,
  FolderPlus,
  Folder,
  FolderOpen,
  ChevronRight,
  X,
  Check,
  MoreHorizontal
} from 'lucide-react';

// ─── Paleta de colores para carpetas ─────────────────────────────────────────
const FOLDER_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#64748b',
];
const FOLDER_ICONS = ['📁', '🏢', '👤', '🎯', '📢', '🚀', '💡', '🎬', '📸', '⚡'];

// ─── Modal para crear carpeta ─────────────────────────────────────────────────
function NewFolderModal({ onClose, onCreate }: { onClose: () => void; onCreate: (f: Omit<ContentFolder, 'id' | 'createdAt'>) => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(FOLDER_COLORS[0]);
  const [icon, setIcon] = useState(FOLDER_ICONS[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({ name: name.trim(), color, icon });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-100 dark:border-slate-800" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">Nueva Carpeta</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Preview */}
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: color + '18' }}>
            <span className="text-2xl">{icon}</span>
            <span className="font-semibold text-gray-800 dark:text-white">{name || 'Sin nombre'}</span>
          </div>

          {/* Nombre */}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Nombre</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="ej: Empresa X, Cliente Y..."
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm"
            />
          </div>

          {/* Ícono */}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Ícono</label>
            <div className="flex flex-wrap gap-2">
              {FOLDER_ICONS.map(ic => (
                <button
                  key={ic} type="button" onClick={() => setIcon(ic)}
                  className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center transition-all ${icon === ic ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200'}`}
                >{ic}</button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Color</label>
            <div className="flex flex-wrap gap-2">
              {FOLDER_COLORS.map(c => (
                <button
                  key={c} type="button" onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="w-3.5 h-3.5 text-white mx-auto" />}
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full">Crear Carpeta</Button>
        </form>
      </div>
    </div>
  );
}

// ─── Componente Principal ────────────────────────────────────────────────────
export default function ContentIdeasPage() {
  const navigate = useNavigate();
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [folders, setFolders] = useState<ContentFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'UNPUBLISHED'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'POST' | 'AD'>('ALL');
  const [sortOrder, setSortOrder] = useState<'NEWEST' | 'OLDEST'>('NEWEST');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null); // null = todas
  const [showNewFolder, setShowNewFolder] = useState(false);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, id: string } | null>(null);
  // Move-to-folder submenu
  const [moveFolderId, setMoveFolderId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    const handleClick = () => { setContextMenu(null); setMoveFolderId(null); };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const loadData = async () => {
    try {
      const [ideasData, foldersData] = await Promise.all([
        db.contentIdeas.getAll(),
        db.contentFolders.getAll(),
      ]);
      setIdeas(ideasData);
      setFolders(foldersData);
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setLoading(false);
    }
  };

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

  const handleMoveToFolder = async (ideaId: string, folderId: string | null) => {
    try {
      await db.contentIdeas.update(ideaId, { folderId } as any);
      setIdeas(prev => prev.map(idea => idea.id === ideaId ? { ...idea, folderId: folderId ?? undefined } : idea));
      setContextMenu(null);
      setMoveFolderId(null);
    } catch (error) {
      console.error("Error moving idea:", error);
    }
  };

  const handleCreateFolder = async (data: Omit<ContentFolder, 'id' | 'createdAt'>) => {
    try {
      const created = await db.contentFolders.create(data);
      setFolders(prev => [...prev, created]);
    } catch (error) {
      console.error("Error creating folder:", error);
    }
  };

  const handleDeleteFolder = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Eliminar carpeta? Los guiones no se borran.')) return;
    await db.contentFolders.delete(id);
    setFolders(prev => prev.filter(f => f.id !== id));
    if (selectedFolderId === id) setSelectedFolderId(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar esta idea?')) {
      await db.contentIdeas.delete(id);
      loadData();
    }
  };

  const filteredIdeas = ideas.filter(idea => {
    const matchesSearch = idea.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (idea.concept || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter === 'PUBLISHED') matchesStatus = idea.status === 'POSTED';
    if (statusFilter === 'UNPUBLISHED') matchesStatus = idea.status !== 'POSTED';

    const matchesType = typeFilter === 'ALL' || idea.contentType === typeFilter;

    const matchesFolder = selectedFolderId === null
      ? true
      : idea.folderId === selectedFolderId;

    return matchesSearch && matchesStatus && matchesType && matchesFolder;
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

  const getFolderById = (id?: string) => folders.find(f => f.id === id);

  const countInFolder = (folderId: string | null) => {
    if (folderId === null) return ideas.length;
    return ideas.filter(i => i.folderId === folderId).length;
  };

  return (
    <div className="h-full flex bg-gray-50/50 dark:bg-slate-950/50 overflow-hidden">

      {/* ── Sidebar de Carpetas ─────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 flex flex-col border-r border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900/70 overflow-y-auto">
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Carpetas</span>
          <button
            onClick={() => setShowNewFolder(true)}
            title="Nueva carpeta"
            className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-500 hover:text-indigo-700 transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {/* Todas */}
          <button
            onClick={() => setSelectedFolderId(null)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all group ${
              selectedFolderId === null
                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'
            }`}
          >
            {selectedFolderId === null
              ? <FolderOpen className="w-4 h-4 text-indigo-500" />
              : <Folder className="w-4 h-4" />
            }
            <span className="flex-1 text-left truncate">Todas</span>
            <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-300 rounded-full px-1.5 py-0.5 font-semibold">
              {countInFolder(null)}
            </span>
          </button>

          {/* Sin carpeta */}
          <button
            onClick={() => setSelectedFolderId('__none__')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all group ${
              selectedFolderId === '__none__'
                ? 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200'
                : 'text-gray-500 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800'
            }`}
          >
            <Folder className="w-4 h-4 opacity-40" />
            <span className="flex-1 text-left truncate">Sin carpeta</span>
            <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-300 rounded-full px-1.5 py-0.5 font-semibold">
              {ideas.filter(i => !i.folderId).length}
            </span>
          </button>

          {folders.length > 0 && (
            <div className="pt-2 pb-1 px-3">
              <div className="h-px bg-gray-100 dark:bg-slate-800" />
            </div>
          )}

          {/* Lista de carpetas */}
          {folders.map(folder => (
            <button
              key={folder.id}
              onClick={() => setSelectedFolderId(folder.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all group ${
                selectedFolderId === folder.id
                  ? 'text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}
              style={selectedFolderId === folder.id ? { backgroundColor: folder.color } : {}}
            >
              <span className="text-base">{folder.icon}</span>
              <span className="flex-1 text-left truncate">{folder.name}</span>
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${
                selectedFolderId === folder.id
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-300'
              }`}>
                {countInFolder(folder.id)}
              </span>
              <button
                onClick={(e) => handleDeleteFolder(folder.id, e)}
                className={`opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all ${
                  selectedFolderId === folder.id ? 'text-white hover:bg-white/20' : 'text-gray-400 hover:text-red-500'
                }`}
              >
                <X className="w-3 h-3" />
              </button>
            </button>
          ))}

          {folders.length === 0 && (
            <div className="text-center pt-4 pb-2 text-xs text-gray-400">
              <FolderPlus className="w-6 h-6 mx-auto mb-1 opacity-40" />
              <p>Crea una carpeta<br />para organizar</p>
            </div>
          )}
        </nav>
      </aside>

      {/* ── Área Principal ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 md:px-8 pb-0 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-3">
              {selectedFolderId && selectedFolderId !== '__none__' && getFolderById(selectedFolderId) ? (
                <>
                  <span className="text-2xl">{getFolderById(selectedFolderId)!.icon}</span>
                  {getFolderById(selectedFolderId)!.name}
                </>
              ) : selectedFolderId === '__none__' ? (
                <>
                  <Folder className="w-7 h-7 text-gray-400" />
                  Sin Carpeta
                </>
              ) : (
                'Generador de Ideas'
              )}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {selectedFolderId === null
                ? `${ideas.length} guiones en total`
                : `${filteredIdeas.length} guiones`
              }
            </p>
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
                  >Todos</button>
                  <button 
                      onClick={() => setTypeFilter('POST')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${typeFilter === 'POST' ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                  >Post</button>
                  <button 
                      onClick={() => setTypeFilter('AD')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${typeFilter === 'AD' ? 'bg-white dark:bg-slate-700 shadow text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                  >Ads</button>
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

              {/* Sort */}
               <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-xl border border-gray-100 dark:border-slate-800">
                  <button
                      onClick={() => setSortOrder('NEWEST')}
                      className={`p-2 rounded-lg transition-all ${sortOrder === 'NEWEST' ? 'bg-gray-100 dark:bg-slate-800 text-black dark:text-white' : 'text-gray-400 hover:text-gray-600'}`}
                      title="Más recientes"
                  ><Calendar className="w-4 h-4 transform rotate-180" /></button>
                  <button
                      onClick={() => setSortOrder('OLDEST')}
                      className={`p-2 rounded-lg transition-all ${sortOrder === 'OLDEST' ? 'bg-gray-100 dark:bg-slate-800 text-black dark:text-white' : 'text-gray-400 hover:text-gray-600'}`}
                      title="Más antiguos"
                  ><Calendar className="w-4 h-4" /></button>
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
              <p>No hay ideas en esta carpeta.</p>
              {selectedFolderId && selectedFolderId !== '__none__' && (
                <button
                  onClick={() => navigate('/content-ideas/new')}
                  className="mt-4 text-indigo-500 text-sm font-semibold hover:text-indigo-700"
                >
                  + Agregar primera idea
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredIdeas.map(idea => {
                const folder = getFolderById(idea.folderId);
                return (
                  <div 
                    key={idea.id} 
                    onClick={() => navigate(`/content-ideas/${idea.id}`)}
                    onContextMenu={(e) => handleContextMenu(e, idea.id)}
                    className="group bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-5 hover:shadow-xl transition-all duration-300 flex flex-col h-full transform hover:-translate-y-1 relative cursor-pointer"
                  >
                    {/* Folder indicator strip */}
                    {folder && (
                      <div
                        className="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl"
                        style={{ backgroundColor: folder.color }}
                      />
                    )}

                    {/* Card Header */}
                    <div className="flex items-start justify-between mb-4" style={folder ? { marginTop: '4px' } : {}}>
                      <div className="flex items-center gap-2 flex-wrap">
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
                        ><Edit2 className="w-3.5 h-3.5" /></button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(idea.id); }}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-400 hover:text-red-500 transition-colors"
                        ><Trash2 className="w-3.5 h-3.5" /></button>
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
                    <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
                      {/* Folder badge */}
                      {folder ? (
                        <span
                          className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: folder.color + '20', color: folder.color }}
                        >
                          {folder.icon} {folder.name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300 dark:text-gray-600 flex items-center gap-1">
                          <Folder className="w-3 h-3" /> Sin carpeta
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Calendar className="w-3 h-3" />
                        {new Date(idea.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Context Menu */}
          {contextMenu && (
            <div
              className="fixed z-50 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-xl py-2 w-56"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onClick={e => e.stopPropagation()}
            >
              <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-slate-700 mb-1">
                Cambiar Estado
              </div>
              {[
                { v: 'IDEA', label: '💡 En Idea', color: 'bg-gray-400' },
                { v: 'SCRIPTED', label: '📝 Guionizado', color: 'bg-blue-400' },
                { v: 'FILMED', label: '🎥 Grabado', color: 'bg-purple-400' },
                { v: 'EDITED', label: '🎬 Editado', color: 'bg-orange-400' },
                { v: 'POSTED', label: '✅ Publicado / Terminado', color: 'bg-green-500' },
              ].map(({ v, label, color }) => (
                <button
                  key={v}
                  onClick={() => handleFastStatusUpdate(contextMenu.id, v)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <span className={`w-2 h-2 rounded-full ${color}`}></span>
                  {label}
                </button>
              ))}

              {/* Move to folder */}
              <div className="border-t border-gray-100 dark:border-slate-700 mt-1 pt-1">
                <div
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center justify-between cursor-pointer"
                  onClick={() => setMoveFolderId(moveFolderId ? null : contextMenu.id)}
                >
                  <span className="flex items-center gap-2">
                    <Folder className="w-3.5 h-3.5 text-indigo-400" />
                    Mover a carpeta
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                </div>
                {moveFolderId === contextMenu.id && (
                  <div className="mx-2 my-1 bg-gray-50 dark:bg-slate-900 rounded-lg overflow-hidden border border-gray-100 dark:border-slate-700">
                    <button
                      onClick={() => handleMoveToFolder(contextMenu.id, null)}
                      className="w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center gap-2"
                    >
                      <Folder className="w-3 h-3 opacity-40" /> Sin carpeta
                    </button>
                    {folders.map(f => (
                      <button
                        key={f.id}
                        onClick={() => handleMoveToFolder(contextMenu.id, f.id)}
                        className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center gap-2"
                      >
                        <span>{f.icon}</span>
                        <span className="font-medium" style={{ color: f.color }}>{f.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal nueva carpeta */}
      {showNewFolder && (
        <NewFolderModal
          onClose={() => setShowNewFolder(false)}
          onCreate={handleCreateFolder}
        />
      )}
    </div>
  );
}
