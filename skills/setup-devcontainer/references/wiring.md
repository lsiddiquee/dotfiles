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
| `.pre-commit-config.yaml` | `PRE_COMMIT_HOME: /.devcontainercache/pre-commit` |

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
