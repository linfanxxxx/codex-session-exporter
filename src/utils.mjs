import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export function expandHome(inputPath) {
  if (!inputPath) {
    return inputPath;
  }

  if (inputPath === "~") {
    return os.homedir();
  }

  if (inputPath.startsWith("~/")) {
    return path.join(os.homedir(), inputPath.slice(2));
  }

  return inputPath;
}

export function resolveCodexHome(codexHome) {
  const defaultHome = path.join(os.homedir(), ".codex");
  return path.resolve(expandHome(codexHome || defaultHome));
}

export async function readJson(filePath) {
  const source = await fs.readFile(filePath, "utf8");
  return JSON.parse(source);
}

export async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function writeText(filePath, text) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, text, "utf8");
}

export async function appendJsonlRecord(filePath, record) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");
}

export async function readJsonl(filePath) {
  let source;

  try {
    source = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { records: [], invalidLines: [] };
    }

    throw error;
  }

  const lines = source.split(/\r?\n/);
  const records = [];
  const invalidLines = [];

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];

    if (!rawLine.trim()) {
      continue;
    }

    try {
      records.push({
        lineNumber: index + 1,
        record: JSON.parse(rawLine),
      });
    } catch (error) {
      invalidLines.push({
        lineNumber: index + 1,
        rawLine,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { records, invalidLines };
}

export function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function toIsoFromEpochSeconds(seconds) {
  const value = Number(seconds);

  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }

  return new Date(value * 1000).toISOString();
}

export function fromIsoToEpochSeconds(value, fallback = 0) {
  const timestamp = Date.parse(String(value || ""));

  if (Number.isNaN(timestamp)) {
    return fallback;
  }

  return Math.floor(timestamp / 1000);
}

export function formatDisplayDate(value) {
  if (value === null || value === undefined || value === "") {
    return "Unknown";
  }

  const date =
    typeof value === "number"
      ? new Date(value * 1000)
      : new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("zh-CN", {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

export function sanitizeFileName(value, fallback = "session") {
  const normalized = normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized.slice(0, 80) || fallback;
}

export function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function toPosixPath(filePath) {
  return String(filePath || "").split(path.sep).join("/");
}

export function relativeTo(rootPath, absolutePath) {
  return toPosixPath(path.relative(rootPath, absolutePath));
}

export function parseInteger(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}
