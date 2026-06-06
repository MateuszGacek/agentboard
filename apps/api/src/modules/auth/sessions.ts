import type { DatabaseClient } from "@agentboard/db";
import {
  sessions,
  users,
  workspaceMembers,
  workspaces,
  type User,
  type WorkspaceMember
} from "@agentboard/db";
import type { CurrentUser, CurrentWorkspace, SessionResponse } from "@agentboard/shared";
import { and, eq, gt } from "drizzle-orm";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context, MiddlewareHandler } from "hono";
import { createHash } from "node:crypto";

import type { ApiEnv } from "../../env";
import { isProduction } from "../../env";
import { unauthorized } from "../../lib/errors";
import type { AppBindings, AuthenticatedUser } from "../../types";
import { createSessionToken } from "./security";

export const sessionCookieName = "ab_session";

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

function ttlSecondsFromDays(days: number) {
  return days * 24 * 60 * 60;
}

function ttlSecondsFromHours(hours: number) {
  return hours * 60 * 60;
}

export function mapCurrentUser(user: User): CurrentUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    locale: user.locale,
    theme: user.theme,
    isDemo: user.isDemo
  };
}

export async function createSession(db: DatabaseClient, userId: string, ttlSeconds: number) {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      tokenHash,
      expiresAt
    })
    .returning();

  if (!session) {
    throw new Error("Expected session to be returned.");
  }

  return { token, tokenHash, session };
}

export function setSessionCookie(
  c: Context<AppBindings>,
  env: ApiEnv,
  token: string,
  maxAge: number
) {
  setCookie(c, sessionCookieName, token, {
    httpOnly: true,
    secure: isProduction(env),
    sameSite: "Lax",
    path: "/",
    maxAge
  });
}

export function clearSessionCookie(c: Context<AppBindings>) {
  deleteCookie(c, sessionCookieName, {
    path: "/"
  });
}

export async function getSessionResponse(
  db: DatabaseClient,
  user: User | AuthenticatedUser
): Promise<SessionResponse> {
  const memberships = await db
    .select({
      workspace: {
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        isDemo: workspaces.isDemo
      },
      membership: {
        role: workspaceMembers.role
      }
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, user.id));

  const currentUser: CurrentUser =
    "passwordHash" in user
      ? mapCurrentUser(user)
      : {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          locale: user.locale,
          theme: user.theme,
          isDemo: user.isDemo
        };

  const currentWorkspaces: CurrentWorkspace[] = memberships.map((row) => ({
    id: row.workspace.id,
    name: row.workspace.name,
    slug: row.workspace.slug,
    role: row.membership.role,
    isDemo: row.workspace.isDemo
  }));

  return {
    user: currentUser,
    workspaces: currentWorkspaces,
    activeWorkspaceId: currentWorkspaces[0]?.id ?? null
  };
}

export async function validateSessionToken(db: DatabaseClient, token: string) {
  const tokenHash = hashSessionToken(token);
  const [row] = await db
    .select({
      session: sessions,
      user: users
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!row) {
    return null;
  }

  await db.update(sessions).set({ lastUsedAt: new Date() }).where(eq(sessions.id, row.session.id));

  return {
    user: mapCurrentUser(row.user),
    sessionId: row.session.id,
    sessionTokenHash: tokenHash
  };
}

export function requireAuth(db: DatabaseClient): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const token = getCookie(c, sessionCookieName);

    if (!token) {
      throw unauthorized();
    }

    const auth = await validateSessionToken(db, token);

    if (!auth) {
      clearSessionCookie(c);
      throw unauthorized();
    }

    c.set("user", auth.user);
    c.set("sessionId", auth.sessionId);
    c.set("sessionTokenHash", auth.sessionTokenHash);
    await next();
  };
}

export async function deleteSessionByToken(db: DatabaseClient, token: string) {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)));
}

export function normalSessionTtlSeconds(env: Pick<ApiEnv, "SESSION_TTL_DAYS">) {
  return ttlSecondsFromDays(env.SESSION_TTL_DAYS);
}

export function demoSessionTtlSeconds(env: Pick<ApiEnv, "DEMO_SESSION_TTL_HOURS">) {
  return ttlSecondsFromHours(env.DEMO_SESSION_TTL_HOURS);
}

export type SessionMembership = WorkspaceMember;
