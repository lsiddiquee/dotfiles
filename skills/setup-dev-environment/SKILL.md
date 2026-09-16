---
name: setup-dev-environment
description: "Use when creating, reviewing, auditing or repairing a repository's containerised development environment, whether greenfield or already established. Triggers: devcontainer, dev container, .devcontainer, devcontainer.json, postCreateCommand, post-create script, dev container features, cache volume, container rebuild, rebuild fails, apt-get update fails in container, Taskfile, go-task, task runner, onboard a repo, set up dev environment, dev tooling install, improve or modernise an existing devcontainer."
---

# Setting up a dev environment

This skill has two jobs:

1. **Author** a containerised dev environment for a repository: `.devcontainer/devcontainer.json`, a post-create
   script, and a root `Taskfile.yml`.
2. **Apply a default environment baseline**: caching, persistence, tool selection and script discipline,
   stack-neutral except for its wiring. Applied in full unless the user overrides a named part.

The environment must produce an identical container from a clean clone on any host, and every choice in it must be
verified by running a command. Container base images change without notice.

## How to read this file

Sections carry one of three registers.

| Register | Sections | Meaning |
| -------- | -------- | ------- |
| **Process** | Verify before you assert, Procedure, Patching an existing environment, Asking the user, Anti-patterns, Output contract | Instructions to you, the authoring agent. Never copied into the generated files. |
| **Payload** | Environment baseline | Substance to emit. Adapt wiring to the stack; keep the substance. |
| **Guidance** | Repo-shaped choices | How to fill each repo-shaped choice from inventory. Never copied verbatim. |

## Verify before you assert

**Never state a base image property from memory. Run it.** Images are mutable behind their tags, and the failure
modes are silent until a rebuild breaks.

Before writing `image`, `build`, or any apt step, run the probe in [Base image selection](#base-image-selection).
This applies equally to feature versions, tool availability, and the default user: `remoteUser` is `vscode` on
`devcontainers/python`, `node` on `devcontainers/typescript-node`.

If Docker is unavailable on the host, say so and mark every image-dependent line as unverified rather than
guessing.

## Procedure

### 0. Establish the target

Default layout, when the user names nothing:

```
.devcontainer/devcontainer.json
.devcontainer/Dockerfile
.devcontainer/post-create.sh
Taskfile.yml
.pre-commit-config.yaml   # or whichever hook framework the repo's stack calls for
```

If the repo already has a `.devcontainer/`, you are in **patch mode** rather than authoring mode. Read [Patching an
existing environment](#patching-an-existing-environment) before writing anything. Record any override the user asks
for.

### 1. Inventory before writing

Read, do not guess:

- Manifests and lockfiles: `package.json`, `pyproject.toml`, `*.csproj`, `go.mod`, `Cargo.toml`, and their locks.
  These name the stack and the package manager.
- Lockfile identity: `pnpm-lock.yaml` vs `package-lock.json` vs `yarn.lock`; `uv.lock` vs `poetry.lock` vs
  `requirements.txt`. The cache wiring differs per manager.
- Existing `Taskfile.yml`, `Makefile`, or `scripts/`: the task surface may already exist under another name.
- Any hook wiring already present: `.pre-commit-config.yaml`, `husky/`, `lefthook.yml`, a set `core.hooksPath`.
- Lint, format and editor config: `.editorconfig`, `.prettierrc`, `eslint.config.*`, `[tool.ruff]`, and any
  existing `settings.json`. These feed `fix`, `check` and the hooks, and the IDE reads them too.
- Any service the app talks to locally (database, cache, queue). This is the only trigger for Compose.
- Whether any port is pinned by an external system (identity-provider redirect URI, webhook callback).

### 2. Choose and probe the base image

Apply [Base image selection](#base-image-selection). Probe the chosen tag before committing to it.

### 3. Compose the configuration

Emit `devcontainer.json` and the Dockerfile per [Environment baseline](#environment-baseline).
[What belongs in the image](#what-belongs-in-the-image) draws the line between the Dockerfile and post-create.

### 4. Write the post-create script

Strict discipline, per [Post-create contract](#post-create-contract).

### 5. Write the Taskfile

Per [Taskfile contract](#taskfile-contract). `dev:setup` is the seam post-create calls.

### 6. Validate

Do not declare done on a file that has never been built. Re-run the step 2 probe, then rebuild the container
(**Dev Containers: Rebuild Container**) and confirm post-create exits 0 and `task check` passes. Report which of
these you ran and which you could not.

**Exit 0 proves nothing about what was installed.** Confirm every manifest inventory found has its dependencies
present afterwards: `node_modules/`, `obj/`, `.venv/`.

### 7. Self-check

- Every image claim traced to a command you ran.
- Cache env vars match the package managers present in the repo.
- Post-create is strict, with no speculative steps.
- Every manifest has an install path in `install`, confirmed by the artifacts it produces.
- The Dockerfile holds only create-invariant setup.
- `remoteUser` and the `chown` target match the probed image.
- No formatting rule is stated in more than one place.

## Asking the user

Inventory first; ask only what it cannot answer. Ask **once, batched**, and offer a concrete default for each.
Never ask what a manifest already states.

Worth asking: an ambiguous pinned language version; whether a detected service should run in Compose or be
mocked; whether a port is externally pinned; which extensions matter. Not worth asking: the package manager, the
test command, or anything a lockfile names.

On an existing repo the audit replaces most of this. See
[Ask once, after the audit](#ask-once-after-the-audit).

## Patching an existing environment

**Register: process.** Someone hit a problem you cannot see and fixed it, and the fix survives as a line you will
not understand from inventory. Treat the existing config as load-bearing until proven otherwise. Do not rewrite a
working config: the baseline describes the end state rather than a diff to apply in one step.

### Audit first, change second

Report findings before editing. Sort every gap into:

| Class | Meaning | Action |
| ----- | ------- | ------ |
| **Broken** | Demonstrably fails: `apt-get update` errors, cache var pointing at a path that is not mounted, a task that exits non-zero | Fix, and show the command that proves it was broken |
| **Missing** | Baseline element absent: no cache volume, no `Taskfile.yml`, uv without `UV_LINK_MODE` | Propose, with the cost of not having it |
| **Divergent** | Works, but differs from the baseline: guarded post-create, apt installed on every create | Ask, with the consequence of each answer spelled out; never silently convert |
| **Unexplained** | You cannot derive why it exists | Keep it. Ask. |

### Ask once, after the audit

Put every **missing** and **divergent** finding into a single batched round of questions and wait. Do not fix the
easy ones first and ask about the rest: a half-applied environment is harder to reason about than an untouched
one.

Each question names the concrete consequence of each answer. "Convert to strict?" is not answerable; "convert to
strict, and these four steps become fatal" is.

| Finding | Ask | Default to offer |
| ------- | --- | ---------------- |
| Guarded post-create | Convert to strict, so failures surface instead of being swallowed? List every step that would become fatal. | **Yes**, so those steps fail at create time instead of silently |
| No cache volume | Add it? Every rebuild currently re-downloads all dependencies. | Yes |
| Manager present, cache var absent | Point it at the cache volume? | Yes |
| No `Taskfile.yml` / `go-task` | Add the root task surface? | Yes |
| No git hooks | Add them, running the lint the repo already has? | Yes |
| Editor settings restating lint or format rules | Delete the duplicates and defer to the tool's config? Name each one. | Yes, since they are what makes the IDE and the hook disagree |
| Newer image or feature major exists | Bump? | **No**, since it is not broken and costs everyone a rebuild |
| Unexplained line | What does this do? Keeping it until you say otherwise. | Keep |

Offer an accept-all. A user who wants the whole baseline should be able to accept it in one answer.

### Naming what becomes fatal

Before offering the strict conversion, read the script and list what the guards are currently hiding. For each
guarded step, say what happens after conversion: a `command -v` guard around an optional tool means the container
now fails when that tool is absent; a `|| true` on a network fetch means an offline rebuild now fails.

Without that list the user is being asked to approve an unbounded change.

### Keep what you cannot explain

An `initializeCommand` capturing the host IP, an `--env-file` in `runArgs`, a `certs/` directory, a local-only
service password, a pinned `appPort`: deleting one moves a repo from working to broken with no error message
pointing at the cause.

If you cannot state what a line does and what breaks without it, keep it.

A *stated* reason can still be stale: check that the guarded path still exists, and that the guard is not skipping
every time and hiding that nothing replaced it.

### Do not churn

A newer base image or feature major is not by itself a reason to change one. Bump when something is broken,
unsupported, or the user asks.

The one exception is the apt probe: if the current image fails `apt-get update`, that is **broken**, not
divergent, and a tag change is the fix.

### Converting a guarded post-create script

The strict rule in [Post-create contract](#post-create-contract) applies to scripts you write. An existing guarded
script is **divergent, not broken**: stripping `command -v` checks and `|| true` changes which failures abort
container creation, and a step that has been quietly failing for months will start blocking everyone.

Propose the conversion, name the steps that would become fatal, and let the user decide. Convert in one deliberate
change with a rebuild, never as a drive-by while fixing something else.

## Environment baseline

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

### Taskfile contract

Always emit a root `Taskfile.yml` with the `go-task` feature. It is the single home for build, test and run flows,
so the container, the host and CI cannot drift.

| Task | Purpose |
| ---- | ------- |
| `default` | `task --list`, with `silent: true` |
| `install` | Install dependencies from the lockfile, frozen/locked |
| `fix` | Format, lint and typecheck, repairing what can be repaired; what the hooks call |
| `check` | The Definition of Done: typecheck, lint, test; what CI calls |
| `dev:setup` | Everything a fresh container needs; called by post-create |
| `hooks` | Install the git hooks; called by `dev:setup` |

`install` must use the frozen form (`pnpm install --frozen-lockfile`, `uv pip sync`, `npm ci` where the cache is
not at stake), and must cover **every** manifest inventory found. If a manifest has no install path, the container
comes up clean and that project is unbuildable. `check` is the command a contributor runs before pushing and the
command CI runs.

For a monorepo, keep sub-project tasks in their own `Taskfile.yml` and pull them in with `includes:` plus `dir:`,
so tools that resolve config by walking up from a file still find the right one.

### Single-sourced lint configuration

The editor, the hooks and CI must reach the same verdict. They diverge the moment a rule is stated in two places:
a file the editor formats on save gets rewritten by the commit hook, or CI rejects what committed cleanly. Every
layer below states its rules once and every other layer defers to it.

| Layer | Owns | Must not |
| ----- | ---- | -------- |
| `.editorconfig` | Charset, line endings, indent width, final newline | Contradict the formatter |
| Formatter config (`.prettierrc`, `[tool.ruff.format]`) | All formatting decisions | Be restated in editor settings |
| Linter config (`eslint.config.js`, `[tool.ruff.lint]`) | Correctness rules only | Carry formatting rules |
| Editor settings in `customizations.vscode` | Which tool runs and when | Restate any rule the tools already state |
| Hooks and CI | When the tools run | Pin a version the manifest already pins |

**Switch off the linter's formatting rules explicitly.** A linter and a formatter with overlapping opinions
rewrite each other's output forever. In ESLint that means `eslint-config-prettier` **last** in the config array,
where it can disable every rule that would fight Prettier; in Markdown it means turning off the markdownlint rules
Prettier owns and leaving markdownlint to structure.

**A lint rule with no autofix deadlocks a fix-then-format task.** Lint fails before the formatter runs, so the
formatter never gets the chance to satisfy the rule and the repo cannot reach a clean state. Disable the rule or
make it report-only.

**Point tooling at the binary the repo already installs** (`node_modules/.bin/eslint`, `.venv/bin/ruff`) rather
than a second pinned copy of the same tool. A hook framework's `rev:` pin duplicates a version the manifest
already states, and no dependency bot updates both, so the two drift silently. Invoking the repo-local binary
fails loudly when the toolchain is missing.

Editor settings route work to tools without restating their rules:
[references/wiring.md](references/wiring.md#editor-settings). Emit the extension for each configured tool: ESLint
where an ESLint config exists, Ruff where `pyproject.toml` configures it, EditorConfig and `task.vscode-task`
always. Never an extension for a tool the repo does not use, or the editor applies a rule no hook or CI step
applies.

### Git hooks

Always configured, and always built from the lint and format tooling the repo already has. A hook that runs
something the repo does not otherwise run is a hook people will `--no-verify` past.

Two frameworks. Choose by what the repo already carries, and keep any framework already in place:

| Framework | Use when | Cost |
| --------- | -------- | ---- |
| `pre-commit` (Python) | Polyglot repos, or any repo that already has Python | Needs Python in the image, and `PRE_COMMIT_HOME` on the cache volume or every rebuild refetches each hook environment |
| `husky` + `lint-staged` (Node) | Node-only repos | Already in the dependency graph; no second runtime to install |

**Hooks repair rather than report.** The same config then serves as both the local gate and the CI gate: locally
you re-stage what was fixed, and in CI `pre-commit run --all-files --show-diff-on-failure` fails as soon as a hook
modifies a file and prints the change as an applicable patch. Checks that cannot repair anything, such as a type
error or a secret scan, still fail on their own merits.

Have the hook call `task fix` rather than listing tools itself. The Taskfile stays the single entry point, so the
hook, the contributor and CI cannot invoke different things.

Split the work by cost:

| Hook | Runs | Why |
| ---- | ---- | --- |
| `pre-commit` | `task fix`: format, lint, typecheck | Must stay fast enough that nobody reaches for `--no-verify` |
| `commit-msg` | A message-convention check | Only when the repo already has a convention to enforce |
| `pre-push` | `task check` | Optional, and only when CI feedback is too slow to be useful |

**Tests do not belong in a commit hook.** They are slow enough that people disable hooks. CI runs them.

Declare both the hook types to install and the default stage
([references/wiring.md](references/wiring.md#hook-staging)). With `pre-commit`, omitting `default_stages` lets
every hook that declares no stage run at *every* stage, so `git commit` runs the whole suite a second time against
the commit-message file.

`.git/hooks` is not versioned, so hooks install per clone. That is what `task hooks` is for, called by
`dev:setup`.

**The host and the container share one set of hooks**, because `.git` sits inside the bind mount. `pre-commit
install` bakes an absolute interpreter path into `.git/hooks/pre-commit` and falls back only to a `PATH` lookup
before failing the commit. Hooks installed in the container therefore break commits made from the host or a GUI
client. Either keep every hook command available on both sides, or say plainly in the README that commits are made
in the container.

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
| Editor settings | Which configured tool handles which language, never the rules themselves |
| `check` contents | The test and lint commands already in the manifests |
| Hook contents | `task fix`, so the hook cannot invoke anything different from CI |

## Anti-patterns

The five most expensive, each stated once here and enforced in its own section above.

| Pattern | Cost | Instead |
| ------- | ---- | ------- |
| Asserting an image property from memory | Silent rebuild breakage | Probe it with `docker run --rm` |
| Patching a broken base image | Carries the defect forever | Change the tag |
| Rewriting a working environment to match the baseline | Silently drops load-bearing config | Audit, classify, propose |
| Commands duplicated between CI, hooks and docs | They drift | One task, called by all three |
| Declaring done without a rebuild | Untested config | Rebuild, then report |

## Output contract

Authoring a new environment:

1. `devcontainer.json`, `Dockerfile`, `post-create.sh`, `Taskfile.yml`, and the hook config, plus
   `devcontainer-lock.json` once the container has been built.
2. Any lint or format config the repo was missing, with each rule stated in exactly one file.
3. A short note of every measurement taken, with the command and its result.
4. An explicit list of what was validated and what was not.
5. Any unresolved choice stated as a question, never filled with a guess.

Patching an existing one, the same, plus:

6. The audit table first, findings classified broken / missing / divergent / unexplained.
7. Edits confined to the **broken** class unless the user approved more.
8. Everything preserved untouched, listed, so the user can confirm nothing load-bearing was dropped.
