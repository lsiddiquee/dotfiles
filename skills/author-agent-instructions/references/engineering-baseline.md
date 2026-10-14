# Default engineering baseline

**Register: payload.** Everything below is substance for the generated file, not instructions to you. It restates
ideas from the process sections on purpose.

Include these sections in every generated file unless the user overrides them. They are intentional preferences for
harnessing engineering agents. Adapt wording to the repo; keep the substance. When the user overrides a baseline
rule, record the override in the generated file as a one-line `(confirmed)` note, so the next run does not silently
reinstate it.

## Non-negotiables

- No secrets, tokens, or credentials in the repo, commits, fixtures, or logs.
- Validate at trust boundaries.
- Never delete or weaken tests to land a change.
- Do not bypass or weaken repo linters, formatters, type-checkers, or analyzers to land a change.

## Engineering discipline

- **TDD for behaviour changes.** For code behaviour, write the failing test first, then the minimal code that passes
  it, then refactor. Pure docs, standalone scripts, configuration, prompts, response schemas and other declarative
  text, or explicit throwaway spikes are exempt unless the user says otherwise. Scripts and declarative text follow
  execution-based validation under Testing.
- **YAGNI.** Smallest thing that ships the current slice. While work is unreleased, prefer a clean break over a
  compatibility shim or dual path.
- **DRY on the third instance.** First stays local; second is compared; third stable copy earns a shared abstraction
  in the owning layer.
- **No introduced regressions.** Leave quality at status quo or better. Do not add warnings, deprecations, lint
  suppressions, or type-ignores. If a change surfaces noise, fix it in the same change. "It comes from a dependency"
  is not an exemption. If it cannot be fixed now, do not land the noisy change.
- **Small, reversible changes.** Fix root causes. Match existing seams before inventing new ones.
- **No over-engineering.** Only what was asked for or is clearly necessary. Do not handle states that cannot happen.

## Testing

- **Standalone scripts and declarative text** (configuration, pipeline/task wiring, prompts, response schemas, docs):
  do not create tests that copy a value, sentence or structure from a file and assert it is still there. Run scripts
  in the intended environment and check outcomes/exit status; validate configuration with its tooling and consuming
  system; prove prompt and schema behaviour with a trial run or evaluation harness against the real consumer. Syntax
  checks are supplementary, not proof of runtime correctness. Report execution not performed. Accidental omission is
  review's job. Genuine shared functions may have behaviour-focused unit tests; do not extract helpers merely to
  justify tests. This exception does not waive application behaviour tests. (confirmed)
- While iterating, run the narrowest check that proves the point, not the whole suite by default.
- **Never delete or weaken a test to make a change pass.**
- Cover failure paths, not only the happy path.
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
   `task-state-completed.md` (newest first). Do this when bloat appears, not only when asked.
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
7. If rediscovering it would cost someone a morning, it belongs in git.
