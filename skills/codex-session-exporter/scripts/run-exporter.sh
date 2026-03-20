#!/usr/bin/env bash
set -euo pipefail

if command -v codex-session-exporter >/dev/null 2>&1; then
  exec codex-session-exporter "$@"
fi

if command -v codex-session-portability >/dev/null 2>&1; then
  exec codex-session-portability "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_ENV_FILE="${SCRIPT_DIR}/../.install-env"

if [ -f "${INSTALL_ENV_FILE}" ]; then
  # The installer records the source repo so the skill can still find the CLI
  # after being copied into ~/.codex/skills.
  # shellcheck source=/dev/null
  . "${INSTALL_ENV_FILE}"
fi

if [ -n "${CODEX_SESSION_EXPORTER_REPO_ROOT:-}" ] && [ -x "${CODEX_SESSION_EXPORTER_REPO_ROOT}/bin/codex-session-exporter.mjs" ]; then
  exec "${CODEX_SESSION_EXPORTER_REPO_ROOT}/bin/codex-session-exporter.mjs" "$@"
fi

if [ -n "${CODEX_SESSION_PORTABILITY_REPO_ROOT:-}" ] && [ -x "${CODEX_SESSION_PORTABILITY_REPO_ROOT}/bin/codex-session-exporter.mjs" ]; then
  exec "${CODEX_SESSION_PORTABILITY_REPO_ROOT}/bin/codex-session-exporter.mjs" "$@"
fi

if [ -n "${CODEX_SESSION_PORTABILITY_REPO_ROOT:-}" ] && [ -x "${CODEX_SESSION_PORTABILITY_REPO_ROOT}/bin/codex-session-portability.mjs" ]; then
  exec "${CODEX_SESSION_PORTABILITY_REPO_ROOT}/bin/codex-session-portability.mjs" "$@"
fi

REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

if [ -x "${REPO_ROOT}/bin/codex-session-exporter.mjs" ]; then
  exec "${REPO_ROOT}/bin/codex-session-exporter.mjs" "$@"
fi

if [ -x "${REPO_ROOT}/bin/codex-session-portability.mjs" ]; then
  exec "${REPO_ROOT}/bin/codex-session-portability.mjs" "$@"
fi

printf '%s\n' "codex-session-exporter CLI not found. Install it globally or reinstall the skill from the tool repo." >&2
exit 1
