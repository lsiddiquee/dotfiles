# Wiring values

Lookup values for [SKILL.md](../SKILL.md). The reasoning for each lives there; only the values live here.

## Editor settings

Route work to tools without restating their rules.

```jsonc
"customizations": { "vscode": { "settings": {
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": { "source.fixAll": "explicit" }
}}}
```

## Hook staging

```yaml
default_install_hook_types: [pre-commit, commit-msg]
default_stages: [pre-commit]
```

## Task runner feature

The container must provide `go-task`, which lives under `devcontainers-extra`, not `devcontainers`:

```
ghcr.io/devcontainers-extra/features/go-task:1
```

## pre-commit cache

`pre-commit` builds an isolated environment per hook and refetches all of them on every rebuild unless its cache
sits on the persistent volume:

```jsonc
"remoteEnv": { "PRE_COMMIT_HOME": "/.devcontainercache/pre-commit" }
```
