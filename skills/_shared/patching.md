# Patching an existing setup

**Register: process.** Instructions to the authoring agent. Never copied into generated files.

Someone hit a problem you cannot see and fixed it, and the fix survives as a line you will not understand from
inventory. Treat existing configuration as load-bearing until proven otherwise. Do not rewrite a working setup: a
baseline describes an end state rather than a diff to apply in one step.

## Audit first, change second

Report findings before editing. Sort every gap into one of four classes:

| Class | Meaning | Action |
| ----- | ------- | ------ |
| **Broken** | Demonstrably fails: an `apt-get update` error, a cache var pointing at a path that is not mounted, a task that exits non-zero | Fix, and show the command that proves it was broken |
| **Missing** | A baseline element is absent | Propose, with the cost of not having it |
| **Divergent** | Works, but differs from the baseline | Ask, with the consequence of each answer spelled out; never silently convert |
| **Unexplained** | You cannot derive why it exists | Keep it. Ask. |

Only the **broken** class may be edited without asking.

For devcontainer patch audits, include package feeds. Compare host `NPM_CONFIG_REGISTRY`, `PIP_INDEX_URL`, and
`NUGET_SOURCE` forwarding with both project managers and installers invoked by retained features; a feature such as
Python with `installTools: true` is relevant even without a Python manifest. Inspect Dockerfile build args/env
ordering, effective workspace NuGet sources, repository source mappings and `auditSources`, and lockfile URLs for
host-private endpoints. A user-level NuGet source-count check alone is not proof of isolation.

Treat missing forwarding as **missing**, not broken. Treat an existing source, mapping, or audit configuration as
load-bearing until its effect is understood. Ask before changing it; never silently replace user configuration,
remove source mappings or weaken audit coverage. Where a feed override is serialized into lockfiles, use an
existing manager-aware pre-commit hook to prevent host-private URLs being committed, and verify that it preserves
lockfile integrity rather than deleting URLs generically.

## Ask once, after the audit

Put every missing and divergent finding into a single batched round of questions and wait. Do not fix the easy
ones first and ask about the rest: a half-applied change is harder to reason about than an untouched setup.

Each question names the concrete consequence of each answer. "Convert to strict?" is not answerable; "convert to
strict, and these four steps become fatal" is.

Offer an accept-all. A user who wants the whole baseline should be able to take it in one answer.

## Naming what becomes fatal

Before offering any change that removes a guard, read the script and list what the guards are currently hiding.
For each guarded step, say what happens afterwards: a `command -v` guard around an optional tool means the setup
now fails when that tool is absent; a `|| true` on a network fetch means an offline run now fails.

Without that list the user is being asked to approve an unbounded change.

## Keep what you cannot explain

An `initializeCommand` capturing the host IP, an `--env-file` in `runArgs`, a `certs/` directory, a local-only
service password, a pinned port, a lint rule disabled without a comment: deleting one moves a repo from working to
broken with no error message pointing at the cause.

If you cannot state what a line does and what breaks without it, keep it.

A *stated* reason can still be stale. Check that the guarded path still exists, and that the guard is not skipping
every time and hiding the fact that nothing replaced it.

## Do not churn

A newer base image, feature major or tool version is not by itself a reason to change one. Bump when something is
broken, unsupported, or the user asks.

The exception is a probe that fails. Something demonstrably broken is **broken** rather than divergent, and
replacing it is the fix.
