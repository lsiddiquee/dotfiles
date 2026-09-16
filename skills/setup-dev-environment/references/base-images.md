# Base image findings

Measurements, not guarantees. Every entry records one probe run on the date given. Re-probe before relying on any
of it — images are mutable behind their tags.

```bash
img=<candidate>
docker run --rm --entrypoint sh "$img" -c '
  echo "user:    $(getent passwd 1000 | cut -d: -f1)"
  echo "sources: $(ls /etc/apt/sources.list.d/ | tr "\n" " ")"
  apt-get update >/dev/null 2>&1 && echo "apt:     OK" || echo "apt:     BROKEN"'
```

## Yarn apt source in python bookworm images

**Probed 2026-09-16.** `mcr.microsoft.com/devcontainers/python` bookworm tags ship a vestigial Yarn apt source at
`/etc/apt/sources.list.d/yarn.list`, signed with an unpublished key. Every `apt-get update` fails:

```
E: The repository 'https://dl.yarnpkg.com/debian stable InRelease' is not signed.
   NO_PUBKEY 62D54FD4003F6525
```

The images contain no node, npm or yarn — the source is pure residue.

| Tag | Python | apt |
| --- | ------ | --- |
| `python:1-3.12-bookworm` | 3.12.11 | **broken** |
| `python:1-3.13-bookworm` | 3.13.5 | **broken** |
| `python:3.12-trixie` | 3.12.14 | OK |
| `python:3-3.14-trixie` | 3.14 | OK |
| `typescript-node:24-bookworm` | — | OK |

The defect is specific to the `python` bookworm images, not to bookworm — `typescript-node:24-bookworm` is clean.

**When 3.12 must be pinned, `python:3.12-trixie` is a full drop-in**: same `vscode` uid 1000 with `nvm` and `pipx`
groups, zsh, oh-my-zsh, and a newer patch. Note the tag grammar — trixie tags drop the `1-` prefix, and
`1-3.12-trixie` does not exist.

Only if a broken tag is unavoidable, remove the source as the first post-create step:

```bash
$SUDO rm -f /etc/apt/sources.list.d/yarn.list
```

## Retagging across a Debian release renames apt packages

**Verified against Debian trixie, 2026-09-16.** Trixie (Debian 13) carries the 64-bit `time_t` transition, which
renames many shared-library packages. A bookworm → trixie retag therefore breaks any hand-written apt list:

| bookworm | trixie |
| -------- | ------ |
| `libasound2` | `libasound2t64` |
| `libatk1.0-0` | `libatk1.0-0t64` |
| `libcups2` | `libcups2t64` |
| `libglib2.0-0` | `libglib2.0-0t64` |

Changing a base image across releases is not a one-line edit. Either re-verify every package name with
`apt-get install -s`, or stop hand-listing them.

For Playwright specifically, `npx playwright install-deps` resolves the correct names for the running distro and
removes the problem entirely. Prefer it over a hand-maintained list of system libraries.
