# dotfiles

Personal development environment setup, applied automatically to VS Code Dev
Containers and GitHub Codespaces.

When a container is created, VS Code clones this repo and runs `install.sh`. The
script is **idempotent** — re-running never duplicates lines or overwrites
existing config — and **fail-fast** (`set -euo pipefail`): a broken step aborts
the install loudly instead of leaving a half-configured environment.

## What it sets up

- **Custom Copilot skills** — every directory under [`skills/`](skills/) is
  symlinked into `~/.copilot/skills/`, so editing a skill in this repo takes
  effect immediately; only adding or renaming one needs a re-run. Each directory
  must contain a `SKILL.md` or the install aborts. See
  [`skills/README.md`](skills/README.md) for the authoring format. This step
  runs *before* the third-party skills below, so a failure there can't stop your
  own skills from being installed.
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

Extend `install.sh` with more personal setup (git config, aliases, shell rc),
keeping each step idempotent.

### Package registries

The installer does not configure package registries or modify `~/.npmrc`.
npm and pnpm consume `NPM_CONFIG_REGISTRY` from their environment; other
package managers use their own settings, not a universal registry variable.
With no override, each tool uses its normal configuration and defaults.
Host variables must still be forwarded into devcontainer builds and runtime
environments; see the setup-devcontainer skill's feed-forwarding guidance.

Earlier installer versions added a `registry=` entry to `~/.npmrc`. Remove
that entry manually if it is no longer wanted; this installer leaves existing
user configuration untouched.

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

**Never** commit auth tokens or credentials to this repo. Store secrets via
your environment / secret manager, not in `.npmrc` or any tracked file.
