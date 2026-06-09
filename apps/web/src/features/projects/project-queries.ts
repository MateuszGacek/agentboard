import type { CreateProjectRequest, UpdateProjectRequest, WorkspaceProject } from "@kanban/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { projectApi } from "../../lib/api-client";
import { dashboardQueryKey } from "../dashboard/dashboard-queries";

export const projectsQueryKey = (workspaceId: string | null) => ["projects", workspaceId] as const;
export const projectTemplatesQueryKey = ["project-templates"] as const;

export function useProjectTemplates() {
  return useQuery({
    queryKey: projectTemplatesQueryKey,
    queryFn: ({ signal }) => projectApi.listTemplates(signal)
  });
}

export function useProjects(workspaceId: string | null) {
  return useQuery({
    queryKey: projectsQueryKey(workspaceId),
    queryFn: ({ signal }) => {
      if (!workspaceId) {
        throw new Error("Workspace ID is required.");
      }

      return projectApi.listProjects(workspaceId, signal);
    },
    enabled: Boolean(workspaceId)
  });
}

function upsertProject(projects: WorkspaceProject[], project: WorkspaceProject) {
  const existingIndex = projects.findIndex((candidate) => candidate.id === project.id);

  if (existingIndex < 0) {
    return [project, ...projects];
  }

  return projects.map((candidate) => (candidate.id === project.id ? project : candidate));
}

export function useCreateProjectMutation(workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateProjectRequest) => {
      if (!workspaceId) {
        throw new Error("Workspace ID is required.");
      }

      return projectApi.createProject(workspaceId, body);
    },
    onSuccess: ({ project }) => {
      queryClient.setQueryData(projectsQueryKey(workspaceId), (current: unknown) => {
        const data = current as { projects: WorkspaceProject[] } | undefined;
        return { projects: upsertProject(data?.projects ?? [], project) };
      });
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKey(workspaceId) });
    }
  });
}

export function useUpdateProjectMutation(workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, body }: { projectId: string; body: UpdateProjectRequest }) =>
      projectApi.updateProject(projectId, body),
    onSuccess: ({ project }) => {
      queryClient.setQueryData(projectsQueryKey(workspaceId), (current: unknown) => {
        const data = current as { projects: WorkspaceProject[] } | undefined;
        return { projects: upsertProject(data?.projects ?? [], project) };
      });
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKey(workspaceId) });
    }
  });
}
