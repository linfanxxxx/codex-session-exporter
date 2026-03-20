#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_NODE_MAJOR = 22;
const CURRENT_NODE_VERSION = process.versions.node;
const CURRENT_NODE_MAJOR = parseMajorVersion(CURRENT_NODE_VERSION);
const CURRENT_NODE_PATH = process.execPath;
const LAUNCHER_PATH = fileURLToPath(import.meta.url);
const CLI_PATH = path.resolve(path.dirname(LAUNCHER_PATH), "../src/cli.mjs");

if (CURRENT_NODE_MAJOR >= REQUIRED_NODE_MAJOR) {
  await import(CLI_PATH);
}

const candidate = findBestNodeCandidate();

if (!candidate) {
  printNode22RequiredMessage();
  process.exit(1);
}

console.error(
  `[codex-session-exporter] Using Node ${candidate.version} from ${candidate.path}`,
);

const result = spawnSync(candidate.path, [CLI_PATH, ...process.argv.slice(2)], {
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);

function findBestNodeCandidate() {
  const candidates = [];

  pushCandidate(candidates, process.env.CODEX_SESSION_EXPORTER_NODE);
  pushCandidate(candidates, process.env.CODEX_SESSION_PORTABILITY_NODE);
  pushCandidate(candidates, process.env.NVM_BIN ? path.join(process.env.NVM_BIN, "node") : "");
  pushCandidate(candidates, process.env.VOLTA_HOME ? path.join(process.env.VOLTA_HOME, "bin", "node") : "");

  for (const executableName of ["node", "node22", "nodejs"]) {
    for (const executablePath of findExecutablesOnPath(executableName)) {
      pushCandidate(candidates, executablePath);
    }
  }

  for (const executablePath of findNvmNodes()) {
    pushCandidate(candidates, executablePath);
  }

  const versionedCandidates = candidates
    .map((candidatePath) => ({
      path: candidatePath,
      version: probeNodeVersion(candidatePath),
    }))
    .filter((candidate) => candidate.version)
    .filter((candidate) => parseMajorVersion(candidate.version) >= REQUIRED_NODE_MAJOR)
    .sort((left, right) => compareVersions(right.version, left.version));

  return versionedCandidates[0] || null;
}

function findExecutablesOnPath(executableName) {
  const pathEntries = (process.env.PATH || "")
    .split(path.delimiter)
    .filter(Boolean);
  const executableNames = process.platform === "win32"
    ? expandWindowsExecutableNames(executableName)
    : [executableName];
  const matches = [];

  for (const entry of pathEntries) {
    for (const candidateName of executableNames) {
      const candidatePath = path.join(entry, candidateName);

      if (existsSync(candidatePath)) {
        matches.push(candidatePath);
      }
    }
  }

  return matches;
}

function findNvmNodes() {
  const nvmRoot = path.join(os.homedir(), ".nvm", "versions", "node");

  if (!existsSync(nvmRoot)) {
    return [];
  }

  const versionDirectories = readdirSync(nvmRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => compareVersions(stripNodePrefix(right), stripNodePrefix(left)));

  return versionDirectories.map((versionDirectory) =>
    path.join(nvmRoot, versionDirectory, "bin", "node"),
  );
}

function expandWindowsExecutableNames(executableName) {
  const extensions = (process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM")
    .split(";")
    .filter(Boolean);

  return extensions.map((extension) => `${executableName}${extension.toLowerCase()}`);
}

function pushCandidate(candidates, candidatePath) {
  if (!candidatePath) {
    return;
  }

  const resolvedPath = path.resolve(candidatePath);

  if (candidates.includes(resolvedPath)) {
    return;
  }

  if (existsSync(resolvedPath)) {
    candidates.push(resolvedPath);
  }
}

function probeNodeVersion(nodePath) {
  const result = spawnSync(nodePath, ["-p", "process.versions.node"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  if (result.error || result.status !== 0) {
    return "";
  }

  return result.stdout.trim();
}

function parseMajorVersion(version) {
  return Number.parseInt(String(version).split(".")[0], 10) || 0;
}

function compareVersions(leftVersion, rightVersion) {
  const leftParts = String(leftVersion)
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = String(rightVersion)
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);

    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

function stripNodePrefix(version) {
  return version.startsWith("v") ? version.slice(1) : version;
}

function printNode22RequiredMessage() {
  console.error("codex-session-exporter requires Node 22 or newer.");
  console.error(`Current runtime: ${CURRENT_NODE_VERSION} (${CURRENT_NODE_PATH})`);
  console.error("");
  console.error("Install or expose a Node 22 binary, then rerun the command.");
  console.error("Supported discovery paths:");
  console.error("- current PATH entries for node, node22, or nodejs");
  console.error("- $CODEX_SESSION_EXPORTER_NODE");
  console.error("- $CODEX_SESSION_PORTABILITY_NODE");
  console.error("- $NVM_BIN/node");
  console.error("- ~/.nvm/versions/node/*/bin/node");
}
