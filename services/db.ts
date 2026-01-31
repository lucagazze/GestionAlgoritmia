
import { supabase } from './supabase';
import { Service, Proposal, Project, Task, ProjectStatus, ProposalStatus, TaskStatus, Contractor, AgencySettings, ClientNote, AIChatLog, AIChatSession } from '../types';

// Utility to handle Supabase responses
const handleResponse = async <T>(query: any): Promise<T[]> => {
  const { data, error } = await query;
  if (error) {
    console.error('Supabase Error:', error);
    return [];
  }
  return data || [];
};

export const db = {
  // --- SETTINGS (For API Keys) ---
  // Table: AgencySettings (CamelCase)
  settings: {
    getApiKey: async (): Promise<string | null> => {
        const { data, error } = await supabase
            .from('AgencySettings') 
            .select('value')
            .eq('key', 'openai_api_key')
            .maybeSingle();
        
        if (error) console.error("Error getting API Key:", error);
        return data?.value || null;
    },
    setApiKey: async (apiKey: string): Promise<void> => {
        // Usamos UPSERT que es mucho más robusto para configuraciones
        // Requiere que la columna 'key' tenga la constraint UNIQUE en la BD (que ya la tiene)
        const { error } = await supabase
            .from('AgencySettings')
            .upsert(
                { key: 'openai_api_key', value: apiKey }, 
                { onConflict: 'key' }
            );

        if (error) {
            console.error("Error saving API Key:", error);
            throw error;
        }
    }
  },

  // --- CHAT HISTORY & SESSIONS ---
  // Tables: aichatsession, aichatlog (Lowercase per schema)
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
      // NOTE: Using 'Client' table for Projects as per typical agency structure mapping
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
        proposalUrl: c.proposalUrl || ''
      }));
    },
    create: async (data: Omit<Project, 'id' | 'createdAt'>): Promise<Project> => {
       const payload = { ...data, createdAt: new Date().toISOString() };
       const { data: created, error } = await supabase.from('Client').insert(payload).select().single();
       if (error) throw error;
       return created;
    },
    update: async (id: string, data: Partial<Project>): Promise<void> => {
      const { error } = await supabase.from('Client').update(data).eq('id', id);
      if (error) throw error;
    },
    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from('Client').delete().eq('id', id);
        if (error) throw error;
    }
  },

  clientNotes: {
      getByClient: async (clientId: string): Promise<ClientNote[]> => {
          // Assuming 'ClientNote' table follows CamelCase convention if it exists
          // If this errors, the table might be missing or lowercase.
          return handleResponse<ClientNote>(
              supabase.from('ClientNote').select('*').eq('clientId', clientId).order('createdAt', { ascending: false })
          );
      },
      create: async (data: Omit<ClientNote, 'id' | 'createdAt'>): Promise<void> => {
          const { error } = await supabase.from('ClientNote').insert({
              ...data,
              createdAt: new Date().toISOString()
          });
          if (error) throw error;
      }
  },

  tasks: {
    getAll: async (): Promise<Task[]> => {
      // Use explicit relationship syntax if needed, but standard should work
      const { data, error } = await supabase
          .from('Task')
          .select('*, assignee:Contractor(*)')
          .order('created_at', { ascending: false });

      if (error) {
          console.error('Supabase Error (Task):', error);
          return [];
      }
      return data as Task[];
    },
    create: async (data: Partial<Task>): Promise<Task> => {
      const { data: created, error } = await supabase.from('Task').insert(data).select().single();
      if (error) throw error;
      return created;
    },
    updateStatus: async (id: string, status: TaskStatus): Promise<void> => {
      const { error } = await supabase.from('Task').update({ status }).eq('id', id);
      if (error) throw error;
    },
    delete: async (id: string): Promise<void> => {
      const { error } = await supabase.from('Task').delete().eq('id', id);
      if (error) throw error;
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
        }

        const proposalPayload = {
            clientId,
            status: data.status,
            objective: data.objective,
            durationMonths: data.durationMonths,
            marginMultiplier: data.marginMultiplier,
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
         const { data, error } = await supabase
            .from('Proposal')
            .select(`*, client:Client(*)`)
            .order('createdAt', { ascending: false });
         if (error) throw error;
         return data as Proposal[];
    }
  },

  contractors: {
    getAll: async (): Promise<Contractor[]> => {
      return handleResponse<Contractor>(supabase.from('Contractor').select('*'));
    },
    create: async (data: Omit<Contractor, 'id' | 'created_at'>): Promise<Contractor> => {
      const { data: created, error } = await supabase.from('Contractor').insert(data).select().single();
      if (error) throw error;
      return created;
    },
    delete: async (id: string): Promise<void> => {
      const { error } = await supabase.from('Contractor').delete().eq('id', id);
      if (error) throw error;
    }
  }
};
