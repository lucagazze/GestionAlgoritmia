// Multi-Task Parser - Detects patterns and expands into multiple tasks
export const parseMultiTaskRequest = (userText: string, aiResponse: any): any => {
    // If AI already returned BATCH, use it
    if (aiResponse?.type === 'BATCH') return aiResponse;
    
    // If AI returned single CREATE_TASK, check if we should expand it
    if (aiResponse?.type === 'ACTION' && aiResponse?.action === 'CREATE_TASK') {
        const text = userText.toLowerCase();
        
        // Pattern 1: "lunes a viernes" or "monday to friday"
        const weekdayPattern = /(lunes a viernes|monday to friday|de lunes a viernes)/i;
        const hasWeekdays = weekdayPattern.test(text);
        
        // Pattern 2: Time range "de 8 a 14:30" or "from 8 to 2:30"
        const timeRangePattern = /(de|from|entre)\s+(\d{1,2}(?::\d{2})?)\s+(a|to|y)\s+(\d{1,2}(?::\d{2})?)/i;
        const timeMatch = text.match(timeRangePattern);
        
        // Pattern 3: Multiple requests "Y también..." or "Y poneme"
        const multiplePattern = /y\s+(también|tambien|poneme)/i;
        const hasMultiple = multiplePattern.test(text);
        
        if (hasWeekdays || hasMultiple) {
            console.log('🔍 DETECTED MULTI-TASK PATTERN');
            
            // Parse the request into separate task descriptions
            const tasks = [];
            const segments = text.split(/\.\s+y\s+(también|tambien|poneme)/i).filter(s => s && s.length > 10);
            
            for (const segment of segments) {
                const isWeekdayTask = weekdayPattern.test(segment);
                
                if (isWeekdayTask) {
                    // Generate 5 tasks (Mon-Fri)
                    const baseDate = new Date();
                    const nextMonday = new Date(baseDate);
                    nextMonday.setDate(baseDate.getDate() + ((1 + 7 - baseDate.getDay()) % 7 || 7));
                    
                    for (let i = 0; i < 5; i++) {
                        const taskDate = new Date(nextMonday);
                        taskDate.setDate(nextMonday.getDate() + i);
                        
                        // Extract time from segment
                        let startTime = '08:00';
                        let endTime = null;
                        
                        const timeMatch = segment.match(timeRangePattern);
                        if (timeMatch) {
                            startTime = timeMatch[2].includes(':') ? timeMatch[2] : `${timeMatch[2]}:00`;
                            endTime = timeMatch[4].includes(':') ? timeMatch[4] : `${timeMatch[4]}:00`;
                            
                            // Handle "dos y media" = 14:30
                            if (endTime === '2:00' && segment.includes('media')) endTime = '14:30';
                        }
                        
                        // Extract title
                        let title = 'Trabajar';
                        const titleMatch = segment.match(/(trabajar|caminar|reunión|meeting)/i);
                        if (titleMatch) {
                            title = titleMatch[1].charAt(0).toUpperCase() + titleMatch[1].slice(1);
                        }
                        
                        const [startHour, startMin] = startTime.split(':');
                        taskDate.setHours(parseInt(startHour), parseInt(startMin), 0);
                        
                        const task = {
                            action: 'CREATE_TASK',
                            payload: {
                                title,
                                dueDate: taskDate.toISOString(),
                                endTime: endTime ? (() => {
                                    const endDate = new Date(taskDate);
                                    const [endHour, endMin] = endTime.split(':');
                                    endDate.setHours(parseInt(endHour), parseInt(endMin), 0);
                                    return endDate.toISOString();
                                })() : undefined,
                                priority: 'MEDIUM',
                                status: 'TODO'
                            }
                        };
                        tasks.push(task);
                    }
                } else {
                    // Single task
                    const task = { ...aiResponse };
                    
                    // Add endTime if time range detected
                    if (timeMatch) {
                        const endTime = timeMatch[4].includes(':') ? timeMatch[4] : `${timeMatch[4]}:00`;
                        if (task.payload && task.payload.dueDate) {
                            const endDate = new Date(task.payload.dueDate);
                            const [endHour, endMin] = endTime.split(':');
                            endDate.setHours(parseInt(endHour), parseInt(endMin), 0);
                            task.payload.endTime = endDate.toISOString();
                        }
                    }
                    
                    tasks.push(task);
                }
            }
            
            if (tasks.length > 1) {
                return {
                    type: 'BATCH',
                    actions: tasks,
                    message: `✅ Creé **${tasks.length} tareas** según tu solicitud.`
                };
            }
        }
    }
    
    return aiResponse;
};
