import { normalizeWhitespace, safeArray } from "./utils.mjs";

const BROKEN_TITLE_PATTERN =
  /(?:\bWait\b|\bOops\b|\bInvalid\b|\bHowever\b|}\s*[>\]]|need fix)/i;

export function extractTranscriptMessages(records, { includeEventFallback = true } = {}) {
  const primaryMessages = [];

  for (const entry of records) {
    const record = entry.record;

    if (record.type !== "response_item") {
      continue;
    }

    const payload = record.payload || {};

    if (payload.type !== "message") {
      continue;
    }

    const role = payload.role || "unknown";
    const text = cleanTranscriptText(extractMessageText(payload));

    if (!shouldKeepTranscriptMessage(role, text)) {
      continue;
    }

    primaryMessages.push({
      phase: payload.phase || null,
      role,
      text,
      timestamp: record.timestamp || "",
    });
  }

  if (primaryMessages.length > 0 || !includeEventFallback) {
    return mergeMessages(primaryMessages);
  }

  const fallbackMessages = [];

  for (const entry of records) {
    const record = entry.record;
    const payload = record.payload || {};

    if (record.type !== "event_msg" || payload.type !== "agent_message") {
      continue;
    }

    const text = cleanTranscriptText(payload.message || "");

    if (!text) {
      continue;
    }

    fallbackMessages.push({
      phase: payload.phase || null,
      role: "assistant",
      text,
      timestamp: record.timestamp || "",
    });
  }

  return mergeMessages(fallbackMessages);
}

export function chooseSessionTitle({ threadRecord, indexRecord, messages, sessionId }) {
  const candidateTitles = [
    threadRecord?.title,
    indexRecord?.thread_name,
    guessTitleFromMessages(messages),
  ].map((value) => normalizeWhitespace(value));

  for (const title of candidateTitles) {
    if (title && !looksLikeBrokenTitle(title)) {
      return title;
    }
  }

  for (const title of candidateTitles) {
    if (title) {
      return title;
    }
  }

  return `Codex Session ${sessionId}`;
}

export function getFirstUserMessage(messages) {
  return (
    messages.find((message) => message.role === "user" && message.text)?.text || ""
  );
}

export function countTurns(messages) {
  return messages.filter((message) => message.role === "user").length;
}

function guessTitleFromMessages(messages) {
  return normalizeWhitespace(getFirstUserMessage(messages)).slice(0, 80);
}

function looksLikeBrokenTitle(title) {
  return BROKEN_TITLE_PATTERN.test(title);
}

function shouldKeepTranscriptMessage(role, text) {
  if (role !== "user" && role !== "assistant") {
    return false;
  }

  if (!text) {
    return false;
  }

  if (role === "user" && text.trimStart().startsWith("# AGENTS.md instructions for ")) {
    return false;
  }

  return true;
}

function cleanTranscriptText(text) {
  return String(text || "").replace(/\u0000/g, "").trim();
}

function extractMessageText(payload) {
  const content = safeArray(payload.content);
  const parts = [];

  for (const item of content) {
    if (!item || typeof item !== "object") {
      continue;
    }

    if (typeof item.text === "string") {
      parts.push(item.text);
      continue;
    }

    if (typeof item.input_text === "string") {
      parts.push(item.input_text);
      continue;
    }

    if (typeof item.output_text === "string") {
      parts.push(item.output_text);
      continue;
    }
  }

  if (parts.length > 0) {
    return parts.join("\n\n");
  }

  if (typeof payload.text === "string") {
    return payload.text;
  }

  return "";
}

function mergeMessages(messages) {
  const merged = [];

  for (const message of messages) {
    const lastMessage = merged[merged.length - 1];

    if (
      lastMessage &&
      lastMessage.role === message.role &&
      (lastMessage.phase || "") === (message.phase || "")
    ) {
      lastMessage.text = `${lastMessage.text}\n\n${message.text}`;
      lastMessage.timestamp = message.timestamp || lastMessage.timestamp;
      continue;
    }

    merged.push({ ...message });
  }

  return merged;
}
