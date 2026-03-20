#!/usr/bin/env bash
set -euo pipefail

REPO_SLUG="${CODEX_SESSION_EXPORTER_REPO:-linfanxxxx/codex-session-exporter}"
REF="${CODEX_SESSION_EXPORTER_REF:-main}"
INSTALL_ROOT="${CODEX_SESSION_EXPORTER_HOME:-${HOME}/.local/share/codex-session-exporter}"
WITH_SKILL=0
ARCHIVE_URL=""

print_help() {
  cat <<'EOF'
Install codex-session-exporter directly from GitHub.

Usage:
  install-from-github.sh [--with-skill] [--ref <ref>] [--dest <path>] [--archive-url <url>]

Options:
  --with-skill        Install the bundled Codex skill after installing the CLI
  --ref <ref>         Git ref to download. Default: main
  --dest <path>       Local install directory. Default: ~/.local/share/codex-session-exporter
  --archive-url <url> Override the archive download URL
EOF
}

resolve_download_tool() {
  if command -v curl >/dev/null 2>&1; then
    printf '%s\n' "curl"
    return 0
  fi

  if command -v wget >/dev/null 2>&1; then
    printf '%s\n' "wget"
    return 0
  fi

  printf '%s\n' "curl or wget is required but neither was found." >&2
  exit 1
}

download_archive() {
  local url="$1"
  local target="$2"
  local tool="$3"

  if [ "${tool}" = "curl" ]; then
    curl -fsSL "${url}" -o "${target}"
    return 0
  fi

  wget -qO "${target}" "${url}"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --with-skill)
      WITH_SKILL=1
      shift
      ;;
    --ref)
      if [ "$#" -lt 2 ]; then
        printf '%s\n' "Missing value for --ref" >&2
        exit 1
      fi
      REF="$2"
      shift 2
      ;;
    --dest)
      if [ "$#" -lt 2 ]; then
        printf '%s\n' "Missing value for --dest" >&2
        exit 1
      fi
      INSTALL_ROOT="$2"
      shift 2
      ;;
    --archive-url)
      if [ "$#" -lt 2 ]; then
        printf '%s\n' "Missing value for --archive-url" >&2
        exit 1
      fi
      ARCHIVE_URL="$2"
      shift 2
      ;;
    -h|--help)
      print_help
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      print_help >&2
      exit 1
      ;;
  esac
done

if ! command -v tar >/dev/null 2>&1; then
  printf '%s\n' "tar is required but was not found." >&2
  exit 1
fi

DOWNLOAD_TOOL="$(resolve_download_tool)"
TMP_DIR="$(mktemp -d)"
ARCHIVE_PATH="${TMP_DIR}/repo.tar.gz"
EXTRACT_DIR="${TMP_DIR}/extract"
mkdir -p "${EXTRACT_DIR}"

cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

if [ -z "${ARCHIVE_URL}" ]; then
  ARCHIVE_URL="https://codeload.github.com/${REPO_SLUG}/tar.gz/${REF}"
fi

download_archive "${ARCHIVE_URL}" "${ARCHIVE_PATH}" "${DOWNLOAD_TOOL}"
tar -xzf "${ARCHIVE_PATH}" -C "${EXTRACT_DIR}"

SOURCE_DIR="$(find "${EXTRACT_DIR}" -mindepth 1 -maxdepth 1 -type d | head -n 1)"

if [ -z "${SOURCE_DIR}" ] || [ ! -d "${SOURCE_DIR}" ]; then
  printf '%s\n' "Failed to extract repository archive." >&2
  exit 1
fi

mkdir -p "$(dirname "${INSTALL_ROOT}")"
rm -rf "${INSTALL_ROOT}"
mv "${SOURCE_DIR}" "${INSTALL_ROOT}"

"${INSTALL_ROOT}/scripts/install-cli.sh"

if [ "${WITH_SKILL}" -eq 1 ]; then
  "${INSTALL_ROOT}/scripts/install-skill.sh"
fi

printf '\nInstalled repository to %s\n' "${INSTALL_ROOT}"
printf 'Run:\n'
printf '  codex-session-exporter list --limit 10\n'

if [ "${WITH_SKILL}" -eq 1 ]; then
  printf 'Restart Codex to pick up the skill.\n'
fi
