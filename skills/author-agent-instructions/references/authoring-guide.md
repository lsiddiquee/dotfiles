# Authoring guidance

**Register: process and guidance.** These are instructions to the authoring agent, not payload to copy into the
generated file. Use the section guidance only from inventory or confirmation.

## Line economy

Keep lines that change an agent's decisions. Remove duplicated configuration and prose that adds no instruction.

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
invent style, layout, or domain shortcuts. Duplication is also wrong: copied rule lists drift from the linter.

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

### Configurable gate authoring contract

Every configurable approval gate added to this skill or its payload must use this contract. A new approval
obligation is a gate even if phrased as a baseline rule or checklist item. Do not silently add mandatory gates, or
make existing safety requirements optional by relabeling them. Gate selection is authoring process; generated
repository instructions contain the resolved policy, not the skill's question-tool workflow.

Each gate definition must name:

| Field | Required content |
| ----- | ---------------- |
| Purpose and trigger | The risk addressed and exactly which changes require review |
| Recommended policy | Review content, approver, timing and conditions requiring renewed approval |
| Choices | Enable the recommendation, customize its terms, or disable this gate; explain each consequence |
| Waivers and exemptions | Who can waive review, for which scope, and how the waiver is recorded |
| Decision owner | Where the confirmed policy and individual approvals/waivers live; use real or deliberately created paths |
| Review-record storage | Ask initially: repo-local ignored `.local/` or a named committed directory; resolve and record the exact workspace-relative path and ignore policy, preserving an established choice |
| Completion predicate | The Definition of Done check derived from the chosen terms, absent when disabled |

Use the interactive ask-question tool when available, with an explicit-question fallback. Recommend enabling the
documented policy, but never treat a default, silence or a skipped answer as consent. Batch initial gate choices
with other questions. For Customize, offer the recommended terms as defaults and ask only for unresolved trigger,
review content, approver, waivers/exemptions, recording and reapproval details. A focused follow-up is allowed;
unresolved terms stay pending, not guessed.

Persist each newly selected policy as a named `(confirmed)` decision: enabled, customized with effective terms, or
disabled. Keep policy choice distinct from approval or a scoped waiver for a particular change. Preserve confirmed
choices on later runs unless a change is requested. Preserve inherited binding policies verified from authoritative
repository instructions, adopted design decisions or enforcement with their sources and effective terms, even
without confirmation markers. Do not invent a fresh confirmation record or re-ask an established choice.
If authority or meaning is unclear, retain existing gate text while asking for clarification in write mode; review
mode reports the uncertainty without requiring a selection. Trimming and review must retain the selected behavior, not reinstate the
recommendation. Update all affected prose and completion checks together so disabling a gate cannot leave an
equivalent approval obligation elsewhere. Never weaken independent data-safety authorization.

When adding or changing a configurable gate, trial the skill against these cases and inspect decisions and emitted
instructions, not exact phrases or Markdown presence:

| Trial | Expected behavior |
| ----- | ----------------- |
| Enable model gate; draft-to-issued lifecycle | Ask once, record the choice, require model presentation and user approval/scoped waiver before implementation; prefer one aggregate with states |
| Customize model gate | Resolve all custom terms; generate matching rules and completion checks rather than the recommendation |
| Disable model gate | Record the choice, omit its approval obligation and completion check; preserve aggregate-reuse and data-safety rules |
| No answer or incomplete customization | Report pending; no assumed consent, no new gate obligation, no removal of an existing gate |
| Repeat run with confirmed custom policy | Retain its terms without asking again or replacing it with defaults |
| Inherited binding gate without confirmation markers | Preserve its verified source and effective terms without asking again or inventing confirmation |
| Review-only request with unresolved policies | Report findings and uncertainty without edits or mandatory policy selection |
| Ambiguous write target among existing instruction files | Resolve ownership before writing; do not create a third file or merge differing policies |
| Shared-database schema change, any gate choice/waiver | Preserve data through migration unless destructive operations are separately authorized |
| Model-review tool active | Use the editor review; no duplicate built-in or plain-chat questions while it is active |
| Initial creation with model review enabled | Resolve ignored `.local/` versus committed review-record storage and exact path with the initial questions; emit the confirmed policy and tool argument |
| Repeat run with an established storage policy | Retain path and ignored/committed policy without asking again or inventing new confirmation |
| Storage unanswered or missing in an existing enabled gate | Keep the location pending; ask before a review writes records, never use external editor storage implicitly |
| Ignored or committed review storage | Verify ignore status; use the same path for editor and chat records; committed choice never authorizes a git commit |
| Revised editor proposal | Reuse its proposal path and tab; preserve a separate explicit decision for the revised content |
| Model-review tool inactive but discoverable | Discover once by registered name and use it; absence from the active list alone does not select fallback |
| Model-review tool missing or discovery unavailable | Present the same details in Markdown; use built-in questions if available, plain chat otherwise; no install requirement or discovery loop |
| Model review deferred, closed or cancelled | Leave approval pending; do not seek approval again through fallback |
| Representative future gate | Apply the same question flow, choice recording and matching checks without shipping a speculative gate |

Report which trials were actually performed. A walkthrough review is not an interactive consumer trial; distinguish
the two and disclose any unexecuted question-tool or generation behavior.

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
| Citing an undefined "required format" | Agents cannot determine the required format | Define it or delete the cite |
| Mixing durable notes into task state | Task-state cleanup can delete durable notes | `patterns.md`, then promote |
| Adding a configurable gate as unconditional baseline | User never selected a repository policy | Use the gate-selection contract before emitting rules |
| Treating a recommendation or silence as consent | Applies an unapproved gate policy | Keep the choice pending until explicitly resolved |
| Keeping an approval checklist after disabling its gate | Reintroduces the gate indirectly | Derive prose and completion checks from the same confirmed policy |
