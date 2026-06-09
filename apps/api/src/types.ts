import type { DatabaseClient } from "@kanban/db";
import type { CurrentUser } from "@kanban/shared";

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
