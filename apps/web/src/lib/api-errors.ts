import type { TFunction } from "i18next";

import { ApiClientError } from "./api-client";

export function getUserFacingApiError(error: unknown, t: TFunction, context?: "ai") {
  if (!(error instanceof ApiClientError)) {
    return t("errors.unexpected");
  }

  if (context === "ai" && error.code === "AI_UNAVAILABLE") {
    return t("errors.aiUnavailable", { requestId: error.requestId });
  }

  if (context === "ai" && error.code === "RATE_LIMITED") {
    return t("errors.aiRateLimited", { requestId: error.requestId });
  }

  if (error.code === "SERVICE_UNAVAILABLE") {
    return t("errors.serviceUnavailable", { requestId: error.requestId });
  }

  if (error.code === "UNAUTHORIZED") {
    return t("errors.unauthorized");
  }

  if (error.code === "VALIDATION_ERROR") {
    return t("errors.validation");
  }

  if (error.code === "CONFLICT") {
    return t("errors.conflict");
  }

  return t("errors.api", { requestId: error.requestId });
}
