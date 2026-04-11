import { escapeHtml, formatDisplayDate } from "./utils.mjs";
import { countTurns } from "./transcript.mjs";

export function renderMarkdown(session) {
  const lines = [
    `# ${session.title}`,
    "",
    `- Session ID: ${session.sessionId}`,
    `- Title: ${session.title}`,
    `- Message Count: ${session.messages.length}`,
    `- User Turns: ${countTurns(session.messages)}`,
    `- Original CWD: ${session.threadRecord.cwd || session.sessionMeta?.cwd || "Unknown"}`,
    `- Original Rollout: ${session.sessionFile}`,
    `- Exported At: ${new Date().toISOString()}`,
  ];

  if (session.invalidLines.length > 0) {
    lines.push(`- Invalid JSONL Lines Ignored: ${session.invalidLines.length}`);
  }

  for (let index = 0; index < session.messages.length; index += 1) {
    const message = session.messages[index];
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(`## ${index + 1}. ${formatRole(message.role)}`);

    if (message.timestamp) {
      lines.push(`- Timestamp: ${formatDisplayDate(message.timestamp)}`);
    }

    if (message.phase) {
      lines.push(`- Phase: ${message.phase}`);
    }

    lines.push("");
    lines.push(message.text);
  }

  return `${lines.join("\n")}\n`;
}

export function renderHtml(session) {
  const navigationItems = buildQuestionNavigation(session.messages);
  const questionNav = renderQuestionNavigation(navigationItems);
  const messageCards = session.messages
    .map((message, index) =>
      renderMessageCard(message, index + 1, navigationItems[index] || null),
    )
    .join("\n");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(session.title)}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f1ea;
        --card: rgba(255, 255, 255, 0.88);
        --border: rgba(65, 55, 44, 0.14);
        --text: #201811;
        --muted: #6b5b4d;
        --user: #0d5c63;
        --assistant: #8b4513;
        --shadow: 0 20px 60px rgba(55, 40, 25, 0.12);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: ui-serif, Georgia, "Times New Roman", serif;
        background:
          radial-gradient(circle at top left, rgba(255, 255, 255, 0.9), transparent 40%),
          linear-gradient(180deg, #efe9de 0%, var(--bg) 100%);
        color: var(--text);
      }

      main {
        max-width: 1380px;
        margin: 0 auto;
        padding: 28px 20px 80px;
        display: grid;
        grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
        gap: 24px;
      }

      .questions-nav {
        position: relative;
      }

      .questions-nav-inner {
        position: sticky;
        top: 24px;
        background: rgba(255, 255, 255, 0.75);
        border: 1px solid var(--border);
        border-radius: 24px;
        padding: 18px;
        box-shadow: var(--shadow);
      }

      .questions-nav-title {
        margin: 0 0 6px;
        font-size: 13px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .questions-nav-summary {
        margin: 0 0 16px;
        font-size: 14px;
        line-height: 1.55;
        color: var(--muted);
      }

      .question-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 10px;
        max-height: calc(100vh - 120px);
        overflow-y: auto;
      }

      .question-link {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 12px;
        align-items: start;
        padding: 12px 12px 12px 10px;
        border-radius: 18px;
        text-decoration: none;
        color: inherit;
        background: rgba(255, 255, 255, 0.52);
        border: 1px solid rgba(65, 55, 44, 0.08);
        transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;
      }

      .question-link:hover {
        transform: translateX(2px);
        background: rgba(255, 255, 255, 0.88);
        border-color: rgba(13, 92, 99, 0.22);
      }

      .question-number {
        min-width: 2.1em;
        padding: 0.25em 0.55em;
        border-radius: 999px;
        background: rgba(13, 92, 99, 0.12);
        color: var(--user);
        font-size: 12px;
        font-weight: 700;
        text-align: center;
      }

      .question-text {
        font-size: 13px;
        line-height: 1.45;
        color: var(--text);
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow: hidden;
      }

      .messages {
        display: grid;
        gap: 18px;
        min-width: 0;
      }

      .message {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 24px;
        padding: 22px;
        box-shadow: var(--shadow);
        scroll-margin-top: 24px;
      }

      .message.user {
        border-left: 8px solid var(--user);
      }

      .message.assistant {
        border-left: 8px solid var(--assistant);
      }

      .message-head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
        margin-bottom: 14px;
      }

      .message-index {
        font-size: 12px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .message-role {
        font-size: 18px;
        font-weight: 700;
      }

      .message-question-tag {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 2.35em;
        padding: 0.28em 0.62em;
        border-radius: 999px;
        background: rgba(13, 92, 99, 0.1);
        color: var(--user);
        font-size: 12px;
        font-weight: 700;
      }

      .badge {
        font-size: 12px;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid var(--border);
        color: var(--muted);
      }

      .message-body {
        font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 15px;
        line-height: 1.78;
        color: var(--text);
        word-break: break-word;
      }

      .message-body > :first-child {
        margin-top: 0;
      }

      .message-body > :last-child {
        margin-bottom: 0;
      }

      .message-body p,
      .message-body ul,
      .message-body ol,
      .message-body blockquote,
      .message-body .table-wrap,
      .message-body pre,
      .message-body hr {
        margin: 0 0 1em;
      }

      .message-body h1,
      .message-body h2,
      .message-body h3,
      .message-body h4,
      .message-body h5,
      .message-body h6 {
        margin: 1.1em 0 0.55em;
        line-height: 1.25;
      }

      .message-body h1 {
        font-size: 1.65em;
      }

      .message-body h2 {
        font-size: 1.35em;
      }

      .message-body h3 {
        font-size: 1.18em;
      }

      .message-body ul,
      .message-body ol {
        padding-left: 1.4em;
      }

      .message-body li + li {
        margin-top: 0.35em;
      }

      .message-body blockquote {
        padding: 0.2em 0 0.2em 1em;
        border-left: 4px solid rgba(65, 55, 44, 0.18);
        color: var(--muted);
      }

      .message-body .table-wrap {
        overflow-x: auto;
      }

      .message-body table {
        width: 100%;
        border-collapse: collapse;
        min-width: 520px;
        border: 1px solid rgba(65, 55, 44, 0.12);
        border-radius: 16px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.74);
      }

      .message-body th,
      .message-body td {
        padding: 0.7em 0.85em;
        border-bottom: 1px solid rgba(65, 55, 44, 0.1);
        vertical-align: top;
      }

      .message-body th {
        background: rgba(32, 24, 17, 0.06);
        font-weight: 700;
        text-align: left;
      }

      .message-body tr:last-child td {
        border-bottom: 0;
      }

      .message-body .align-center {
        text-align: center;
      }

      .message-body .align-right {
        text-align: right;
      }

      .message-body hr {
        border: 0;
        border-top: 1px solid rgba(65, 55, 44, 0.12);
      }

      .message-body pre {
        overflow-x: auto;
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid rgba(65, 55, 44, 0.12);
        background: rgba(32, 24, 17, 0.92);
        color: #f7f1e7;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
      }

      .message-body .code-block-label {
        display: inline-block;
        margin: 0 0 0.45em;
        padding: 0.18em 0.55em;
        border-radius: 999px;
        background: rgba(32, 24, 17, 0.08);
        color: var(--muted);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .message-body .code-block-label + pre {
        margin-top: 0;
      }

      .message-body code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.92em;
      }

      .message-body p code,
      .message-body li code,
      .message-body blockquote code,
      .message-body td code {
        padding: 0.15em 0.4em;
        border-radius: 6px;
        background: rgba(13, 92, 99, 0.08);
        color: #0b4950;
      }

      .message-body pre code {
        display: block;
        white-space: pre;
      }

      .message-body a {
        color: #0d5c63;
      }

      .message-body strong {
        font-weight: 700;
      }

      @media (max-width: 920px) {
        main {
          grid-template-columns: 1fr;
        }

        .questions-nav-inner {
          position: static;
        }

        .question-list {
          max-height: none;
        }
      }
    </style>
  </head>
  <body>
    <main>
      ${questionNav}
      <section class="messages">
        ${messageCards}
      </section>
    </main>
  </body>
</html>
`;
}

function renderQuestionNavigation(navigationItems) {
  const items = Object.values(navigationItems);
  const summary = `共 ${items.length} 个问题。`;

  if (items.length === 0) {
    return `<aside class="questions-nav" aria-label="问题导航">
      <div class="questions-nav-inner">
        <p class="questions-nav-title">问题导航</p>
        <p class="questions-nav-summary">当前导出里没有可导航的用户提问。</p>
      </div>
    </aside>`;
  }

  const links = items
    .map(
      (item) => `<li>
        <a class="question-link" href="#${escapeHtml(item.anchorId)}">
          <span class="question-number">Q${item.questionNumber}</span>
          <span class="question-text">${escapeHtml(item.label)}</span>
        </a>
      </li>`,
    )
    .join("");

  return `<aside class="questions-nav" aria-label="问题导航">
    <div class="questions-nav-inner">
      <p class="questions-nav-title">问题导航</p>
      <p class="questions-nav-summary">${escapeHtml(summary)}</p>
      <ol class="question-list">${links}</ol>
    </div>
  </aside>`;
}

function renderMessageCard(message, index, navigationItem) {
  const badges = [];

  if (message.phase) {
    badges.push(`<span class="badge">${escapeHtml(message.phase)}</span>`);
  }

  if (message.timestamp) {
    badges.push(
      `<span class="badge">${escapeHtml(formatDisplayDate(message.timestamp))}</span>`,
    );
  }

  const anchorId = navigationItem?.anchorId || `message-${index}`;
  const questionTag = navigationItem
    ? `<span class="message-question-tag">Q${navigationItem.questionNumber}</span>`
    : "";

  return `<article id="${escapeHtml(anchorId)}" class="message ${escapeHtml(message.role)}">
    <div class="message-head">
      <span class="message-index">Message ${index}</span>
      ${questionTag}
      <span class="message-role">${escapeHtml(formatRole(message.role))}</span>
      ${badges.join("")}
    </div>
    <div class="message-body">${renderMessageBodyHtml(message.text)}</div>
  </article>`;
}

function formatRole(role) {
  return role === "assistant" ? "Assistant" : role === "user" ? "User" : role;
}

function buildQuestionNavigation(messages) {
  const navigationItems = {};
  let questionNumber = 0;

  messages.forEach((message, index) => {
    if (message.role !== "user") {
      return;
    }

    questionNumber += 1;
    navigationItems[index] = {
      anchorId: `question-${questionNumber}`,
      questionNumber,
      label: summarizeQuestion(message.text),
    };
  });

  return navigationItems;
}

function summarizeQuestion(text) {
  const summary = String(text || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 72);

  if (!summary) {
    return "未命名问题";
  }

  return summary.length < String(text || "").trim().length ? `${summary}...` : summary;
}

function renderMessageBodyHtml(text) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];

  for (let index = 0; index < lines.length; ) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const codeFenceMatch = line.match(/^```([^\s`]*)\s*$/);
    if (codeFenceMatch) {
      const language = codeFenceMatch[1] || "";
      const codeLines = [];
      index += 1;

      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      const codeLabel = language
        ? `<div class="code-block-label">${escapeHtml(language)}</div>`
        : "";

      blocks.push(
        `${codeLabel}<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`,
      );
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      blocks.push("<hr />");
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines = [];

      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }

      blocks.push(`<blockquote>${renderParagraphHtml(quoteLines)}</blockquote>`);
      continue;
    }

    if (isMarkdownTableStart(lines, index)) {
      const { nextIndex, tableHtml } = renderMarkdownTable(lines, index);
      blocks.push(tableHtml);
      index = nextIndex;
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      const items = [];

      while (index < lines.length && /^[-*+]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^[-*+]\s+/, ""));
        index += 1;
      }

      blocks.push(
        `<ul>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = [];

      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s+/, ""));
        index += 1;
      }

      blocks.push(
        `<ol>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ol>`,
      );
      continue;
    }

    const paragraphLines = [];

    while (index < lines.length && shouldContinueParagraph(lines, index)) {
      paragraphLines.push(lines[index]);
      index += 1;
    }

    blocks.push(`<p>${renderParagraphHtml(paragraphLines)}</p>`);
  }

  return blocks.join("\n");
}

function renderParagraphHtml(lines) {
  return lines.map((line) => renderInlineMarkdown(line)).join("<br />\n");
}

function shouldContinueParagraph(lines, index) {
  const line = lines[index];

  if (!line.trim()) {
    return false;
  }

  return !(
    isMarkdownTableStart(lines, index) ||
    /^```([^\s`]*)\s*$/.test(line) ||
    /^(#{1,6})\s+/.test(line) ||
    /^---+$/.test(line.trim()) ||
    /^>\s?/.test(line) ||
    /^[-*+]\s+/.test(line) ||
    /^\d+\.\s+/.test(line)
  );
}

function isMarkdownTableStart(lines, index) {
  if (index + 1 >= lines.length) {
    return false;
  }

  const headerLine = lines[index];
  const delimiterLine = lines[index + 1];

  if (!looksLikeTableRow(headerLine) || !isTableDelimiterRow(delimiterLine)) {
    return false;
  }

  const headerCells = splitMarkdownTableRow(headerLine);
  const delimiterCells = splitMarkdownTableRow(delimiterLine);

  return headerCells.length > 0 && headerCells.length === delimiterCells.length;
}

function renderMarkdownTable(lines, startIndex) {
  const headerCells = splitMarkdownTableRow(lines[startIndex]);
  const alignments = splitMarkdownTableRow(lines[startIndex + 1]).map(parseTableAlignment);
  const bodyRows = [];
  let index = startIndex + 2;

  while (index < lines.length && looksLikeTableRow(lines[index])) {
    const rowCells = splitMarkdownTableRow(lines[index]);

    if (rowCells.length === 0) {
      break;
    }

    bodyRows.push(rowCells);
    index += 1;
  }

  const normalizedColumnCount = Math.max(
    headerCells.length,
    ...bodyRows.map((cells) => cells.length),
  );
  const headerHtml = normalizeTableRow(headerCells, normalizedColumnCount)
    .map((cell, cellIndex) =>
      `<th${getTableAlignClass(alignments[cellIndex])}>${renderInlineMarkdown(cell)}</th>`,
    )
    .join("");
  const bodyHtml = bodyRows
    .map((row) =>
      `<tr>${normalizeTableRow(row, normalizedColumnCount)
        .map(
          (cell, cellIndex) =>
            `<td${getTableAlignClass(alignments[cellIndex])}>${renderInlineMarkdown(cell)}</td>`,
        )
        .join("")}</tr>`,
    )
    .join("");

  return {
    nextIndex: index,
    tableHtml: `<div class="table-wrap"><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`,
  };
}

function looksLikeTableRow(line) {
  const trimmed = line.trim();

  return trimmed.includes("|") && !trimmed.startsWith("```");
}

function isTableDelimiterRow(line) {
  const cells = splitMarkdownTableRow(line);

  return (
    cells.length > 0 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()))
  );
}

function splitMarkdownTableRow(line) {
  const trimmed = line.trim();

  if (!trimmed.includes("|")) {
    return [];
  }

  const row = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  const cells = [];
  let current = "";
  let escaping = false;

  for (const character of row) {
    if (escaping) {
      current += character;
      escaping = false;
      continue;
    }

    if (character === "\\") {
      escaping = true;
      current += character;
      continue;
    }

    if (character === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current.trim());
  return cells;
}

function parseTableAlignment(cell) {
  const trimmed = cell.trim();

  if (trimmed.startsWith(":") && trimmed.endsWith(":")) {
    return "center";
  }

  if (trimmed.endsWith(":")) {
    return "right";
  }

  return "left";
}

function getTableAlignClass(alignment) {
  if (alignment === "center") {
    return ' class="align-center"';
  }

  if (alignment === "right") {
    return ' class="align-right"';
  }

  return "";
}

function normalizeTableRow(cells, size) {
  return Array.from({ length: size }, (_, index) => cells[index] || "");
}

function renderInlineMarkdown(text) {
  let output = "";

  for (let index = 0; index < text.length; ) {
    if (text.startsWith("`", index)) {
      const end = text.indexOf("`", index + 1);

      if (end !== -1) {
        output += `<code>${escapeHtml(text.slice(index + 1, end))}</code>`;
        index = end + 1;
        continue;
      }
    }

    if (text.startsWith("**", index)) {
      const end = text.indexOf("**", index + 2);

      if (end !== -1) {
        output += `<strong>${renderInlineMarkdown(text.slice(index + 2, end))}</strong>`;
        index = end + 2;
        continue;
      }
    }

    if (text.startsWith("[", index)) {
      const labelEnd = text.indexOf("]", index + 1);
      const hasUrl = labelEnd !== -1 && text[labelEnd + 1] === "(";
      const urlEnd = hasUrl ? text.indexOf(")", labelEnd + 2) : -1;

      if (labelEnd !== -1 && urlEnd !== -1) {
        const label = text.slice(index + 1, labelEnd);
        const href = text.slice(labelEnd + 2, urlEnd);
        output += `<a href="${escapeHtml(href)}">${renderInlineMarkdown(label)}</a>`;
        index = urlEnd + 1;
        continue;
      }
    }

    output += escapeHtml(text[index]);
    index += 1;
  }

  return output;
}
