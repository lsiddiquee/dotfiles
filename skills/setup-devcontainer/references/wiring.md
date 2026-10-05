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

## Package registry and feed forwarding

Forward only the endpoint inputs used by manifests or retained features. Feature installers count even without a
matching project manifest: for example, Python `installTools: true` invokes pip, and Node feature global packages
can invoke npm. `NPM_CONFIG_REGISTRY` also needs verification with pnpm/Corepack when retained. `PIP_INDEX_URL`
does not by itself prove that Poetry uses the selected source; preserve and validate Poetry's project source
configuration rather than assuming pip's setting controls it.

Pass host values as non-secret endpoint URLs, with no host-side fallback. Declare only the relevant arguments:

```jsonc
"build": {
  "dockerfile": "Dockerfile",
  "args": {
    // Keep only entries used by manifests or retained feature installers.
    "NPM_CONFIG_REGISTRY": "${localEnv:NPM_CONFIG_REGISTRY}",
    "PIP_INDEX_URL": "${localEnv:PIP_INDEX_URL}",
    "NUGET_SOURCE": "${localEnv:NUGET_SOURCE}"
  }
}
```

Declare the same arguments in the Dockerfile before feature installation. Let unset or empty npm and pip overrides
fall back to their normal public defaults; emit only variables relevant to the repo or retained features.
`UV_DEFAULT_INDEX` is needed when uv is used and must follow `PIP_INDEX_URL`.

```dockerfile
# Keep only arguments and ENV entries relevant to this repo or its retained features.
ARG NPM_CONFIG_REGISTRY
ARG PIP_INDEX_URL
ARG NUGET_SOURCE
ENV NPM_CONFIG_REGISTRY=${NPM_CONFIG_REGISTRY:-https://registry.npmjs.org/} \
    PIP_INDEX_URL=${PIP_INDEX_URL:-https://pypi.org/simple} \
    NUGET_SOURCE=${NUGET_SOURCE} \
    RestoreSources=${NUGET_SOURCE}
# Add only when uv is used:
ENV UV_DEFAULT_INDEX=${PIP_INDEX_URL:-https://pypi.org/simple}
```

Use image `ENV`, not `remoteEnv` alone: build-time feature installers need the selected endpoint too. With no
`NUGET_SOURCE`, leave normal NuGet source configuration intact. With an override, configure both MSBuild's
`RestoreSources` and the probed remote user's NuGet client config, after `dotnet` is available in the relevant
Dockerfile stage. Run that step as root, then restore the Dockerfile's intended `USER`. For a new client config, a
source-only setup can be bootstrapped as follows; substitute the verified user and group, and do not overwrite an
existing config:

If the SDK is supplied only by a Dev Container Feature installed after Dockerfile instructions, do not place this
step earlier and claim it succeeded. Use an SDK base image or a later setup hook that runs after the SDK and before
any dependent build-time installer; otherwise report build-time NuGet coverage as unverified.

```dockerfile
RUN if [ -n "${NUGET_SOURCE}" ]; then \
        set -eu; \
        command -v dotnet >/dev/null; \
        config=/home/<remoteUser>/.nuget/NuGet/NuGet.Config; \
        mkdir -p "$(dirname "$config")"; \
        if [ -e "$config" ]; then \
            echo "Existing NuGet.Config requires review; refusing to overwrite" >&2; \
            exit 1; \
        fi; \
        printf '%s\n' \
            '<?xml version="1.0" encoding="utf-8"?>' \
            '<configuration>' \
            '  <packageSources>' \
            '    <clear />' \
            '  </packageSources>' \
            '</configuration>' > "$config"; \
        dotnet nuget add source "${NUGET_SOURCE}" --name environment \
            --configfile "$config" >/dev/null; \
        dotnet nuget list source --configfile "$config" --format Short \
            > /tmp/nuget-sources; \
        test "$(grep -c '^E ' /tmp/nuget-sources)" -eq 1; \
        rm /tmp/nuget-sources; \
        chown -R <remoteUser>:<remoteGroup> "$(dirname "$(dirname "$config")")"; \
    fi
```

The source-count check is only a bootstrap check, not proof of effective isolation. Preserve existing configuration,
package source mappings, and required `auditSources`; inspect effective sources from the workspace and relevant
project directories because repository and nested `NuGet.Config` files can add or change sources. Verify in the
unset-host trial that an empty `RestoreSources` value preserves normal sources; if the selected SDK treats it as an
override, arrange for the property to be absent when `NUGET_SOURCE` is empty. Verify an MSBuild
restore (including package audit) and non-MSBuild search, add/update, and tool operations against the approved feed;
use a disposable project or tool manifest for operations that modify files. If an override cannot retain required
audit coverage or an existing config needs a policy decision, stop and report it rather than silently clearing or
bypassing configuration. Never put credentials, credential-bearing URLs, or host config files in build args, `ENV`,
image layers, or logs; use supported credential providers or secret delivery for authenticated feeds.
`NUGET_PACKAGES` is a cache path, not a source override.

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
