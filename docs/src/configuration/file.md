# config.xbuild.ts

`config.xbuild.ts` is where a project describes what it builds. `--config` points at another path, and a run that
finds no file falls back to the built-in defaults.

## Shape

```ts
/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { xBuildConfig } from '@remotex-labs/xbuild';

/**
 * Config build
 */

export const config: xBuildConfig = {
    logLevel: 'info',
    common: {
        types: true,
        declaration: { outDir: 'dist/types' },
        esbuild: {
            platform: 'node',
            sourcemap: true
        }
    },
    variants: {
        esm: {
            esbuild: {
                format: 'esm',
                outdir: 'dist/esm',
                entryPoints: [ 'src/index.ts' ]
            }
        },
        cjs: {
            esbuild: {
                format: 'cjs',
                outdir: 'dist/cjs',
                entryPoints: [ 'src/index.ts' ]
            }
        }
    },
    serve: { dir: 'dist', start: true },
    watch: { debounce: 50 }
};

// export default config; is accepted too
```

## Top-level fields

| Field      | Type                                                      | Notes                                                                      |
|------------|-----------------------------------------------------------|----------------------------------------------------------------------------|
| `variants` | `Record<string, VariantConfiguration>`                    | Required. One entry per output.                                            |
| `common`   | `BaseConfiguration`                                       | Merged under every variant.                                                |
| `logLevel` | `'verbose' \| 'info' \| 'warning' \| 'error' \| 'silent'` | Reporting level for the whole run. Defaults to `info`.                     |
| `userArgv` | `Record<string, Options>`                                 | Command line options this project declares. See [CLI](/configuration/cli). |
| `serve`    | `ServerConfiguration & { dir, start? }`                   | Static server. See [Serve](/configuration/serve).                          |
| `watch`    | `WatchOptions`                                            | Watcher settings. See [Watch](/configuration/watch).                       |

::: warning 🔀 Renamed in 3.0.0
The top-level `verbose` boolean is gone. Reporting is a level now: write `logLevel: 'verbose'` where a v2
configuration wrote `verbose: true`, and `logLevel: 'silent'` to say nothing at all.
:::

## Settings a build understands

These belong on `common`, on a variant, or on both. Every one is optional except `esbuild` on a variant.

| Field         | Type                                                                                               | Notes                                                      |
|---------------|----------------------------------------------------------------------------------------------------|------------------------------------------------------------|
| `esbuild`     | `Omit<BuildOptions, 'plugins' \| 'define' \| 'banner' \| 'footer' \| 'logOverride' \| 'logLevel'>` | Required on a variant, optional on `common`.               |
| `types`       | `boolean \| { failOnError?: boolean }`                                                             | Type checking.                                             |
| `declaration` | `boolean \| { outDir?: string }`                                                                   | `.d.ts` emit.                                              |
| `define`      | `Record<string, Primitive \| object \| (name, argv) => Primitive>`                                 | Substituted values, and the flags the macros read.         |
| `banner`      | `Record<string, string \| (name, argv) => Primitive>`                                              | Code placed at the top of each output, keyed by format.    |
| `footer`      | `Record<string, string \| (name, argv) => Primitive>`                                              | Code placed at the bottom of each output, keyed by format. |
| `logOverride` | `Record<string, LogLevel>`                                                                         | The level one esbuild message is reported at.              |
| `lifecycle`   | `LifecycleHooks`                                                                                   | One hook set. See [Lifecycle](/configuration/lifecycle).   |
| `plugins`     | `Array<LifecyclePlugin>`                                                                           | Named hook sets. See [Plugins](/configuration/plugins).    |
| `dependOn`    | `string \| Array<string>`                                                                          | Variants only. Build order.                                |

::: info 🚫 Six esbuild options xBuild owns
`plugins`, `define`, `banner`, `footer`, `logOverride`, and `logLevel` are assembled from the fields beside
`esbuild` rather than passed through it, so each has exactly one place it can be stated. Everything else esbuild
accepts reaches it untouched.
:::

## `variants`

Each key names a variant. The name labels its messages, is what `dependOn` refers to, and is what `--build`
selects.

```ts
variants: {
    dev: {
        esbuild: {
            minify: false,
            outdir: 'dist/dev',
            sourcemap: true,
            entryPoints: [ 'src/index.ts' ]
        }
    },
    prod: {
        define: { DEBUG: false },
        esbuild: {
            minify: true,
            outdir: 'dist/prod',
            entryPoints: [ 'src/index.ts' ]
        }
    }
}
```

### `entryPoints`

All three esbuild forms are accepted, and globs are matched from the working directory:

```ts
entryPoints: [ 'src/**/*.ts' ]                       // every match, keyed by its path without the extension
entryPoints: [ { in: 'src/index.ts', out: 'bundle' } ] // keyed by out
entryPoints: { index: 'src/index.ts' }               // already in the target shape
```

A glob list is expanded before the build runs, so a lifecycle hook reading `context.options.entryPoints` sees the
resolved record rather than the pattern.

### `dependOn`

A variant may declare the variants that have to finish before it starts. Independent variants run in parallel.

```ts
variants: {
    types: { esbuild: { entryPoints: [ 'src/index.ts' ] } },
    main: {
        dependOn: [ 'types' ], // main builds only after types finishes
        esbuild: { outdir: 'dist', entryPoints: [ 'src/index.ts' ] }
    }
}
```

Cycles and unknown variant names are rejected with a validation error.

## `common`

Everything a variant does not state comes from `common`. The two are merged key by key, so a variant naming a
setting wins and one that stays quiet inherits.

```ts
common: {
    types: { failOnError: true },
    declaration: { outDir: 'dist/types' },
    esbuild: {
        platform: 'node',
        target: [ 'node22' ]
    }
}
```

Two fields merge differently from the rest:

- `lifecycle` merges hook by hook, so a variant naming `onEnd` replaces that hook alone and keeps the others.
- `plugins` is appended to, so a plugin on `common` runs ahead of one a variant adds for itself.

## Defaults

A configuration starts from these and states only what it changes:

```ts
common: {
    types: true,
    declaration: true,
    logOverride: {},
    esbuild: {
        write: true,
        bundle: true,
        minify: true,
        format: 'cjs',
        outdir: 'dist',
        platform: 'browser',
        legalComments: 'none',
        absWorkingDir: process.cwd()
    }
}
```

## `types`

```ts
types: true                        // check and report
types: { failOnError: true }       // check, and fail the run on an error
types: false                       // no checking
```

Checking runs in the build's start stage against the files the build reaches. With `failOnError` left off, the
diagnostics are reported and the build carries on and emits, which is what suits a watch cycle.

## `declaration`

```ts
declaration: true                  // beside the code, under the build's own outdir
declaration: { outDir: 'types' }   // apart from it
declaration: false                 // nothing emitted
```

Declarations are emitted after a build that produced no errors. Which emit runs follows `esbuild.bundle`:

- **`bundle: true`** - one bundled `.d.ts` per entry point, rolled up from the whole graph.
- **`bundle: false`** - one `.d.ts` per input file.

::: warning 🗑️ Removed in 3.0.0
`declaration.bundle` is gone. The declaration pipeline was rebuilt on oxc and now follows `esbuild.bundle`, so a
bundled build gets bundled types and an unbundled one gets per-file types with nothing extra to state.
:::

## `define`

`define` states the values substituted into the source, and it is the same table the macros read their flags from.

```ts
define: {
    DEBUG: true,
    __VERSION: pkg.version,
    __RELEASE: (name, argv) => argv.production === true // called when the build runs
}
```

A function is called at build time with the name it is producing a value for and the arguments the run was
started with, and its result is substituted. `banner` and `footer` accept the same two forms.

```ts
banner: { js: '#!/usr/bin/env node' }
footer: { js: (name, argv) => `//# built ${ argv.build ?? 'all' }` }
```

::: tip ⚡ Macros read this table
`$$ifdef` and `$$ifndef` decide on the text a flag holds here. `false`, `null`, and `undefined` leave a flag
unset, and every other text sets it, `0` and the empty string among them. See [ifdef](/macros/ifdef).
:::

## `logOverride`

`logLevel` sets the floor for the run. `logOverride` moves one message off it, keyed by the id esbuild reports it
under:

```ts
logOverride: {
    'direct-eval': 'silent',      // this id alone, dropped rather than filed
    'TS-2\\d{3}': 'warning'       // a pattern, claiming every TS diagnostic in the 2000 range
}
```

A key written out verbatim stands for itself. A key carrying regular-expression syntax is read as an anchored
pattern instead. Verbatim keys win over patterns, and the first pattern declared wins over the ones after it.

## Export style

Both are read, and a named `config` export wins over a default one:

```ts
export const config: xBuildConfig = { /* ... */ };
export default { /* ... */ };
```

::: info 🔁 The file runs twice
The options a project declares through `userArgv` are known only once the file has been read, so xBuild builds and
runs it once with an empty `$argv` to collect them, parses the command line, then runs it again with the whole
option set. The first run's console output is isolated. Anything the file does on its way to an export therefore
happens twice, which is worth knowing before writing a side effect into one.
:::

## TypeScript autocomplete

```json
{
    "compilerOptions": {
        "types": [ "node", "@remotex-labs/xbuild" ]
    }
}
```

## See also

- [Getting Started](/guide)
- [CLI](/configuration/cli)
- [Lifecycle](/configuration/lifecycle)
- [Plugins](/configuration/plugins)
- [Watch](/configuration/watch)
- [Serve](/configuration/serve)
- [Release Notes](/release)
