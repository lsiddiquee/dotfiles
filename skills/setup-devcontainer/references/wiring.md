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
does not control Poetry dependency downloads; use the mirror plugin below for developer-specific PyPI overrides.
Preserve existing project source configuration.

Pass host values as non-secret endpoint URLs, with no host-side fallback. Dev Containers CLI 0.89.0 can truncate
colon-containing `${localEnv:NAME:https://...}` defaults to `https`; put URL fallbacks in Dockerfile `ENV`
expansion instead. Declare only the relevant arguments:

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

### Poetry developer mirrors

When Poetry is used, add `POETRY_PYPI_MIRROR_URL=${PIP_INDEX_URL}` to the **same** `ENV` instruction that sets
the pip fallback above. Docker expands that instruction using the incoming build argument: an absent or empty
host override leaves the mirror empty, while pip still defaults to public PyPI. A later `ENV` instruction would
read the already-defaulted pip value instead. Do not put this mirror only in `remoteEnv`; build-time consumers
need it too.

```dockerfile
ARG PIP_INDEX_URL
ARG NPM_CONFIG_REGISTRY
ENV PIP_INDEX_URL=${PIP_INDEX_URL:-https://pypi.org/simple} \
    NPM_CONFIG_REGISTRY=${NPM_CONFIG_REGISTRY:-https://registry.npmjs.org/} \
    POETRY_PYPI_MIRROR_URL=${PIP_INDEX_URL}
```

`POETRY_PYPI_MIRROR_URL` is supplied by `poetry-plugin-pypi-mirror`, not built-in Poetry.
`POETRY_REPOSITORIES_PYPI_URL` configures publishing repositories, not the implicit dependency PyPI source.
Plugin version `0.6.5` declares Poetry `>=2.1,<2.6`; check the installed Poetry version and recheck compatibility
on upgrades rather than silently upgrading an existing installation.

Install the plugin into the actual Poetry environment after Poetry is installed and before any dependency install.
For pipx-managed Poetry, run as the user owning that pipx installation:

```bash
pipx inject poetry "poetry-plugin-pypi-mirror==0.6.5"
poetry install --no-interaction
```

For other installation methods, use their supported plugin installation mechanism (for example,
`poetry self add "poetry-plugin-pypi-mirror==0.6.5"` where supported). A feature-provided Poetry installation is
not available in earlier Dockerfile steps: install the plugin in a later feature or setup task, before the first
Poetry consumer. Keep native `poetry install`; do not export to pip, add a project-level primary source, or write
developer-specific mirror URLs into `pyproject.toml` or `poetry.lock`. `poetry source add --priority=primary`
is a separate project-wide dependency-source decision, not this container-only solution.

Validate the loaded plugin and active Poetry dependency pool against the supplied credential-free mirror, not
only the environment variable. With the host override unset, verify that implicit PyPI remains public. Run a
fresh native `poetry --no-cache install --no-interaction` in a disposable project environment and compare manifest
and lockfile hashes before and after. Verify expected development tools actually exist; a guarded post-create
script returning zero is insufficient. Preserve the patch-mode approval requirement for converting guarded scripts.

### NuGet feeds

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
    fi
```

When this root-run step creates the remote user's NuGet configuration directory, include
`"$HOME/.nuget/NuGet"` in post-create ownership repair; do not change ownership in the Dockerfile.

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

### Lockfile protection

Inspect lockfiles after package operations for host-private proxy URLs. Use the repository's existing hook
framework to reject or safely normalize affected **staged** lockfiles through its task surface before commit.
The check must be manager-aware, preserve integrity hashes and intentional project-wide private sources, and
inspect the staged content rather than only the working tree. Never strip or rewrite URLs indiscriminately.
If no safe normalizer exists, reject the change with a diagnostic that does not reveal credentials.
Exercise the actual hook with a representative private-proxy lockfile and a valid public-source lockfile in a
disposable repository; confirm rejection or safe repair, unchanged package integrity, and that unstaged edits
cannot hide an unsafe staged URL. Coordinate hook wiring with `setup-dev-workflow`; do not add duplicate commands.

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
entire home directory. Repair ownership in post-create before provisioning secrets, set directory mode `0700`,
and use a restrictive umask when creating secret files. Never put actual credentials in Dockerfile steps.

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

## Post-create ownership repair

Copy [the bundled script](../assets/fix-ownership.sh) to `.devcontainer/fix-ownership.sh`. It derives the owner
from the calling user's runtime UID/GID, uses non-interactive sudo for a non-root user, and fails if permissions
cannot be repaired. Run it as the configured `remoteUser`, not through `sudo bash` (which would select root as
the owner). The selected image must provide passwordless sudo when `remoteUser` is non-root.

At the start of `.devcontainer/post-create.sh`, before `task dev:setup`:

```bash
#!/usr/bin/env bash
set -euo pipefail

bash .devcontainer/fix-ownership.sh \
    /.devcontainercache \
    "$HOME/.vscode-server"
task dev:setup
```

Pass the actual configured mount targets, adapting the editor path when necessary. Include other user-owned
setup directories only when used, such as `$HOME/.nuget/NuGet` when build-time NuGet configuration was created.
For a mounted .NET secrets store, include `$HOME/.microsoft/usersecrets` in the same ownership call and then
restrict its mode before provisioning any secrets:

```bash
chmod 0700 "$HOME/.microsoft/usersecrets"
umask 077
```

Wire the ordered script and wait for it before normal editor attachment:

```jsonc
"postCreateCommand": "bash .devcontainer/post-create.sh",
"waitFor": "postCreateCommand"
```

Use this path for both fresh and reused volumes; remove corresponding Dockerfile or later-hook ownership changes.
Never delete volumes to repair ownership. `waitFor` does not defer the server bootstrap itself: validate startup
with the actual editor as well as CLI lifecycle execution and report failures that precede post-create separately.

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
