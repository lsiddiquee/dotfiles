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
# existing config. Failures are loud: the script aborts rather than silently
# leaving the environment half-configured.
set -euo pipefail

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
# Copilot skills — installed under $HOME, which is wiped on every dev container
# rebuild. Skills authored in this repo are symlinked; third-party skills are
# real git clones, so do not edit their working trees in place or the next pull
# will conflict.
# ---------------------------------------------------------------------------
require_cmd() {
  # require_cmd <name> — abort with a clear message if <name> is not on PATH.
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: required command '$1' not found on PATH" >&2
    exit 1
  fi
}

COPILOT_SKILLS_DIR="${HOME}/.copilot/skills"

# ---------------------------------------------------------------------------
# Custom Copilot skills — symlinked from skills/ into ~/.copilot/skills. The
# link resolves to wherever this script ran from: your own working tree when run
# by hand, or VS Code's throwaway dotfiles clone inside a container. Linked
# before the third-party skills below so a failure there can't block your own.
# ---------------------------------------------------------------------------
DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CUSTOM_SKILLS_SRC="${DOTFILES_DIR}/skills"

echo "==> copilot skills: custom (${CUSTOM_SKILLS_SRC})"
if [[ ! -d "${CUSTOM_SKILLS_SRC}" ]]; then
  echo "    none: ${CUSTOM_SKILLS_SRC} does not exist, skipping"
else
  mkdir -p "${COPILOT_SKILLS_DIR}"
  shopt -s nullglob
  for skill_src in "${CUSTOM_SKILLS_SRC}"/*/; do
    skill_src="${skill_src%/}"
    skill_name="$(basename "${skill_src}")"
    skill_dest="${COPILOT_SKILLS_DIR}/${skill_name}"

    if [[ ! -f "${skill_src}/SKILL.md" ]]; then
      echo "ERROR: ${skill_src} has no SKILL.md; a skill directory must define one" >&2
      exit 1
    fi

    if [[ -L "${skill_dest}" ]]; then
      current="$(readlink -f "${skill_dest}" || true)"
      if [[ "${current}" == "${skill_src}" ]]; then
        echo "    ok: ${skill_name} already linked"
        continue
      fi
      echo "    relinking ${skill_name} (was -> ${current:-<broken>})"
      rm "${skill_dest}"
    elif [[ -e "${skill_dest}" ]]; then
      echo "ERROR: ${skill_dest} exists and is not a symlink; move or remove it and re-run" >&2
      exit 1
    fi

    ln -s "${skill_src}" "${skill_dest}"
    echo "    linked: ${skill_name} -> ${skill_src}"
  done
  shopt -u nullglob
fi

# ---------------------------------------------------------------------------
# Third-party Copilot skills.
# ---------------------------------------------------------------------------
require_cmd git
require_cmd python3

REMOVE_FLUFF_DIR="${COPILOT_SKILLS_DIR}/remove-fluff"
REMOVE_FLUFF_REPO="https://github.com/iharshulhan/remove-fluff.git"

echo "==> copilot skill: remove-fluff"
if [[ -d "${REMOVE_FLUFF_DIR}/.git" ]]; then
  echo "    updating existing clone at ${REMOVE_FLUFF_DIR}"
  git -C "${REMOVE_FLUFF_DIR}" pull --ff-only
else
  echo "    cloning ${REMOVE_FLUFF_REPO}"
  mkdir -p "${COPILOT_SKILLS_DIR}"
  git clone "${REMOVE_FLUFF_REPO}" "${REMOVE_FLUFF_DIR}"
fi

if ! python3 -m pip --version >/dev/null 2>&1; then
  # Some base images ship python3 without pip; ensurepip is stdlib-bundled.
  echo "    bootstrapping pip"
  if ! python3 -m ensurepip --user; then
    echo "ERROR: python3 has no pip and ensurepip could not bootstrap it." >&2
    echo "       Install pip for this interpreter (Debian/Ubuntu: apt install python3-pip) and re-run." >&2
    exit 1
  fi
fi

echo "    installing python dependencies"
python3 -m pip install --user -r "${REMOVE_FLUFF_DIR}/requirements.txt"

echo "    verifying scorer"
if ! python3 "${REMOVE_FLUFF_DIR}/scripts/svi.py" --help >/dev/null; then
  echo "ERROR: ${REMOVE_FLUFF_DIR}/scripts/svi.py --help failed" >&2
  exit 1
fi
echo "    ok: remove-fluff ready at ${REMOVE_FLUFF_DIR}"

# ---------------------------------------------------------------------------
# Add more personal setup below (git config, aliases, shell rc, etc.). Keep each
# step idempotent — reuse ensure_line for "append if missing" edits.
# ---------------------------------------------------------------------------

echo "==> dotfiles: install complete"
