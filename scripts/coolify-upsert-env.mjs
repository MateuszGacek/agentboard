const requiredLocalEnv = [
  "COOLIFY_URL",
  "COOLIFY_TOKEN",
  "COOLIFY_APP_UUID",
  "AGENTBOARD_POSTGRES_PASSWORD",
  "AGENTBOARD_SESSION_SECRET"
];

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const verifyOnly = args.has("--verify");
const unknownArgs = [...args].filter((arg) => !["--dry-run", "--verify"].includes(arg));

if (unknownArgs.length > 0 || (dryRun && verifyOnly)) {
  console.error("Usage: node scripts/coolify-upsert-env.mjs [--dry-run|--verify]");
  process.exit(1);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function validateLocalEnv() {
  const missing = requiredLocalEnv.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    fail(`Missing required local env vars: ${missing.join(", ")}`);
  }
}

function normalizeCoolifyUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    fail("COOLIFY_URL must be a valid URL.");
  }
}

function requiredVariables() {
  const postgresPassword = process.env.AGENTBOARD_POSTGRES_PASSWORD;
  const sessionSecret = process.env.AGENTBOARD_SESSION_SECRET;
  const encodedPostgresPassword = encodeURIComponent(postgresPassword);

  return [
    ["NODE_ENV", "production", true],
    ["PORT", "3000", true],
    ["APP_URL", "https://scalesoftware.matgac.pl", true],
    ["WEB_DIST_DIR", "/app/apps/web/dist", true],
    ["POSTGRES_DB", "agentboard", true],
    ["POSTGRES_USER", "agentboard", true],
    ["POSTGRES_PASSWORD", postgresPassword, true],
    [
      "DATABASE_URL",
      `postgres://agentboard:${encodedPostgresPassword}@agentboard-postgres-db:5432/agentboard`,
      true
    ],
    ["SESSION_SECRET", sessionSecret, true],
    ["SEED_DEMO_DATA", "true", true],
    ["AI_FEATURE_ENABLED", "true", true],
    ["OPENAI_API_KEY", "", false],
    ["OPENAI_MODEL", "gpt-5-nano", true]
  ].map(([key, value, required]) => ({ key, required, value }));
}

function variableName(env) {
  return env?.key ?? env?.name ?? env?.variable ?? env?.env_key ?? null;
}

function variableValue(env) {
  if (!env || typeof env !== "object") {
    return undefined;
  }

  if ("value" in env) {
    return env.value;
  }

  if ("real_value" in env) {
    return env.real_value;
  }

  if ("env_value" in env) {
    return env.env_value;
  }

  return undefined;
}

function isPreviewVariable(env) {
  return env?.is_preview === true;
}

function extractVariables(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  for (const key of ["data", "envs", "environment_variables", "variables"]) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  return null;
}

function payloadKeys(payload) {
  if (Array.isArray(payload)) {
    return "array";
  }

  if (payload && typeof payload === "object") {
    return Object.keys(payload).sort().join(", ") || "object-without-keys";
  }

  return typeof payload;
}

function buildEnvBody(variable) {
  return {
    key: variable.key,
    value: variable.value,
    is_buildtime: true,
    is_runtime: true,
    is_literal: false,
    is_multiline: false,
    is_preview: false
  };
}

function diagnosticBody(payload, rawText) {
  const source =
    payload === null || payload === undefined
      ? rawText
      : typeof payload === "string"
        ? payload
        : JSON.stringify(payload);

  if (!source) {
    return "(empty)";
  }

  const secrets = [
    process.env.COOLIFY_TOKEN,
    process.env.AGENTBOARD_POSTGRES_PASSWORD,
    process.env.AGENTBOARD_SESSION_SECRET,
    ...requiredVariables()
      .map((variable) => variable.value)
      .filter(Boolean)
  ];

  return secrets.reduce((message, secret) => message.split(secret).join("[redacted]"), source);
}

function failRequest(action, variable, result) {
  fail(
    [
      `${action} failed for ${variable.key}.`,
      `HTTP status: ${result.response.status}`,
      `Endpoint: ${result.pathname}`,
      `Response body: ${diagnosticBody(result.payload, result.text)}`
    ].join("\n")
  );
}

async function requestJson(pathname, options = {}) {
  const url = `${coolifyUrl}${pathname}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${process.env.COOLIFY_TOKEN}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers
    }
  });

  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  return { response, payload, pathname, text };
}

async function discoverEnvEndpoint() {
  const candidates = [
    `/api/v1/applications/${appUuid}/envs`,
    `/api/v1/applications/${appUuid}/environment-variables`,
    `/api/v1/applications/${appUuid}/environment_variables`
  ];
  const diagnostics = [];

  for (const pathname of candidates) {
    let result;

    try {
      result = await requestJson(pathname);
    } catch (error) {
      diagnostics.push(`${pathname}: request failed (${error.name})`);
      continue;
    }

    if (!result.response.ok) {
      diagnostics.push(`${pathname}: HTTP ${result.response.status}`);
      continue;
    }

    const variables = extractVariables(result.payload);

    if (!variables) {
      diagnostics.push(`${pathname}: unexpected response keys (${payloadKeys(result.payload)})`);
      continue;
    }

    return { pathname, variables };
  }

  fail(
    [
      "Could not discover Coolify application environment variable endpoint.",
      "Non-secret diagnostics:",
      ...diagnostics.map((diagnostic) => `- ${diagnostic}`)
    ].join("\n")
  );
}

async function createVariable(endpoint, variable) {
  const result = await requestJson(endpoint, {
    method: "POST",
    body: JSON.stringify(buildEnvBody(variable))
  });

  if (!result.response.ok) {
    failRequest("Create", variable, result);
  }
}

async function updateVariable(endpoint, variable) {
  const result = await requestJson(endpoint, {
    method: "PATCH",
    body: JSON.stringify(buildEnvBody(variable))
  });

  if (!result.response.ok) {
    failRequest("Update", variable, result);
  }
}

function printNames(title, variables) {
  console.info(`${title}:`);
  for (const variable of variables) {
    console.info(`- ${variable.key}`);
  }
}

validateLocalEnv();

const variables = requiredVariables();

if (dryRun) {
  printNames("Dry run would upsert these Coolify application env vars", variables);
  process.exit(0);
}

const coolifyUrl = normalizeCoolifyUrl(process.env.COOLIFY_URL);
const appUuid = process.env.COOLIFY_APP_UUID;
const { pathname: endpoint, variables: existingVariables } = await discoverEnvEndpoint();
const existingByName = new Map();

for (const existing of existingVariables) {
  if (isPreviewVariable(existing)) {
    continue;
  }

  const name = variableName(existing);

  if (name) {
    existingByName.set(name, existing);
  }
}

if (verifyOnly) {
  const missing = variables.filter((variable) => !existingByName.has(variable.key));

  if (missing.length > 0) {
    printNames("Missing Coolify application env vars", missing);
    process.exit(1);
  }

  printNames("Verified Coolify application env vars exist", variables);
  process.exit(0);
}

const created = [];
const updated = [];
const skipped = [];

for (const variable of variables) {
  const existing = existingByName.get(variable.key);

  if (!existing) {
    await createVariable(endpoint, variable);
    created.push(variable);
    continue;
  }

  if (variableValue(existing) === variable.value) {
    skipped.push(variable);
    continue;
  }

  await updateVariable(endpoint, variable);
  updated.push(variable);
}

console.info(`created count: ${created.length}`);
printNames("created names", created);
console.info(`updated count: ${updated.length}`);
printNames("updated names", updated);
console.info(`skipped count: ${skipped.length}`);
printNames("skipped names", skipped);
