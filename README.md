# dotfiles

Personal development environment setup, applied automatically to VS Code Dev
Containers and GitHub Codespaces.

When a container is created, VS Code clones this repo and runs `install.sh`. The
script is **idempotent** — re-running never duplicates lines or overwrites
existing config — and **fail-fast** (`set -euo pipefail`): a broken step aborts
the install loudly instead of leaving a half-configured environment.

## What it sets up

- **npm/pnpm registry** — appends the supply-chain-screened Microsoft
  package-feed proxy to your user `~/.npmrc`. This is intentionally kept in your
  *personal* environment, never in a project repo, so project builds default to
  the public npm registry for anyone who can't reach the internal proxy.
- **`remove-fluff` Copilot skill** — clones
  [iharshulhan/remove-fluff](https://github.com/iharshulhan/remove-fluff) (MIT)
  to `~/.copilot/skills/remove-fluff` and installs its `requirements.txt`
  (`markdown-it-py`, `mdurl`) with `pip --user`. `$HOME` is wiped on every dev
  container rebuild, which is why this lives here. It is a real git clone, so
  re-running does `git pull --ff-only` — **don't edit the working tree in
  place**, or the next pull conflicts. Fork upstream instead if you need
  changes. The step ends by running `scripts/svi.py --help` and errors if the
  scorer doesn't start.

### Requirements

`git` and `python3` (with `pip`) must be on `PATH`; the script errors if they
aren't. On Debian/Ubuntu system Pythons `ensurepip` is disabled and
`/usr/lib/python3*/EXTERNALLY-MANAGED` is set — install `python3-pip` and, if
pip refuses to write to `~/.local`, add `--break-system-packages` to the install
line.

Extend `install.sh` with more personal setup (git config, aliases, shell rc). Use
the `ensure_line` helper for "append if missing" edits.

## Enable it

### VS Code Dev Containers

Add to your **local** User `settings.json` (`Preferences: Open User Settings (JSON)`):

```json
"dotfiles.repository": "<your-username>/dotfiles",
"dotfiles.targetPath": "~/dotfiles",
"dotfiles.installCommand": "install.sh"
```

Rebuild the container (`Dev Containers: Rebuild Container`) to apply.

Note that dotfiles run **after** `postCreateCommand`, so nothing in a project's
post-create hook can depend on the `remove-fluff` skill being present yet.

### GitHub Codespaces

Enable once, account-wide, at
[github.com/settings/codespaces](https://github.com/settings/codespaces) →
**Dotfiles** → check *"Automatically install dotfiles"* and select this repo. New
Codespaces then run `install.sh` automatically.

## Apply immediately (without a rebuild)

```bash
bash install.sh
```

## Security

The registry entry here is a proxy URL, not a secret. **Never** commit auth
tokens or credentials to this repo — keep it **private**, and store secrets via
your environment / secret manager, not in `.npmrc` or any tracked file.
