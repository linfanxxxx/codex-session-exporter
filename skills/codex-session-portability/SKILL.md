---
name: codex-session-portability
description: Export, import, inspect, and share local Codex sessions as portable bundles, Markdown, or HTML. Use when a user wants to move a Codex session to another client, archive it for offline reading, or inspect local Codex session metadata.
---

# Codex Session Portability

Use this skill when the user wants to inspect, export, import, or share local Codex sessions.

## Prefer The Runner Script

Use [scripts/run-portability.sh](scripts/run-portability.sh) instead of rebuilding command lines by hand. It prefers a globally installed `codex-session-portability` command and falls back to the copy bundled in this repo.

## Workflow

1. Resolve the session first.
2. Use `list` or `inspect` before exporting or importing.
3. Pick the smallest output that matches the request:
   - `export md` for offline reading in editors
   - `export html` for a readable browser page
   - `export bundle` for migration to another Codex client
4. When importing, prefer:
   - `--target-cwd <path>` when the session should point at one exact workspace
   - `--cwd-map <old>=<new>` when remapping a shared root prefix
5. If the launcher cannot find Node 22+, stop and tell the user to install or expose a Node 22 binary.

## Common Commands

```bash
scripts/run-portability.sh list --limit 10
scripts/run-portability.sh inspect <session-id>
scripts/run-portability.sh export md <session-id> --output ./exports/session.md
scripts/run-portability.sh export html <session-id> --output ./exports/session.html
scripts/run-portability.sh export bundle <session-id> --output ./exports/session.codex-session
scripts/run-portability.sh import bundle ./exports/session.codex-session --target-cwd /new/workspace
```

## Notes

- The CLI uses Node's built-in `node:sqlite` support and requires Node 22+.
- Readable exports keep only user and assistant messages, but bundle exports also preserve raw session JSONL and thread metadata.
- The import/export format follows the current local Codex storage layout, so future Codex schema changes may require tool updates.
