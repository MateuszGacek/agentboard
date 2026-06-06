import type { MiddlewareHandler } from "hono";

import type { AppBindings } from "../types";

export function requestLogger(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const startedAt = performance.now();
    await next();
    const durationMs = Math.round(performance.now() - startedAt);
    const requestId = c.get("requestId");
    console.info(
      JSON.stringify({
        requestId,
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs
      })
    );
  };
}
