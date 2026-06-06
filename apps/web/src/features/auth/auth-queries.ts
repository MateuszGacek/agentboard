import type { LoginRequest, RegisterRequest, SessionResponse } from "@agentboard/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiClientError, authApi } from "../../lib/api-client";

export const sessionQueryKey = ["auth", "session"] as const;

async function getCurrentSession(signal?: AbortSignal): Promise<SessionResponse | null> {
  try {
    return await authApi.me(signal);
  } catch (error) {
    if (error instanceof ApiClientError && error.code === "UNAUTHORIZED") {
      return null;
    }

    throw error;
  }
}

export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: ({ signal }) => getCurrentSession(signal),
    retry: (_failureCount, error) =>
      !(error instanceof ApiClientError && error.code === "SERVICE_UNAVAILABLE")
  });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: LoginRequest) => authApi.login(body),
    onSuccess: (session) => {
      queryClient.setQueryData(sessionQueryKey, session);
    }
  });
}

export function useRegisterMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: RegisterRequest) => authApi.register(body),
    onSuccess: (session) => {
      queryClient.setQueryData(sessionQueryKey, session);
    }
  });
}

export function useDemoLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.demo({ template: "ai-agency-default" }),
    onSuccess: (session) => {
      queryClient.setQueryData(sessionQueryKey, session);
    }
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      queryClient.setQueryData(sessionQueryKey, null);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: sessionQueryKey });
    }
  });
}
