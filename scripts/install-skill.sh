#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SOURCE_SKILL_DIR="${REPO_ROOT}/skills/codex-session-portability"
CODEX_HOME_DIR="${CODEX_HOME:-${HOME}/.codex}"
TARGET_SKILL_DIR="${CODEX_HOME_DIR}/skills/codex-session-portability"
INSTALL_ENV_FILE="${TARGET_SKILL_DIR}/.install-env"

mkdir -p "${CODEX_HOME_DIR}/skills"
rm -rf "${TARGET_SKILL_DIR}"
cp -R "${SOURCE_SKILL_DIR}" "${TARGET_SKILL_DIR}"
chmod +x "${TARGET_SKILL_DIR}/scripts/run-portability.sh"
printf 'CODEX_SESSION_PORTABILITY_REPO_ROOT=%q\n' "${REPO_ROOT}" > "${INSTALL_ENV_FILE}"

printf 'Installed skill to %s\n' "${TARGET_SKILL_DIR}"
