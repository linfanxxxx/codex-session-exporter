# Codex Session Exporter

Export, inspect, and share local Codex sessions as Markdown, HTML, or portable bundles.

[简体中文](./README.zh-CN.md)

`codex-session-exporter` is a standalone CLI for working with locally stored Codex sessions. It can:

- list and inspect sessions from a local Codex home
- export readable Markdown transcripts
- export single-file HTML transcripts for offline viewing
- export portable bundles for client-to-client transfer
- import those bundles back into another local Codex home

It is designed around the local storage shape used by current Codex Desktop / CLI installs:

- `~/.codex/sessions/**/*.jsonl`
- `~/.codex/session_index.jsonl`
- `~/.codex/state_5.sqlite`

## Quick Start

Run the launcher directly:

```bash
./bin/codex-session-exporter.mjs list --limit 10
```

Export one session to Markdown:

```bash
./bin/codex-session-exporter.mjs export md <session-id> --output ./exports/session.md
```

Export one session to HTML:

```bash
./bin/codex-session-exporter.mjs export html <session-id> --output ./exports/session.html
```

Export one session as a portable bundle:

```bash
./bin/codex-session-exporter.mjs export bundle <session-id> --output ./exports/session.codex-session
```

Import a bundle into another Codex home:

```bash
./bin/codex-session-exporter.mjs import bundle ./exports/session.codex-session --codex-home ~/.codex
```

## Why This Exists

Codex currently stores sessions locally, but there is no built-in public workflow for:

- moving a session to another Codex client
- exporting a readable archive for offline review
- preserving the raw session JSONL together with thread metadata

This tool fills that gap while keeping the export format transparent and file-based.

## Requirements

- A reachable `Node 22+` runtime for the actual CLI
- Or `Node 18+` for the launcher, as long as it can discover a `Node 22+` binary
- A local Codex home, defaulting to `~/.codex`

The launcher at `bin/codex-session-exporter.mjs` can search for `Node 22+` in:

- the current `node`
- `CODEX_SESSION_EXPORTER_NODE`
- the legacy compatibility variable `CODEX_SESSION_PORTABILITY_NODE`
- `NVM_BIN/node`
- `PATH` entries for `node`, `node22`, and `nodejs`
- `~/.nvm/versions/node/*/bin/node`

## Common Commands

List recent sessions:

```bash
./bin/codex-session-exporter.mjs list --limit 20
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

Import and rewrite the working directory:

```bash
./bin/codex-session-exporter.mjs import bundle ./exports/session.codex-session --codex-home ~/.codex --target-cwd /new/workspace
```

Import and rewrite a shared root prefix:

```bash
./bin/codex-session-exporter.mjs import bundle ./exports/session.codex-session --codex-home ~/.codex --cwd-map /old/root=/new/root
```

## Skill Wrapper

This repo also includes an optional Codex skill at `skills/codex-session-exporter`.

Install it into the local Codex skills directory:

```bash
./scripts/install-skill.sh
```

The skill prefers a globally installed `codex-session-exporter` command and otherwise uses the repo path recorded at install time.

## Compatibility

- The legacy command name `codex-session-portability` is still exposed as a compatibility alias.
- The readable exports keep only user and assistant messages.
- Raw tool calls and raw tool outputs remain available in bundle exports under `raw/session.jsonl`.
- The import/export flow depends on the current local Codex storage layout and may need updates if Codex changes its schema later.

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

## Repo Layout

```text
codex-session-exporter/
  bin/
  scripts/
  skills/
  src/
  LICENSE
  README.md
  README.zh-CN.md
  package.json
```
