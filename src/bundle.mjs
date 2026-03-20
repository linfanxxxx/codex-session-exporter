import { promises as fs } from "node:fs";
import path from "node:path";

import { openDatabase } from "./sqlite.mjs";
import { renderHtml, renderMarkdown } from "./renderers.mjs";
import { getFirstUserMessage } from "./transcript.mjs";
import {
  appendJsonlRecord,
  fromIsoToEpochSeconds,
  normalizeWhitespace,
  parseInteger,
  readJson,
  relativeTo,
  resolveCodexHome,
  sanitizeFileName,
  toIsoFromEpochSeconds,
  writeJson,
  writeText,
} from "./utils.mjs";

const BUNDLE_FORMAT_VERSION = 1;
const THREAD_FALLBACK_DEFAULTS = {
  agent_nickname: null,
  agent_role: null,
  approval_mode: "on-request",
  archived: 0,
  archived_at: null,
  cli_version: "",
  created_at: 0,
  cwd: "",
  first_user_message: "",
  git_branch: null,
  git_origin_url: null,
  git_sha: null,
  has_user_event: 1,
  memory_mode: "enabled",
  model_provider: "openai",
  sandbox_policy: JSON.stringify({ type: "workspace-write" }),
  source: "unknown",
  tokens_used: 0,
  updated_at: 0,
};

export async function exportMarkdown(session, { outputPath } = {}) {
  const targetPath = path.resolve(
    outputPath || path.join(process.cwd(), "exports", `${session.sessionId}.md`),
  );

  await writeText(targetPath, renderMarkdown(session));

  return {
    outputPath: targetPath,
    sessionId: session.sessionId,
    title: session.title,
  };
}

export async function exportHtml(session, { outputPath } = {}) {
  const targetPath = path.resolve(
    outputPath || path.join(process.cwd(), "exports", `${session.sessionId}.html`),
  );

  await writeText(targetPath, renderHtml(session));

  return {
    outputPath: targetPath,
    sessionId: session.sessionId,
    title: session.title,
  };
}

export async function exportBundle(session, { outputPath } = {}) {
  const bundleDirectory = path.resolve(
    outputPath ||
      path.join(process.cwd(), "exports", `${session.sessionId}.codex-session`),
  );
  const rawDirectory = path.join(bundleDirectory, "raw");
  const manifest = {
    exportedAt: new Date().toISOString(),
    files: {
      dynamicToolsJson: "raw/thread-dynamic-tools.json",
      htmlTranscript: "transcript.html",
      indexRecordJson: "raw/index-record.json",
      markdownTranscript: "transcript.md",
      sessionJsonl: "raw/session.jsonl",
      threadJson: "raw/thread.json",
    },
    formatVersion: BUNDLE_FORMAT_VERSION,
    messageCount: session.messages.length,
    paths: {
      rolloutRelativePath: relativeTo(session.codexHome, session.sessionFile),
    },
    sessionId: session.sessionId,
    source: {
      cliVersion: session.threadRecord.cli_version || session.sessionMeta?.cli_version || "",
      cwd: session.threadRecord.cwd || session.sessionMeta?.cwd || "",
      modelProvider:
        session.threadRecord.model_provider || session.sessionMeta?.model_provider || "",
      rolloutPath: session.sessionFile,
      source: session.threadRecord.source || session.sessionMeta?.source || "",
    },
    title: session.title,
    warnings: session.invalidLines.length
      ? [`Ignored ${session.invalidLines.length} invalid JSONL lines while building transcripts.`]
      : [],
  };

  await fs.mkdir(rawDirectory, { recursive: true });
  await writeJson(path.join(bundleDirectory, "manifest.json"), manifest);
  await writeText(path.join(bundleDirectory, "transcript.md"), renderMarkdown(session));
  await writeText(path.join(bundleDirectory, "transcript.html"), renderHtml(session));
  await fs.copyFile(session.sessionFile, path.join(rawDirectory, "session.jsonl"));
  await writeJson(path.join(rawDirectory, "thread.json"), session.threadRecord);
  await writeJson(
    path.join(rawDirectory, "thread-dynamic-tools.json"),
    session.dynamicTools,
  );
  await writeJson(path.join(rawDirectory, "index-record.json"), session.indexRecord);

  return {
    bundleDirectory,
    manifestPath: path.join(bundleDirectory, "manifest.json"),
    sessionId: session.sessionId,
    title: session.title,
  };
}

export async function importBundle(
  bundlePath,
  { codexHome, targetCwd, cwdMap } = {},
) {
  const bundleDirectory = await resolveBundleDirectory(bundlePath);
  const manifest = await readJson(path.join(bundleDirectory, "manifest.json"));

  validateBundleManifest(manifest);

  const threadRecord =
    (await readJson(path.join(bundleDirectory, manifest.files.threadJson))) || {};
  const dynamicTools =
    (await readJson(path.join(bundleDirectory, manifest.files.dynamicToolsJson))) || [];
  const indexRecord =
    (await readJson(path.join(bundleDirectory, manifest.files.indexRecordJson))) || null;
  const rawSessionPath = path.join(bundleDirectory, manifest.files.sessionJsonl);
  const targetCodexHome = resolveCodexHome(codexHome);
  const databasePath = path.join(targetCodexHome, "state_5.sqlite");

  try {
    await fs.access(databasePath);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new Error(
        `Target Codex home is missing "${databasePath}". Launch Codex once first, or pass --codex-home.`,
      );
    }

    throw error;
  }

  const rewrittenCwd = rewriteCwd(threadRecord.cwd || manifest.source?.cwd || "", {
    cwdMap,
    targetCwd,
  });
  const rolloutRelativePath = chooseRolloutRelativePath(manifest, threadRecord);
  const targetRolloutPath = path.join(
    targetCodexHome,
    ...rolloutRelativePath.split("/").filter(Boolean),
  );
  const rewrittenSessionSource = rewriteSessionMeta(rawSessionPath, {
    cwd: rewrittenCwd,
  });
  const normalizedThread = normalizeThreadRecord({
    manifest,
    rewrittenCwd,
    targetRolloutPath,
    threadRecord,
  });
  const normalizedIndexRecord = normalizeIndexRecord({
    indexRecord,
    manifest,
    threadRecord: normalizedThread,
  });
  const normalizedDynamicTools = normalizeDynamicTools(dynamicTools, manifest.sessionId);

  await writeText(targetRolloutPath, await rewrittenSessionSource);
  const upsertResult = await upsertThreadBundle({
    codexHome: targetCodexHome,
    dynamicTools: normalizedDynamicTools,
    threadRecord: normalizedThread,
  });
  await appendJsonlRecord(path.join(targetCodexHome, "session_index.jsonl"), normalizedIndexRecord);

  return {
    bundleDirectory,
    codexHome: targetCodexHome,
    importedSessionId: manifest.sessionId,
    replacedExistingThread: upsertResult.replacedExistingThread,
    targetCwd: rewrittenCwd,
    targetRolloutPath,
    title: normalizedThread.title,
  };
}

function validateBundleManifest(manifest) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("Bundle manifest is missing or invalid.");
  }

  if (manifest.formatVersion !== BUNDLE_FORMAT_VERSION) {
    throw new Error(
      `Unsupported bundle format version "${manifest.formatVersion}". Expected ${BUNDLE_FORMAT_VERSION}.`,
    );
  }

  if (!manifest.sessionId) {
    throw new Error("Bundle manifest is missing sessionId.");
  }

  if (!manifest.files?.sessionJsonl || !manifest.files?.threadJson) {
    throw new Error("Bundle manifest is missing required file mappings.");
  }
}

async function resolveBundleDirectory(bundlePath) {
  const resolvedPath = path.resolve(bundlePath);
  const stat = await fs.stat(resolvedPath);

  if (stat.isDirectory()) {
    return resolvedPath;
  }

  if (path.basename(resolvedPath) === "manifest.json") {
    return path.dirname(resolvedPath);
  }

  throw new Error(`Expected a bundle directory or manifest.json path, got "${bundlePath}".`);
}

function chooseRolloutRelativePath(manifest, threadRecord) {
  const candidate = String(manifest.paths?.rolloutRelativePath || "");

  if (
    candidate &&
    !candidate.startsWith("../") &&
    !candidate.startsWith("/") &&
    (candidate.startsWith("sessions/") || candidate.startsWith("archived_sessions/"))
  ) {
    return candidate;
  }

  const createdAt = parseInteger(threadRecord.created_at) || Math.floor(Date.now() / 1000);
  const archived = Boolean(parseInteger(threadRecord.archived));
  return buildRolloutRelativePath(manifest.sessionId, createdAt, archived);
}

function buildRolloutRelativePath(sessionId, createdAt, archived) {
  const date = new Date(createdAt * 1000);
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const stamp = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
  const time = [
    String(date.getUTCHours()).padStart(2, "0"),
    String(date.getUTCMinutes()).padStart(2, "0"),
    String(date.getUTCSeconds()).padStart(2, "0"),
  ].join("-");
  const rootDirectory = archived ? "archived_sessions" : "sessions";

  return `${rootDirectory}/${year}/${month}/${day}/rollout-${stamp}T${time}-${sessionId}.jsonl`;
}

async function rewriteSessionMeta(rawSessionPath, { cwd }) {
  const source = await fs.readFile(rawSessionPath, "utf8");
  const lines = source.split(/\r?\n/);
  const outputLines = lines.map((line) => {
    if (!line.trim()) {
      return line;
    }

    try {
      const record = JSON.parse(line);

      if (record.type === "session_meta" && record.payload && typeof cwd === "string") {
        record.payload.cwd = cwd;
        return JSON.stringify(record);
      }

      return line;
    } catch {
      return line;
    }
  });

  return `${outputLines.join("\n").replace(/\n+$/, "")}\n`;
}

function rewriteCwd(originalCwd, { targetCwd, cwdMap }) {
  if (targetCwd) {
    return path.resolve(targetCwd);
  }

  if (!cwdMap) {
    return originalCwd;
  }

  const separatorIndex = cwdMap.indexOf("=");

  if (separatorIndex <= 0) {
    throw new Error(`Invalid --cwd-map value "${cwdMap}". Expected OLD=NEW.`);
  }

  const fromPath = cwdMap.slice(0, separatorIndex);
  const toPath = cwdMap.slice(separatorIndex + 1);

  if (!fromPath || !toPath) {
    throw new Error(`Invalid --cwd-map value "${cwdMap}". Expected OLD=NEW.`);
  }

  if (originalCwd === fromPath) {
    return toPath;
  }

  if (originalCwd.startsWith(`${fromPath}${path.sep}`)) {
    return `${toPath}${originalCwd.slice(fromPath.length)}`;
  }

  return originalCwd;
}

function normalizeThreadRecord({ manifest, rewrittenCwd, targetRolloutPath, threadRecord }) {
  const createdAt =
    parseInteger(threadRecord.created_at) ||
    fromIsoToEpochSeconds(manifest.exportedAt) ||
    Math.floor(Date.now() / 1000);
  const updatedAt =
    parseInteger(threadRecord.updated_at) ||
    fromIsoToEpochSeconds(manifest.source?.updatedAt) ||
    createdAt;

  return {
    ...THREAD_FALLBACK_DEFAULTS,
    ...threadRecord,
    approval_mode: threadRecord.approval_mode || THREAD_FALLBACK_DEFAULTS.approval_mode,
    archived: parseInteger(threadRecord.archived, 0),
    cli_version: threadRecord.cli_version || manifest.source?.cliVersion || "",
    created_at: createdAt,
    cwd: rewrittenCwd,
    first_user_message:
      threadRecord.first_user_message ||
      normalizeWhitespace(threadRecord.title) ||
      normalizeWhitespace(manifest.title) ||
      "",
    has_user_event: parseInteger(threadRecord.has_user_event, 1),
    id: manifest.sessionId,
    memory_mode: threadRecord.memory_mode || THREAD_FALLBACK_DEFAULTS.memory_mode,
    model_provider:
      threadRecord.model_provider ||
      manifest.source?.modelProvider ||
      THREAD_FALLBACK_DEFAULTS.model_provider,
    rollout_path: targetRolloutPath,
    sandbox_policy:
      typeof threadRecord.sandbox_policy === "string"
        ? threadRecord.sandbox_policy
        : THREAD_FALLBACK_DEFAULTS.sandbox_policy,
    source: threadRecord.source || manifest.source?.source || THREAD_FALLBACK_DEFAULTS.source,
    title:
      normalizeWhitespace(threadRecord.title) ||
      normalizeWhitespace(manifest.title) ||
      sanitizeFileName(manifest.sessionId),
    tokens_used: parseInteger(threadRecord.tokens_used, 0),
    updated_at: updatedAt,
  };
}

function normalizeIndexRecord({ indexRecord, manifest, threadRecord }) {
  return {
    id: manifest.sessionId,
    thread_name:
      normalizeWhitespace(threadRecord.title) ||
      normalizeWhitespace(indexRecord?.thread_name) ||
      manifest.sessionId,
    updated_at:
      indexRecord?.updated_at ||
      toIsoFromEpochSeconds(threadRecord.updated_at) ||
      new Date().toISOString(),
  };
}

function normalizeDynamicTools(dynamicTools, sessionId) {
  return Array.isArray(dynamicTools)
    ? dynamicTools
        .filter((tool) => tool && typeof tool === "object")
        .map((tool, index) => ({
          description: String(tool.description || ""),
          input_schema: String(tool.input_schema || "{}"),
          name: String(tool.name || ""),
          position: parseInteger(tool.position, index),
          thread_id: sessionId,
        }))
    : [];
}

async function upsertThreadBundle({ codexHome, dynamicTools, threadRecord }) {
  const databasePath = path.join(codexHome, "state_5.sqlite");
  const database = await openDatabase(databasePath);

  try {
    database.exec("PRAGMA foreign_keys = ON");

    const replacedExistingThread =
      database
        .prepare("select count(*) as count from threads where id = ?")
        .get(threadRecord.id).count > 0;
    const threadColumns = getTableColumns(database, "threads");
    const threadInsertSql = buildInsertStatement("threads", threadColumns);

    database.prepare(threadInsertSql).run(pickColumns(threadRecord, threadColumns));

    if (getTableColumns(database, "thread_dynamic_tools").length > 0) {
      database
        .prepare("delete from thread_dynamic_tools where thread_id = ?")
        .run(threadRecord.id);

      if (dynamicTools.length > 0) {
        const toolColumns = getTableColumns(database, "thread_dynamic_tools");
        const toolInsertSql = buildInsertStatement("thread_dynamic_tools", toolColumns);
        const toolStatement = database.prepare(toolInsertSql);

        for (const dynamicTool of dynamicTools) {
          toolStatement.run(pickColumns(dynamicTool, toolColumns));
        }
      }
    }

    return { replacedExistingThread };
  } finally {
    database.close();
  }
}

function getTableColumns(database, tableName) {
  return database
    .prepare(`pragma table_info(${tableName})`)
    .all()
    .map((row) => row.name);
}

function buildInsertStatement(tableName, columns) {
  return `insert or replace into ${tableName} (${columns.join(", ")}) values (${columns
    .map((column) => `@${column}`)
    .join(", ")})`;
}

function pickColumns(source, columns) {
  const record = {};

  for (const column of columns) {
    record[column] = Object.hasOwn(source, column) ? source[column] : null;
  }

  return record;
}
