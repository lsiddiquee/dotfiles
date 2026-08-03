---
name: author-agent-instructions
description: "Use when creating, reviewing, trimming or arguing about a repository's always-on agent instruction file for Copilot, Claude, or similar. Triggers: copilot-instructions.md, AGENTS.md, CLAUDE.md, agent instructions, house rules for agents, /init, generate instructions, instruction file review, instructions too long, instructions ignored, onboarding an agent to a repo."
---

# Authoring agent instructions

This skill has two jobs, and they are not the same:

1. **Author** an always-on repository instruction file for coding agents (GitHub Copilot, Claude Code, Cursor,
   Codex-style agents, and similar). The *path* varies by tool; the *job* does not.
2. **Apply a default engineering baseline** that is language- and domain-neutral: how work is done, not which stack
   is used. It is applied in full unless the user overrides a named part.

Default path when none is named and none already exists: `.github/copilot-instructions.md`. If the user names a path,
or the repo already has a canonical file (`AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, and similar),
use that. Prefer one always-on file unless the user asks for more. When generating for more than one tool, keep the
same substance; only the filename (and any tool-required frontmatter) should differ.

The generated file is a harness. It must be clear for both audiences, and **processable by ordinary LLMs** without
repo-specific tribal knowledge:

| Audience | Needs |
| -------- | ----- |
| Coding agents (Claude, GPT, Grok, Copilot, …) | Unambiguous rules they can execute: what to do, where files live, what "done" means, no contradictions |
| Humans reviewing the file | Why a line exists, and whether it is a repo fact or an intentional baseline rule |

Write the generated file so a capable model that has never seen this skill can still follow it. Prefer short
imperative rules, named paths, and checklists over essay. If two lines can be read as conflicting, they are a bug.

## How to read this file

Sections carry one of three registers. The payload deliberately restates ideas from the process sections. That is
not duplication to cut.

| Register | Sections | Meaning |
| -------- | -------- | ------- |
| **Process** | Line economy, Three kinds of content, Language and domain, Procedure, Asking the user, Anti-patterns, Working from `/init`, Output contract | Instructions to you, the authoring agent. Never copied into the generated file. |
| **Payload** | Default engineering baseline | Substance to emit into the generated file. Adapt wording; keep the substance. |
| **Guidance** | Repo-shaped sections | How to fill each repo-shaped section from inventory. Never copied verbatim. |

## Line economy

An always-on instruction file is loaded often and acted on unevenly. Each line must buy more than it costs. Most
files fail by saying too much that was already true elsewhere, not by saying something wrong.

### The test

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

## Three kinds of content

Every line in the generated file is exactly one of:

| Kind | Meaning | When to write it |
| ---- | ------- | ---------------- |
| **Verified fact** | Attested by the repository right now | After inventory confirms it |
| **Baseline rule** | From this skill's default engineering harness | Always, unless the user overrides it |
| **Confirmed decision** | A choice the repo does not encode yet | Only after the user confirms, or omit the section |

Never present a guess as a verified fact. Never present an unconfirmed repo-specific convention as a baseline rule.
Baseline rules may be opinionated. That is intentional: this skill exists to generate instructions the author wants
to work under. The baseline itself is stack-neutral; attested language, toolchain, and domain enter as verified
facts under the rules below.

**Make the kind legible without markup.** Every verified fact names the file or command it came from. A line with no
source pointer is a baseline rule. A confirmed decision carries a trailing `(confirmed)`. A reviewer can then tell
repo law from house style by reading one line, and an agent never guesses which rules are negotiable.

## Language and domain: include without duplicating

If inventory finds a real stack or domain, the harness must make agents obey it. Silence is wrong: an agent will
invent style, layout, or domain shortcuts. Duplication is also wrong: copied rule lists drift from the linter. This
is the only home for that rule; later sections apply it rather than restating it.

| Do | Do not |
| -- | ------ |
| Name the language(s), package managers, and primary domain only as attested | Invent a stack or domain the repo does not show |
| Point at linter, formatter, type-checker, analyzer, and policy configs as authoritative | Paste rule IDs, severity tables, or full config excerpts |
| Name the command(s) that apply those checks | Restate what each rule does |
| Write only unenforced conventions (layout, domain invariants nothing checks) | Repeat a rule the hook or CI already fails on |
| Say "follow the repo configs; do not weaken or bypass them" | Maintain a second prose style guide beside ruff/eslint/analyzer |

The asymmetric-downside exception above still applies: a high-cost rule may be repeated even when enforced, provided
the file says the redundancy is deliberate.

## Procedure

### 0. Pin the target

1. If the user names a path or tool, honour that (`CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, …).
2. Else if the repo already has one canonical always-on instruction file, edit that file.
3. Else write `.github/copilot-instructions.md`.
4. If the user wants the same harness for multiple tools, write multiple files only when asked; keep content aligned.
5. Say the chosen path(s) before writing.

### 1. Inventory before writing

Read; do not recall. Open what exists:

- Task runner, package manifests, and the command that lists available tasks/scripts
- **Language and toolchain:** manifests, lockfiles, SDK/tool pins, solution/project files
- Linter, formatter, type-checker, analyzer config, including comments in those files
- Hooks and CI (what they run is the enforcement map)
- Test config: what is collected, what is excluded
- **Domain signals:** package names, service boundaries, data/compliance docs, ADR/architecture notes that constrain
  implementation — only what is actually present
- Directory layout as it is
- Existing instruction files, README, contrib docs
- `.gitignore` and any existing scratch/working directory convention
- Dev container or runtime pin files when present

Never state a tool default from memory. Measure it.

While inventorying language/domain, build two lists:

1. **Enforced** — checked by linter, formatter, type-checker, tests, hooks, or CI.
2. **Unenforced** — real conventions or domain invariants with no checker.

The generated file must cover both: enforced items by pointer, unenforced items by short prescription. Do not leave
an attested language or domain out of the file entirely.

**An empty inventory is an answer.** Whatever the inventory did not turn up is not a verified fact. A near-empty
repo may still attest to something real, such as a dev container image implying an interpreter. Point at that file.
Do not invent commands, test layout, commit format, language, or domain.

### 2. Draft against the skeleton

Use this order. Each row owns a disjoint slice; if a fact fits two rows, the earlier row wins. Drop a section only
when it would be empty after applying the content rules below.

| Section | Content kind | Holds |
| ------- | ------------ | ----- |
| Intro | Verified fact | What the project is, major trees, attested language/runtime pins, domain in one phrase |
| Non-negotiables | Baseline + verified | Expensive-to-undo rules, including high-downside domain rules when attested |
| Commands | Verified fact | Daily commands including lint/format/typecheck/test entrypoints |
| Single source of truth | Verified fact | What defines "passing"; which configs own style, types, and analysis; "do not bypass" |
| Engineering discipline | Baseline rule | Default harness below |
| Testing | Baseline + verified | Default harness, plus how to run the narrow case when known |
| Commits | Verified or confirmed | Message/PR rules only if attested or confirmed |
| Repo conventions | Verified or confirmed | Layout and domain invariants that nothing checks for you |
| Documentation ownership | Verified + baseline | Which file owns what; update docs in the same change |
| Definition of Done | Baseline, adapted | Closing checklist; include lint/typecheck when they exist; no dangling refs |
| Context persistence | Baseline, paths fixed | Task state files and lifecycle |
| Pattern capture and promotion | Baseline, paths fixed | Patterns file and promotion rules |

Language and toolchain have no section of their own: pins go in Intro, authoritative configs go in Single source of
truth, and anything unenforced goes in Repo conventions. Domain splits the same way by downside.

With no tooling yet, the file is mostly baseline plus any verified runtime pin. That is success, not incompleteness.
With a mature stack, baseline stays, and language/domain appear as pointers plus unenforced residue.

### 3. Cut description

Delete:

- copied config values, linter rule codes, severity lists, versions, full script inventories
- restated tool behaviour ("ruff enforces E, F, I…") when a config, analyzer, or CI job already enforces it
- "there is no X yet"
- rationale that belongs as a comment in the config file

Point at the source of truth instead. After cutting, the file must still **require** agents to run and satisfy those
tools — cutting means remove the mirror, not remove the obligation.

### 4. Verify and classify

For each remaining line:

1. **Verified fact** — find it in the repo, or delete it. Do not soften into "generally uses X".
2. **Baseline rule** — keep the substance from this skill; adapt names to the repo when needed.
3. **Confirmed decision** — keep only if confirmed. Otherwise omit the section or ask.

Watch for the tell: a rule that cites "the required format" when the file never defines one. Either define it from
evidence/confirmation or remove the rule.

### 5. Self-check the generated file

- One home per rule **across files**: never mirror a rule that a config, hook, or CI job already owns. Restating a
  rule inside the generated file is allowed when the restatement changes mood — Definition of Done turns working
  rules into verifiable predicates. That is its job, not duplication to thin.
- Constraints before procedures; checklist near the end.
- Every path and named format is real, or is deliberately created by the baseline and marked as such. No line cites
  "the required format" or "the test command" when the file never defines one.
- **No contradictions:** a later section must not undo an earlier one; exemptions (docs/config/spikes) must match
  across discipline, testing, and Definition of Done; no hedge-pairs ("always X" beside "except when convenient").
- **Model-processable:** any of Claude / GPT / Grok / Copilot can follow the file without this skill in context,
  without guessing where state goes, and without resolving ambiguity between two rules.
- **Stack coverage:** attested languages, toolchains, and domains are named and reachable through their configs;
  Commands and Definition of Done still require the real check commands.
- Concrete scratch paths and the full task-state lifecycle are present.
- No stack or domain invention beyond inventory.
- No tool-locked wording unless the file is truly tool-specific ("in the Copilot chat panel…"). Rules should read as
  repository law, not product UI help.

## Asking the user

Ask only for residue the repo cannot answer and the baseline does not already decide.

Common residue:

- commit / branch / PR conventions when nothing in the repo defines them
- non-negotiables beyond the baseline
- target path when several instruction files exist and the user has not chosen

Rules:

1. **Ask once, in a batch.** Prefer an interactive question tool when available; otherwise put the questions first in
   the reply.
2. **Offer a concrete default on every question.**
3. **Never ask what inventory already answered.**
4. **Do not block baseline or verified facts on answers.** Write those now.
5. **Do block repo conventions on answers.** Omit them until confirmed. Do not fill them with guesses.

If the user wants a different engineering style, they can override baseline rules explicitly. Without an override,
use the baseline below.

## Default engineering baseline

**Register: payload.** Everything below is substance for the generated file, not instructions to you. It restates
ideas from the process sections above on purpose.

Include these sections in every generated file unless the user overrides them. They are intentional preferences for
harnessing engineering agents. Adapt wording to the repo; keep the substance. When the user overrides a baseline
rule, record the override in the generated file as a one-line `(confirmed)` note, so the next run does not silently
reinstate it.

### Non-negotiables

- No secrets, tokens, or credentials in the repo, commits, fixtures, or logs.
- Validate at trust boundaries.
- Never delete or weaken tests to land a change.
- Do not bypass or weaken repo linters, formatters, type-checkers, or analyzers to land a change.

### Engineering discipline

- **TDD for behaviour changes.** For code behaviour, write the failing test first, then the minimal code that passes
  it, then refactor. Pure docs, config-only, or explicit throwaway spikes are exempt unless the user says otherwise.
- **YAGNI.** Smallest thing that ships the current slice. While work is unreleased, prefer a clean break over a
  compatibility shim or dual path.
- **DRY on the third instance.** First stays local; second is compared; third stable copy earns a shared abstraction
  in the owning layer.
- **No introduced regressions.** Leave quality at status quo or better. Do not add warnings, deprecations, lint
  suppressions, or type-ignores. If a change surfaces noise, fix it in the same change. "It comes from a dependency"
  is not an exemption. If it cannot be fixed now, do not land the noisy change.
- **Small, reversible changes.** Fix root causes. Match existing seams before inventing new ones.
- **No over-engineering.** Only what was asked for or is clearly necessary. Do not handle states that cannot happen.

### Testing

- While iterating, run the narrowest check that proves the point, not the whole suite by default.
- **Never delete or weaken a test to make a change pass.**
- Cover failure paths, not only the happy path.
- Coverage thresholds are earned by behaviour tests, never by padding.
- When the repo has a known test command, name the narrow and full forms under Commands or Testing.

### Definition of Done

Use as the authoritative closing checklist. Keep one line per item. Omit an item only when it cannot apply to the
repository yet; do not leave dangling references.

1. For behaviour changes: failing test first; success and failure paths covered. Skip only for pure docs/config/spikes.
2. Relevant fix/test/check commands are clean, or the hook runner reports nothing modified. If no runner exists yet,
   say what was run manually.
3. No new warning, deprecation, or suppression introduced.
4. No secret or token added; new trust-boundary inputs are validated.
5. Commit message follows the repo's attested or confirmed format. Mention PR title only if the repo uses PR titles
   as a checked surface; define the format in the Commits section before citing it here.
6. Docs current: whichever file owns the changed behaviour updated in the same change.
7. Durable learnings captured and promoted; not left only in assistant memory or task state.

### Context persistence

Assume anything not written down is lost.

| Location | Lifetime | Audience | Holds |
| -------- | -------- | -------- | ----- |
| Assistant / tool memory | not durable; assume it is gone next session | you | current conversation working state |
| `.local/scratch/` (git-ignored) | until the workspace is rebuilt | you | task state and patterns |
| Git-tracked files | permanent | everyone | rules and facts the next person needs |

Default paths (substitute only if the repo already has a scratch root; write the final paths into the file):

| File | Role |
| ---- | ---- |
| `.local/scratch/task-state.md` | Live task state |
| `.local/scratch/task-state-completed.md` | Archive of finished blocks from the live file |
| `.local/scratch/patterns.md` | Durable candidates, append-only |

Rules to write into the generated file:

1. For any non-trivial task, create `task-state.md` **before the first edit**.
2. Keep in it: current focus; in-flight items with state and next step; deferred threads; key findings.
3. Checkpoint before focus changes, deep dives, long/branching operations, and after meaningful findings. Re-read on
   resume.
4. When live state exceeds roughly 200 lines or collects several finished blocks, move completed sections to
   `task-state-completed.md` (newest first). Do this when bloat appears, not only when asked.
5. When the task is closed: promote anything durable, then delete `task-state.md` and
   `task-state-completed.md`, or leave them empty. Do not keep stale task state as if it were current.
6. Ensure `.local/` is git-ignored when this baseline is applied. If `.gitignore` cannot be changed in the same work,
   say that the operator must ignore it before using the path.
7. Never leave a durable decision only in assistant or tool memory. Write it to a file in the same turn it is made.

### Pattern capture and promotion

1. Append durable candidates to `.local/scratch/patterns.md` when they appear.
2. Do not store durable notes only in `task-state.md`. Task state is lossy on purpose.
3. `patterns.md` shrinks only by promotion or by being proven wrong, never by tidying with the task.
4. Capture when: the same thing is explained twice; the same class of mistake is corrected twice; a non-obvious gotcha
   costs real time; a decision would otherwise live only in memory.
5. Promote in the same change when possible:
   - to the instruction file when it changes future agent behaviour
   - to human docs when a person needs it to work here
6. Leave an entry in `patterns.md` only while it may not generalise.
7. If rediscovering it would cost someone a morning, it belongs in git.

## Repo-shaped sections

**Register: guidance.** How to fill each section from inventory. Do not copy this prose into the generated file.

Write these only from inventory or confirmation.

### Intro

A few lines: what the system is, where major trees are, attested language/runtime pins, and domain in one phrase when
real. No roadmap. No hoped-for stack.

### Non-negotiables

Start from the baseline non-negotiables in the payload section, then add repo-attested rules (compliance, data
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

## Working from `/init` or an existing file

Generators are useful for inventory and little else. Their output is usually description-heavy and baseline-poor:
they can see config, not engineering harness preferences.

Process:

1. Treat generator output as an unedited draft.
2. Run inventory again anyway.
3. Delete description that duplicates sources of truth.
4. Insert the default baseline sections if missing.
5. Verify every repo-shaped claim.
6. Ask for residue; do not invent it.

A short existing file is not proof of discipline. It may simply be missing harness rules. Judge by what an agent
still gets wrong, not by whether the file looks tidy.

When reviewing, check wrong claims before style, then missing baseline sections, then absent repo-shaped sections.

## Output contract

Quality of the generated file is defined by step 5; this contract covers what the agent does and reports.

1. State the target path(s) and which tool ecosystem they serve, if relevant.
2. Write or update those files.
3. Pass every item in step 5 before reporting done.
4. Report briefly: target path(s), verified stack/domain pointers, baseline applied, overrides recorded, and
   anything omitted pending confirmation.

## Resolving "less is more"

Length arguments collapse once every line is assigned one of the three kinds above: cut description that duplicates
a source of truth, keep baseline prescription that has nowhere else to live, keep verified facts that change agent
decisions, and omit unconfirmed guesses. That is the deterministic version of "be brief" versus "be prescriptive".
