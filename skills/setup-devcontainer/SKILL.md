---
name: setup-devcontainer
description: "Use when creating, reviewing, auditing or repairing a repository's dev container, whether greenfield or already established. Triggers: devcontainer, dev container, .devcontainer, devcontainer.json, postCreateCommand, post-create script, dev container features, devcontainer-lock.json, cache volume, container rebuild, rebuild fails, apt-get update fails in container, base image, remoteUser, docker-in-docker, containerise a repo."
---

# Setting up a dev container

This skill has two jobs:

1. **Author** the container for a repository: `.devcontainer/devcontainer.json`, a Dockerfile, and a post-create
   script.
2. **Apply a default container baseline**: caching, persistence, image selection and script discipline,
   stack-neutral except for its wiring. Applied in full unless the user overrides a named part.

The container must come up identically from a clean clone on any host, and every claim about it must be verified
by running a command inside it. Base images change without notice.

The post-create script calls `task dev:setup`. Defining that task surface, the lint configuration and the git
hooks is out of scope here.

## How to read this file

Sections carry one of three registers.

| Register | Sections | Meaning |
| -------- | -------- | ------- |
| **Process** | Preflight, Verify before you assert, Procedure, Patching, Asking the user, Anti-patterns, Output contract | Instructions to you, the authoring agent. Never copied into the generated files. |
| **Payload** | Container baseline | Substance to emit. Adapt wiring to the stack; keep the substance. |
| **Guidance** | Repo-shaped choices | How to fill each repo-shaped choice from inventory. Never copied verbatim. |

## Preflight

Both checks run before anything else, and neither has a fallback. Validating on the host proves nothing about the
image, and falling back to it silently is worse than stopping.

### Docker must be reachable

```bash
docker info >/dev/null 2>&1 && echo OK || echo UNREACHABLE
```

If unreachable, state the fix that applies and stop:

| Where you are running | Fix to state |
| --------------------- | ------------ |
| Inside a dev container | Add `docker-outside-of-docker` to reuse the host daemon, or `docker-in-docker` for a nested one, then rebuild. IDs in [references/wiring.md](references/wiring.md#feature-ids) |
| Anywhere else | Re-run from the host or WSL, where the daemon is reachable |

### The devcontainer CLI must be present

It is what builds and execs without the VS Code UI.

```bash
command -v devcontainer >/dev/null && devcontainer --version || echo MISSING
```

If missing, ask once and then run the install yourself rather than handing the user a command:

```bash
npm install -g @devcontainers/cli
```

It needs Node 20 or newer and provides the `devcontainer` binary. If the user declines, name the validation steps
that are now impossible and mark their results unverified for the rest of the session.

## Verify before you assert

**Never state a base image property from memory. Run it.** Images are mutable behind their tags, and the failure
modes are silent until a rebuild breaks.

Before writing `image`, `build`, or any apt step, run the probe in [Base image selection](#base-image-selection).
This applies equally to feature versions, tool availability, and the default user: `remoteUser` is `vscode` on
`devcontainers/python`, `node` on `devcontainers/typescript-node`.

## Procedure

### 0. Establish the target

Default layout, when the user names nothing:

```
.devcontainer/devcontainer.json
.devcontainer/Dockerfile
.devcontainer/post-create.sh
```

If the repo already has a `.devcontainer/`, you are in **patch mode** rather than authoring mode. Read
[Patching](#patching) before writing anything. Record any override the user asks for.

### 1. Inventory before writing

Read, do not guess:

- Manifests and lockfiles: `package.json`, `pyproject.toml`, `*.csproj`, `go.mod`, `Cargo.toml`, and their locks.
  These name the stack and the package manager.
- Lockfile identity: `pnpm-lock.yaml` vs `package-lock.json` vs `yarn.lock`; `uv.lock` vs `poetry.lock` vs
  `requirements.txt`. The cache wiring differs per manager.
- Any hook framework already present, since `pre-commit` needs Python in the image and its own cache variable.
- Any service the app talks to locally (database, cache, queue). This is the only trigger for Compose.
- Whether any port is pinned by an external system (identity-provider redirect URI, webhook callback).

In patch mode, diff this inventory against what the container already declares. A manifest with no matching
feature, cache variable or install path is a **missing** finding; a feature or cache variable with no matching
manifest is **divergent**. A container that builds cleanly can still be months behind the repo's stack.

### 2. Choose and probe the base image

Apply [Base image selection](#base-image-selection). Probe the chosen tag before committing to it.

### 3. Compose the configuration

Emit `devcontainer.json` and the Dockerfile per [Container baseline](#container-baseline).
[What belongs in the image](#what-belongs-in-the-image) draws the line between the Dockerfile and post-create.

### 4. Write the post-create script

Strict discipline, per [Post-create contract](#post-create-contract).

### 5. Build and validate

Do not declare done on a configuration that has never been built. The build succeeding is this skill's success
criterion.

```bash
devcontainer up --workspace-folder . --remove-existing-container
```

Then read every version claim back out of the running container, never out of the host shell:

```bash
devcontainer exec --workspace-folder . -- bash -lc '<command>'
```

**Exit 0 proves nothing about what was installed.** Confirm that each manifest found in inventory has its
dependencies present afterwards: `node_modules/`, `obj/`, `.venv/`.

Batch configuration edits and rebuild once. Every `devcontainer.json` change requires
`--remove-existing-container`, so an edit-per-rebuild loop is slow and wasteful.

Report which of these you ran and which you could not.

### 6. Self-check

- Every image claim traced to a command you ran inside the container.
- Cache env vars match the package managers present in the repo.
- Post-create is strict, with no speculative steps.
- The Dockerfile holds only create-invariant setup.
- `remoteUser` and the `chown` target match the probed image.
- `devcontainer-lock.json` committed after the build.

## Asking the user

Inventory first; ask only what it cannot answer. Ask **once, batched**, and offer a concrete default for each.
Never ask what a manifest already states.

Worth asking: an ambiguous pinned language version; whether a detected service should run in Compose or be
mocked; whether a port is externally pinned. Not worth asking: the package manager, or anything a lockfile names.

On an existing repo the audit replaces most of this.

## Patching

**Register: process.** The audit rubric, the four-class sort and the ask-once rule live in
[references/patching.md](references/patching.md). Read it before editing an existing `.devcontainer/`.

What to ask about, once the audit is done:

| Finding | Ask | Default to offer |
| ------- | --- | ---------------- |
| Guarded post-create | Convert to strict, so failures surface instead of being swallowed? List every step that would become fatal. | **Yes**, so those steps fail at create time instead of silently |
| No cache volume | Add it? Every rebuild currently re-downloads all dependencies. | Yes |
| Manager present, cache var absent | Point it at the cache volume? | Yes |
| Manifest for a language the container does not provide | Add the feature and its cache var? Name the manifest that proves the language is used. | Yes |
| Feature or cache var for a language no longer in the repo | Remove it? Every rebuild currently pays for it. | Ask, since a script you cannot see may still call it |
| Newer image or feature major exists | Bump? | **No**, since it is not broken and costs everyone a rebuild |
| Unexplained line | What does this do? Keeping it until you say otherwise. | Keep |

### Converting a guarded post-create script

The strict rule in [Post-create contract](#post-create-contract) applies to scripts you write. An existing guarded
script is **divergent, not broken**: stripping `command -v` checks and `|| true` changes which failures abort
container creation, and a step that has been quietly failing for months will start blocking everyone.

Propose the conversion, name the steps that would become fatal, and let the user decide. Convert in one deliberate
change with a rebuild, never as a drive-by while fixing something else.

## Container baseline

**Register: payload.** This is the substance to emit.

### Base image selection

Pick the image matching the primary language; add other languages as features. The Dockerfile that seeds volume
ownership builds `FROM` it.

**Probe every candidate tag before use:**

```bash
img=<candidate>
docker run --rm --entrypoint sh "$img" -c '
  echo "user:    $(getent passwd 1000 | cut -d: -f1)"
  echo "sources: $(ls /etc/apt/sources.list.d/ | tr "\n" " ")"
  apt-get update >/dev/null 2>&1 && echo "apt:     OK" || echo "apt:     BROKEN"'
```

`apt: BROKEN` disqualifies the tag if a clean alternative exists. Prefer changing the tag over patching the image.

Past probes, including a broken-apt image family and the drop-in replacement for it, are logged in
[references/base-images.md](references/base-images.md). Read it when choosing or changing a base image. It records
what was true on a date and is not a substitute for running the probe.

**After a retag across a distro release, re-verify every hand-written apt list.** Package names move between
releases. The same reference has the details.

### Features

Commit `devcontainer-lock.json`, which records resolved feature versions and is what makes a rebuild
reproducible.

Feature IDs and the pinning rule: [references/wiring.md](references/wiring.md#feature-ids). The task runner is
always included. Add a language feature only when that language is used; a feature costs rebuild time.

### Workspace mount

Pin the workspace path so scripts, tasks and docs can rely on it regardless of the host folder name. A named
volume survives rebuilds; the workspace bind does not, so mount one at a fixed path and point every cache at it.
The `vscode-server` volume keeps extensions and Copilot chat history across rebuilds.

Wiring for all three: [references/wiring.md](references/wiring.md#workspace-mount-and-volumes).

#### Volume ownership

A named volume is created root-owned on first mount, so every cache write fails until something fixes it. Seed
the ownership in the Dockerfile.

**Seeding only works while the volume is empty.** On a repo whose cache volume already exists, switching to it
changes nothing and the volume stays root-owned, so that repo keeps its post-create chown unless the volume is
being recreated. Both forms: [references/wiring.md](references/wiring.md#volume-ownership-seeding).

**Emit only the cache variables whose tooling the repo uses.** Unused variables are noise that outlives the tool.
The per-manager table is in [references/wiring.md](references/wiring.md#cache-environment-variables).

`UV_LINK_MODE: copy` is mandatory with uv: hardlinks cannot cross from the cache volume into the bind-mounted
workspace, and uv falls back with a warning on every install otherwise.

`history -a` flushes after each command so history reaches the volume before a rebuild rather than at shell exit.

### Ports

Two cases:

- **Convenience**: `forwardPorts` plus `portsAttributes` with a `label` and `onAutoForward`. The host port is
  dynamic. This is the default.
- **Externally pinned**: when an identity provider's redirect URI, or a webhook, hardcodes a host port, that
  exact port must be published: `"appPort": ["127.0.0.1:<port>:<port>"]`.

Where Compose publishes ports, do not add a second VS Code forwarding layer on top: the callback must keep the
published port.

### Compose

Use `dockerComposeFile` **only when a second container is required** (a database, cache or queue the app
talks to). Do not use Compose for a single container. With Compose, the cache volume is declared on the service
rather than in `mounts`.

### What belongs in the image

The Dockerfile is for setup that is identical on every create and worth caching as a layer. Post-create is for
anything that depends on the repo's current contents.

| In the Dockerfile | Not in the Dockerfile |
| ----------------- | --------------------- |
| Volume ownership seeding | Dependency installs from lockfiles: they change with the repo, and the build context is `.devcontainer/` rather than the repo root |
| apt tooling, with any third-party apt repo and keyring it needs | Credentials or tokens, since every layer is readable with `docker history` |
| Binaries with neither a feature nor an apt package: fetch a pinned release, verify its checksum, place it in `/usr/local/bin` | Host-specific values, since the image is shared |
| Locale, timezone, CA certificates | Anything writing to a path a volume later covers |

A mount hides whatever the image placed at that path unless the volume is empty, so install image-layer tools to
`/usr/local/bin`, never into `/.devcontainercache`.

### Common tooling

Baseline set: `jq ripgrep fd-find bat tree unzip zip dnsutils iputils-ping netcat-openbsd`, covering JSON handling,
search, structure inspection, archives, and DNS, ping and port debugging inside the container.

Add `sqlite3` only if the repo uses SQLite. Add Playwright system libraries only if Playwright is a dependency,
using `npx playwright install-deps` rather than hand-listing packages.

The apt layer, including the symlinks two of these need:
[references/wiring.md](references/wiring.md#baseline-apt-layer).

### Post-create contract

Strict. Every line is required, so any failure is a real failure:

```bash
#!/usr/bin/env bash
set -euo pipefail
```

No `command -v` guards, no `|| true`, no steps for tooling the repo does not yet use. A container that comes up
"successfully" with a half-installed toolchain hides the failure.

This governs scripts you write. For an existing guarded script, see
[Converting a guarded post-create script](#converting-a-guarded-post-create-script).

Order. With ownership seeded and apt baked into the image, the script is short:

1. `task dev:setup`, so dependency install and hook registration live in the Taskfile and the host and CI run the
   same path.
2. Echo resolved versions of the tools that define the environment. Record them for debugging.

A repo that kept its post-create chown per [Volume ownership](#volume-ownership) does that first.

Keep the script at `.devcontainer/post-create.sh` and invoke it as
`"postCreateCommand": "bash .devcontainer/post-create.sh"`.

If the repo has no `Taskfile.yml` yet, `task dev:setup` fails on the first build. Say so plainly rather than
silently substituting a different command.

## Repo-shaped choices

**Register: guidance.** How to fill each choice from inventory. Do not copy this prose anywhere.

| Choice | Fill it from |
| ------ | ------------ |
| Base image | The primary language and its pinned version; probe the tag |
| Extra features | Secondary languages and CLIs the repo invokes |
| Cache env vars | The lockfiles present: one row per manager, nothing speculative |
| Compose or not | Whether a second container is required |
| Ports | Dev-server ports from config; pinned ports from the identity provider |
| Extensions | The linters and formatters already configured, plus `task.vscode-task` |

## Anti-patterns

| Pattern | Cost | Instead |
| ------- | ---- | ------- |
| Asserting an image property from memory | Silent rebuild breakage | Probe it with `docker run --rm` |
| Validating on the host when Docker is unreachable | Green locally, broken for everyone else | Halt and name the fix |
| Patching a broken base image | Carries the defect forever | Change the tag |
| Rewriting a working container to match the baseline | Silently drops load-bearing config | Audit, classify, propose |
| Declaring done without a build | Untested config | `devcontainer up`, then report |

## Output contract

Authoring a new container:

1. `devcontainer.json`, `Dockerfile`, `post-create.sh`, plus `devcontainer-lock.json` once it has been built.
2. A short note of every measurement taken, with the command and its result.
3. An explicit list of what was validated and what was not.
4. Any unresolved choice stated as a question, never filled with a guess.

Patching an existing one, the same, plus:

5. The audit table first, findings classified broken / missing / divergent / unexplained.
6. Edits confined to the **broken** class unless the user approved more.
7. Everything preserved untouched, listed, so the user can confirm nothing load-bearing was dropped.
