#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -eq 0 ]]; then
  printf 'Usage: %s <mounted-directory>...\n' "$0" >&2
  exit 1
fi

owner="$(id -u):$(id -g)"
elevate=()
if [[ "$(id -u)" -ne 0 ]]; then
  elevate=(sudo -n)
fi

for directory in "$@"; do
  "${elevate[@]}" mkdir -p -- "${directory}"
  "${elevate[@]}" chown -R --no-dereference -- "${owner}" "${directory}"
done
