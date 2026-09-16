# Known gaps

Open items in [SKILL.md](SKILL.md) and its references. Each entry states what is missing, why it matters, and the
shape of the fix. Delete an entry once it is closed.

## Python environments

**Recorded 2026-09-16. Open.**

The skill detects Python dependency managers but never decides how their environments are created or where they
live. `.venv/` appears twice in SKILL.md, both incidental: once in the list of artifacts expected after a build,
once as the tool path `.venv/bin/ruff`. A project-root `.venv` is assumed, never chosen.

### Why it matters

uv creates `.venv` in the working directory, which is the bind-mounted workspace. A `.venv` built on the host
carries host interpreter paths in `pyvenv.cfg` and in every script shebang, so the container inherits a broken
environment through the mount. Same failure class as validating tool versions on the host rather than in the
container.

### What is missing

- **Manager choice for a greenfield Python repo.** The skill reads lockfile identity when one exists and
  prescribes nothing when none does.
- **Venv location.** Three viable answers, none chosen:
  - keep `.venv` in the workspace under an anonymous volume, as with `node_modules`
  - move it out of the workspace with `UV_PROJECT_ENVIRONMENT`
  - keep it in the workspace and forbid host-side `uv sync`
- **Poetry knobs.** No `POETRY_VIRTUALENVS_IN_PROJECT` or `POETRY_VIRTUALENVS_PATH` in the cache-variable table.
- **Interpreter discovery.** No `python.defaultInterpreterPath` in the editor settings, without which VS Code
  cannot find a relocated interpreter.

### Shape of the fix

A `### Python environments` subsection under Environment baseline, roughly 15-20 lines, plus a row in
[references/wiring.md](references/wiring.md#cache-environment-variables). Fits the container half of the skill, so
it does not conflict with the devcontainer-first restructure.
