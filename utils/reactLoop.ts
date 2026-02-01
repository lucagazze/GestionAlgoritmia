// ReAct Loop Controller
// Handles multi-step AI reasoning and action execution

import { db } from '../services/db';
import { ai } from '../services/ai';

export interface ReActIteration {
    thought: string;
    action?: string;
    actionPayload?: any;
    observation?: string;
    iteration: number;
}

export async function executeReActLoop(
    userRequest: string,
    sessionId: string,
    contextData: any,
    maxIterations: number = 5
): Promise<{ success: boolean; message: string; iterations: ReActIteration[] }> {
    
    const iterations: ReActIteration[] = [];
    let context: any[] = await db.chat.getMessages(sessionId);
    
    for (let i = 0; i < maxIterations; i++) {
        console.log(`🔄 ReAct Iteration ${i + 1}/${maxIterations}`);
        
        // Call AI agent with accumulated context
        const response = await ai.agent(
            i === 0 ? userRequest : "Continue with the next step based on previous results",
            context,
            contextData
        );
        
        if (!response) {
            return {
                success: false,
                message: "AI failed to respond",
                iterations
            };
        }
        
        // Check response type
        if (response.type === 'REASONING') {
            // AI is thinking and planning next action
            const iteration: ReActIteration = {
                thought: response.thought || response.message,
                action: response.nextAction?.action,
                actionPayload: response.nextAction?.payload,
                iteration: i + 1
            };
            
            console.log(`💭 Thought: ${iteration.thought}`);
            console.log(`⚡ Action: ${iteration.action}`);
            
            // Execute the action
            if (response.nextAction) {
                const result = await executeAction(
                    response.nextAction.action,
                    response.nextAction.payload
                );
                
                iteration.observation = result.success 
                    ? `Success: ${JSON.stringify(result.data || result.message)}`
                    : `Error: ${result.error}`;
                
                console.log(`👁️ Observation: ${iteration.observation}`);
                
                // Add observation to context for next iteration
                context.push({
                    role: 'system',
                    content: `Previous action result: ${iteration.observation}`
                });
            }
            
            iterations.push(iteration);
            
        } else if (response.type === 'CHAT' || response.type === 'ACTION' || response.type === 'BATCH') {
            // AI has finished reasoning and provided final answer
            console.log(`✅ ReAct Loop Complete after ${i + 1} iterations`);
            
            iterations.push({
                thought: "Task completed",
                iteration: i + 1,
                observation: response.message
            });
            
            return {
                success: true,
                message: response.message || "Task completed successfully",
                iterations
            };
        } else if (response.type === 'QUESTION') {
            // AI needs more info from user
            return {
                success: false,
                message: response.message,
                iterations
            };
        }
    }
    
    // Max iterations reached
    return {
        success: false,
        message: `⚠️ Reached maximum iterations (${maxIterations}). Task may be incomplete.`,
        iterations
    };
}

// Helper function to execute actions
async function executeAction(action: string, payload: any): Promise<any> {
    try {
        switch (action) {
            case 'QUERY_DATABASE':
                return await queryDatabase(payload);
            
            case 'CREATE_TASK':
                const task = await db.tasks.create(payload);
                return { success: true, data: task };
            
            case 'SEND_PORTAL_MESSAGE':
                const message = await db.portal.sendMessage(payload);
                return { success: true, data: message };
            
            case 'UPDATE_PROJECT':
                await db.projects.update(payload.id, payload);
                return { success: true, message: "Project updated" };
            
            default:
                return { success: false, error: `Unknown action: ${action}` };
        }
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Query database helper
async function queryDatabase(payload: any): Promise<any> {
    const { table, filter, limit = 50 } = payload;
    
    try {
        let data: any[] = [];
        
        switch (table) {
            case 'Project':
            case 'projects':
                data = await db.projects.getAll();
                break;
            case 'Task':
            case 'tasks':
                data = await db.tasks.getAll();
                break;
            case 'Contractor':
            case 'contractors':
                data = await db.contractors.getAll();
                break;
            default:
                return { success: false, error: `Unknown table: ${table}` };
        }
        
        // Apply filters if specified
        if (filter) {
            if (filter.status) {
                data = data.filter((item: any) => item.status === filter.status);
            }
            if (filter.overdue) {
                const now = new Date();
                data = data.filter((item: any) => {
                    const dueDate = item.billingDay || item.dueDate;
                    return dueDate && new Date(dueDate) < now;
                });
            }
        }
        
        // Limit results
        data = data.slice(0, limit);
        
        return {
            success: true,
            data,
            message: `Found ${data.length} results`
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
