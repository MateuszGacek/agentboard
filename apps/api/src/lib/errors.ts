import type { ApiErrorCode } from "@agentboard/shared";
import { ZodError } from "zod";

import type { ContentfulStatusCode } from "hono/utils/http-status";

export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly status: ContentfulStatusCode;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(input: {
    code: ApiErrorCode;
    message: string;
    status: ContentfulStatusCode;
    details?: unknown;
    expose?: boolean;
  }) {
    super(input.message);
    this.name = "AppError";
    this.code = input.code;
    this.status = input.status;
    this.details = input.details;
    this.expose = input.expose ?? true;
  }
}

export function unauthorized(message = "Authentication is required.") {
  return new AppError({
    code: "UNAUTHORIZED",
    message,
    status: 401
  });
}

export function forbidden(message = "You do not have access to this resource.") {
  return new AppError({
    code: "FORBIDDEN",
    message,
    status: 403
  });
}

export function notFound(message = "The requested resource was not found.") {
  return new AppError({
    code: "NOT_FOUND",
    message,
    status: 404
  });
}

export function conflict(message: string) {
  return new AppError({
    code: "CONFLICT",
    message,
    status: 409
  });
}

export function validationError(message: string, details?: unknown) {
  return new AppError({
    code: "VALIDATION_ERROR",
    message,
    status: 422,
    details
  });
}

export function serviceUnavailable(message: string) {
  return new AppError({
    code: "SERVICE_UNAVAILABLE",
    message,
    status: 503
  });
}

export function aiUnavailable(message: string, details?: unknown) {
  return new AppError({
    code: "AI_UNAVAILABLE",
    message,
    status: 503,
    details
  });
}

export function rateLimited(message: string) {
  return new AppError({
    code: "RATE_LIMITED",
    message,
    status: 429
  });
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return validationError("Request validation failed.", error.flatten());
  }

  return new AppError({
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred.",
    status: 500,
    expose: false
  });
}
