#!/usr/bin/env node

import { fileURLToPath } from "node:url";

import { exportBundle, exportHtml, exportMarkdown, importBundle } from "./bundle.mjs";
import { inspectSession, listSessions, resolveSession } from "./codex-store.mjs";
import { installSkill } from "./install.mjs";
import { formatDisplayDate } from "./utils.mjs";

export async function main(args = process.argv.slice(2)) {

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  const command = args[0];

  switch (command) {
    case "list":
      await runList(args.slice(1));
      return;
    case "inspect":
      await runInspect(args.slice(1));
      return;
    case "export":
      await runExport(args.slice(1));
      return;
    case "import":
      await runImport(args.slice(1));
      return;
    case "install":
      await runInstall(args.slice(1));
      return;
    default:
      printHelp();
      throw new Error(`Unknown command: ${command}`);
  }
}

async function runList(args) {
  const options = parseOptions(args);
  const limit = options.limit ? Number.parseInt(options.limit, 10) : 20;

  if (Number.isNaN(limit) || limit <= 0) {
    throw new Error("--limit must be a positive integer.");
  }

  const sessions = await listSessions({
    codexHome: options.codexHome,
    limit,
    query: options.query || "",
  });

  if (options.json) {
    console.log(JSON.stringify(sessions, null, 2));
    return;
  }

  if (sessions.length === 0) {
    console.log("No sessions found.");
    return;
  }

  for (const session of sessions) {
    console.log(
      [
        session.id,
        formatDisplayDate(session.updatedAt),
        session.archived ? "archived" : "active",
        session.title,
      ].join("\t"),
    );
  }
}

async function runInspect(args) {
  const sessionId = args[0];

  if (!sessionId) {
    throw new Error("inspect requires a session id.");
  }

  const options = parseOptions(args.slice(1));
  const details = await inspectSession(sessionId, { codexHome: options.codexHome });

  console.log(JSON.stringify(details, null, 2));
}

async function runExport(args) {
  const format = args[0];
  const sessionId = args[1];

  if (!format || !sessionId) {
    throw new Error("export requires a format and session id.");
  }

  const options = parseOptions(args.slice(2));
  const session = await resolveSession(sessionId, { codexHome: options.codexHome });

  if (format === "md") {
    const result = await exportMarkdown(session, { outputPath: options.output });
    printExportResult("Markdown", result.outputPath, session);
    return;
  }

  if (format === "html") {
    const result = await exportHtml(session, { outputPath: options.output });
    printExportResult("HTML", result.outputPath, session);
    return;
  }

  if (format === "bundle") {
    const result = await exportBundle(session, { outputPath: options.output });
    printExportResult("Bundle", result.bundleDirectory, session);
    return;
  }

  throw new Error(`Unsupported export format: ${format}`);
}

async function runImport(args) {
  const subcommand = args[0];
  const bundlePath = args[1];

  if (subcommand !== "bundle" || !bundlePath) {
    throw new Error('import expects "bundle <bundle-path>".');
  }

  const options = parseOptions(args.slice(2));
  const result = await importBundle(bundlePath, {
    codexHome: options.codexHome,
    cwdMap: options.cwdMap,
    targetCwd: options.targetCwd,
  });

  console.log(`Imported session ${result.importedSessionId}`);
  console.log(`Title: ${result.title}`);
  console.log(`Codex home: ${result.codexHome}`);
  console.log(`Rollout: ${result.targetRolloutPath}`);
  console.log(`CWD: ${result.targetCwd || "unchanged"}`);
  console.log(`Action: ${result.replacedExistingThread ? "updated existing thread" : "created new thread"}`);
}

async function runInstall(args) {
  const subcommand = args[0];

  if (subcommand !== "skill") {
    throw new Error('install expects "skill".');
  }

  const options = parseOptions(args.slice(1));
  const result = await installSkill({ codexHome: options.codexHome });

  console.log(`Installed skill ${result.skillName}`);
  console.log(`Codex home: ${result.codexHome}`);
  console.log(`Skill: ${result.targetSkillDir}`);
  console.log("Restart Codex to pick up the new skill.");
}

function parseOptions(args) {
  const options = {
    json: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--output" || arg === "-o") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --output.");
      }

      options.output = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--output=")) {
      options.output = arg.slice("--output=".length);
      continue;
    }

    if (arg === "--query" || arg === "-q") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --query.");
      }

      options.query = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--query=")) {
      options.query = arg.slice("--query=".length);
      continue;
    }

    if (arg === "--limit") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --limit.");
      }

      options.limit = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      options.limit = arg.slice("--limit=".length);
      continue;
    }

    if (arg === "--codex-home") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --codex-home.");
      }

      options.codexHome = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--codex-home=")) {
      options.codexHome = arg.slice("--codex-home=".length);
      continue;
    }

    if (arg === "--target-cwd") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --target-cwd.");
      }

      options.targetCwd = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--target-cwd=")) {
      options.targetCwd = arg.slice("--target-cwd=".length);
      continue;
    }

    if (arg === "--cwd-map") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --cwd-map.");
      }

      options.cwdMap = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--cwd-map=")) {
      options.cwdMap = arg.slice("--cwd-map=".length);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printExportResult(kind, outputPath, session) {
  console.log(`Exported session ${session.sessionId}`);
  console.log(`Title: ${session.title}`);
  console.log(`${kind}: ${outputPath}`);
  console.log(`Source: ${session.sessionFile}`);
}

function printHelp() {
  console.log(`Codex Session Exporter

Usage:
  codex-session-exporter list [--limit 20] [--query keyword] [--json]
  codex-session-exporter inspect <session-id> [--codex-home ~/.codex]
  codex-session-exporter export md <session-id> [--output ./exports/session.md]
  codex-session-exporter export html <session-id> [--output ./exports/session.html]
  codex-session-exporter export bundle <session-id> [--output ./exports/session.codex-session]
  codex-session-exporter import bundle <bundle-path> [--codex-home ~/.codex] [--target-cwd /new/path]
  codex-session-exporter import bundle <bundle-path> [--cwd-map /old/root=/new/root]
  codex-session-exporter install skill [--codex-home ~/.codex]

Options:
  -o, --output       Write exports to a specific path
  -q, --query        Filter list results
      --limit        Max rows for list
      --json         Print JSON for list
      --codex-home   Override Codex home. Default: ~/.codex
      --target-cwd   Replace imported thread cwd with one exact path
      --cwd-map      Prefix-rewrite cwd during import. Format: OLD=NEW
  -h, --help         Show help
`);
}

if (isDirectExecution()) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

function isDirectExecution() {
  const entryPath = process.argv[1];

  if (!entryPath) {
    return false;
  }

  return fileURLToPath(import.meta.url) === entryPath;
}
