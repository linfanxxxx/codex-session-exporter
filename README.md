# Codex Session Exporter

`codex-session-exporter` is a standalone CLI and repo-ready package for exporting local Codex sessions into:

- readable Markdown
- readable single-file HTML
- a portable bundle that can be imported into another local Codex home

It is designed around the storage shape observed in local Codex Desktop / CLI environments:

- `~/.codex/sessions/**/*.jsonl`
- `~/.codex/session_index.jsonl`
- `~/.codex/state_5.sqlite`

## Capabilities

- List recent sessions from a Codex home
- Inspect one session and resolve its JSONL rollout path
- Export readable transcripts to Markdown or HTML
- Export a bundle with:
  - raw session JSONL
  - thread metadata
  - dynamic tool metadata
  - a manifest
  - readable transcripts
- Import that bundle into another Codex home
- Rewrite the imported `cwd` with `--target-cwd` or `--cwd-map`

## Runtime

- The actual CLI uses Node's built-in `node:sqlite` module and requires a discoverable `Node 22+` runtime.
- The launcher at `bin/codex-session-exporter.mjs` can start under `Node 18+`, search for Node 22 automatically, and then re-exec the CLI.
- Automatic discovery checks:
  - the current `node`
  - `CODEX_SESSION_EXPORTER_NODE`
  - `NVM_BIN/node`
  - `PATH` entries for `node`, `node22`, and `nodejs`
  - `~/.nvm/versions/node/*/bin/node`

## Repo Layout

```text
codex-session-exporter/
  bin/
  scripts/
  skills/
  src/
  LICENSE
  README.md
  package.json
```

## Sharing

Share the whole repository directory. The recipient can:

1. clone or copy the repo
2. run the launcher directly
3. optionally install the skill wrapper

Direct launcher usage:

```bash
./bin/codex-session-exporter.mjs list --limit 10
```

If the executable bit is unavailable in the target environment:

```bash
node ./bin/codex-session-exporter.mjs list --limit 10
```

Optional global link:

```bash
npm link
codex-session-exporter list --limit 10
```

The legacy command name `codex-session-portability` is still exposed as a compatibility alias.

## Usage

List recent sessions:

```bash
./bin/codex-session-exporter.mjs list --limit 10
```

Inspect one session:

```bash
./bin/codex-session-exporter.mjs inspect 019d0a15-0c56-7b61-86ed-5b1f41c263cf
```

Export Markdown:

```bash
./bin/codex-session-exporter.mjs export md 019d0a15-0c56-7b61-86ed-5b1f41c263cf --output ./exports/session.md
```

Export HTML:

```bash
./bin/codex-session-exporter.mjs export html 019d0a15-0c56-7b61-86ed-5b1f41c263cf --output ./exports/session.html
```

Export a portable bundle:

```bash
./bin/codex-session-exporter.mjs export bundle 019d0a15-0c56-7b61-86ed-5b1f41c263cf --output ./exports/session.codex-session
```

Import the bundle into another Codex home:

```bash
./bin/codex-session-exporter.mjs import bundle ./exports/session.codex-session --codex-home ~/.codex
```

Import and rewrite the working directory:

```bash
./bin/codex-session-exporter.mjs import bundle ./exports/session.codex-session --codex-home ~/.codex --target-cwd /new/workspace
```

Prefix-rewrite the working directory:

```bash
./bin/codex-session-exporter.mjs import bundle ./exports/session.codex-session --codex-home ~/.codex --cwd-map /old/root=/new/root
```

## Skill Wrapper

This repo also includes an optional skill at `skills/codex-session-exporter`.

Install it into the local Codex skills directory:

```bash
./scripts/install-skill.sh
```

The skill prefers a globally installed `codex-session-exporter` command and otherwise uses the repo path recorded at install time. The legacy `codex-session-portability` command is still supported as a compatibility alias. If you move or delete the repo later, either reinstall the skill from the new repo path or install the CLI globally with `npm link`.

## Bundle Layout

```text
session.codex-session/
  manifest.json
  transcript.md
  transcript.html
  raw/
    session.jsonl
    thread.json
    thread-dynamic-tools.json
    index-record.json
```

## Notes

- Readable exports intentionally keep only user and assistant messages. Raw tool calls and raw tool outputs remain in `raw/session.jsonl`.
- Import appends a new line to `session_index.jsonl` rather than rewriting old lines.
- Imported sessions are restored into `threads`, `thread_dynamic_tools`, `session_index.jsonl`, and `sessions/...jsonl`.
- This tool depends on the current local Codex storage layout and requires `Node 22+` because it uses Node's built-in `node:sqlite` module.
- The launcher itself can run on older Node versions, but execution still needs a reachable `Node 22+` binary.
- It does not require a separately installed system `sqlite3` command anymore.
- If Codex changes its local schema later, import logic may need updates.
