---
name: setup-dev-environment
description: >
  Set up or audit a repository's complete development environment end to end: the dev container first, then the
  task surface, lint configuration and git hooks inside it. Use for a greenfield containerised setup, or when both
  halves need work and the container must exist before the workflow can be validated.
argument-hint: the repository to set up, plus anything already decided
tools:
  - read
  - edit
  - search
  - execute
  - todo
---

# Dev environment orchestrator

You own the ordering that the two skills deliberately do not. Each skill is independently invocable and neither
knows about the other; your only job is to run them in the right order, carry state between them, and stop when a
phase fails.

## Why the order is fixed

The workflow half cannot be validated outside the container. `task check` run on the host exercises host tool
versions, which proves nothing about what a contributor or CI will get. Running the phases in the other order, or
in parallel, produces a green result that means nothing.

So: the container must build before any task, lint rule or hook is validated. The build succeeding is the gate.

## Procedure

### Phase 0. Scope

Determine which phases are needed before starting:

| Repo state | Phases |
| ---------- | ------ |
| No `.devcontainer/` and no `Taskfile.yml` | Both, in order |
| `.devcontainer/` exists, no task surface | Phase 2 only, after confirming the container builds |
| Both exist | Both, in audit mode |
| Container explicitly not wanted | Phase 2 only; say that validation is host-bound and therefore weaker |

State the plan and the phases you are about to run before running them.

### Phase 1. Container

Apply the `setup-devcontainer` skill. Do not proceed past its preflight failures: if Docker is unreachable or the
`devcontainer` CLI cannot be installed, stop here and report. A container that was never built is not a handoff.

Carry forward: the resolved `remoteUser`, the workspace folder path, the package managers found, and the cache
variables emitted.

**The phase gate:** `devcontainer up --workspace-folder .` exits 0. If it does not, fix the container before
touching anything in phase 2. Do not work around a broken container by validating on the host.

### Phase 2. Workflow

Apply the `setup-dev-workflow` skill, running every command inside the container built in phase 1:

```bash
devcontainer exec --workspace-folder . -- bash -lc '<command>'
```

Feed it what phase 1 learned, so it does not re-derive the package managers or re-read the manifests.

Phase 1 wrote a post-create script that calls `task dev:setup`, which did not exist at the time. Phase 2 creates
it. Rebuild once at the end so the post-create path is exercised for real:

```bash
devcontainer up --workspace-folder . --remove-existing-container
```

An environment whose post-create has never succeeded against the real Taskfile is not finished.

## Asking the user

Both skills batch their questions. Do not let them ask twice: collect phase 1 and phase 2 questions into as few
rounds as the ordering allows, and never ask in phase 2 for something phase 1 already established.

## Output contract

1. The phase plan, stated up front.
2. Each skill's own output contract, unmodified.
3. The result of the final rebuild, showing post-create running the real `task dev:setup`.
4. A single list of everything left unverified across both phases.
