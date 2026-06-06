import { useQuery } from "@tanstack/react-query";

import { dashboardApi } from "../../lib/api-client";

export const dashboardQueryKey = (workspaceId: string | null) =>
  ["dashboard", workspaceId] as const;

export function useDashboard(workspaceId: string | null) {
  return useQuery({
    queryKey: dashboardQueryKey(workspaceId),
    queryFn: ({ signal }) => {
      if (!workspaceId) {
        throw new Error("Workspace ID is required.");
      }

      return dashboardApi.getDashboard(workspaceId, signal);
    },
    enabled: Boolean(workspaceId)
  });
}
