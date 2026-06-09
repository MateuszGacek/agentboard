import type { DatabaseClient } from "@kanban/db";
import { sessions, users, workspaceMembers, workspaces } from "@kanban/db";
import { demoLoginRequestSchema, loginRequestSchema, registerRequestSchema } from "@kanban/shared";
import { and, eq } from "drizzle-orm";
import { getCookie } from "hono/cookie";
import { Hono } from "hono";
import { randomUUID } from "node:crypto";

import type { ApiEnv } from "../../env";
import { parseJsonBody, parseOptionalJsonBody } from "../../lib/body";
import { conflict, unauthorized } from "../../lib/errors";
import { success } from "../../lib/responses";
import type { AppBindings } from "../../types";
import { createIsolatedDemoWorkspace } from "./demo";
import { hashPassword, verifyPassword } from "./security";
import {
  clearSessionCookie,
  createSession,
  deleteSessionByToken,
  demoSessionTtlSeconds,
  getSessionResponse,
  normalSessionTtlSeconds,
  requireAuth,
  sessionCookieName,
  setSessionCookie
} from "./sessions";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function workspaceSlugFromName(name: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  return `${base || "workspace"}-${randomUUID().slice(0, 8)}`;
}

export function createAuthRoutes(db: DatabaseClient, env: ApiEnv) {
  const auth = new Hono<AppBindings>();

  auth.post("/register", async (c) => {
    const body = await parseJsonBody(c.req.raw, registerRequestSchema);
    const email = normalizeEmail(body.email);

    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      throw conflict("An account with this email already exists.");
    }

    const passwordHash = await hashPassword(body.password);
    const user = await db.transaction(async (tx) => {
      const [createdUser] = await tx
        .insert(users)
        .values({
          name: body.name,
          email,
          passwordHash,
          locale: "en",
          theme: "system",
          isDemo: false,
          updatedAt: new Date()
        })
        .returning();

      if (!createdUser) {
        throw new Error("Expected registered user to be returned.");
      }

      const [workspace] = await tx
        .insert(workspaces)
        .values({
          name: `${body.name}'s Workspace`,
          slug: workspaceSlugFromName(body.name),
          createdBy: createdUser.id,
          isDemo: false,
          updatedAt: new Date()
        })
        .returning();

      if (!workspace) {
        throw new Error("Expected workspace to be returned.");
      }

      await tx.insert(workspaceMembers).values({
        workspaceId: workspace.id,
        userId: createdUser.id,
        role: "owner"
      });

      return createdUser;
    });

    const ttlSeconds = normalSessionTtlSeconds(env);
    const { token } = await createSession(db, user.id, ttlSeconds);
    setSessionCookie(c, env, token, ttlSeconds);

    return success(c, await getSessionResponse(db, user), undefined);
  });

  auth.post("/login", async (c) => {
    const body = await parseJsonBody(c.req.raw, loginRequestSchema);
    const email = normalizeEmail(body.email);
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user?.passwordHash) {
      throw unauthorized("Invalid email or password.");
    }

    const passwordIsValid = await verifyPassword(body.password, user.passwordHash);

    if (!passwordIsValid) {
      throw unauthorized("Invalid email or password.");
    }

    const ttlSeconds = normalSessionTtlSeconds(env);
    const { token } = await createSession(db, user.id, ttlSeconds);
    setSessionCookie(c, env, token, ttlSeconds);

    return success(c, await getSessionResponse(db, user));
  });

  auth.post("/demo", async (c) => {
    await parseOptionalJsonBody(c.req.raw, demoLoginRequestSchema);
    const demo = await createIsolatedDemoWorkspace(db);
    const ttlSeconds = demoSessionTtlSeconds(env);
    const { token, session } = await createSession(db, demo.user.id, ttlSeconds);
    setSessionCookie(c, env, token, ttlSeconds);

    const sessionResponse = await getSessionResponse(db, demo.user);

    return success(c, {
      ...sessionResponse,
      demo: {
        workspaceId: demo.workspace.id,
        projectId: demo.project.id,
        boardId: demo.board.id,
        expiresAt: session.expiresAt.toISOString()
      }
    });
  });

  auth.post("/logout", async (c) => {
    const token = getCookie(c, sessionCookieName);

    if (token) {
      await deleteSessionByToken(db, token);
    }

    clearSessionCookie(c);
    return success(c, { ok: true as const });
  });

  auth.get("/me", requireAuth(db), async (c) => {
    const user = c.get("user");
    const sessionTokenHash = c.get("sessionTokenHash");
    const sessionStillExists = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.tokenHash, sessionTokenHash), eq(sessions.userId, user.id)))
      .limit(1);

    if (sessionStillExists.length === 0) {
      clearSessionCookie(c);
      throw unauthorized();
    }

    return success(c, await getSessionResponse(db, user));
  });

  return auth;
}
