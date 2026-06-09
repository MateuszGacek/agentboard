import type { ApiError, ApiSuccess } from "@kanban/shared";
import type { Context } from "hono";

import type { AppBindings } from "../types";
import { toAppError } from "./errors";

export function getRequestId(c: Context<AppBindings>) {
  return c.get("requestId") ?? "unknown";
}

export function success<T>(
  c: Context<AppBindings>,
  data: T,
  meta?: Record<string, unknown>
): Response {
  const body: ApiSuccess<T> = meta ? { data, meta } : { data };
  return c.json(body);
}

export function errorResponse(c: Context<AppBindings>, error: unknown): Response {
  const appError = toAppError(error);
  const body: ApiError = {
    error: {
      code: appError.code,
      message: appError.expose ? appError.message : "An unexpected error occurred.",
      requestId: getRequestId(c)
    }
  };

  if (appError.details !== undefined && appError.expose) {
    body.error.details = appError.details;
  }

  return c.json(body, appError.status);
}
