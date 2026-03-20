#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [ -n "${CODEX_HOME:-}" ]; then
  exec "${REPO_ROOT}/bin/codex-session-exporter.mjs" install skill --codex-home "${CODEX_HOME}"
fi

exec "${REPO_ROOT}/bin/codex-session-exporter.mjs" install skill
