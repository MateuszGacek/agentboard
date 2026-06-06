import type { DatabaseClient } from "@agentboard/db";
import type { CurrentUser } from "@agentboard/shared";

export type AuthenticatedUser = CurrentUser;

export type AppBindings = {
  Variables: {
    requestId: string;
    db: DatabaseClient;
    user: AuthenticatedUser;
    sessionId: string;
    sessionTokenHash: string;
  };
};
