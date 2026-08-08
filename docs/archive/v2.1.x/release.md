# Release Notes

What shipped in the v2.0.x and v2.1.x lines of `@remotex-labs/xbuild`.

## v2.1.x patches

Stability fixes across the line: declarations emit from the original source entry point, lifecycle `onEnd` hooks
run at the right time and report errors with their phase `id`, and relative path computation was corrected.

## v2.1.0

- **Added**: `$argv` global, populated from a minimal CLI parse before the configuration file loads, so
  `config.xbuild.ts` can read CLI arguments during config evaluation. See [CLI](configuration/cli).

## v2.0.0

A rewrite of the toolchain around build variants and directives. The v1 hooks-based architecture
([archived docs](../v1.x.x/)) was replaced by `config.xbuild.ts` with named variants.

- **Added**: [Build variants](configuration/file#variants): define multiple build targets in one config and select
  them from the [CLI](configuration/cli) with `--build`.
- **Added**: Macros directives: [`$$ifdef`](macros/ifdef), [`$$ifndef`](macros/ifndef), and [`$$inline`](macros/inline)
  for conditional code and compile-time evaluation, replacing the v1 `// ifdef` comment blocks.
- **Added**: Custom CLI options via [`userArgv`](configuration/cli#custom-cli-arguments-with-userargv).
- **Added**: [Lifecycle provider](configuration/lifecycle) (`onStart`, `onResolve`, `onLoad`, `onEnd`, `onSuccess`)
  replacing the previous plugins provider.
- **Added**: [Runtime config updates](configuration/runtime) with `overwriteConfig` and `patchConfig`.
- **Added**: [Dev server](configuration/serve) and watch service for local iteration.
- **Added**: [Programmatic API](advanced/programmatic) with `BuildService`, `WatchService`, and `ServerModule` exports.
- **Added**: Printer and interactive terminal components for build output and shortcut handling.

## Earlier releases

- [v1.x](../v1.x.x/release) - the original hooks-based toolchain (archived docs).

## See also

- [Getting Started](guide)
- [config.xbuild.ts](configuration/file)
