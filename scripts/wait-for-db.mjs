import net from "node:net";

const databaseUrl = process.env.DATABASE_URL;
const timeoutMs = Number(process.env.DB_WAIT_TIMEOUT_MS ?? 60_000);
const intervalMs = Number(process.env.DB_WAIT_INTERVAL_MS ?? 1_000);

if (!databaseUrl) {
  console.error("DATABASE_URL is required before waiting for the database.");
  process.exit(1);
}

const parsed = new URL(databaseUrl);
const host = parsed.hostname;
const port = Number(parsed.port || 5432);
const deadline = Date.now() + timeoutMs;

function waitOnce() {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });

    socket.setTimeout(5_000);
    socket.once("connect", () => {
      socket.end();
      resolve();
    });
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error("Database connection timed out."));
    });
    socket.once("error", reject);
  });
}

while (Date.now() < deadline) {
  try {
    await waitOnce();
    console.info(`Database socket is reachable at ${host}:${port}.`);
    process.exit(0);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

console.error(`Database did not become reachable at ${host}:${port} within ${timeoutMs}ms.`);
process.exit(1);
