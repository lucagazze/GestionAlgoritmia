import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../../services/db';
import { Project, ProjectStatus, Contractor } from '../../types';

export const useProjects = () => {
    const queryClient = useQueryClient();

    const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
        queryKey: ['projects'],
        queryFn: async () => {
            const data = await db.projects.getAll();
            // Filter out archived projects immediately
            return data.filter((p: Project) => p.status !== ProjectStatus.ARCHIVED);
        },
    });

    const { data: contractors = [], isLoading: isLoadingContractors } = useQuery({
        queryKey: ['contractors'],
        queryFn: () => db.contractors.getAll(),
    });

    const createProjectMutation = useMutation({
        mutationFn: (newProject: any) => db.projects.create(newProject),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
        },
    });

    const updateProjectStatusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: ProjectStatus }) => 
            db.projects.update(id, { status }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
        },
    });

    const archiveProjectMutation = useMutation({
        mutationFn: (id: string) => db.projects.update(id, { status: ProjectStatus.ARCHIVED }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
        },
    });

    // Computed data (merging projects with contractor names)
    const mappedProjects = projects.map((p: Project) => {
        const partner = contractors.find((c: Contractor) => c.id === p.assignedPartnerId);
        return { ...p, partnerName: partner ? partner.name : undefined };
    });

    return {
        projects: mappedProjects,
        contractors,
        isLoading: isLoadingProjects || isLoadingContractors,
        createProject: createProjectMutation.mutateAsync,
        updateStatus: updateProjectStatusMutation.mutateAsync,
        archiveProject: archiveProjectMutation.mutateAsync,
    };
};
