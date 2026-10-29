#!/usr/bin/env bash
set -euo pipefail

mode="${DOTFILES_MODEL_REVIEW:-auto}"
case "${mode}" in
  0) echo "==> model review: disabled by DOTFILES_MODEL_REVIEW=0"; exit 0 ;;
  auto|1) ;;
  *) echo "ERROR: DOTFILES_MODEL_REVIEW must be auto, 1 or 0" >&2; exit 1 ;;
esac

cli="${DOTFILES_VSCODE_CLI:-code}"
for executable in node npm "${cli}"; do
  if ! command -v "${executable}" >/dev/null 2>&1; then
    echo "==> model review: '${executable}' unavailable; Markdown/chat review remains available."
    echo "    Retry: bash extensions/model-review/install.sh (Node 22+, npm and VS Code CLI required)."
    if [[ "${mode}" == 1 ]]; then exit 1; fi
    exit 0
  fi
done
if [[ "$(node -p "Number(process.versions.node.split('.')[0]) >= 22")" != true ]]; then
  echo "==> model review: Node 22+ required; Markdown/chat review remains available."
  if [[ "${mode}" == 1 ]]; then exit 1; fi
  exit 0
fi

extension_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${extension_dir}"
version="$(node -p "require('./package.json').version")"
fingerprint="$(find src examples package.json package-lock.json build.mjs .vscodeignore README.md install.sh -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum)"
host_id="$(printf '%s\n' "$(command -v "${cli}")" "$("${cli}" --version)" | sha256sum)"
stamp="${HOME}/.cache/dotfiles/model-review/${host_id%% *}"
installed="$("${cli}" --list-extensions --show-versions)"
if [[ -f "${stamp}" && "$(<"${stamp}")" == "${fingerprint}" ]]; then
  while IFS= read -r entry; do
    if [[ "${entry}" == "lsiddiquee.model-review@${version}" ]]; then
      echo "==> model review: installed source is unchanged (${version})"
      exit 0
    fi
  done <<< "${installed}"
fi

echo "==> model review: building and installing ${version}"
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run package
"${cli}" --install-extension "${extension_dir}/model-review.vsix" --force
mkdir -p "$(dirname "${stamp}")"
printf '%s\n' "${fingerprint}" > "${stamp}"
echo "==> model review: installed. Reload VS Code, then run 'Model Review: Open Example'."
