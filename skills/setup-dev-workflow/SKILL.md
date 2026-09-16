---
name: setup-dev-workflow
description: "Use when creating, reviewing, auditing or repairing a repository's task surface, lint configuration or git hooks. Triggers: Taskfile, Taskfile.yml, go-task, task runner, task check, task fix, dev:setup, pre-commit, husky, lint-staged, git hooks, commit hook, pre-push, lint config, editorconfig, prettier, eslint, ruff, formatter fights linter, CI and local disagree, Definition of Done, single source of truth for lint rules."
---

# Setting up a dev workflow

This skill defines the commands a repository runs and the rules those commands enforce: a root `Taskfile.yml`, a
single-sourced lint configuration, and git hooks built from both.

One principle underneath all three: **every command exists in exactly one place, and the editor, the hooks and CI
all call it there.** Anything stated twice drifts, and drift is what makes a commit pass locally and fail in CI.

## How to read this file

Sections carry one of three registers.

| Register | Sections | Meaning |
| -------- | -------- | ------- |
| **Process** | Where this runs, Procedure, Patching, Anti-patterns, Output contract | Instructions to you, the authoring agent. Never copied into the generated files. |
| **Payload** | Workflow baseline | Substance to emit. Adapt wiring to the stack; keep the substance. |
| **Guidance** | Repo-shaped choices | How to fill each choice from inventory. Never copied verbatim. |

## Where this runs

If the repo has a `.devcontainer/`, every command below runs **inside the container**, because that is where the
toolchain the tasks invoke exists. Either work in the container, or prefix each command:

```bash
devcontainer exec --workspace-folder . -- bash -lc '<command>'
```

A version read from the host proves nothing about what CI or another contributor will run. If the repo has no
container, run the commands directly and say so in the output.

The container half also owns two things this skill depends on: the `go-task` feature, and `PRE_COMMIT_HOME` on
the cache volume when `pre-commit` is the framework. If either is absent, name it as a gap rather than working
around it here.

## Procedure

### 1. Inventory before writing

Read, do not guess:

- Manifests and lockfiles, and which package manager each names. `install` must cover every one of them.
- Existing `Taskfile.yml`, `Makefile`, or `scripts/`: the task surface may already exist under another name.
- Hook wiring already present: `.pre-commit-config.yaml`, `husky/`, `lefthook.yml`, a set `core.hooksPath`.
- Lint, format and editor config: `.editorconfig`, `.prettierrc`, `eslint.config.*`, `[tool.ruff]`, and any
  existing `settings.json`. These feed `fix`, `check` and the hooks, and the IDE reads them too.
- The test and lint commands the manifests already define. Assemble `check` from these rather than inventing it.

### 2. Write the Taskfile

Per [Taskfile contract](#taskfile-contract). `dev:setup` is the seam a post-create script calls.

### 3. Single-source the lint configuration

Per [Single-sourced lint configuration](#single-sourced-lint-configuration). Resolve every duplicated rule before
wiring hooks, or the hooks enforce a rule the editor contradicts.

### 4. Wire the hooks

Per [Git hooks](#git-hooks). Hooks call `task fix`, never a tool directly.

### 5. Validate

Run the surface you created, and show the output:

```bash
task install
task check
```

Then prove the hooks are real: stage a file that violates a rule the hooks repair, commit, and confirm the hook
rewrote it. A hook that has never fired is an unverified hook.

**Do not declare done on a task that has never run.** Report which commands you ran and which you could not.

### 6. Self-check

- Every manifest has an install path in `install`, confirmed by the artifacts it produces.
- No formatting rule is stated in more than one place.
- Hooks call `task fix`; CI calls `task check`; neither names a tool directly.
- No task pins a version the manifest already pins.

## Patching

**Register: process.** The audit rubric, the four-class sort and the ask-once rule live in
[references/patching.md](references/patching.md). Read it before editing an existing task surface or hook config.

What to ask about, once the audit is done:

| Finding | Ask | Default to offer |
| ------- | --- | ---------------- |
| No `Taskfile.yml` / `go-task` | Add the root task surface? | Yes |
| No git hooks | Add them, running the lint the repo already has? | Yes |
| Editor settings restating lint or format rules | Delete the duplicates and defer to the tool's config? Name each one. | Yes, since they are what makes the IDE and the hook disagree |
| Hook framework pinning a tool version the manifest also pins | Drop the pin and call the repo-local binary? | Yes |
| Tests running in a commit hook | Move them to `pre-push` or CI? | Yes |
| Unexplained lint rule or disabled check | What does this do? Keeping it until you say otherwise. | Keep |

## Workflow baseline

**Register: payload.** This is the substance to emit.

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

`install` must use the frozen form (`pnpm install --frozen-lockfile`, `uv sync --frozen`, `npm ci` where the cache
is not at stake), and must cover **every** manifest inventory found. If a manifest has no install path, the
container comes up clean and that project is unbuildable. `check` is the command a contributor runs before pushing
and the command CI runs.

For a monorepo, keep sub-project tasks in their own `Taskfile.yml` and pull them in with `includes:` plus `dir:`,
so tools that resolve config by walking up from a file still find the right one.

### Python environments

A virtual environment is still wanted inside the container. It keeps the repo's dependencies off the system
interpreter, which some base images mark externally-managed, and it gives the VS Code Python extension a concrete
interpreter path to resolve against.

**Keep it in the project, at `.venv`.** Every tool path in this skill assumes that location, and both managers can
be made to agree on it:

| Manager | Setting | Why |
| ------- | ------- | --- |
| uv | None needed; `.venv` in the project root is the default | Set `UV_PROJECT_ENVIRONMENT` only to move it elsewhere |
| Poetry | `POETRY_VIRTUALENVS_IN_PROJECT: "true"` in `remoteEnv` | Its default is `{cache-dir}/virtualenvs`, outside the project entirely |

The Poetry setting is load-bearing. Without it the venv lands in the cache directory, `.venv/bin/ruff` resolves to
nothing, and the editor points at an interpreter no hook or CI step uses. Setting it later does not migrate an
environment that already exists: the one under `{cache-dir}/virtualenvs` has to be deleted first, or Poetry keeps
using it.

**Do not mount a volume over `.venv`.** It sits in the bind-mounted workspace and already survives rebuilds. A
volume there comes up root-owned, cannot be seeded from the Dockerfile because the workspace bind masks the
image's directory at that path, is invisible from the host, and is named per repo, so a second clone silently
gets a different one.

**A venv built on the host cannot run in the container.** `pyvenv.cfg` and every console-script shebang record an
absolute interpreter path. Have `dev:setup` detect a foreign venv and recreate it rather than reuse it, or the
first `task check` fails on a missing interpreter with nothing pointing at the cause.

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
| `install` contents | Every manifest found, with the frozen form its manager provides |
| `check` contents | The test and lint commands already in the manifests |
| `fix` contents | The formatter and the linter's autofix mode, in that order |
| Python manager | Whichever lockfile is present; for a repo with none, offer uv |
| Hook framework | Whichever is already present; otherwise Python present means `pre-commit`, Node-only means `husky` |
| Hook contents | `task fix`, so the hook cannot invoke anything different from CI |
| Editor settings | Which configured tool handles which language, never the rules themselves |

## Anti-patterns

| Pattern | Cost | Instead |
| ------- | ---- | ------- |
| Commands duplicated between CI, hooks and docs | They drift | One task, called by all three |
| A formatting rule stated in both the formatter and the editor | The IDE and the hook fight forever | State it once, defer everywhere else |
| A hook framework pinning a tool the manifest also pins | Silent version drift, no bot updates both | Call the repo-local binary |
| Tests in a commit hook | People disable hooks | `pre-push` or CI |
| Declaring done on a task that has never run | Untested surface | Run `task check`, then report |

## Output contract

1. `Taskfile.yml`, the hook config, and any lint or format config the repo was missing, with each rule stated in
   exactly one file.
2. A list of every duplicated rule found and which copy was deleted.
3. The output of `task check`, or an explicit statement that it could not be run and why.
4. Confirmation that a hook fired, or that it did not.
5. Any unresolved choice stated as a question, never filled with a guess.

Patching an existing surface, the same, plus:

6. The audit table first, findings classified broken / missing / divergent / unexplained.
7. Edits confined to the **broken** class unless the user approved more.
8. Everything preserved untouched, listed, so the user can confirm nothing load-bearing was dropped.
