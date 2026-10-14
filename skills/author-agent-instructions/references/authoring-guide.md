# Authoring guidance

**Register: process and guidance.** These are instructions to the authoring agent, not payload to copy into the
generated file. Use the section guidance only from inventory or confirmation.

## Line economy

An always-on instruction file is loaded often and acted on unevenly. Each line must buy more than it costs. Most
files fail by saying too much that was already true elsewhere, not by saying something wrong.

Every candidate line answers:

> Does knowing this **in advance** save a cycle that the tooling would not teach cheaply anyway?

Fails:

1. **It restates an external source of truth.** Config, lockfile, or `--help` already says it. A copy in another
   file drifts; a copy inside this one file does not.
2. **A fast local check already rejects it.** A clear local hook teaches the rule in one cycle.

Passes:

- **Prescription, not description.** "Never weaken a test to make a change pass" does not go stale. "`select` is E,
  F, I" goes stale when the config changes.
- **Nothing enforces it.** Silent drift, layout conventions, confusing tool failures.
- **The feedback loop is slow.** A rule checked only after push or PR review is worth a line.

Exception: **asymmetric downside earns redundancy.** Secret handling stays even when a scanner also enforces it.
State that the redundancy is deliberate.

## Language and domain: include without duplicating

If inventory finds a real stack or domain, the harness must make agents obey it. Silence is wrong: an agent will
invent style, layout, or domain shortcuts. Duplication is also wrong: copied rule lists drift from the linter. This
is the only home for that rule; section guidance below applies it rather than restating it.

| Do | Do not |
| -- | ------ |
| Name the language(s), package managers, and primary domain only as attested | Invent a stack or domain the repo does not show |
| Point at linter, formatter, type-checker, analyzer, and policy configs as authoritative | Paste rule IDs, severity tables, or full config excerpts |
| Name the command(s) that apply those checks | Restate what each rule does |
| Write only unenforced conventions (layout, domain invariants nothing checks) | Repeat a rule the hook or CI already fails on |
| Say "follow the repo configs; do not weaken or bypass them" | Maintain a second prose style guide beside ruff/eslint/analyzer |

The asymmetric-downside exception above still applies: a high-cost rule may be repeated even when enforced, provided
the file says the redundancy is deliberate.

## Repo-shaped sections

### Intro

A few lines: what the system is, where major trees are, attested language/runtime pins, and domain in one phrase when
real. No roadmap. No hoped-for stack.

### Non-negotiables

Start from the baseline non-negotiables in the payload, then add repo-attested rules (compliance, data
handling, release constraints). This is where attested **domain** rules land when the downside is high enough to
justify a line even if something already checks them. Point at ADRs or specs that own the detail. Keep the list
short.

### Commands

Only the daily commands, including whatever applies lint/format/types/tests. Point at the task list / package scripts
/ Makefile for the rest. If none exist, omit the section.

### Single source of truth

Name the check entrypoints that define "green" locally and in CI when they exist. Name which config files own
formatting, lint, types, and analysis, and state that those tools are binding: fix findings, do not suppress unless
the repo already documents an exemption process. If local and CI differ, say so plainly; do not pretend they match.

This section carries the toolchain pointers. Runtime and SDK pins belong in Intro, named by their pin file
(`global.json`, devcontainer image, `.tool-versions`, and similar).

### Repo conventions

Layout rules, naming rules, and domain invariants that no linter, test, or CI job checks. This is the home for the
unenforced residue from inventory. If a rule has a checker, it belongs in Single source of truth as a pointer
instead. Do not paste architecture encyclopedias. Do not invent domain packs the repo does not practice.

### Commits

Write only if hooks, templates, recent history, or the user define a format. Otherwise omit. Do not invent
Conventional Commits.

### Documentation ownership

When known, say which file owns human setup vs agent rules. Require updates in the same change as behaviour changes.

## Anti-patterns

| Anti-pattern | Why it fails | Instead |
| ------------ | ------------ | ------- |
| Listing every task or script | Second source of truth | Name the daily two or three |
| Restating linter selections | Drifts from config | Point at the config path and the command that runs it |
| Explaining what a hook does | Hook output already does | Say what to do when it fires |
| "Currently we do not have X" | Rots when X lands | Stay silent until X exists |
| Checklist that repeats prose verbatim | Tokens without a new check | Restate as a verifiable predicate, or cut |
| Vague virtues | No observable decision | Rule with a checkable outcome |
| Dumping architecture | Stale quickly | Only constraints on work |
| Inventing stack or conventions | Wrong with high confidence | Verified fact, baseline, or ask |
| Omitting an attested language/domain | Agents freestyle against the repo | Name it; point at enforcing tools |
| Citing an undefined "required format" | Agents enforce fog | Define it or delete the cite |
| Mixing durable notes into task state | Lossy file eats them | `patterns.md`, then promote |
