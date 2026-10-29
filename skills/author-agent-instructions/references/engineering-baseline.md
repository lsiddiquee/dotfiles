# Default engineering baseline

**Register: payload**, except the explicitly marked gate emission and checklist adaptation guidance. The payload
is substance for the generated file. It restates ideas from the process sections on purpose.

Include non-gate sections in every generated file unless the user overrides them. Configurable approval gates
require a confirmed policy under the skill's selection flow. Adapt wording to the repo; keep the substance. When the user overrides a baseline
rule, record the override in the generated file as a one-line `(confirmed)` note, so the next run does not silently
reinstate it.

## Non-negotiables

- No secrets, tokens, or credentials in the repo, commits, fixtures, or logs.
- Validate at trust boundaries.
- Never delete or weaken tests to land a change.
- Do not bypass or weaken repo linters, formatters, type-checkers, or analyzers to land a change.
- Preserve existing deployed/shared data through migration unless the user separately authorizes a destructive
   operation. Unreleased or greenfield status does not authorize resetting, deleting or reseeding that data.
   Model approval, gate-policy selection and review waivers are not destructive-operation authorization.

## Engineering discipline

- **TDD for behaviour changes.** For code behaviour, write the failing test first, then the minimal code that passes
  it, then refactor. Pure docs, standalone scripts, configuration, prompts, response schemas and other declarative
  text, or explicit throwaway spikes are exempt unless the user says otherwise. Scripts and declarative text follow
  execution-based validation under Testing.
- **YAGNI.** Smallest thing that ships the current slice. While work is unreleased, prefer a clean break over a
   compatibility shim or dual path, without bypassing the selected model-review policy or data-preservation rules.
- **Reuse the owning aggregate.** When an existing aggregate represents the concept, prefer lifecycle states and
   workflow-specific validation over equivalent duplicate models. Separate models need a justified ownership or
   domain boundary, reviewed under the selected model-approval policy when applicable.
- **DRY on the third instance.** First stays local; second is compared; third stable copy earns a shared abstraction
  in the owning layer.
- **No introduced regressions.** Leave quality at status quo or better. Do not add warnings, deprecations, lint
  suppressions, or type-ignores. If a change surfaces noise, fix it in the same change. "It comes from a dependency"
  is not an exemption. If it cannot be fixed now, do not land the noisy change.
- **Small, reversible changes.** Fix root causes. Match existing seams before inventing new ones.
- **No over-engineering.** Only what was asked for or is clearly necessary. Do not handle states that cannot happen.

## Configurable approval gate: Domain and persistence model approval

**Emission guidance (process, not payload):** Preserve an existing confirmed policy or verified binding repository
policy unless the user requests a change. Retain the source of inherited policies without inventing user
confirmation. Review mode reports findings without edits or required selections. In write mode, for new or unresolved
policies or requested changes, offer Enable (recommended), Customize or Disable before
drafting this gate; do not re-ask a choice the user has already supplied. Emit the following policy only when
enabled; replace it with the confirmed terms when customized.
When disabled, record that decision without emitting this approval obligation or its conditional completion check.
When unanswered, keep the policy pending, preserving existing gate text rather than silently changing it. The
non-negotiable data-preservation rule applies independently of this selection. Future configurable gates must use
the same selection contract in the authoring guide, not become mandatory through baseline inclusion.

**Recommended policy (payload when enabled):**

- Before implementing a new or materially changed domain/persistence model, present a structured proposal:
   entities/aggregates with ownership and source of truth; field tables listing type, meaning, required/optional,
   stored/derived, mutability, identity/references and constraints; relationship cardinalities; lifecycle states
   and invariants; non-destructive migration mapping and historical gaps; assumptions and unresolved decisions.
   Explain why any parallel model is necessary. Distinguish new-record requirements from existing-data handling.
- Prefer a structured model-review surface when available. If its tool is not active, make one discovery attempt
   by its registered name when discovery is available, then use it if found; otherwise fall back without retry
   loops or requiring installation. Choose one question route: keep questions/feedback in the editor while its
   review is active; only on the fallback route present the same detailed proposal as Markdown and use the
   built-in question tool when available, or explicit chat questions otherwise. Resolve material questions, incorporate feedback and
   present the revised scope before separately requesting explicit approval. Do not preselect approval or treat
   answers/recommendations as consent. Missing review tooling never requires installation or waives the gate;
   a deferred or cancelled review remains pending rather than triggering another approval request via fallback.
- Store review records and proposal snapshots in the repository's confirmed workspace-relative directory, with
   its confirmed ignored or committed policy. Use that location for editor and chat reviews, not external editor
   storage. If this policy is missing, ask whether to use ignored `.local/model-reviews/` or a named committed
   directory, resolve the exact path and record the choice before starting review; silence leaves it pending.
   For Review Model Proposal, pass the recorded directory as `decisionDirectory` alongside `proposalPath`.
   Record the displayed revision, explicit outcome and feedback/answers; never infer approval. Keep secrets out
   of records and verify the directory's ignore status matches the policy. Do not stage or commit without
   authorization. Reuse the same proposal path for revised editor reviews rather than creating a new file each cycle.
- Obtain explicit user approval of that model before implementation, unless the user explicitly waives the review.
   A general request to implement a feature is not model approval. Gate enablement is not model approval either.
- Reuse an existing aggregate for the same concept; prefer lifecycle states and workflow-specific validation over
   equivalent duplicate models unless an approved boundary justifies separation.
- Record the approved model or explicit one-off waiver in the owning design documentation. Record a waiver's scope
   so it cannot silently disable future reviews. Renew approval for material departures from the approved model,
   not routine implementation details within it. Approval covers only the reviewed content and scope, not future
   revisions. A tool receipt alone does not replace repository design documentation. Do not reopen unchanged
   approved decisions.
- Model approval or waiver never authorizes resetting, deleting or reseeding deployed/shared data; obtain separate
   authorization for any destructive operation and otherwise preserve data through migration.

## Testing

- **Standalone scripts and declarative text** (configuration, pipeline/task wiring, prompts, response schemas, docs):
  do not create tests that copy a value, sentence or structure from a file and assert it is still there. Run scripts
  in the intended environment and check outcomes/exit status; validate configuration with its tooling and consuming
   system; prove prompt and schema behaviour with a trial run or evaluation suite against the real consumer. Syntax
  checks are supplementary, not proof of runtime correctness. Report execution not performed. Accidental omission is
  review's job. Genuine shared functions may have behaviour-focused unit tests; do not extract helpers merely to
   justify tests. This exception does not waive application behaviour tests.
- While iterating, run the narrowest check that proves the point. Do not default to the whole suite.
- **Agent-owned Bash terminal sessions only:** run checks in a conditional and capture the original numeric
   status immediately, so ordinary failure cannot skip reporting. Show relevant diagnostics without secrets or
   sensitive payloads, then echo the check name, PASS/FAIL and original command exit code. Immediately follow the
   successful echo with plain `exit`, not `exit "$command_status"`; avoid strict-mode or chained-command exits
   that bypass reporting. Use this pattern with the actual check:

   ```bash
   if some_check; then
      command_status=0
      outcome=PASS
   else
      command_status=$?
      outcome=FAIL
   fi
   echo "some_check: ${outcome}; command_exit=${command_status}"
   exit
   ```

   The terminal's normal exit is not evidence that the check passed: a printed nonzero command code is a failed
   check. Label expected TDD red runs explicitly and continue the repair/test loop; never report them as passing.
   Do not deliberately fail the terminal process or create synthetic nonzero-terminal probes to validate this
   convention. Do not change native exit-status propagation in CI, hooks, repository scripts or callers that
   depend on it; wrap their invocation only in the agent-owned session. Never weaken a quality gate or disable
   editor notifications to avoid a popup.
- **Never delete or weaken a test to make a change pass.**
- Cover success and failure paths.
- Coverage thresholds are earned by behaviour tests, never by padding.
- When the repo has a known test command, name the narrow and full forms under Commands or Testing.

## Definition of Done

Use as the authoritative closing checklist. Keep one line per item. Omit an item only when it cannot apply to the
repository yet; do not leave dangling references.

1. For application/shared-code behaviour: failing test first; success and failure paths covered. Pure docs, standalone
   scripts, configuration, prompts, response schemas and other declarative text, or explicit throwaway spikes are
   exempt; standalone scripts and declarative text use execution-based validation instead.
2. Relevant fix/test/check commands are clean, or the hook runner reports nothing modified. If no runner exists yet,
   say what was run manually.
3. No new warning, deprecation, or suppression introduced.
4. No secret or token added; new trust-boundary inputs are validated.
5. Commit message follows the repo's attested or confirmed format. Mention PR title only if the repo uses PR titles
   as a checked surface; define the format in the Commits section before citing it here.
6. Docs current: whichever file owns the changed behaviour updated in the same change.
7. Durable learnings captured and promoted; not left only in assistant memory or task state.

**Checklist adaptation (process, not payload):** For an enabled model-approval gate, add: "For applicable model
changes, approval or an explicit scoped waiver is recorded in the owning design documentation; material departures
have renewed approval." For a customized gate, add the matching completion predicate under its confirmed terms.
For a disabled or pending gate, do not introduce a model-approval checklist item. A pending policy does not permit
removing an existing obligation. Preserve separate destructive-operation authorization checks whenever relevant,
regardless of the model-gate choice.

## Context persistence

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
   `task-state-completed.md` (newest first). Do this when bloat appears; do not wait to be asked.
5. When the task is closed: promote anything durable, then delete `task-state.md` and
   `task-state-completed.md`, or leave them empty. Do not keep stale task state as if it were current.
6. Ensure `.local/` is git-ignored when this baseline is applied. If `.gitignore` cannot be changed in the same work,
   say that the operator must ignore it before using the path.
7. Never leave a durable decision only in assistant or tool memory. Write it to a file in the same turn it is made.

## Pattern capture and promotion

1. Append durable candidates to `.local/scratch/patterns.md` when they appear.
2. Do not store durable notes only in `task-state.md`. Task state is lossy on purpose.
3. `patterns.md` shrinks only by promotion or by being proven wrong, never by tidying with the task.
4. Capture when: the same thing is explained twice; the same class of mistake is corrected twice; a non-obvious gotcha
   costs real time; a decision would otherwise live only in memory.
5. Promote in the same change when possible:
   - to the instruction file when it changes future agent behaviour
   - to human docs when a person needs it to work here
6. Leave an entry in `patterns.md` only while it may not generalise.
