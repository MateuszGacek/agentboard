import type { DatabaseClient } from "@agentboard/db";
import { applyAiSuggestionRequestSchema, idSchema } from "@agentboard/shared";
import { Hono } from "hono";

import { parseOptionalJsonBody } from "../../lib/body";
import { validationError } from "../../lib/errors";
import { success } from "../../lib/responses";
import type { AppBindings } from "../../types";
import { requireAuth } from "../auth/sessions";
import { applyAiSuggestion, rejectAiSuggestion } from "./service";

export function createAiSuggestionRoutes(db: DatabaseClient) {
  const aiRoute = new Hono<AppBindings>();

  aiRoute.post("/:suggestionId/apply", requireAuth(db), async (c) => {
    const parsedSuggestionId = idSchema.safeParse(c.req.param("suggestionId"));

    if (!parsedSuggestionId.success) {
      throw validationError(
        "AI suggestion ID must be a valid UUID.",
        parsedSuggestionId.error.flatten()
      );
    }

    const body = await parseOptionalJsonBody(c.req.raw, applyAiSuggestionRequestSchema);
    const user = c.get("user");

    return success(
      c,
      await applyAiSuggestion({
        db,
        userId: user.id,
        suggestionId: parsedSuggestionId.data,
        body
      })
    );
  });

  aiRoute.post("/:suggestionId/reject", requireAuth(db), async (c) => {
    const parsedSuggestionId = idSchema.safeParse(c.req.param("suggestionId"));

    if (!parsedSuggestionId.success) {
      throw validationError(
        "AI suggestion ID must be a valid UUID.",
        parsedSuggestionId.error.flatten()
      );
    }

    const user = c.get("user");

    return success(
      c,
      await rejectAiSuggestion({
        db,
        userId: user.id,
        suggestionId: parsedSuggestionId.data
      })
    );
  });

  return aiRoute;
}
