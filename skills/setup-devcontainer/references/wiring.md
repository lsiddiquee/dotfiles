# Wiring values

Lookup values for [SKILL.md](../SKILL.md). The reasoning for each lives there; only the values live here.

## Feature IDs

Pin the major; let patches float.

| Need | Feature |
| ---- | ------- |
| Task runner (always) | `ghcr.io/devcontainers-extra/features/go-task:1` |
| Node alongside another primary | `ghcr.io/devcontainers/features/node:2` |
| Python alongside another primary | `ghcr.io/devcontainers/features/python:1` |
| Azure CLI | `ghcr.io/devcontainers/features/azure-cli:1` |
| GitHub CLI | `ghcr.io/devcontainers/features/github-cli:1` |
| uv | `ghcr.io/va-h/devcontainers-features/uv:1` |
| Container builds / Testcontainers | `ghcr.io/devcontainers/features/docker-in-docker:4` |
| Docker where the host daemon can be reused | `ghcr.io/devcontainers/features/docker-outside-of-docker:1` |

`go-task` lives under `devcontainers-extra`, not `devcontainers`.

## Cache environment variables

Emit only the rows whose tooling the repo actually contains.

| Present in repo | `remoteEnv` entries |
| --------------- | ------------------- |
| Always | `PROMPT_COMMAND: "history -a"`, `HISTFILE: /.devcontainercache/.bash_history` |
| Always | `COPILOT_HOME: /.devcontainercache/.copilot` |
| npm / `package-lock.json` | `NPM_CONFIG_CACHE: /.devcontainercache/npm-cache` |
| pnpm / `pnpm-lock.yaml` | `PNPM_HOME`, `PNPM_STORE_DIR`, `COREPACK_HOME` |
| pip / `requirements.txt` | `PIP_CACHE_DIR: /.devcontainercache/pip-cache` |
| Poetry / `poetry.lock` | `POETRY_CACHE_DIR: /.devcontainercache/poetry-cache`, `POETRY_VIRTUALENVS_IN_PROJECT: "true"` |
| uv / `uv.lock` | `UV_CACHE_DIR`, `UV_LINK_MODE: copy`, `UV_PYTHON_INSTALL_DIR`, `UV_TOOL_DIR`, `UV_TOOL_BIN_DIR`, and `PATH` prepended with `/.devcontainercache/uv-tools/bin` |
| .NET / `*.csproj` | `NUGET_PACKAGES: /.devcontainercache/nuget-packages` |
| Playwright | `PLAYWRIGHT_BROWSERS_PATH: /.devcontainercache/ms-playwright` |
| Azure CLI feature | `AZURE_CONFIG_DIR: /.devcontainercache/.azure` |
| GitHub CLI installed (feature or image) | `GH_CONFIG_DIR: /.devcontainercache/gh` |
| `.pre-commit-config.yaml` | `PRE_COMMIT_HOME: /.devcontainercache/pre-commit` |

`GH_CONFIG_DIR` persists GitHub CLI configuration and file-backed credentials across rebuilds. Create it as the
remote user with mode `0700`. GitHub CLI prefers the system credential store; that store is separate from this
directory. Do not force `--insecure-storage` to make persistence work. Preserve injected `GH_TOKEN` /
`GITHUB_TOKEN` authentication without writing tokens into configuration. After login, verify with `gh auth status`
before and after a rebuild, without `--show-token` or reading credential files. If authentication uses a
nonpersistent credential store, report that limitation instead of claiming the directory alone preserves login.

## Registry and feed forwarding

Forward only the managers used by repository projects or package installers invoked by retained features. Feature
installers count even without a corresponding manifest (for example, Python `installTools: true`). Registry values
are non-secret endpoint URLs; never pass credentials, credential-bearing host configuration, or tokens through build
args, image `ENV`, or build logs.

Add only relevant entries to `build.args`:

```jsonc
"build": {
  "dockerfile": "Dockerfile",
  "args": {
    "NPM_CONFIG_REGISTRY": "${localEnv:NPM_CONFIG_REGISTRY:https://registry.npmjs.org/}",
    "PIP_INDEX_URL": "${localEnv:PIP_INDEX_URL:https://pypi.org/simple}",
    "NUGET_SOURCE": "${localEnv:NUGET_SOURCE:}"
  }
}
```

Declare corresponding Dockerfile args and set image environment before any retained feature installer that may use
them. This makes the selected endpoints available to build-time installers and runtime commands; `remoteEnv` alone
is too late for feature builds. Include only relevant variables:

```dockerfile
ARG NPM_CONFIG_REGISTRY=https://registry.npmjs.org/
ARG PIP_INDEX_URL=https://pypi.org/simple
ARG NUGET_SOURCE=
ENV NPM_CONFIG_REGISTRY=${NPM_CONFIG_REGISTRY} \
    PIP_INDEX_URL=${PIP_INDEX_URL} \
    NUGET_SOURCE=${NUGET_SOURCE} \
    RestoreSources=${NUGET_SOURCE}
```

When uv is used or explicitly requested, also set `UV_DEFAULT_INDEX=${PIP_INDEX_URL}` in the image environment
(declare the Dockerfile `ENV` entry alongside the others) so uv consumes the same selected Python index.

For NuGet, `RestoreSources` is needed for MSBuild restore, but it does not configure search, add/update, or other
NuGet client operations. When `NUGET_SOURCE` is non-empty, configure the remote user's NuGet client as well, in a
stage where `dotnet` is available, using the probed remote user's home. Add the endpoint without credentials and
make every configuration/assertion command fatal (`set -eu` or `&&` throughout); a later successful `chown` must
not mask a failed source addition. With no override, do not create or replace NuGet configuration.

Do not blindly overwrite an existing user `NuGet.Config`. Preserve unrelated settings, required source mappings,
and audit coverage. If an explicit override requires a managed config with cleared package sources, first verify
that no existing user settings or source mappings would be lost; preserve or merge them deliberately. Repository
`NuGet.Config` files are discovered later in the config hierarchy and can add/clear sources, map packages, or
declare separate `auditSources`. Inspect the effective configuration from the workspace and the solution/project
directories. Do not claim the feed is isolated just because the user-level config lists one source: make sure
repository configs and audit sources do not unexpectedly contact nuget.org or another unapproved endpoint. If
isolation conflicts with required mappings or audit coverage, stop and report the conflict rather than silently
deleting or weakening configuration.

For a verified fresh user config that does not already exist, the conditional configuration step can follow this
pattern. Run it only after the .NET feature/SDK is installed, and substitute the probed remote user's home,
username, and group. If a config already exists, preserve and merge it deliberately instead of applying this
clear-and-recreate pattern:

```dockerfile
RUN set -eu; \
    if [ -n "${NUGET_SOURCE}" ]; then \
        config="/home/<remoteUser>/.nuget/NuGet/NuGet.Config"; \
        mkdir -p "$(dirname "$config")"; \
        test ! -e "$config"; \
        printf '%s\n' \
            '<?xml version="1.0" encoding="utf-8"?>' \
            '<configuration>' \
            '  <packageSources>' \
            '    <clear />' \
            '  </packageSources>' \
            '</configuration>' > "$config"; \
        dotnet nuget add source "${NUGET_SOURCE}" --name environment --configfile "$config" >/dev/null; \
        enabled_sources="$(dotnet nuget list source --configfile "$config" --format Short \
            | awk '/^E / { count++ } END { print count+0 }')"; \
        [ "$enabled_sources" -eq 1 ]; \
        chown -R <remoteUser>:<remoteGroup> "/home/<remoteUser>/.nuget"; \
    fi
```

The clear-and-add example is not a general-purpose merge strategy; do not apply it over an unexplained existing
config or where source mappings/audit sources need preservation. Its source-count check verifies only this config,
not the effective workspace configuration.

An override can be persisted into manager lockfiles. Inspect the resulting lockfiles; if they contain a host-private
proxy URL, use the repository's existing hook framework for a manager-aware staged-lockfile pre-commit
check/normalizer.
Reject or safely normalize such changes before commit, preserving integrity hashes and intentional private-feed
references. Do not use blanket URL deletion or rewriting. Verify the hook against a representative lockfile change.

Validate with actual consumers, not config-string assertions: run relevant feature installers and project package
operations in the built container, and check both build-time and runtime endpoint consumption with overrides set
and unset. For .NET, exercise restore/audit and relevant non-MSBuild operations (package search, add/update, or
tool install) from the workspace, and inspect effective package and audit sources without exposing credentials.
Report unreachable feeds and authentication-dependent checks as unverified; do not weaken TLS or silently switch
registries to make a trial pass.

## .NET user-secrets store

For Linux .NET projects using user-secrets, add a dedicated mount at the verified user's store path
(normally `$HOME/.microsoft/usersecrets`). This is separate from `NUGET_PACKAGES`.

```jsonc
"mounts": [
  "source=dotnet-usersecrets-<repo>,target=/home/<remoteUser>/.microsoft/usersecrets,type=volume"
]
```

Add this entry to existing mounts, not in place of the cache/editor volumes. With Compose, declare the named volume
and mount it on the devcontainer service instead; do not introduce Compose just for persistence. Do not mount the
entire home directory. Prepare ownership for the probed remote UID/GID, directory mode `0700`, and a restrictive
umask when creating secret files. Never put actual credentials in Dockerfile ownership-seeding steps.

For an existing store, preserve its contents before a first mount can hide them. Provision individual required keys
with the project's existing setup command; never replace the entire store or erase other project IDs.

Validate through execution: confirm ownership/access and required-key presence without displaying values, then use
a fresh non-secret probe key to verify persistence across container recreation and remove that probe afterwards.
Exercise the consuming application too: a healthy HTTP listener does not prove database-backed sign-in works.
If recreation or application validation was not performed, report it as unverified; do not substitute tests that
assert script/configuration contents.

## Baseline apt layer

One transaction, lists dropped in the same layer:

```dockerfile
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        jq ripgrep fd-find bat tree unzip zip dnsutils iputils-ping netcat-openbsd \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/fdfind /usr/local/bin/fd \
    && ln -sf /usr/bin/batcat /usr/local/bin/bat
```

`fd-find` and `bat` install their binaries as `fdfind` and `batcat`, hence the symlinks.

## Volume ownership seeding

```dockerfile
RUN mkdir -p /.devcontainercache /home/vscode/.vscode-server \
    && chown -R vscode:vscode /.devcontainercache /home/vscode/.vscode-server
```

The `chown` target must match the probed `remoteUser`.

Where a cache volume already exists and cannot be recreated, the repo keeps its post-create chown instead:

```bash
if [ "$(id -u)" -ne 0 ]; then SUDO=sudo; else SUDO=""; fi
$SUDO chown -R "$(id -u):$(id -g)" /.devcontainercache
```

## Workspace mount and volumes

```jsonc
"workspaceMount": "source=${localWorkspaceFolder},target=/workspaces/<repo>,type=bind",
"workspaceFolder": "/workspaces/<repo>",
"mounts": [
  "source=devcontainer-cache-<repo>,target=/.devcontainercache,type=volume",
  "source=vscode-server-<repo>,target=/home/<remoteUser>/.vscode-server,type=volume"
]
```

Under Compose, Docker will not create an external volume on demand, so create it first:

```jsonc
"initializeCommand": "docker volume inspect <repo>-vscode-server >/dev/null 2>&1 || docker volume create <repo>-vscode-server >/dev/null"
```
