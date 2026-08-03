---
name: author-agent-instructions
description: "Use when creating, reviewing, trimming or arguing about a repository's agent instruction file. Triggers: copilot-instructions.md, AGENTS.md, CLAUDE.md, agent instructions, house rules for agents, /init, generate instructions, instruction file review, instructions too long, instructions ignored, onboarding an agent to a repo."
---

# Authoring agent instructions

An instruction file is loaded into context on **every** request in the repository. That is the whole economy of the
thing: each line is paid for constantly and acted on rarely, so it has to buy more than it costs. Most instruction
files fail not by saying something wrong but by saying too much that was already true elsewhere.

## The test

Every candidate line answers one question:

> Does knowing this **in advance** save a cycle that the tooling would not teach cheaply anyway?

Two things fail it:

1. **It restates a source of truth.** The config file, the lockfile or `--help` already says it. The copy is a second
   definition, and the two will drift without anyone noticing.
2. **A fast local check already rejects it.** A hook that fails in a second with a clear message teaches the rule in
   one cycle. Writing it down changes nothing.

Three things pass it:

- **Prescription, not description.** "Never weaken a test to make a change pass" cannot go stale. "`select` is set to
  E, F, I" is stale the moment someone edits the config.
- **Nothing enforces it.** Silent drift between two files, a directory layout convention, a tool that fails with a
  confusing message rather than a useful one.
- **The feedback loop is slow.** A `commit-msg` hook fails locally in a second, so it barely needs documenting. A rule
  only checked by CI after branch, commit, push and PR creation is worth a line, because learning it the hard way
  costs a full cycle.

One deliberate exception: **asymmetric downside earns redundancy.** Secret handling stays in the file even though a
scanner enforces it, because the cost of a miss is a rotation incident rather than a failed build, and scanners are
pattern matchers that miss things. Say in the file that the exception is deliberate, or someone will delete it later
for consistency.

## Procedure

### 1. Inventory before writing

Read, do not recall. Open the actual files:

- Task runner or `package.json` scripts, and run the list command to see what exists.
- Linter, formatter and type-checker config, including comments already in them.
- The pre-commit or hook config, and the CI pipeline.
- The test config: which paths are collected, which are excluded.
- The directory layout as it is, not as it is planned.

Never state a tool's defaults from memory. Measure them. Defaults change between versions, and a confident wrong
claim about them is worse than saying nothing, because it gets quoted in review.

### 2. Draft against the skeleton

A working set of sections, in roughly this order. Drop any that the repository has nothing real to say about; an
empty section invites padding.

| Section                   | Holds                                                            |
| ------------------------- | ---------------------------------------------------------------- |
| Intro                     | What the project is, where the major trees are, in a few lines   |
| Non-negotiables           | The few rules whose violation is expensive to undo               |
| Commands                  | Only the handful used constantly, plus where to find the rest    |
| Single source of truth    | What defines "passing", and that local and CI run the same thing |
| Engineering discipline    | TDD, YAGNI, DRY, no introduced regressions, no over-engineering  |
| Testing                   | How to run the narrow case, and what may never be done to a test |
| Commits                   | Message format, and which check catches a mistake how late       |
| Repo-specific conventions | **Only** what nothing checks for you                             |
| Documentation             | Which file owns what, updated in the same change                 |
| Definition of Done        | The closing checklist                                            |
| Context persistence       | Where in-flight state lives across a long session                |
| Pattern capture           | How a learning gets promoted from scratch to permanent           |

### 3. Cut description

Go through the draft and delete anything that describes current state:

- Lists of config values, rule codes, dependency versions, task names. Point at the file instead.
- Restated tool behaviour. Link the tool's docs or its config comment.
- "There is no X yet" or "X is not enabled today". These rot silently, because nothing prompts anyone to revisit them
  when X arrives.
- Rationale that belongs next to the setting. If a config choice needs explaining, put the comment **in the config**
  and let the instruction file point at it.

### 4. Verify every remaining claim

For each factual statement left, find it in the repository and confirm it. This step is not optional and it is where
the real bugs are: instruction files routinely assert config values that were changed months earlier. A file that is
confidently wrong is worse than one that is silent, because agents act on it and reviewers trust it.

### 5. Check the file against itself

- **Internal duplication.** If a closing checklist repeats every section above it, decide which one is authoritative
  and thin the other. Repetition does not reinforce anything in a context window, it just doubles the maintenance
  surface.
- **Ordering.** Constraints before procedures; the checklist last.
- **Tone.** Write the rule, not the war story. One line of reasoning after a rule stops the next person reverting it;
  three paragraphs of history do not.

## The portable core

Five sections transfer between repositories essentially unchanged, because they constrain how work is done rather
than what the tooling happens to be. They are also the **highest-value content in the file** by the test above: pure
prescription, with nothing anywhere else in a repository that encodes them, so there is nothing for them to duplicate
or drift from. When an instruction file has to be short, these are the last things to cut, not the first.

Adapt the wording, keep the substance.

### Engineering discipline

- **TDD.** Write the failing test first, then the minimal code that passes it, then refactor.
- **YAGNI.** Build the smallest thing that ships the current slice. No compatibility shims, aliases or dual code
  paths for unreleased work; while something is unreleased, prefer the clean breaking change over a migration path.
- **DRY on the third instance.** The first stays local, the second is compared carefully, the third stable one earns
  a shared abstraction in the layer that owns it.
- **No introduced regressions.** A change leaves quality at status quo or better. It may never _add_ a deprecation
  notice, build or test warning, lint suppression or type-ignore. If a change surfaces a new warning, fix it in the
  same change instead of silencing it. "It comes from a dependency" is not an exemption. If it genuinely cannot be
  fixed now, do not land the noisy change.
- **Small, reversible changes.** Fix root causes, not symptoms, and match the existing seams before inventing new
  ones.
- **No over-engineering.** Only what was asked for or is clearly necessary. Do not handle states that cannot happen.

### Testing

- While iterating, run the narrowest thing that proves the point, not the whole suite.
- **Never delete or weaken a test to make a change pass.** That discards the signal the test exists to give. This one
  earns its place in every repository: it is the single most common shortcut, and no tool prevents it.
- Cover the failure path, not just the happy one.
- Coverage thresholds get earned by behaviour tests, never by padding.

### Definition of Done

A closing checklist works because it is acted on at the moment of finishing. Keep it to one line per item and let it
be the authoritative recap, thinning the prose above rather than repeating it.

1. Failing test written first; success **and** failure paths covered.
2. The fix and test commands are clean, or equivalently the hook runner reports nothing modified.
3. No new warning, deprecation or suppression introduced.
4. No secret or token added, and anything new crossing a trust boundary validates its input.
5. Commit message and PR title in the required format.
6. Docs current: whichever file owns the changed behaviour updated in the same change.
7. Anything durable learned is captured and promoted, not left in ephemeral memory.

### Context persistence

Long sessions exceed the context window and tangents are constant, so assume anything not written down is lost.
Three tiers, chosen by lifetime **and** audience:

| Tier             | Lifetime                       | Audience | Holds                            |
| ---------------- | ------------------------------ | -------- | -------------------------------- |
| Assistant memory | wiped on rebuild               | you      | the conversation's working state |
| Local scratch    | survives rebuilds, git-ignored | you      | task state and captured patterns |
| Git-tracked      | permanent                      | everyone | anything the next person needs   |

- **One task-state file.** For any non-trivial task keep it current: the focus right now, a ledger of in-flight items
  each with its next step, deferred open threads, and key findings. Create it before the first edit, not after.
- **Checkpoint as you go**: before switching focus or starting a deep dive, the moment a new sub-issue appears, after
  any meaningful step or finding, and before a long or branching operation. Re-read and reconcile it when resuming.
- **Keep it lean.** Roll finished sections into a companion archive file once it grows past roughly 200 lines.

### Pattern capture and promotion

Capture and promotion are one habit: notice the thing, write it somewhere it survives, then move it up a tier as soon
as it proves it outlives the task that produced it. Knowledge earns permanence, it does not start there.

**Give captured patterns their own file.** This is the structural point most workflows get wrong: task state is
_deliberately lossy_, since it is trimmed, archived and compressed as work moves, so anything durable parked there is
on a countdown. The two file types have opposite shrink policies, and mixing them means the trimming policy silently
eats the durable material. A patterns file is append-only and shrinks only by promotion, never by tidying.

Capture when: the same thing gets explained a second time; the same class of generated mistake is corrected twice; a
gotcha appears whose cause was not obvious from the error; a decision is made in discussion that would otherwise
survive only in someone's memory.

Promote in the same change that taught you, while the reasoning is still to hand: to the instruction file when it
changes what an agent should do next time, to the human-facing docs when a person needs it. An entry leaves the
patterns file by being promoted or by being proven wrong, never by being cleared out with the task that found it.

## Anti-patterns

| Anti-pattern                           | Why it fails                                               | Instead                            |
| -------------------------------------- | ---------------------------------------------------------- | ---------------------------------- |
| Listing every task or script           | A second source of truth that drifts from the runner       | Name the two or three used daily   |
| Restating linter rule selections       | Changes with the config, and nobody updates prose          | Point at the config                |
| Explaining what a hook does            | The hook's own output explains it at the moment it matters | Say what to do when it fires       |
| "Currently we do not have X"           | Rots the day X lands, silently                             | Say nothing until X exists         |
| A checklist that recaps the whole file | Doubles the file for no new information                    | Pick one home per rule             |
| Vague virtues: "write clean code"      | Changes no decision                                        | A rule with an observable outcome  |
| Dumping the architecture               | Long, and out of date within a sprint                      | Only the parts that constrain work |

## Working from `/init` or an existing file

`/init` and similar generators are useful for the inventory step and little else: they produce description-heavy
output, because describing is what they can do safely. Treat the result as a first draft that has not been edited,
then apply steps 3 to 5. Expect to delete a large fraction of it.

Deleting is only half the pass. Generator output is not merely description-heavy, it is **prescription-poor**, and
for a structural reason: the portable core cannot be inferred from a repository. Nothing in a config file reveals
whether this team weakens tests under deadline pressure or where in-flight state is meant to live. A generator writes
what it can see, so it reliably produces the half that rots and omits the half that doesn't. Run step 2 as well:
check the skeleton section by section, and add every portable-core section that is missing. Judge it by what a new
agent still gets wrong, not by whether the file looks complete.

The same applies to any inherited file, including one a previous author trimmed. A short instruction file is not
evidence of a disciplined one — it is just as often prescription that was cut for length by someone applying "less is
more" without the description/prescription distinction below.

When reviewing someone else's instruction file, the fastest useful pass is to check the factual claims against the
configs first. Finding one wrong claim justifies the whole review and changes the conversation from taste to
correctness. Then check for absent sections, which are harder to notice than wrong ones because nothing on the page
points at them.

## Resolving the "less is more" argument

This file gets argued about more than the code it governs, because everyone is qualified to have an opinion. The
argument usually splits into "keep it short" against "be prescriptive so the agent does not need nudging". Those only
conflict if all content is treated as equal. It is not:

- Cut **description**, which duplicates a source of truth and rots.
- Keep **prescription**, which cannot rot, because there is nowhere else for it to live.

That distinction settles nearly every individual case, and it is a defensible answer in review.
