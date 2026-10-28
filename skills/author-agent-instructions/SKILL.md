---
name: author-agent-instructions
description: "Use when creating, reviewing, trimming or arguing about a repository's always-on agent instruction file for Copilot, Claude, or similar. Triggers: copilot-instructions.md, AGENTS.md, CLAUDE.md, agent instructions, house rules for agents, /init, generate instructions, instruction file review, instructions too long, instructions ignored, onboarding an agent to a repo."
---

# Authoring agent instructions

This skill has two jobs:

1. **Author** an always-on repository instruction file for coding agents (GitHub Copilot, Claude Code, Cursor,
   Codex-style agents, and similar). The *path* varies by tool; the *job* does not.
2. **Apply a default engineering baseline** that is language- and domain-neutral: how work is done, not which stack
  is used. It is applied in full unless the user overrides a named part, except configurable approval gates:
  resolve those explicitly before emitting their rules.

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

## Required reference loading

This file is **process**: instructions to the authoring agent, never copied into the generated file. Read the
references in full at the following points; do not treat their payload or guidance as optional because it moved.

| Reference | When to read | Register and role |
| --------- | ------------ | ----------------- |
| [Engineering baseline](./references/engineering-baseline.md) | Before drafting or reviewing any instruction file | **Payload:** emit applicable baseline sections; emit configurable gates only under their confirmed policy |
| [Authoring guide](./references/authoring-guide.md) | Before drafting, trimming or reviewing any instruction file | **Process/guidance:** line economy, stack coverage, repo-shaped sections and anti-patterns; never copy verbatim |
| [Terraform guidance](./references/terraform.md) | When inventory finds Terraform or infrastructure setup is planned | **Guidance:** confirmed environment layout, examples and safe command selection; do not reproduce samples in the harness |

The payload deliberately restates some process ideas. That is not duplication to cut. Generated instructions must
stand alone: emit the required substance, not links to these skill references that future agents may not have.

## Three kinds of content

Every line in the generated file is exactly one of:

| Kind | Meaning | When to write it |
| ---- | ------- | ---------------- |
| **Verified fact** | Attested by the repository right now | After inventory confirms it |
| **Baseline rule** | From this skill's default engineering harness | Always, unless the user overrides it |
| **Confirmed decision** | A choice the repo does not encode yet | Only after the user confirms, or omit the section |

Never present a guess as a verified fact. Never present an unconfirmed repo-specific convention as a baseline rule.
Baseline rules may be opinionated. The baseline is stack-neutral; attested language, toolchain, and domain enter as verified
facts under the rules below.

**Make the kind legible without markup.** Every verified fact names the file or command it came from. A line with no
source pointer is a baseline rule. A confirmed decision carries a trailing `(confirmed)`. A reviewer can then tell
repo law from house style by reading one line, and an agent never guesses which rules are negotiable.

## Procedure

### 0. Establish mode and target

Use **review mode** for requests to check, review or explain instructions: inspect and report findings without
editing files or requiring policy selections. Describe unresolved policy choices as findings or questions, not
decisions the user must make to receive the review. Use **write mode** when the user requests creation, updates,
trimming or implementation of findings. A review does not authorize applying its recommendations.

1. If the user names a path or tool, honour that (`CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, …).
2. Else if the repo has one canonical always-on instruction file, use it as the target.
3. If several files exist and ownership is unclear, identify their scopes and ask which to change before any
  instruction-file write. Do not create a default file or reconcile differing policies while that choice is pending.
  In review mode, review the identified files together when useful and report ownership ambiguity.
4. Only when no instruction file exists and no target is named, use `.github/copilot-instructions.md` in write mode.
  In review mode, report the absence rather than creating it.
5. Write for multiple tools only when asked; keep aligned content within their confirmed scopes.
6. Say the chosen path(s) and mode before proceeding.

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

Start with authoritative entrypoints and the instruction files in scope. Follow references only to verify a claim,
resolve conflicting ownership or identify a missing requirement. Stop when every planned fact has a source and
the required stack, domain and policy questions are resolved or explicitly pending; do not inventory unrelated
trees or every task merely because they exist.

### 1a. Resolve configurable approval gates

In write mode, before drafting affected rules, follow the gate-selection contract in the
[authoring guide](./references/authoring-guide.md). The engineering baseline's named configurable gates are the
available choices; currently this includes **Domain and persistence model approval**. This selection configures
future repository instructions; it is not approval of any particular model or operation.

Preserve an existing explicitly confirmed policy, including a disabled or customized choice, unless the user asks
to change it. Also preserve a binding policy verified in an authoritative repository instruction, adopted design
decision or enforced policy, even without a `(confirmed)` marker. Carry it forward with its source and effective
terms as a verified fact; do not claim new user confirmation. A suggestion, draft or unexplained rule is not proof
of adoption. Ask only when policy authority, meaning or a requested replacement is unresolved; keep existing text
while clarifying it. In review mode, assess these policies without reopening their selection.
For new or unresolved policies, use the interactive ask-question tool when available, otherwise ask explicit questions
in the response. Offer **Enable the recommended gate**, **Customize the gate**, and **Disable this gate** with
their consequences; mark Enable as recommended, not pre-approved. An explicit choice already supplied by the user
counts as an answer; do not ask it again.

Batch initial choices with other unresolved questions. Ask a focused follow-up only for unresolved customization
details. No answer means pending, not enabled or disabled: unrelated baseline and verified facts may proceed, but
do not emit new gate obligations or remove an existing gate while its policy is unresolved. Report that the run is
incomplete for that policy. Record each newly selected policy as a `(confirmed)` decision in the owning instruction file,
including its name, enabled/customized/disabled state and the effective terms or a pointer to their owning design
document. Do not invent a documentation path; use the existing owner or deliberately create and name one.

### 2. Draft against the skeleton

Use this order. Each row owns a disjoint slice; if a fact fits two rows, the earlier row wins. Drop a section only
when it would be empty after applying the content rules below.

| Section | Content kind | Holds |
| ------- | ------------ | ----- |
| Intro | Verified fact | What the project is, major trees, attested language/runtime pins, domain in one phrase |
| Non-negotiables | Baseline + verified | Expensive-to-undo rules, including high-downside domain rules when attested |
| Commands | Verified fact | Daily commands including lint/format/typecheck/test entrypoints |
| Single source of truth | Verified fact | What defines "passing"; which configs own style, types, and analysis; "do not bypass" |
| Engineering discipline | Baseline + verified + confirmed | Required baseline, inherited binding policies and newly confirmed gate choices; no new unconfirmed obligations |
| Testing | Baseline + verified | Default harness, plus how to run the narrow case when known |
| Commits | Verified or confirmed | Message/PR rules only if attested or confirmed |
| Repo conventions | Verified or confirmed | Layout and domain invariants that nothing checks for you |
| Documentation ownership | Verified + baseline | Which file owns what; update docs in the same change |
| Definition of Done | Baseline, adapted | Closing checklist; include lint/typecheck when they exist; no dangling refs |
| Context persistence | Baseline, paths fixed | Task state files and lifecycle |
| Pattern capture and promotion | Baseline, paths fixed | Patterns file and promotion rules |

Language and toolchain have no section of their own: pins go in Intro, authoritative configs go in Single source of
truth, and anything unenforced goes in Repo conventions. Domain splits the same way by downside.

With no tooling yet, the file is mostly baseline plus any verified runtime pin.
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
  rules into verifiable predicates.
- Constraints before procedures; checklist near the end.
- Every path and named format is real, or is deliberately created by the baseline and marked as such. No line cites
  "the required format" or "the test command" when the file never defines one.
- **No contradictions:** a later section must not undo an earlier one; exemptions (docs/scripts/config/spikes) must match
  across discipline, testing, and Definition of Done; no hedge-pairs ("always X" beside "except when convenient").
- **Model-processable:** any of Claude / GPT / Grok / Copilot can follow the file without this skill in context,
  without guessing where state goes, and without resolving ambiguity between two rules.
- **Stack coverage:** attested languages, toolchains, and domains are named and reachable through their configs;
  Commands and Definition of Done still require the real check commands.
- Concrete scratch paths and the full task-state lifecycle are present.
- Every configurable gate has a verified binding or confirmed policy, or is reported pending; no recommendation was mistaken for
  consent. Enabled/customized gate rules and Definition of Done agree; disabled gates leave no indirect approval
  requirement. Preserve unchanged confirmed choices, including custom terms, across later runs and trimming.
- Gate-policy selection, approval of a particular change, and a one-off waiver are distinct records. Model-gate
  selection or waiver never authorizes destructive data operations.
- When changing this skill or its references, every new configurable approval gate follows the authoring guide's
  gate-selection contract and behavioral trials. Reject additions that silently impose a gate through payload,
  review guidance or a checklist; do not reclassify existing safety requirements as optional.
- No stack or domain invention beyond inventory.
- No tool-locked wording unless the file is truly tool-specific ("in the Copilot chat panel…"). Rules should read as
  repository law, not product UI help.

## Asking the user

Ask for unresolved configurable gate policies and residue the repo cannot answer. Non-gate baseline rules still
apply unless explicitly overridden; a gate recommendation does not decide the user's policy.

Common residue:

- commit / branch / PR conventions when nothing in the repo defines them
- non-negotiables beyond the baseline
- target path when several instruction files exist and the user has not chosen
- enable/customize/disable choices for new gates or policies without verified authority or an existing confirmed choice

Rules:

1. **Batch initial questions.** Use an interactive question tool when available; otherwise put explicit questions
  first in the reply. Allow focused follow-ups for unresolved answers needed to establish scope, conventions or
  gate customization.
2. **Offer a concrete default on every question.**
3. **Never ask what inventory already answered.**
4. **Do not block unrelated baseline or verified facts on answers.** Write those now.
5. **Do block repo conventions and new gate obligations on answers.** Keep unanswered policy choices pending;
  preserve existing gate text until resolved. Do not fill them with guesses.

In review mode, report unresolved choices without requiring answers or writing policy records. In write mode,
if the user wants a different engineering style, they can override baseline rules explicitly. Without an override,
use the required non-gate baseline payload. Configurable gates always follow step 1a.

## Working from `/init` or an existing file

Generators are useful for inventory and little else. Their output is usually description-heavy and baseline-poor:
they can see config, not engineering harness preferences.

Process:

1. Treat generator output as an unedited draft.
2. Run inventory again anyway.
3. Delete description that duplicates sources of truth.
4. Insert missing non-gate baseline sections; resolve gate policies under step 1a before adding or changing gates.
5. Verify every repo-shaped claim.
6. Ask for residue; do not invent it.

A short existing file is not proof of discipline. It may simply be missing harness rules. Judge by what an agent
would do differently when a missing rule is supplied.

When reviewing, check wrong claims before style, then missing baseline sections, then absent repo-shaped sections.

## Output contract

Quality of the generated file is defined by step 5; this contract covers what the agent does and reports.

1. State the mode, target path(s) and tool ecosystem, if relevant.
2. In review mode, return findings ordered by severity with file references, assumptions and validation gaps.
  Report a clean review when appropriate. Do not edit files or require that identified defects be fixed first.
3. In write mode, update only the resolved targets and pass every applicable item in step 5 before reporting done.
4. For writes, report target path(s), verified stack/domain pointers, baseline applied, overrides recorded,
  inherited binding policies, enabled/customized/disabled gate choices, and anything pending confirmation.
  Do not report a pending gate as resolved or an inherited policy as newly confirmed.

## Retention criteria

Apply the three content categories when deciding what to retain: cut description that duplicates a source of truth,
keep baseline rules without another owner, keep verified facts that change agent decisions, and omit unconfirmed
guesses.
