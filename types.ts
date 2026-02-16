
export enum ServiceType {
  ONE_TIME = 'ONE_TIME',
  RECURRING = 'RECURRING',
}

export enum ProposalStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  ACCEPTED = 'ACCEPTED',
  PARTIALLY_ACCEPTED = 'PARTIALLY_ACCEPTED', // ✅ NUEVO
  REJECTED = 'REJECTED',
}

export enum ProjectStatus {
  // Sales Stages
  LEAD = 'LEAD',
  DISCOVERY = 'DISCOVERY',
  PROPOSAL = 'PROPOSAL',
  NEGOTIATION = 'NEGOTIATION',
  LOST = 'LOST',

  // Delivery Stages
  ONBOARDING = 'ONBOARDING', // Won
  ACTIVE = 'ACTIVE', // Pagando mensualmente
  COMPLETED = 'COMPLETED', // Terminado (One-time)
  PAUSED = 'PAUSED', // Pausado
  ARCHIVED = 'ARCHIVED' // ✅ NUEVO
}

export enum TaskStatus {
  TODO = 'TODO',
  DONE = 'DONE',
}

export type ClientHealth = 'GOOD' | 'RISK' | 'CRITICAL';

export interface ProjectResource {
  id: string;
  name: string;
  url: string;
  type: 'DRIVE' | 'FIGMA' | 'ACCESS' | 'CONTRACT' | 'OTHER';
}

export interface ProjectContact {
  id: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
}

export interface Service {
  id: string;
  name: string;
  category: string;
  type: ServiceType;
  baseCost: number;
  description?: string;
}

export interface Client {
  id: string;
  name: string;
  industry?: string;
  email?: string;
  phone?: string; 
  location?: string;
  createdAt: Date;
}

export interface Project extends Client {
  status: ProjectStatus;
  monthlyRevenue: number;
  billingDay: number; 
  nextBillingDate?: string; 
  notes?: string;
  
  assignedPartnerId?: string; 
  outsourcingCost?: number;   
  proposalUrl?: string;       
  
  partnerName?: string;       
  
  // CRM Features
  healthScore?: ClientHealth;
  lastPaymentDate?: string;
  contractEndDate?: string; // ✅ NUEVO: Fecha fin de contrato para auto-pause
  lastContactDate?: string;   // Ghosting Monitor
  resources?: ProjectResource[];
  contacts?: ProjectContact[];

  // Brand Kit Features
  brandColors?: string[];     // Hex codes
  brandFonts?: string[];      // Font names

  // Profitability & Portal Features
  internalCost?: number;        // Costo fijo interno mensual (Suscripciones, equipo base)
  publicToken?: string;         // Token único para el link público
  progress?: number;            // 0 a 100 para la barra de estado del cliente
  
  // Growth
  growthStrategy?: string;      // Texto de estrategia
  serviceDetails?: string;      // Detalle del servicio (ej: "Community Manager + Ads")

  // ✅ NUEVO: Contexto Estratégico (Vienen de ClientProfile)
  targetAudience?: string;    // Público Objetivo
  contextProblem?: string;    // Situación Actual (Dolores)
  contextObjectives?: string; // Objetivo Principal
}

export interface Contractor {
  id: string;
  name: string;
  role: string;
  hourlyRate: number; // ✅ FIXED: Coincide con la DB (antes 'monthlyRate')
  email?: string;
  phone?: string; 
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  projectId?: string;
  dueDate?: string; // Start time
  endTime?: string; // End time (optional)
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  assigneeId?: string;
  assignee?: Contractor; 
  created_at?: string;
  sopId?: string; // New: Link to SOP
  googleEventId?: string; // ID del evento en Google Calendar
}

export interface ClientNote {
    id: string;
    clientId: string;
    content: string;
    type: 'MEETING' | 'NOTE' | 'CALL' | 'PAYMENT' | 'PROGRESS' | 'INFO';
    createdAt: string;
}

export interface ProposalItem {
  id: string;
  serviceId: string;
  serviceSnapshotName: string;
  serviceSnapshotDescription?: string;
  serviceSnapshotType?: 'ONE_TIME' | 'RECURRING';
  serviceSnapshotCost: number;
  
  // ✅ CONTRACTOR ASSIGNMENT FIELDS
  assignedContractorId?: string; // Who will do the work
  outsourcingCost?: number;      // How much we pay them (Cost)
}

export interface Proposal {
  id: string;
  clientId: string;
  client?: Client;
  status: ProposalStatus;
  objective: string;
  targetAudience?: string;
  currentSituation?: string;
  durationMonths: number;
  validityPeriod?: number; // Days valid from createdAt (default 15)
  totalOneTimePrice: number;
  totalRecurringPrice: number;
  totalContractValue: number;
  aiPromptGenerated: string;
  items: ProposalItem[];
  createdAt: Date;
}

export interface AgencySettings {
  id: string;
  key: string;   
  value: string; 
}

export interface AIChatSession {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
}

export interface AIChatLog {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  
  action_type?: string;     
  action_payload?: any;     
  is_undone?: boolean;      
}

export interface SOP {
    id: string;
    title: string;
    category: 'SALES' | 'ONBOARDING' | 'FULFILLMENT' | 'ADMIN' | 'OTHER';
    content: string;
    updatedAt: string;
}

export interface AutomationRecipe {
    id: string;
    name: string;
    triggerType: 'PROJECT_STATUS_CHANGE' | 'NEW_PROJECT';
    triggerValue?: string; // e.g., 'ACTIVE' or 'ONBOARDING'
    conditions: {
        field: 'industry' | 'monthlyRevenue';
        operator: 'contains' | 'greater_than' | 'equals';
        value: string;
    }[];
    actions: {
        type: 'CREATE_TASK';
        payload: {
            title: string;
            priority: 'HIGH' | 'MEDIUM' | 'LOW';
            delayDays?: number; // Due date offset
            assigneeRole?: string; // e.g. "Auto assign to Media Buyer" (future)
        }
    }[];
    isActive: boolean;
}

export type DeliverableStatus = 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED';

export interface Deliverable {
    id: string;
    projectId: string;
    name: string;
    url: string;
    status: DeliverableStatus;
    feedback?: string;
    createdAt: string;
}

export interface PortalMessage {
    id: string;
    projectId: string;
    sender: 'AGENCY' | 'CLIENT';
    content: string;
    readAt?: string;
    createdAt: string;
}

export type ServiceCategory = 'Web & Tech' | 'Branding' | 'Contenido' | 'Ads / Tráfico' | 'Automatización' | 'Consultoría';

export interface Payment {
    id: string;
    clientId: string;
    client?: Client;
    amount: number;
    date: string;
    notes?: string;
    type?: 'FULL' | 'PARTIAL';
    metadata?: any; // Stores snapshot of services/proposal at time of payment
    createdAt: string;
}

export interface Role {
    id: string;
    department: 'DIRECCIÓN' | 'VENTAS' | 'OPERACIONES' | 'DESARROLLO' | 'MARKETING' | 'CONTENIDO' | 'ADMIN';
    roleName: string;
    description: string; // ¿Para qué sirve? (La Meta)
    tasks: string; // Tareas del Día a Día
    currentOwner: string; // ¿Quién lo hace HOY?
    hiringTrigger: string; // ¿Cuándo contratar? (Señal de Alerta)
    priority?: 'ALTA' | 'MEDIA' | 'BAJA';
}

export interface ContentIdea {
  id: string;
  title: string;
  concept: string; // Contexto / Idea general
  hook?: string; // Gancho (3 seg)
  script?: string; // Guion desarrollado
  visuals?: string; // Descripción visual
  platform?: 'Instagram' | 'TikTok' | 'YouTube' | 'LinkedIn';
  contentType: 'POST' | 'AD'; // ✅ NUEVO: Publicidad o Posteo
  status: 'IDEA' | 'SCRIPTED' | 'FILMED' | 'EDITED' | 'POSTED';
  scheduledDate?: string;
  createdAt: string;
}

export interface ContractorPayment {
    id: string;
    contractor_id: string;
    client_id?: string;
    amount: number;
    date: string;
    description?: string;
    created_at: string;
}
