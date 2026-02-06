
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../services/db';
import { Role, Contractor } from '../types';
import { Button, Input, Modal, Badge } from '../components/UIComponents';
import { 
  Users, 
  Plus, 
  RefreshCw,
  Edit2, 
  Trash2, 
  Save, 
  X,
  Check,
  Search,
  LayoutList,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { motion } from 'framer-motion';

const DEPARTMENTS = ['DIRECCIÓN', 'VENTAS', 'OPERACIONES', 'DESARROLLO', 'MARKETING', 'CONTENIDO', 'ADMIN'] as const;

const DEPT_COLORS: Record<string, string> = {
    'DIRECCIÓN': 'bg-slate-800 text-white border-slate-700',
    'VENTAS': 'bg-emerald-600 text-white border-emerald-500',
    'OPERACIONES': 'bg-blue-600 text-white border-blue-500',
    'DESARROLLO': 'bg-indigo-600 text-white border-indigo-500',
    'MARKETING': 'bg-purple-600 text-white border-purple-500',
    'CONTENIDO': 'bg-pink-600 text-white border-pink-500',
    'ADMIN': 'bg-gray-600 text-white border-gray-500',
};

const DEPT_BG_COLORS: Record<string, string> = {
    'DIRECCIÓN': 'bg-slate-50 dark:bg-slate-900/50',
    'VENTAS': 'bg-emerald-50 dark:bg-emerald-900/10',
    'OPERACIONES': 'bg-blue-50 dark:bg-blue-900/10',
    'DESARROLLO': 'bg-indigo-50 dark:bg-indigo-900/10',
    'MARKETING': 'bg-purple-50 dark:bg-purple-900/10',
    'CONTENIDO': 'bg-pink-50 dark:bg-pink-900/10',
    'ADMIN': 'bg-gray-50 dark:bg-gray-900/10',
};

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters & Sort
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Role | 'priority', direction: 'asc' | 'desc' }>({ key: 'roleName', direction: 'asc' });

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Role>>({});

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRole, setNewRole] = useState<Partial<Role>>({ department: 'OPERACIONES' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rolesData, teamData] = await Promise.all([
          db.roles.getAll(),
          db.contractors.getAll()
      ]);
      setRoles(rolesData);
      setContractors(teamData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
      if (!newRole.roleName || !newRole.department) return;
      try {
          await db.roles.create(newRole as any);
          setIsModalOpen(false);
          setNewRole({ department: 'OPERACIONES' });
          loadData();
      } catch (e) {
          console.error(e);
          alert("Error creando rol");
      }
  };

  const handleDelete = async (id: string) => {
      if(!confirm("¿Seguro que quieres eliminar este rol?")) return;
      try {
          await db.roles.delete(id);
          loadData();
      } catch (e) {
          console.error(e);
      }
  };

  const startEdit = (role: Role) => {
      setEditingId(role.id);
      setEditForm(role);
  };

  const saveEdit = async () => {
      if (!editingId) return;
      try {
          await db.roles.update(editingId, editForm);
          setEditingId(null);
          loadData();
      } catch (e) {
          console.error(e);
          alert("Error guardando cambios");
      }
  };

  const toggleOwner = (name: string) => {
      const current = editForm.currentOwner ? editForm.currentOwner.split(',').map(s => s.trim()).filter(Boolean) : [];
      let newOwners;
      if (current.includes(name)) {
          newOwners = current.filter(c => c !== name);
      } else {
          newOwners = [...current, name];
      }
      setEditForm({ ...editForm, currentOwner: newOwners.join(', ') });
  };

  const handleSort = (key: keyof Role | 'priority') => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
  };

  const processedRoles = useMemo(() => {
    let filtered = roles.filter(r => {
        const matchesSearch = r.roleName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              r.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              r.tasks?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = selectedDept === 'ALL' || r.department === selectedDept;
        return matchesSearch && matchesDept;
    });

    return filtered.sort((a, b) => {
        let valA = a[sortConfig.key as keyof Role] || '';
        let valB = b[sortConfig.key as keyof Role] || '';

        // Priority Sort Hack
        if (sortConfig.key === 'priority') {
             valA = a.hiringTrigger?.includes('PRIORIDAD') ? 'A' : 'Z';
             valB = b.hiringTrigger?.includes('PRIORIDAD') ? 'A' : 'Z';
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
  }, [roles, searchTerm, selectedDept, sortConfig]);

  // Group roles by department
  const groupedRoles = useMemo(() => {
      return DEPARTMENTS.reduce((acc, dept) => {
        const rolesInDept = processedRoles.filter(r => r.department === dept);
        if (rolesInDept.length > 0) acc[dept] = rolesInDept;
        return acc;
     }, {} as Record<string, Role[]>);
  }, [processedRoles]);

  const handleHardReset = async () => {
      if(!confirm("⚠️ ESTO BORRARÁ TODOS LOS ROLES EXISTENTES y los volverá a crear desde cero. ¿Estás seguro?")) return;
      setLoading(true);
      try {
          // 1. Delete all
          // Note: Since we don't have a 'delete all' RPC, we fetch and delete one by one or we should add a 'deleteAll' to service.
          // For now, let's delete visible roles on screen.
          const deletePromises = roles.map(r => db.roles.delete(r.id));
          await Promise.all(deletePromises);
          
          // 2. Re-seed
          const rolesToSeed = [
            { department: 'DIRECCIÓN', roleName: 'CEO / Director General', description: 'Que el barco no se hunda y sea rentable. Visión y Plata.', tasks: 'Definir hacia dónde vamos, revisar las cuentas, cerrar alianzas grandes.', currentOwner: 'Luca Gazze', hiringTrigger: 'Nunca (sos vos).' },
            { department: 'DIRECCIÓN', roleName: 'COO / Gerente de Operaciones', description: 'Que las cosas pasen. Eficiencia y márgenes.', tasks: 'Organizar el quilombo interno, optimizar procesos, apagar incendios operativos.', currentOwner: 'Luca Gazze', hiringTrigger: 'Cuando vivís apagando incendios y no podés pensar en crecer.' },
            { department: 'VENTAS', roleName: 'Director Comercial / Head of Growth', description: 'Que entre plata nueva. Facturación mensual.', tasks: 'Armar la estrategia de venta, definir precios, liderar al equipo de ventas.', currentOwner: 'Luca Gazze', hiringTrigger: 'Cuando tengas un equipo de 2 o 3 vendedores.' },
            { department: 'VENTAS', roleName: 'Setter / Prospectador', description: 'Conseguir reuniones. Llenar la agenda.', tasks: 'Mandar mensajes (DMs) en frío, buscar empresas en LinkedIn, calificar si sirven o no.', currentOwner: 'Luca Gazze', hiringTrigger: 'PRIORIDAD ALTA. Es lo primero que se delega para que vos solo vendas.' },
            { department: 'VENTAS', roleName: 'Cerrador / Closer', description: 'Cerrar el trato. Meter clientes adentro.', tasks: 'Tener las videollamadas de venta, negociar, mandar el contrato y cobrar.', currentOwner: 'Luca Gazze', hiringTrigger: 'Cuando tengas la agenda explotada de llamadas y no tengas tiempo de atenderlas.' },
            { department: 'OPERACIONES', roleName: 'Account Manager / Cuentas', description: 'Que el cliente no se vaya. Retención.', tasks: 'Hablar con el cliente por WhatsApp, mandar reportes mensuales, tenerlos contentos.', currentOwner: 'Luca Gazze', hiringTrigger: 'Cuando tenés +10 clientes y el WhatsApp te explota de mensajes.' },
            { department: 'OPERACIONES', roleName: 'Project Manager (PM)', description: 'Que se entregue a tiempo. Orden.', tasks: 'Asignar tareas en el Notion/Excel, perseguir al equipo para que cumplan fechas.', currentOwner: 'Luca Gazze', hiringTrigger: 'Cuando tenés 5 proyectos a la vez y se te empiezan a pasar las fechas.' },
            { department: 'DESARROLLO', roleName: 'CTO / Líder Técnico', description: 'Que todo funcione técnico. Calidad.', tasks: 'Decidir qué tecnologías usar, revisar que el código esté limpio, arquitectura web.', currentOwner: 'Luca Gazze', hiringTrigger: 'Cuando el código te consuma el 100% del día y no puedas dirigir la empresa.' },
            { department: 'DESARROLLO', roleName: 'Diseñador Web UI/UX', description: 'Que la web sea linda y útil. Estética.', tasks: 'Diseñar en Figma, armar prototipos, pensar la experiencia del usuario.', currentOwner: 'Luca Gazze', hiringTrigger: 'Cuando quieras dar un salto de calidad visual muy zarpado.' },
            { department: 'DESARROLLO', roleName: 'Programador Frontend', description: 'Que la web se vea y ande. Maquetado.', tasks: 'Pasar el diseño a código, hacer animaciones, que ande rápido en el celular.', currentOwner: 'Luca Gazze', hiringTrigger: 'Cuando necesites sacar webs más rápido de lo que tus manos pueden escribir.' },
            { department: 'MARKETING', roleName: 'Trafficker Digital (Media Buyer)', description: 'Comprar visitas baratas. Rentabilidad de anuncios.', tasks: 'Armar campañas en Meta/Google Ads, mirar métricas todos los días, ajustar presupuestos.', currentOwner: 'Luca Gazze', hiringTrigger: 'Cuando manejes mucha plata en publicidad de clientes y te dé miedo pifiarla.' },
            { department: 'MARKETING', roleName: 'Especialista en Conversión (CRO)', description: 'Que las visitas compren. Tasa de venta.', tasks: 'Mirar mapas de calor, hacer tests A/B, mejorar los textos de la landing.', currentOwner: 'Luca Gazze', hiringTrigger: 'Cuando tenés mucho tráfico pero pocas ventas/consultas.' },
            { department: 'CONTENIDO', roleName: 'Director Creativo', description: 'Que la marca tenga onda. Identidad.', tasks: 'Definir el estilo visual de Algoritmia y los clientes, bajar ideas locas a tierra.', currentOwner: 'Mariano', hiringTrigger: 'Nunca (Suele ser el socio creativo).' },
            { department: 'CONTENIDO', roleName: 'Editor de Video (Reels/TikTok)', description: 'Videos dinámicos. Retención.', tasks: 'Editar crudos, poner subtítulos lindos, música, efectos de sonido, transiciones.', currentOwner: 'Mariano', hiringTrigger: 'Cuando el socio no dé abasto para editar todo lo que graban.' },
            { department: 'CONTENIDO', roleName: 'Content Strategist / Guionista', description: 'Ideas que enganchen. Viralidad y Venta.', tasks: 'Escribir los guiones de los videos, pensar los ganchos, armar el calendario.', currentOwner: 'Mariano', hiringTrigger: 'Cuando se queden sin ideas o necesiten producir volumen masivo.' },
            { department: 'ADMIN', roleName: 'Asistente Virtual / Admin', description: 'Sacarte lo aburrido. Tiempo libre.', tasks: 'Facturar, responder mails pavos, subir contenidos a redes, organizar agenda.', currentOwner: 'Luca Gazze', hiringTrigger: 'Contratar rápido para sacarse tareas repetitivas.' },
          ];

          for (const role of rolesToSeed) {
              await db.roles.create(role as any);
          }
          
          loadData();
          alert("Roles reseteados correctamente.");
      } catch (e) {
          console.error(e);
          alert("Error al resetear roles.");
      } finally {
          setLoading(false);
      }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><RefreshCw className="w-6 h-6 animate-spin text-gray-400"/></div>;

  return (
    <div className="p-6 max-w-[1800px] mx-auto space-y-8 pb-20">
      
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
                  <LayoutList className="w-8 h-8 text-teal-600" /> Matriz de Roles
              </h1>
              <p className="text-gray-500 mt-1">Mapa organizacional de responsabilidades y equipo.</p>
            </div>
            <div className="flex gap-2">
                <Button onClick={handleHardReset} variant="outline" className="text-red-500 hover:text-red-600 border-red-200 hover:bg-red-50">
                    <RefreshCw className="w-4 h-4 mr-2" /> Resetear Roles
                </Button>
                <Button onClick={() => setIsModalOpen(true)} className="bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-500/20">
                    <Plus className="w-4 h-4 mr-2" /> Nuevo Rol
                </Button>
            </div>
          </div>

          {/* FILTERS TOOLBAR */}
          <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
             <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input 
                    placeholder="Buscar por rol, tarea o descripción..." 
                    className="pl-10 h-10 border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
             
             <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 custom-scrollbar">
                <button 
                    onClick={() => setSelectedDept('ALL')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${selectedDept === 'ALL' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-400'}`}
                >
                    Todos
                </button>
                {DEPARTMENTS.map(dept => (
                    <button 
                        key={dept}
                        onClick={() => setSelectedDept(dept)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border whitespace-nowrap ${selectedDept === dept ? DEPT_COLORS[dept] : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                    >
                        {dept}
                    </button>
                ))}
             </div>
          </div>
      </div>

      {/* ROLES TABLE */}
      <div className="space-y-10">
        {DEPARTMENTS.map(dept => {
            const departmentRoles = groupedRoles[dept];
            if (!departmentRoles) return null;

            return (
                <div key={dept} className={`rounded-3xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm ${DEPT_BG_COLORS[dept]}`}>
                    {/* Header Depto */}
                    <div className={`px-6 py-4 border-b border-gray-200 dark:border-slate-800/50 flex items-center justify-between ${DEPT_COLORS[dept]} bg-opacity-90 backdrop-blur-sm`}>
                         <div className="flex items-center gap-3">
                             <h2 className="text-lg font-bold tracking-widest">{dept}</h2>
                             <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-mono">{departmentRoles.length}</span>
                         </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                             <thead className="bg-white/50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-800 text-[10px] uppercase text-gray-500 font-semibold tracking-wider">
                                <tr>
                                    <th className="px-3 py-2 w-[200px] cursor-pointer hover:text-gray-700" onClick={() => handleSort('roleName')}>
                                        <div className="flex items-center gap-1">Rol {sortConfig.key === 'roleName' && <ArrowUpDown className="w-3 h-3"/>}</div>
                                    </th>
                                    <th className="px-3 py-2 w-[200px]">Propósito (Meta)</th>
                                    <th className="px-3 py-2 min-w-[250px]">Responsabilidades (Día a Día)</th>
                                    <th className="px-3 py-2 w-[180px] cursor-pointer hover:text-gray-700" onClick={() => handleSort('currentOwner')}>
                                        <div className="flex items-center gap-1">Owner {sortConfig.key === 'currentOwner' && <ArrowUpDown className="w-3 h-3"/>}</div>
                                    </th>
                                    <th className="px-3 py-2 w-[200px] cursor-pointer hover:text-gray-700" onClick={() => handleSort('priority')}>
                                         <div className="flex items-center gap-1">Señal Contratación {sortConfig.key === 'priority' && <ArrowUpDown className="w-3 h-3"/>}</div>
                                    </th>
                                    <th className="px-3 py-2 w-[60px] text-right"></th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-gray-100 dark:divide-slate-800/50">
                                {departmentRoles.map(role => {
                                    const isEditing = editingId === role.id;
                                    return (
                                        <tr key={role.id} className={`group hover:bg-white dark:hover:bg-slate-800/80 transition-colors ${isEditing ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`}>
                                            
                                            {/* ROL */}
                                            <td className="px-3 py-2 align-top">
                                                {isEditing ? (
                                                    <Input 
                                                        value={editForm.roleName} 
                                                        onChange={e => setEditForm({...editForm, roleName: e.target.value})} 
                                                        className="h-7 text-xs font-bold"
                                                    />
                                                ) : (
                                                    <div className="font-bold text-gray-900 dark:text-white text-xs">{role.roleName}</div>
                                                )}
                                            </td>

                                            {/* META */}
                                            <td className="px-3 py-2 align-top text-gray-600 dark:text-gray-400">
                                                {isEditing ? (
                                                    <textarea 
                                                        className="w-full rounded-md border-gray-300 dark:border-slate-700 bg-transparent text-[11px] p-1.5 min-h-[50px] resize-y leading-tight"
                                                        value={editForm.description}
                                                        onChange={e => setEditForm({...editForm, description: e.target.value})}
                                                    />
                                                ) : <p className="leading-snug">{role.description}</p>}
                                            </td>

                                            {/* TASKS */}
                                            <td className="px-3 py-2 align-top text-gray-600 dark:text-gray-300">
                                                {isEditing ? (
                                                    <textarea 
                                                        className="w-full rounded-md border-gray-300 dark:border-slate-700 bg-transparent text-[11px] p-1.5 min-h-[80px] leading-tight"
                                                        value={editForm.tasks}
                                                        onChange={e => setEditForm({...editForm, tasks: e.target.value})}
                                                    />
                                                ) : (
                                                    <p className="text-[11px] leading-tight">
                                                        {role.tasks?.split(',').map(t => t.trim()).join(' • ')}
                                                    </p>
                                                )}
                                            </td>

                                            {/* OWNER */}
                                            <td className="px-3 py-2 align-top">
                                                {isEditing ? (
                                                    <div className="space-y-1 max-h-[120px] overflow-y-auto p-1.5 border rounded-md custom-scrollbar bg-white dark:bg-slate-800 shadow-sm">
                                                        {contractors.map(c => {
                                                            const isSelected = editForm.currentOwner?.includes(c.name);
                                                            return (
                                                                <div 
                                                                    key={c.id} 
                                                                    onClick={() => toggleOwner(c.name)}
                                                                    className={`flex items-center gap-2 text-[10px] p-1 rounded cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                                                                >
                                                                    <div className={`w-2.5 h-2.5 border rounded flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                                                                        {isSelected && <Check className="w-1.5 h-1.5 text-white" />}
                                                                    </div>
                                                                    {c.name}
                                                                </div>
                                                            );
                                                        })}
                                                         <div className="border-t my-1"></div>
                                                         <Input 
                                                            placeholder="Otro..." 
                                                            className="h-6 text-[10px]" 
                                                            value={editForm.currentOwner || ''}
                                                            onChange={e => setEditForm({...editForm, currentOwner: e.target.value})}
                                                         />
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1">
                                                        {role.currentOwner ? role.currentOwner.split(',').map((owner, i) => (
                                                            <Badge key={i} variant="outline" className="bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-700 shadow-sm text-[10px] px-1.5 py-0 h-5">
                                                                {owner.trim()}
                                                            </Badge>
                                                        )) : <span className="text-gray-400 italic text-[10px]">Sin asignar</span>}
                                                    </div>
                                                )}
                                            </td>

                                            {/* TRIGGER */}
                                            <td className="px-3 py-2 align-top">
                                                {isEditing ? (
                                                    <textarea 
                                                        className="w-full rounded-md border-gray-300 dark:border-slate-700 bg-transparent text-[11px] p-1.5 min-h-[50px] leading-tight"
                                                        value={editForm.hiringTrigger}
                                                        onChange={e => setEditForm({...editForm, hiringTrigger: e.target.value})}
                                                    />
                                                ) : (
                                                    <p className={`text-[11px] italic leading-snug ${role.hiringTrigger?.includes('PRIORIDAD') ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                                                        {role.hiringTrigger}
                                                    </p>
                                                )}
                                            </td>

                                            {/* ACTIONS */}
                                            <td className="px-3 py-2 align-top text-right">
                                                {isEditing ? (
                                                    <div className="flex flex-col gap-1 items-end">
                                                        <Button size="sm" variant="primary" onClick={saveEdit} className="h-6 w-6 p-0 rounded-full shadow-md"><Save className="w-3 h-3"/></Button>
                                                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-6 w-6 p-0 rounded-full text-gray-400 hover:bg-gray-100"><X className="w-3 h-3"/></Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-1 items-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button size="sm" variant="ghost" onClick={() => startEdit(role)} className="h-6 w-6 p-0 rounded-full hover:bg-indigo-50 hover:text-indigo-600"><Edit2 className="w-3 h-3"/></Button>
                                                        <Button size="sm" variant="ghost" onClick={() => handleDelete(role.id)} className="h-6 w-6 p-0 rounded-full hover:bg-red-50 hover:text-red-600"><Trash2 className="w-3 h-3"/></Button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                             </tbody>
                        </table>
                    </div>
                </div>
            );
        })}

        {processedRoles.length === 0 && (
             <div className="p-12 text-center border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl">
                 <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                 <p className="text-gray-500 font-medium">No se encontraron roles.</p>
                 <Button variant="ghost" onClick={() => setSearchTerm('')} className="mt-2 text-teal-600">Limpiar filtros</Button>
             </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Agregar Nuevo Rol">
          <div className="space-y-4">
              <div>
                  <label className="text-sm font-medium">Departamento</label>
                  <select 
                    className="w-full h-10 rounded-lg border px-3 mt-1"
                    value={newRole.department}
                    onChange={e => setNewRole({...newRole, department: e.target.value as any})}
                  >
                        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
              </div>
              <div>
                  <label className="text-sm font-medium">Nombre del Rol</label>
                  <Input 
                    value={newRole.roleName || ''} 
                    onChange={e => setNewRole({...newRole, roleName: e.target.value})} 
                    placeholder="Ej: Project Manager"
                  />
              </div>
              <div>
                  <label className="text-sm font-medium">Meta / Objetivo</label>
                  <textarea 
                    className="w-full rounded-lg border p-3 mt-1 text-sm h-20 bg-transparent"
                    value={newRole.description || ''}
                    onChange={e => setNewRole({...newRole, description: e.target.value})}
                    placeholder="¿Cuál es el propósito principal?"
                  />
              </div>
              <div className="flex justify-end pt-4">
                  <Button onClick={handleCreate}>Crear Rol</Button>
              </div>
          </div>
      </Modal>

    </div>
  );
}
