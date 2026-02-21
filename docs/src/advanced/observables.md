# Observables in xBuild

xBuild uses observable subscriptions internally for reactive config updates.

## Why it matters

When configuration changes at runtime, active variant services are notified automatically.

This enables:
- hot reconfiguration without restart
- variant-level updates while watch/build is running
- controlled service re-init when required (for example `tsconfig` change)

## Internal behavior (high level)

- Variant services subscribe to configuration state.
- A config change event triggers variant re-initialization logic.
- Build/lifecycle settings are refreshed from merged config.

## For most users

You usually do not need to interact with observables directly.

Use:
- `overwriteConfig` for full replacement
- `patchConfig` for incremental changes

and xBuild handles propagation through its observable layer.
