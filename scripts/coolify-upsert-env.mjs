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

  return [
    ["NODE_ENV", "production"],
    ["PORT", "3000"],
    ["APP_URL", "https://scalesoftware.matgac.pl"],
    ["WEB_DIST_DIR", "/app/apps/web/dist"],
    ["POSTGRES_DB", "agentboard"],
    ["POSTGRES_USER", "agentboard"],
    ["POSTGRES_PASSWORD", postgresPassword],
    ["DATABASE_URL", `postgres://agentboard:${postgresPassword}@postgres:5432/agentboard`],
    ["SESSION_SECRET", sessionSecret],
    ["SEED_DEMO_DATA", "true"],
    ["OPENAI_API_KEY", ""],
    ["OPENAI_MODEL", "gpt-5-nano"]
  ].map(([key, value]) => ({ key, value }));
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

function variableId(env) {
  return env?.uuid ?? env?.id ?? env?.environment_variable_uuid ?? null;
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

function buildCreateBody(variable) {
  return {
    key: variable.key,
    name: variable.key,
    value: variable.value,
    is_build_time: false,
    is_preview: false
  };
}

function buildUpdateBody(variable) {
  return {
    key: variable.key,
    name: variable.key,
    value: variable.value,
    is_build_time: false,
    is_preview: false
  };
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
  const payload = text ? JSON.parse(text) : null;

  return { response, payload, pathname };
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
    body: JSON.stringify(buildCreateBody(variable))
  });

  if (!result.response.ok) {
    fail(`Create failed for ${variable.key}: HTTP ${result.response.status} at ${endpoint}`);
  }
}

async function updateVariable(endpoint, existing, variable) {
  const id = variableId(existing);

  if (!id) {
    fail(`Cannot update ${variable.key}: existing variable has no id/uuid in API response.`);
  }

  const updateEndpoint = `${endpoint}/${encodeURIComponent(id)}`;
  const body = JSON.stringify(buildUpdateBody(variable));
  const patchResult = await requestJson(updateEndpoint, {
    method: "PATCH",
    body
  });

  if (patchResult.response.ok) {
    return;
  }

  const putResult = await requestJson(updateEndpoint, {
    method: "PUT",
    body
  });

  if (!putResult.response.ok) {
    fail(
      `Update failed for ${variable.key}: PATCH HTTP ${patchResult.response.status}, PUT HTTP ${putResult.response.status} at ${updateEndpoint}`
    );
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

  await updateVariable(endpoint, existing, variable);
  updated.push(variable);
}

console.info(`created count: ${created.length}`);
printNames("created names", created);
console.info(`updated count: ${updated.length}`);
printNames("updated names", updated);
console.info(`skipped count: ${skipped.length}`);
printNames("skipped names", skipped);
