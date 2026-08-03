# Custom Copilot skills

Each subdirectory here is one skill. `install.sh` symlinks every
`skills/<name>/` into `~/.copilot/skills/<name>`, so edits made in this repo
take effect immediately — no re-run needed. Adding or renaming a skill *does*
require re-running `bash install.sh`.

## Layout

```
skills/
  my-skill/
    SKILL.md        # required — frontmatter + instructions
    reference.md    # optional supporting files, referenced from SKILL.md
    scripts/
```

`install.sh` aborts if a skill directory has no `SKILL.md`, and refuses to
overwrite a real directory at the destination (e.g. the `remove-fluff` clone).

## SKILL.md

```markdown
---
name: my-skill
description: One or two sentences describing what the skill does and when to use it. This is the only text the model sees when deciding whether to load the skill, so state the trigger conditions explicitly.
---

# My skill

Instructions the model follows once the skill is loaded.
```

- `name` must match the directory name: lowercase, hyphen-separated.
- `description` drives skill selection. Write it as "Use when …" — vague
  descriptions mean the skill never gets picked.
- Keep `SKILL.md` short; push detail into sibling files and link to them by
  relative path so they load only when needed.
