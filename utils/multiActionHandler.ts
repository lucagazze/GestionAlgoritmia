// Multi-Action Response Handler
// Handles multiple function calls from AI with progress tracking

interface ExecutionResult {
    action: string;
    success: boolean;
    data?: any;
    message?: string;
    error?: string;
    navigate?: string;
}

/**
 * Handles multiple AI actions with progress tracking and summary generation
 * @param actions - Array of actions to execute
 * @param sessionId - Current chat session ID
 * @returns Execution summary
 */
export async function handleMultiActionResponse(
    actions: Array<{ action: string; payload: any }>,
    sessionId: string,
    executeAction: (action: string, payload: any) => Promise<any>,
    setProgress: (progress: any) => void,
    navigate: (path: string) => void
): Promise<string> {
    
    const results: ExecutionResult[] = [];
    
    // Show initial progress
    setProgress({
        total: actions.length,
        current: 0,
        status: 'executing',
        currentAction: actions[0]?.action
    });
    
    // Determine execution mode
    const hasNavigation = actions.some(a => a.action === 'NAVIGATE_TO' || a.action === 'OPEN_PROJECT' || a.action === 'OPEN_TASK');
    const hasDependencies = actions.some(a => a.action === 'QUERY_DATABASE' || a.action === 'SEND_PORTAL_MESSAGE');
    
    const executionMode = hasDependencies ? 'sequential' : 'parallel';
    
    if (executionMode === 'parallel' && !hasDependencies) {
        // Execute all actions in parallel (for independent actions)
        const promises = actions.map(async (action, index) => {
            try {
                const result = await executeAction(action.action, action.payload);
                
                setProgress((prev: any) => ({
                    ...prev,
                    current: prev.current + 1,
                    currentAction: actions[index + 1]?.action
                }));
                
                return {
                    action: action.action,
                    success: result.success,
                    data: result.data,
                    message: result.message,
                    error: result.error,
                    navigate: result.navigate
                };
            } catch (error: any) {
                return {
                    action: action.action,
                    success: false,
                    error: error.message
                };
            }
        });
        
        const parallelResults = await Promise.all(promises);
        results.push(...parallelResults);
        
    } else {
        // Execute sequentially (for dependent actions)
        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];
            
            setProgress((prev: any) => ({
                ...prev,
                current: i,
                currentAction: action.action
            }));
            
            try {
                const result = await executeAction(action.action, action.payload);
                
                results.push({
                    action: action.action,
                    success: result.success,
                    data: result.data,
                    message: result.message,
                    error: result.error,
                    navigate: result.navigate
                });
                
                // If action failed and it's critical, stop execution
                if (!result.success && hasDependencies) {
                    console.warn(`Action ${action.action} failed, stopping execution`);
                    break;
                }
                
            } catch (error: any) {
                results.push({
                    action: action.action,
                    success: false,
                    error: error.message
                });
                
                if (hasDependencies) break;
            }
        }
    }
    
    // Handle navigation if any action requested it
    const navigationResult = results.find(r => r.navigate);
    if (navigationResult && navigationResult.navigate) {
        setTimeout(() => navigate(navigationResult.navigate!), 500);
    }
    
    // Update progress to summarizing
    setProgress((prev: any) => ({
        ...prev,
        status: 'summarizing'
    }));
    
    // Generate summary
    const summary = generateExecutionSummary(results);
    
    // Complete
    setProgress((prev: any) => ({
        ...prev,
        status: 'complete'
    }));
    
    // Clear progress after delay
    setTimeout(() => setProgress(null), 2000);
    
    return summary;
}

/**
 * Generates a human-readable summary of execution results with bullet points
 */
function generateExecutionSummary(results: ExecutionResult[]): string {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    if (failed.length === 0) {
        // All successful
        if (successful.length === 1) {
            return successful[0].message || '✅ Acción completada exitosamente';
        }
        
        // Multiple successful actions - Use Markdown List
        const summaryLines = successful.map(r => {
            if (r.message) return `- ${r.message.replace(/^✅\s*/, '')}`; // Remove checkmark if present as we add it to header
            const actionName = formatActionName(r.action);
            return `- ${capitalize(actionName)} completada`;
        });
        
        return `✅ **Completé ${successful.length} acciones:**\n${summaryLines.join('\n')}`;
    } else {
        // Some failures
        return `⚠️ **Resumen de ejecución:**\n- ✅ ${successful.length} exitosas\n- ❌ ${failed.length} fallidas\n\n${failed.map(f => `- Error en ${formatActionName(f.action)}: ${f.error}`).join('\n')}`;
    }
}

function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Formats action name for display
 */
function formatActionName(action: string): string {
    const names: Record<string, string> = {
        'CREATE_TASK': 'tarea',
        'UPDATE_TASK': 'actualización',
        'DELETE_TASK': 'eliminación',
        'CREATE_PROJECT': 'proyecto',
        'ADD_CLIENT_NOTE': 'nota',
        'NAVIGATE_TO': 'navegación',
        'CREATE_SOP': 'SOP'
    };
    
    return names[action] || action.toLowerCase();
}
