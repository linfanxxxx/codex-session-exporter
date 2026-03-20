#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TARGET_BIN_DIR="${CODEX_SESSION_EXPORTER_BIN_DIR:-${HOME}/.local/bin}"
EXPORTER_SOURCE="${REPO_ROOT}/bin/codex-session-exporter.mjs"
PORTABILITY_SOURCE="${REPO_ROOT}/bin/codex-session-portability.mjs"
EXPORTER_TARGET="${TARGET_BIN_DIR}/codex-session-exporter"
PORTABILITY_TARGET="${TARGET_BIN_DIR}/codex-session-portability"

mkdir -p "${TARGET_BIN_DIR}"
ln -sfn "${EXPORTER_SOURCE}" "${EXPORTER_TARGET}"
ln -sfn "${PORTABILITY_SOURCE}" "${PORTABILITY_TARGET}"

printf 'Installed CLI command: %s\n' "${EXPORTER_TARGET}"
printf 'Installed compatibility alias: %s\n' "${PORTABILITY_TARGET}"

case ":${PATH}:" in
  *":${TARGET_BIN_DIR}:"*)
    ;;
  *)
    printf '\nAdd this directory to PATH if needed:\n'
    printf '  export PATH="%s:$PATH"\n' "${TARGET_BIN_DIR}"
    ;;
esac

printf '\nRun:\n'
printf '  codex-session-exporter list --limit 10\n'
