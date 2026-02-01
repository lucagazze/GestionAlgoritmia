
import { supabase } from './supabase';
import { Service, Proposal, Project, Task, ProjectStatus, ProposalStatus, TaskStatus, Contractor, AgencySettings, ClientNote, AIChatLog, AIChatSession, SOP, AutomationRecipe, Deliverable, PortalMessage } from '../types';

// Utility to handle Supabase responses
const handleResponse = async <T>(query: any): Promise<T[]> => {
  const { data, error } = await query;
  if (error) {
    // Gracefully handle missing table error (PGRST205)
    if (error.code === 'PGRST205') {
        console.warn(`Table not found (PGRST205). Returning empty array. Query:`, query);
        return [];
    }
    console.error('Supabase Error:', error);
    return [];
  }
  return data || [];
};

interface UndoPayload {
    undoType: 'RESTORE_TASK' | 'DELETE_TASK' | 'DELETE_PROJECT' | 'RESTORE_TASKS';
    data: any;
    description: string;
}

// --- AUTOMATION ENGINE HELPER ---
const runAutomations = async (triggerType: 'PROJECT_STATUS_CHANGE' | 'NEW_PROJECT', project: Project, triggerValue?: string) => {
    try {
        console.log(`Checking automations for ${triggerType} on ${project.name}...`);
        
        // 1. Fetch active recipes
        const { data: recipes } = await supabase.from('Automation').select('*').eq('isActive', true).eq('triggerType', triggerType);
        
        if (!recipes || recipes.length === 0) return;

        for (const recipe of (recipes as AutomationRecipe[])) {
            // 2. Check Trigger Value (e.g. Status must match)
            if (recipe.triggerValue && recipe.triggerValue !== triggerValue) continue;

            // 3. Check Conditions (e.g. Industry must be SaaS)
            let conditionsMet = true;
            if (recipe.conditions && recipe.conditions.length > 0) {
                for (const cond of recipe.conditions) {
                    if (cond.field === 'industry') {
                        if (!project.industry?.toLowerCase().includes(cond.value.toLowerCase())) conditionsMet = false;
                    } else if (cond.field === 'monthlyRevenue') {
                        if (project.monthlyRevenue < parseFloat(cond.value)) conditionsMet = false;
                    }
                }
            }

            if (!conditionsMet) continue;

            // 4. Execute Actions
            console.log(`> Executing Recipe: ${recipe.name}`);
            for (const action of recipe.actions) {
                if (action.type === 'CREATE_TASK') {
                    const dueDate = new Date();
                    if (action.payload.delayDays) dueDate.setDate(dueDate.getDate() + action.payload.delayDays);
                    
                    await supabase.from('Task').insert({
                        title: action.payload.title,
                        description: `🤖 Generada por automatización: ${recipe.name}`,
                        priority: action.payload.priority,
                        status: TaskStatus.TODO,
                        projectId: project.id,
                        dueDate: action.payload.delayDays ? dueDate.toISOString() : null
                    });
                }
            }
        }
    } catch (e) {
        console.error("Automation Engine Error:", e);
    }
};


export const db = {
  // --- SETTINGS (For API Keys & Automation) ---
  settings: {
    getApiKey: async (keyName: string = 'google_api_key'): Promise<string | null> => {
        const { data, error } = await supabase.from('AgencySettings').select('value').eq('key', keyName).maybeSingle();
        if (error && error.code !== 'PGRST205') console.error("Error getting API Key:", error);
        return data?.value || null;
    },
    setApiKey: async (apiKey: string, keyName: string = 'google_api_key'): Promise<void> => {
        const { error } = await supabase.from('AgencySettings').upsert({ key: keyName, value: apiKey }, { onConflict: 'key' });
        if (error) throw error;
    },
    // AUTOMATION: Check and run recurring tasks
    checkAndRunRecurringTasks: async () => {
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        
        // 1. Check last run
        const { data: setting, error } = await supabase.from('AgencySettings').select('value').eq('key', 'last_recurring_run').maybeSingle();
        
        // Skip if table doesn't exist yet
        if (error && error.code === 'PGRST205') return;

        const lastRun = setting?.value;

        if (lastRun === currentMonth) return; // Already ran this month

        console.log("Running Monthly Automation...");

        // 2. Fetch Active Projects
        const { data: projects } = await supabase.from('Client').select('*').eq('status', ProjectStatus.ACTIVE);
        
        if (projects && projects.length > 0) {
            const newTasks = [];
            for (const p of projects) {
                // Default recurring tasks structure
                newTasks.push(
                    { title: `📊 Reporte Mensual: ${p.name}`, priority: 'HIGH', status: TaskStatus.TODO, projectId: p.id, description: 'Generar métricas y enviar al cliente.' },
                    { title: `📅 Planificación Contenido: ${p.name}`, priority: 'MEDIUM', status: TaskStatus.TODO, projectId: p.id, description: 'Definir estrategia del mes.' }
                );
            }
            
            // 3. Bulk Insert
            if (newTasks.length > 0) {
                await supabase.from('Task').insert(newTasks);
            }
        }

        // 4. Update Flag
        await supabase.from('AgencySettings').upsert({ key: 'last_recurring_run', value: currentMonth }, { onConflict: 'key' });
    }
  },

  // --- AUTOMATIONS CRUD ---
  automations: {
      getAll: async (): Promise<AutomationRecipe[]> => {
          return handleResponse<AutomationRecipe>(supabase.from('Automation').select('*'));
      },
      create: async (data: Omit<AutomationRecipe, 'id'>): Promise<AutomationRecipe> => {
          const { data: created, error } = await supabase.from('Automation').insert(data).select().single();
          if (error) throw error;
          return created;
      },
      update: async (id: string, data: Partial<AutomationRecipe>): Promise<void> => {
          const { error } = await supabase.from('Automation').update(data).eq('id', id);
          if (error) throw error;
      },
      delete: async (id: string): Promise<void> => {
          const { error } = await supabase.from('Automation').delete().eq('id', id);
          if (error) throw error;
      }
  },

  // --- KNOWLEDGE BASE (SOPs) ---
  sops: {
      getAll: async (): Promise<SOP[]> => {
          return handleResponse<SOP>(supabase.from('SOP').select('*').order('title', { ascending: true }));
      },
      create: async (data: Omit<SOP, 'id' | 'updatedAt'>): Promise<SOP> => {
          const { data: created, error } = await supabase.from('SOP').insert({ ...data, updatedAt: new Date().toISOString() }).select().single();
          if (error) throw error;
          return created;
      },
      update: async (id: string, data: Partial<SOP>): Promise<void> => {
          const { error } = await supabase.from('SOP').update({ ...data, updatedAt: new Date().toISOString() }).eq('id', id);
          if (error) throw error;
      },
      delete: async (id: string): Promise<void> => {
          const { error } = await supabase.from('SOP').delete().eq('id', id);
          if (error) throw error;
      }
  },

  // --- CLIENT PORTAL (Deliverables & Chat) ---
  portal: {
      getDeliverables: async (projectId: string): Promise<Deliverable[]> => {
          return handleResponse<Deliverable>(
              supabase.from('Deliverable').select('*').eq('projectId', projectId).order('createdAt', { ascending: false })
          );
      },
      createDeliverable: async (data: Omit<Deliverable, 'id' | 'createdAt' | 'status'>): Promise<Deliverable> => {
          const { data: created, error } = await supabase.from('Deliverable').insert({
              ...data, status: 'PENDING', createdAt: new Date().toISOString()
          }).select().single();
          if (error) throw error;
          return created;
      },
      updateDeliverable: async (id: string, data: Partial<Deliverable>): Promise<void> => {
          const { error } = await supabase.from('Deliverable').update(data).eq('id', id);
          if (error) throw error;
      },
      deleteDeliverable: async (id: string): Promise<void> => {
          const { error } = await supabase.from('Deliverable').delete().eq('id', id);
          if (error) throw error;
      },
      getMessages: async (projectId: string): Promise<PortalMessage[]> => {
          return handleResponse<PortalMessage>(
              supabase.from('PortalMessage').select('*').eq('projectId', projectId).order('createdAt', { ascending: true })
          );
      },
      sendMessage: async (data: Omit<PortalMessage, 'id' | 'createdAt' | 'readAt'>): Promise<PortalMessage> => {
          const { data: created, error } = await supabase.from('PortalMessage').insert({
              ...data, createdAt: new Date().toISOString()
          }).select().single();
          if (error) throw error;
          return created;
      }
  },

  // --- CHAT HISTORY & SESSIONS ---
  chat: {
      getSessions: async (): Promise<AIChatSession[]> => {
          return handleResponse<AIChatSession>(
              supabase.from('aichatsession').select('*').order('updated_at', { ascending: false })
          );
      },
      createSession: async (firstMessage: string): Promise<AIChatSession> => {
          const title = firstMessage.slice(0, 40) + (firstMessage.length > 40 ? '...' : '');
          const { data, error } = await supabase
              .from('aichatsession')
              .insert({ title, created_at: new Date().toISOString() })
              .select()
              .single();
          
          if (error) throw error;
          return data;
      },
      deleteSession: async (id: string): Promise<void> => {
          const { error } = await supabase.from('aichatsession').delete().eq('id', id);
          if (error) throw error;
      },
      getMessages: async (sessionId: string): Promise<AIChatLog[]> => {
          return handleResponse<AIChatLog>(
              supabase.from('aichatlog')
                      .select('*')
                      .eq('session_id', sessionId)
                      .order('created_at', { ascending: true })
          );
      },
      addMessage: async (sessionId: string, role: 'user' | 'assistant', content: string, actionData?: { type: string, payload: any }): Promise<void> => {
          const { error } = await supabase.from('aichatlog').insert({
              session_id: sessionId,
              role,
              content,
              created_at: new Date().toISOString(),
              action_type: actionData?.type || null,
              action_payload: actionData?.payload || null,
              is_undone: false
          });
          if (error) console.error("Error adding message:", error);

          await supabase.from('aichatsession').update({ updated_at: new Date().toISOString() }).eq('id', sessionId);
      },
      markUndone: async (messageId: string): Promise<void> => {
          await supabase.from('aichatlog').update({ is_undone: true }).eq('id', messageId);
      }
  },

  // --- BUSINESS ENTITIES (CamelCase per schema) ---

  services: {
    getAll: async (): Promise<Service[]> => {
      return handleResponse<Service>(supabase.from('Service').select('*'));
    },
    create: async (data: Omit<Service, 'id'>): Promise<Service> => {
      const { data: created, error } = await supabase.from('Service').insert(data).select().single();
      if (error) throw error;
      return created;
    },
    update: async (id: string, data: Partial<Service>): Promise<Service> => {
      const { data: updated, error } = await supabase.from('Service').update(data).eq('id', id).select().single();
      if (error) throw error;
      return updated;
    },
    delete: async (id: string): Promise<void> => {
      const { error } = await supabase.from('Service').delete().eq('id', id);
      if (error) throw error;
    }
  },
  
  projects: {
    getAll: async (): Promise<Project[]> => {
      const { data, error } = await supabase.from('Client').select('*');
      if (error) {
        console.error('Supabase Error (Client):', error);
        return [];
      }
      return (data || []).map((c: any) => ({
        ...c,
        status: c.status || ProjectStatus.ACTIVE,
        monthlyRevenue: c.monthlyRevenue || 0,
        billingDay: c.billingDay || 1,
        notes: c.notes || '',
        phone: c.phone || '',
        outsourcingCost: c.outsourcingCost || 0,
        assignedPartnerId: c.assignedPartnerId || null,
        proposalUrl: c.proposalUrl || '',
        healthScore: c.healthScore || 'GOOD',
        lastPaymentDate: c.lastPaymentDate || null,
        lastContactDate: c.lastContactDate || null,
        resources: c.resources || [],
        contacts: c.contacts || [],
        brandColors: c.brandColors || [],
        brandFonts: c.brandFonts || [],
        internalCost: c.internalCost || 0,
        publicToken: c.publicToken || '',
        progress: c.progress || 0,
        growthStrategy: c.growthStrategy || ''
      }));
    },
    getByToken: async (token: string): Promise<Project | null> => {
         const { data, error } = await supabase.from('Client').select('*').eq('publicToken', token).maybeSingle();
         if (error || !data) return null;
         return {
            ...data,
            status: data.status || ProjectStatus.ACTIVE,
            monthlyRevenue: data.monthlyRevenue || 0,
            billingDay: data.billingDay || 1,
            notes: data.notes || '',
            phone: data.phone || '',
            outsourcingCost: data.outsourcingCost || 0,
            healthScore: data.healthScore || 'GOOD',
            resources: data.resources || [],
            internalCost: data.internalCost || 0,
            publicToken: data.publicToken || '',
            progress: data.progress || 0,
            growthStrategy: data.growthStrategy || ''
         };
    },
    create: async (data: Partial<Project>): Promise<Project> => {
      const { data: created, error } = await supabase.from('Project').insert(data).select().single();
      if (error) throw error;

      // 🧠 AUTO-SAVE MEMORY
      db.documents.create(
          `Nuevo Proyecto: ${created.name}. Industria: ${created.industry || 'N/A'}. Fee mensual: $${created.monthlyRevenue || 0}. Estado: ${created.status}`,
          'PROJECT',
          created.id
      ).catch(e => console.warn('Failed to save project memory:', e));

      // Run automations for new projects
      await runAutomations('NEW_PROJECT', created);
      
      return created;
    },
    update: async (id: string, data: Partial<Project>): Promise<void> => {
      const { error } = await supabase.from('Client').update(data).eq('id', id);
      if (error) throw error;
      
      // Trigger Automation Engine (STATUS_CHANGE)
      if (data.status) {
          const { data: currentProject } = await supabase.from('Client').select('*').eq('id', id).single();
          if (currentProject) {
              await runAutomations('PROJECT_STATUS_CHANGE', currentProject, data.status);
          }
      }
    },
    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from('Client').delete().eq('id', id);
        if (error) throw error;
    }
  },

  clientNotes: {
      getByClient: async (clientId: string): Promise<ClientNote[]> => {
          return handleResponse<ClientNote>(
              supabase.from('ClientNote').select('*').eq('clientId', clientId).order('createdAt', { ascending: false })
          );
      },
      create: async (data: Omit<ClientNote, 'id' | 'createdAt'>): Promise<void> => {
          const { error } = await supabase.from('ClientNote').insert({ ...data, createdAt: new Date().toISOString() });
          if (error) throw error;
          await supabase.from('Client').update({ lastContactDate: new Date().toISOString() }).eq('id', data.clientId);
      }
  },

  tasks: {
    getAll: async (): Promise<Task[]> => {
      const { data, error } = await supabase.from('Task').select('*, assignee:Contractor(*)').order('created_at', { ascending: false });
      if (error) { console.error('Supabase Error (Task):', error); return []; }
      return data as Task[];
    },
    create: async (data: Partial<Task>): Promise<Task> => {
      const { data: created, error } = await supabase.from('Task').insert(data).select().single();
      if (error) throw error;
      
      // 🧠 AUTO-SAVE MEMORY (fire and forget - don't block UI)
      db.documents.create(
          `Nueva Tarea: ${created.title}. ${created.description || 'Sin descripción'}. Estado: ${created.status}. Fecha: ${created.dueDate || 'Sin fecha'}`,
          'TASK',
          created.id
      ).catch(e => console.warn('Failed to save task memory:', e));
      
      return created;
    },
    updateStatus: async (id: string, status: TaskStatus): Promise<void> => {
      const { error } = await supabase.from('Task').update({ status }).eq('id', id);
      if (error) throw error;
    },
    update: async (id: string, data: Partial<Task>): Promise<void> => {
        const { error } = await supabase.from('Task').update(data).eq('id', id);
        if (error) throw error;
    },
    delete: async (id: string): Promise<void> => {
      const { error } = await supabase.from('Task').delete().eq('id', id);
      if (error) throw error;
    },
    deleteMany: async (ids: string[]): Promise<void> => {
      const { error } = await supabase.from('Task').delete().in('id', ids);
      if (error) throw error;
    },
    getMany: async (ids: string[]): Promise<Task[]> => {
      const { data, error } = await supabase.from('Task').select('*, assignee:Contractor(*)').in('id', ids);
      if (error) return [];
      return data as Task[];
    }
  },

  proposals: {
    create: async (data: Omit<Proposal, 'id' | 'createdAt' | 'clientId'>, clientName: string, industry?: string): Promise<Proposal> => {
        let clientId = '';
        const { data: existingClient } = await supabase.from('Client').select('id, monthlyRevenue').ilike('name', clientName).maybeSingle();
        
        if (existingClient) {
            clientId = existingClient.id;
            await supabase.from('Client').update({ monthlyRevenue: data.totalRecurringPrice }).eq('id', clientId);
        } else {
            const { data: newClient, error: clientError } = await supabase.from('Client').insert({
                name: clientName,
                industry: industry || '',
                createdAt: new Date().toISOString(),
                status: ProjectStatus.ONBOARDING,
                monthlyRevenue: data.totalRecurringPrice,
                billingDay: 1
            }).select().single();
            if (clientError) throw clientError;
            clientId = newClient.id;
            
            // Trigger Automation for Proposal -> Client creation
            await runAutomations('NEW_PROJECT', newClient, undefined);
        }

        const proposalPayload = {
            clientId,
            status: data.status,
            objective: data.objective,
            durationMonths: data.durationMonths,
            totalOneTimePrice: data.totalOneTimePrice,
            totalRecurringPrice: data.totalRecurringPrice,
            totalContractValue: data.totalContractValue,
            aiPromptGenerated: data.aiPromptGenerated,
            createdAt: new Date().toISOString()
        };

        const { data: newProposal, error: proposalError } = await supabase.from('Proposal').insert(proposalPayload).select().single();
        if (proposalError) throw proposalError;

        if (data.items && data.items.length > 0) {
            const itemsPayload = data.items.map(item => ({
                proposalId: newProposal.id,
                serviceId: item.serviceId,
                serviceSnapshotName: item.serviceSnapshotName,
                serviceSnapshotCost: item.serviceSnapshotCost
            }));
            const { error: itemsError } = await supabase.from('ProposalItem').insert(itemsPayload);
            if (itemsError) console.error("Error creating items", itemsError);

            const tasksPayload = data.items.map(item => ({
                title: `Implementar: ${item.serviceSnapshotName}`,
                description: `Servicio vendido en propuesta. Cliente: ${clientName}. Objetivo: ${data.objective}`,
                status: TaskStatus.TODO,
                priority: 'HIGH', 
                projectId: clientId 
            }));

            for (const task of tasksPayload) {
                 const { error: taskError } = await supabase.from('Task').insert(task);
                 if (taskError) console.error("Error auto-creating task", taskError);
            }
        }
        return newProposal;
    },
    getAll: async (): Promise<Proposal[]> => {
         const { data, error } = await supabase.from('Proposal').select(`*, client:Client(*)`).order('createdAt', { ascending: false });
         if (error) throw error;
         return data as Proposal[];
    }
  },

  contractors: {
    getAll: async (): Promise<Contractor[]> => {
      return handleResponse<Contractor>(supabase.from('Contractor').select('*').then(res => ({
          ...res,
          data: res.data?.map((c: any) => ({ ...c, monthlyRate: c.hourlyRate || 0 }))
      })));
    },
    create: async (data: Omit<Contractor, 'id' | 'created_at'>): Promise<Contractor> => {
      const payload = { ...data, hourlyRate: data.monthlyRate };
      const { data: created, error } = await supabase.from('Contractor').insert(payload).select().single();
      if (error) throw error;
      return { ...created, monthlyRate: created.hourlyRate };
    },
    delete: async (id: string): Promise<void> => {
      const { error } = await supabase.from('Contractor').delete().eq('id', id);
      if (error) throw error;
    },
  },

  // --- VECTOR MEMORY (RAG) ---
  documents: {
      /**
       * Store a memory with vector embedding
       * @param content - Text content to remember
       * @param type - Type of memory (TASK, PROJECT, CHAT, etc.)
       * @param relatedId - Optional ID of related entity
       */
      create: async (content: string, type: string, relatedId?: string) => {
          try {
              // Import ai dynamically to avoid circular dependency
              const { ai } = await import('./ai');
              
              // 1. Generate vector embedding
              const embedding = await ai.embed(content);
              if (!embedding) {
                  console.warn("Failed to generate embedding for:", content.slice(0, 50));
                  return;
              }

              // 2. Store in Supabase
              const { error } = await supabase.from('documents').insert({
                  content,
                  metadata: { type, relatedId },
                  embedding
              });
              
              if (error) console.error("Error saving memory:", error);
          } catch (error) {
              console.error("Error in documents.create:", error);
          }
      },

      /**
       * Search for similar memories using vector similarity
       * @param vector - Query embedding vector
       * @param threshold - Similarity threshold (0-1, default 0.5)
       * @param limit - Max results (default 5)
       */
      search: async (vector: number[], threshold = 0.5, limit = 5) => {
          try {
              const { data, error } = await supabase.rpc('match_documents', {
                  query_embedding: vector,
                  match_threshold: threshold,
                  match_count: limit
              });
              
              if (error) {
                  console.error("Error searching memory:", error);
                  return [];
              }
              
              return data || [];
          } catch (error) {
              console.error("Error in documents.search:", error);
              return [];
          }
      }
  }
};
