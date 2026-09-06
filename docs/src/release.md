# Release Notes

What changed in the notable releases of `@remotex-labs/xbuild`.

## v3.0.0

A rewrite of the compiler-facing half of xBuild. Macros and the declaration pipeline moved from TypeScript's own
AST to [oxc](https://oxc.rs/), reporting became a level rather than a boolean, and lifecycle hooks gained a
named, reusable form.

```ts
export const config: xBuildConfig = {
    logLevel: 'info',
    common: {
        plugins: [ timing ],
        logOverride: { 'direct-eval': 'silent' }
    },
    variants: {
        main: { esbuild: { outdir: 'dist', entryPoints: [ 'src/**/*.ts' ] } }
    },
    watch: { debounce: 50 }
};
```

- **Added**: [`plugins`](/configuration/plugins) - lifecycle hooks as a named set, several of which can stand on
  one build. Adds `onSetup`, the one place a plugin changes the options a build receives, run before every build
  of the variant rather than once.
- **Added**: [`logOverride`](/configuration/file#logoverride) - the level a single esbuild message is reported at,
  keyed by its id or by an anchored pattern claiming a family of them. `silent` drops a message rather than
  filing it.
- **Added**: [`watch`](/configuration/watch) as a configuration block - `filter`, `recursive`, `debounce`, `dot`,
  and `followSymlinks`. A `filter` a file names joins the defaults rather than replacing them, and each output
  directory is excluded automatically.
- **Added**: [`--clean`](/configuration/cli#options) removes `dist` before building.
- **Added**: An interactive terminal for watching and serving runs - a status bar on the last row, and single-key
  build, reload, verbose, clear, open, and quit. See [Getting Started](/guide#watch-and-serve).
- **Added**: Glob patterns in `esbuild.entryPoints`, matched from the working directory and keyed by path with the
  extension dropped.
- **Added**: `context.stage.reachableFiles` and `context.stage.dropped` on the
  [lifecycle context](/configuration/lifecycle#context-stage), and `info` and `verbose` buckets on both
  `context.logs` and `buildResult`.
- **Changed**: [Lifecycle hooks](/configuration/lifecycle) take one object with the shared context as a field on
  it, rather than the context itself - `onLoad({ args, contents, loader, context })`. `contents` arrives as a
  string rather than as bytes.
- **Changed**: [Macros](/macros/ifdef) are span edits over an oxc AST. A conditional binding whose flag does not
  hold is now dropped across the whole build: the declaration goes, the imports naming it are pruned, and its
  reads become `undefined`.
- **Changed**: A `define` flag is decided by the text it substitutes, so only `false`, `null`, `undefined`, and an
  absent key leave it unset. `0` and the empty string now set it.
- **Changed**: [`$$inline`](/macros/inline) serializes objects and arrays as JSON instead of rendering them as
  `undefined`, and a `bigint` as its exact digits.
- **Changed**: `logLevel` replaces the top-level `verbose` boolean, with `verbose`, `info`, `warning`, `error`,
  and `silent`.
- **Changed**: Declarations follow `esbuild.bundle` - a bundled build gets one rolled-up `.d.ts` per entry point,
  an unbundled one gets a `.d.ts` per input.
- **Changed**: `$argv` carries the whole parsed command line, the project's own `userArgv` options included,
  rather than only the pre-config parse. See [The `$argv` global](/configuration/cli#the-argv-global).
- **Changed**: The observable and symlink internals moved out to
  [xObservable](https://remotex-labs.github.io/xObservable/) and `@remotex-labs/xinject`, and both `ServerModule`
  and `WatchService` now report as streams rather than writing to the console.
- **Removed**: `BuildService`, `overwriteConfig`, and `patchConfig` from the public exports. See
  [Programmatic API](/advanced/programmatic).
- **Removed**: The `context` global inside an `$$inline` sandbox, and `MacroContextInterface` with it. Reach the
  same values through a `define` function or a lifecycle hook.
- **Removed**: `declaration.bundle`, which `esbuild.bundle` now decides.
- **Removed**: Function references in `$$inline` - `$$inline(getPort)` no longer resolves, since the argument is
  built on its own.
- **Migration**: Rename `verbose: true` to `logLevel: 'verbose'`; destructure `context` out of every hook
  argument; drop `.toString()` on `onLoad` contents; drop `declaration.bundle`; replace `0` with `false` in any
  `define` that meant off; and move `$$inline` callbacks that read `context` onto `define` functions.
- **Migration**: Node.js 22 or newer is required.

## Earlier releases

- [v2.5.x](v2.5.x/release) - the last of the TypeScript-AST line (archived docs).
- [v2.0.0 / v2.1.x](v2.1.x/release) - the variant/directive rewrite and the `$argv` global (archived docs).
- [v1.x](v1.x.x/release) - the original hooks-based toolchain (archived docs).

## See also

- [Getting Started](/guide)
- [config.xbuild.ts](/configuration/file)
