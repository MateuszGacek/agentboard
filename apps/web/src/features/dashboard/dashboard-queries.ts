import { useQuery } from "@tanstack/react-query";

import { dashboardApi } from "../../lib/api-client";

export const dashboardQueryKey = (workspaceId: string | null, projectId?: string | null) =>
  ["dashboard", workspaceId, projectId ?? null] as const;
export const weeklyReportQueryKey = (
  workspaceId: string | null,
  projectId?: string | null,
  weekStart?: string | null
) => ["weekly-report", workspaceId, projectId ?? null, weekStart ?? null] as const;

export function useDashboard(workspaceId: string | null, projectId?: string | null) {
  return useQuery({
    queryKey: dashboardQueryKey(workspaceId, projectId),
    queryFn: ({ signal }) => {
      if (!workspaceId) {
        throw new Error("Workspace ID is required.");
      }

      return dashboardApi.getDashboard(workspaceId, projectId, signal);
    },
    enabled: Boolean(workspaceId)
  });
}

export function useWeeklyReport(
  workspaceId: string | null,
  projectId?: string | null,
  weekStart?: string | null
) {
  return useQuery({
    queryKey: weeklyReportQueryKey(workspaceId, projectId, weekStart),
    queryFn: ({ signal }) => {
      if (!workspaceId) {
        throw new Error("Workspace ID is required.");
      }

      return dashboardApi.getWeeklyReport(workspaceId, projectId, weekStart, signal);
    },
    enabled: Boolean(workspaceId)
  });
}
