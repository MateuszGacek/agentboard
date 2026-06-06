const apiBaseUrl = process.env.SMOKE_API_URL ?? "http://localhost:3000/api";
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 10_000);

let cookie = "";

function assertSafeLocalUrl(url) {
  const parsed = new URL(url);
  const hostname = parsed.hostname;
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost");

  if (!isLocal) {
    throw new Error(`Refusing to run local smoke against non-local URL: ${url}`);
  }
}

async function request(pathname, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { ...options.headers };

  if (cookie) {
    headers.cookie = cookie;
  }

  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(`${apiBaseUrl}${pathname}`, {
      ...options,
      headers,
      signal: controller.signal
    });
    const setCookie = response.headers.get("set-cookie");

    if (setCookie) {
      cookie = setCookie.split(";")[0];
    }

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        `${options.method ?? "GET"} ${pathname} failed ${response.status}: ${JSON.stringify(payload)}`
      );
    }

    return pathname === "/health" ? payload : payload?.data;
  } finally {
    clearTimeout(timeout);
  }
}

function countTasks(board) {
  return board.columns.reduce(
    (count, column) => count + (board.tasksByColumn[column.id]?.length ?? 0),
    0
  );
}

assertSafeLocalUrl(apiBaseUrl);

const results = [];
const health = await request("/health");
if (!health?.ok) {
  throw new Error("Health endpoint did not return ok=true.");
}
results.push("health");

const demo = await request("/auth/demo", {
  method: "POST",
  body: { template: "ai-agency-default" }
});
const { boardId, workspaceId } = demo.demo;
results.push("demo auth");

const board = await request(`/boards/${boardId}`);
const taskCount = countTasks(board);
if (taskCount <= 0) {
  throw new Error("Board snapshot returned no tasks.");
}
results.push(`board snapshot (${taskCount} tasks)`);

const dashboard = await request(`/workspaces/${workspaceId}/dashboard`);
if (typeof dashboard.totalActiveTasks !== "number") {
  throw new Error("Dashboard endpoint did not return totalActiveTasks.");
}
results.push(`dashboard (${dashboard.totalActiveTasks} active tasks)`);

const firstTask = board.columns
  .flatMap((column) => board.tasksByColumn[column.id] ?? [])
  .find(Boolean);

if (!firstTask) {
  throw new Error("No task available for AI unavailable smoke.");
}

const aiResponse = await fetch(`${apiBaseUrl}/tasks/${firstTask.id}/ai/improve`, {
  method: "POST",
  headers: cookie ? { cookie } : undefined
});
const aiPayload = await aiResponse.json().catch(() => null);

if (process.env.OPENAI_API_KEY) {
  if (!aiResponse.ok) {
    throw new Error(
      `AI smoke expected success with OPENAI_API_KEY set, got ${aiResponse.status}: ${JSON.stringify(aiPayload)}`
    );
  }
  results.push("AI improve");
} else {
  if (aiResponse.status !== 503 || aiPayload?.error?.code !== "AI_UNAVAILABLE") {
    throw new Error(
      `AI unavailable smoke expected 503 AI_UNAVAILABLE, got ${aiResponse.status}: ${JSON.stringify(aiPayload)}`
    );
  }
  results.push("AI unavailable");
}

console.info(`Local smoke PASS: ${results.join(", ")}.`);
