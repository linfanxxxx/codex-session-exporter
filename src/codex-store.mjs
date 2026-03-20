import { promises as fs } from "node:fs";
import path from "node:path";

import { openDatabase } from "./sqlite.mjs";
import {
  fromIsoToEpochSeconds,
  normalizeWhitespace,
  parseInteger,
  readJsonl,
  relativeTo,
  resolveCodexHome,
  toIsoFromEpochSeconds,
} from "./utils.mjs";
import {
  chooseSessionTitle,
  extractTranscriptMessages,
  getFirstUserMessage,
} from "./transcript.mjs";

const SESSION_ID_PATTERN =
  /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const SESSION_FILE_ID_PATTERN =
  /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i;

export async function listSessions({ codexHome, limit = 20, query = "" } = {}) {
  const codexRoot = resolveCodexHome(codexHome);
  const [threadRecords, indexRecords] = await Promise.all([
    loadThreadRecords(codexRoot),
    loadSessionIndexRecords(codexRoot),
  ]);
  const indexById = new Map(indexRecords.map((record) => [record.id, record]));
  const summariesById = new Map();

  for (const threadRecord of threadRecords) {
    summariesById.set(
      threadRecord.id,
      buildSessionSummary(threadRecord, indexById.get(threadRecord.id)),
    );
  }

  for (const indexRecord of indexRecords) {
    if (!summariesById.has(indexRecord.id)) {
      summariesById.set(indexRecord.id, buildSessionSummary(null, indexRecord));
    }
  }

  const loweredQuery = query.trim().toLowerCase();
  const summaries = Array.from(summariesById.values())
    .filter((summary) => {
      if (!loweredQuery) {
        return true;
      }

      return [
        summary.id,
        summary.title,
        summary.cwd,
        summary.source,
        summary.modelProvider,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(loweredQuery));
    })
    .sort((left, right) => right.updatedAtSort - left.updatedAtSort);

  return summaries.slice(0, limit);
}

export async function inspectSession(requestedId, { codexHome } = {}) {
  const session = await resolveSession(requestedId, { codexHome });

  return {
    archived: Boolean(session.threadRecord.archived),
    codexHome: session.codexHome,
    cwd: session.threadRecord.cwd || session.sessionMeta?.cwd || "",
    dynamicToolCount: session.dynamicTools.length,
    hasInvalidJsonlLines: session.invalidLines.length > 0,
    messageCount: session.messages.length,
    rolloutRelativePath: relativeTo(session.codexHome, session.sessionFile),
    sessionFile: session.sessionFile,
    sessionId: session.sessionId,
    title: session.title,
    updatedAt:
      toIsoFromEpochSeconds(session.threadRecord.updated_at) ||
      session.indexRecord?.updated_at ||
      "",
  };
}

export async function resolveSession(requestedId, { codexHome } = {}) {
  const sessionIdInput = String(requestedId || "").trim();

  if (!sessionIdInput) {
    throw new Error("A session id is required.");
  }

  const codexRoot = resolveCodexHome(codexHome);
  const [threadRecords, indexRecords] = await Promise.all([
    loadThreadRecords(codexRoot),
    loadSessionIndexRecords(codexRoot),
  ]);
  const threadById = new Map(threadRecords.map((record) => [record.id, record]));
  const indexById = new Map(indexRecords.map((record) => [record.id, record]));
  const knownIds = new Set([...threadById.keys(), ...indexById.keys()]);
  const matchedSessionId = resolveRequestedSessionId(sessionIdInput, Array.from(knownIds));

  if (!matchedSessionId) {
    const fileMatches = await findSessionFiles(codexRoot, sessionIdInput);

    if (fileMatches.length === 1) {
      return hydrateResolvedSession({
        codexRoot,
        filePath: fileMatches[0].filePath,
        indexRecord: indexById.get(fileMatches[0].id) || null,
        sessionId: fileMatches[0].id,
        threadRecord: threadById.get(fileMatches[0].id) || null,
      });
    }

    if (fileMatches.length > 1) {
      throw new Error(buildAmbiguousMatchMessage(sessionIdInput, fileMatches));
    }

    throw new Error(
      `No Codex session matched "${sessionIdInput}". Try "node src/cli.mjs list".`,
    );
  }

  const threadRecord = threadById.get(matchedSessionId) || null;
  const indexRecord = indexById.get(matchedSessionId) || null;
  const filePath = await resolveSessionFile(codexRoot, matchedSessionId, threadRecord);

  return hydrateResolvedSession({
    codexRoot,
    filePath,
    indexRecord,
    sessionId: matchedSessionId,
    threadRecord,
  });
}

export async function loadThreadRecords(codexRoot) {
  const databasePath = path.join(codexRoot, "state_5.sqlite");

  try {
    await fs.access(databasePath);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const database = await openDatabase(databasePath, { readonly: true });

  try {
    return database.prepare("select * from threads order by updated_at desc").all();
  } finally {
    database.close();
  }
}

export async function loadThreadDynamicTools(codexRoot, sessionId) {
  const databasePath = path.join(codexRoot, "state_5.sqlite");

  try {
    await fs.access(databasePath);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const database = await openDatabase(databasePath, { readonly: true });

  try {
    return database
      .prepare(
        "select thread_id, position, name, description, input_schema from thread_dynamic_tools where thread_id = ? order by position asc",
      )
      .all(sessionId);
  } finally {
    database.close();
  }
}

export async function loadSessionIndexRecords(codexRoot) {
  const indexPath = path.join(codexRoot, "session_index.jsonl");
  const parsed = await readJsonl(indexPath);
  const latestById = new Map();

  for (const item of parsed.records) {
    const record = item.record;

    if (!record || !record.id) {
      continue;
    }

    const existing = latestById.get(record.id);
    const currentUpdated = Date.parse(record.updated_at || "");
    const existingUpdated = Date.parse(existing?.updated_at || "");

    if (!existing || Number.isNaN(existingUpdated) || currentUpdated > existingUpdated) {
      latestById.set(record.id, record);
    }
  }

  return Array.from(latestById.values()).sort((left, right) => {
    return fromIsoToEpochSeconds(right.updated_at) - fromIsoToEpochSeconds(left.updated_at);
  });
}

async function hydrateResolvedSession({
  codexRoot,
  filePath,
  indexRecord,
  sessionId,
  threadRecord,
}) {
  const parsed = await readJsonl(filePath);
  const sessionMeta = parsed.records.find((entry) => entry.record.type === "session_meta")?.record
    ?.payload || null;
  const messages = extractTranscriptMessages(parsed.records);
  const fallbackThreadRecord =
    threadRecord ||
    buildFallbackThreadRecord({
      codexRoot,
      filePath,
      indexRecord,
      messages,
      sessionId,
      sessionMeta,
      timestamps: parsed.records.map((entry) => entry.record.timestamp).filter(Boolean),
    });
  const dynamicTools = threadRecord
    ? await loadThreadDynamicTools(codexRoot, sessionId)
    : [];
  const title = chooseSessionTitle({
    threadRecord: fallbackThreadRecord,
    indexRecord,
    messages,
    sessionId,
  });

  fallbackThreadRecord.title = title;

  return {
    codexHome: codexRoot,
    dynamicTools,
    indexRecord,
    invalidLines: parsed.invalidLines,
    messages,
    records: parsed.records,
    sessionFile: filePath,
    sessionId,
    sessionMeta,
    threadRecord: fallbackThreadRecord,
    title,
  };
}

function buildFallbackThreadRecord({
  codexRoot,
  filePath,
  indexRecord,
  messages,
  sessionId,
  sessionMeta,
  timestamps,
}) {
  const createdAt =
    fromIsoToEpochSeconds(sessionMeta?.timestamp) ||
    fromIsoToEpochSeconds(timestamps[0]) ||
    fromIsoToEpochSeconds(indexRecord?.updated_at) ||
    Math.floor(Date.now() / 1000);
  const updatedAt =
    fromIsoToEpochSeconds(timestamps[timestamps.length - 1]) ||
    fromIsoToEpochSeconds(indexRecord?.updated_at) ||
    createdAt;

  return {
    agent_nickname: null,
    agent_role: null,
    approval_mode: "on-request",
    archived: filePath.includes(`${path.sep}archived_sessions${path.sep}`) ? 1 : 0,
    archived_at: null,
    cli_version: sessionMeta?.cli_version || "",
    created_at: createdAt,
    cwd: sessionMeta?.cwd || "",
    first_user_message: getFirstUserMessage(messages),
    git_branch: null,
    git_origin_url: null,
    git_sha: null,
    has_user_event: messages.some((message) => message.role === "user") ? 1 : 0,
    id: sessionId,
    memory_mode: "enabled",
    model_provider: sessionMeta?.model_provider || "openai",
    rollout_path: filePath,
    sandbox_policy: JSON.stringify({ type: "workspace-write" }),
    source: sessionMeta?.source || sessionMeta?.originator || "unknown",
    title:
      normalizeWhitespace(indexRecord?.thread_name) ||
      normalizeWhitespace(getFirstUserMessage(messages)) ||
      sessionId,
    tokens_used: 0,
    updated_at: updatedAt,
  };
}

function buildSessionSummary(threadRecord, indexRecord) {
  const updatedAtSort = threadRecord?.updated_at
    ? parseInteger(threadRecord.updated_at)
    : fromIsoToEpochSeconds(indexRecord?.updated_at);

  return {
    archived: Boolean(threadRecord?.archived),
    cwd: threadRecord?.cwd || "",
    id: threadRecord?.id || indexRecord?.id || "",
    modelProvider: threadRecord?.model_provider || "",
    rolloutPath: threadRecord?.rollout_path || "",
    source: threadRecord?.source || "",
    title: normalizeWhitespace(threadRecord?.title || indexRecord?.thread_name || "(untitled)"),
    updatedAt:
      toIsoFromEpochSeconds(threadRecord?.updated_at) ||
      indexRecord?.updated_at ||
      "",
    updatedAtSort,
  };
}

function resolveRequestedSessionId(requestedId, knownIds) {
  if (knownIds.includes(requestedId)) {
    return requestedId;
  }

  if (!SESSION_ID_PATTERN.test(requestedId) && !knownIds.some((id) => id.startsWith(requestedId))) {
    return "";
  }

  const prefixMatches = knownIds.filter((id) => id.startsWith(requestedId));

  if (prefixMatches.length === 1) {
    return prefixMatches[0];
  }

  if (prefixMatches.length > 1) {
    throw new Error(buildAmbiguousMatchMessage(requestedId, prefixMatches));
  }

  return "";
}

function buildAmbiguousMatchMessage(requestedId, matches) {
  const lines = matches.slice(0, 10).map((match) => {
    if (typeof match === "string") {
      return `- ${match}`;
    }

    return `- ${match.id}  ${match.filePath}`;
  });

  return `Session id prefix "${requestedId}" is ambiguous:\n${lines.join("\n")}`;
}

async function resolveSessionFile(codexRoot, sessionId, threadRecord) {
  const candidatePath = threadRecord?.rollout_path;

  if (candidatePath) {
    try {
      await fs.access(candidatePath);
      return candidatePath;
    } catch (error) {
      if (!error || error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  const fileMatches = await findSessionFiles(codexRoot, sessionId);

  if (fileMatches.length === 0) {
    throw new Error(`Could not find a JSONL file for session ${sessionId}.`);
  }

  if (fileMatches.length > 1) {
    throw new Error(buildAmbiguousMatchMessage(sessionId, fileMatches));
  }

  return fileMatches[0].filePath;
}

async function findSessionFiles(codexRoot, requestedId) {
  const roots = [
    path.join(codexRoot, "sessions"),
    path.join(codexRoot, "archived_sessions"),
  ];
  const matches = [];

  for (const rootDirectory of roots) {
    const files = await walkFiles(rootDirectory);

    for (const filePath of files) {
      const match = filePath.match(SESSION_FILE_ID_PATTERN);

      if (!match) {
        continue;
      }

      const sessionId = match[1];

      if (sessionId === requestedId || sessionId.startsWith(requestedId)) {
        matches.push({ filePath, id: sessionId });
      }
    }
  }

  return matches;
}

async function walkFiles(rootDirectory) {
  const files = [];

  try {
    const entries = await fs.readdir(rootDirectory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(rootDirectory, entry.name);

      if (entry.isDirectory()) {
        files.push(...(await walkFiles(fullPath)));
        continue;
      }

      if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  return files;
}
