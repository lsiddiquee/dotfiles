#!/usr/bin/env bash
#
# Personal dotfiles installer.
#
# Runs automatically when a VS Code Dev Container or GitHub Codespace is created
# (VS Code clones your dotfiles repo, then runs the first of install.sh /
# bootstrap.sh / setup.sh it finds). Also safe to run by hand: `bash install.sh`.
#
# Philosophy: idempotent and non-destructive. Every step checks before it writes,
# so re-running (or a partial previous run) never duplicates lines or clobbers
# existing config. A single optional step must not abort the whole install.
set -uo pipefail

echo "==> dotfiles: starting install for $(whoami)"

# ---------------------------------------------------------------------------
# npm / pnpm registry — resolve packages through the supply-chain-screened
# Microsoft package-feed proxy. This is ENV-SPECIFIC and belongs in your user
# ~/.npmrc, never in a project repo (a committed registry breaks contributors
# who can't reach it).
# ---------------------------------------------------------------------------
ensure_line() {
  # ensure_line <file> <line> — append <line> to <file> only if absent.
  local file="$1" line="$2"
  mkdir -p "$(dirname "${file}")"
  touch "${file}"
  if grep -qxF "${line}" "${file}"; then
    echo "    ok: '${line}' already in ${file}"
  else
    printf '%s\n' "${line}" >>"${file}"
    echo "    added: '${line}' -> ${file}"
  fi
}

echo "==> npmrc: ensuring the package-feed proxy registry"
ensure_line "${HOME}/.npmrc" "registry=https://packagefeedproxy.microsoft.io/npm/"

# ---------------------------------------------------------------------------
# Add more personal setup below (git config, aliases, shell rc, etc.). Keep each
# step idempotent — reuse ensure_line for "append if missing" edits.
# ---------------------------------------------------------------------------

echo "==> dotfiles: install complete"
