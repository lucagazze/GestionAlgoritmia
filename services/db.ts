
import { supabase } from './supabase';
import { Service, Proposal, Project, Task, ProjectStatus, ProposalStatus, TaskStatus, Contractor } from '../types';

// Utility to handle Supabase responses
const handleResponse = async <T>(query: any): Promise<T[]> => {
  const { data, error } = await query;
  if (error) {
    console.error('Supabase Error:', error);
    // Return empty array on error to prevent UI crash, but log it
    return [];
  }
  return data || [];
};

export const db = {
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
        notes: c.notes || ''
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

  tasks: {
    getAll: async (): Promise<Task[]> => {
      // 1. Try fetching tasks WITH Contractor details
      const { data, error } = await supabase
          .from('Task')
          .select('*, assignee:Contractor(*)')
          .order('created_at', { ascending: false });

      // 2. If it fails due to missing relationship (PGRST200), fallback to simple fetch
      if (error && error.code === 'PGRST200') {
          console.warn("⚠️ Relation Task -> Contractor missing in DB. Running fallback query (Tasks will load without assignees). Please run the SQL migration.");
          return handleResponse<Task>(
             supabase.from('Task').select('*').order('created_at', { ascending: false })
          );
      }

      // 3. Handle other errors
      if (error) {
          console.error('Supabase Error:', error);
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
        
        // 1. Create or Get Client
        let clientId = '';
        const { data: existingClient } = await supabase.from('Client').select('id, monthlyRevenue').ilike('name', clientName).maybeSingle();
        
        if (existingClient) {
            clientId = existingClient.id;
            // Update MRR if changed
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

        // 2. Create Proposal
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

        // 3. Create Proposal Items & Generate Tasks
        if (data.items && data.items.length > 0) {
            const itemsPayload = data.items.map(item => ({
                proposalId: newProposal.id,
                serviceId: item.serviceId,
                serviceSnapshotName: item.serviceSnapshotName,
                serviceSnapshotCost: item.serviceSnapshotCost
            }));
            
            const { error: itemsError } = await supabase.from('ProposalItem').insert(itemsPayload);
            if (itemsError) console.error("Error creating items", itemsError);

            // AUTOMATIC TASK GENERATION
            // We create a task for each service sold
            const tasksPayload = data.items.map(item => ({
                title: `Implementar: ${item.serviceSnapshotName}`,
                description: `Servicio vendido en propuesta. Cliente: ${clientName}. Objetivo: ${data.objective}`,
                status: TaskStatus.TODO,
                priority: 'HIGH', // New sales are high priority
                projectId: clientId 
            }));

            // Insert tasks one by one or bulk if supported by simple logic
            // Using a loop for safety to ensure all get inserted even if one fails
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
