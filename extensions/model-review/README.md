# Model Review

Repository-owned VS Code extension for structured model approval. It displays
model fields, relationships, rules, migration and unresolved decisions, and returns
the user's decision to the calling agent in the same conversation. It has no
Azure dependency. Diagram colors follow the editor's live color variables.

## Install And Try

From the dotfiles root:

```bash
bash extensions/model-review/install.sh
```

Requires Node 22+, npm, VS Code 1.100+ and its CLI (`code`). Set
`DOTFILES_VSCODE_CLI=code-insiders` for Insiders. Installation targets the host
selected by that CLI; use the WSL/container CLI to install remotely. Reload VS Code,
then run **Model Review: Open Example** from the Command Palette in a trusted
workspace. The Book/Copy/Loan example has deliberately unresolved questions;
practice decisions do not approve repository changes.

For a real proposal, use **Model Review: Open Proposal** and select its JSON file
inside the current single-folder workspace. The command saves a local receipt but
does not resume a chat; use the agent tool for the complete feedback loop.

## Agent Tool

Enable **Review Model Proposal** in Copilot Agent mode's tool picker, or reference
`#review_model_proposal` in chat:

1. Call with `{}` to obtain the [JSON Schema](proposal.schema.json) and
   [example](examples/library.proposal.json), without opening a review.
2. Resolve receipt storage during initial instruction creation: ignored repo-local
   `.local/model-reviews/` or a named committed directory such as `docs/model-reviews/`.
   Record the exact path and ignore policy in repository instructions. Write a proposal
   in the workspace, then call with `proposalPath` and that `decisionDirectory`, for
   example `{"proposalPath":"design/model.proposal.json","decisionDirectory":".local/model-reviews"}`
   only when that ignored path is the confirmed choice. Missing storage is an error,
   not an implicit default. Manual commands ask for the directory.
3. Proposals with questions show **Submit Answers**, not a disabled approval button.
   It returns answers and feedback as `changes_requested`. Incorporate those choices
   into the model, resolve the questions and present the revised proposal again.
   Revise the same proposal file to reuse its review tab; a different file opens a separate review.
4. Resolved proposals show **Approve Proposal** and **Request Changes**. Approval
   returns `approved` with the proposal hash and local receipt path; requested
   changes must be incorporated before approval. Typing "approved" in Feedback is
   not an approval action. **Defer**, closing the page or cancellation never approves.

The review tab closes after approval or deferral is successfully saved. It stays
open after **Submit Answers** or **Request Changes** for the next revision, and
after a save failure so the decision can be retried.

No recommendation or approval is preselected. Tool-execution permission is not
model approval. The host checks the current proposal content before saving a
decision; a stale page cannot approve changed content. Receipts contain a proposal
snapshot in the explicitly selected repository directory. Ignored records stay on
this checkout; committed records can be shared, but choosing them does not authorize
a git commit. The extension never falls back to external VS Code storage. Existing
external receipts are not moved automatically. Receipts are review records, not an audit
or access-control system. The agent must record approved scope in the repository's
owning design documentation and obtain renewed approval for material departures.
Approval never authorizes deleting, resetting or reseeding existing data.

Installation does not enable a repository's model gate. Disabled/customized gate
policies remain authoritative. When this tool is unavailable, use structured
Markdown in chat with the same model details. Ask unresolved decisions through
the built-in question tool (or plain chat if unavailable), incorporate the answers,
then request separate explicit approval of the revised proposal. Extension
installation is not required for this fallback. Deferring or closing an editor
review does not trigger a second approval request in chat. There are no network
requests or telemetry in the review workflow.

## Development

```bash
cd extensions/model-review
npm ci --ignore-scripts
npm test
npx playwright install chromium
npm run test:ui
npm run package
```

The VSIX is built locally, not published. Browser tests use a VS Code messaging
stub; they do not prove live Copilot tool discovery. Dependencies retain their
respective licenses. Bootstrap disables dependency lifecycle scripts; esbuild uses
its packaged platform binary, and VSIX signing is not needed for local packaging.
