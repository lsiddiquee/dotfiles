# Known gaps

Open items across the `setup-devcontainer` and `setup-dev-workflow` skills, the orchestrator agent, and
`install.sh`. Each entry states what is missing, why it matters, and the shape of the fix. Delete an entry once it
is closed.

Ordered by how likely each is to bite.

## Nested containers may break `devcontainer up`

**Recorded 2026-09-16. Open, and untested.**

The container skill's preflight tells an agent running inside a dev container to add `docker-outside-of-docker`
and rebuild. That advice is unverified, and there is a specific reason to doubt it.

With `docker-outside-of-docker` the socket belongs to the **host** daemon, so every path in a `docker run` is
resolved by the host. Running `devcontainer up --workspace-folder .` from inside a container asks the host daemon
to bind-mount a path like `/workspaces/repo`, which on the host is either absent or a different directory. The
inner container would then come up against an empty or wrong workspace, and the failure is silent rather than
loud.

`docker-in-docker` avoids the path problem, at the cost of a nested daemon and no layer cache sharing.

### Shape of the fix

Test both features from inside a real dev container before trusting either. If the path mismatch is confirmed,
the known mitigation is to mount the workspace at an identical path on both sides so host and inner resolution
agree, and the preflight table must say so rather than naming the feature alone. This matters more than the other
entries here, because running the agent from inside a container is the normal case.

## Nothing has been validated end to end

**Recorded 2026-09-16. Open.**

Neither skill has been run against a real repository since the split. The `devcontainer up` and `devcontainer
exec` flow that both the container skill and the agent depend on is entirely unexercised, and the CLI that
provides it is absent from this machine.

The preflight, the phase gate, and the final rebuild in the agent are all written from reasoning rather than from
a run.

### Shape of the fix

Run the agent against one greenfield repo and one existing repo. `taxa` and `CloakCode` are both candidates and
both already have known defects to find.

## The shared patching rubric depends on symlinks

**Recorded 2026-09-16. Open, low priority.**

`skills/_shared/patching.md` is linked into both skills as `references/patching.md`. Git stores the links and
`install.sh` symlinks whole skill directories, so the arrangement holds for the current install path.

It would break wherever the repo arrives as a copy rather than a clone: a plugin install, which snapshots files, a
zip download, or a filesystem without symlink support. Both skills would then have a reference pointing at
nothing, and each would lose its entire patch-mode rubric while still reading as though it had one.

### Shape of the fix

Leave it until a copy-based install path is wanted. If one is, either have `install.sh` materialise the
copies, or fold the rubric back into both skills and accept the duplication.
