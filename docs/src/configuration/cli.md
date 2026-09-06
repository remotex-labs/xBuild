# CLI

```bash
xBuild [entryPoints..] [options]
```

Both `xbuild` and `xBuild` are installed as binaries.

## Options

| Flag            | Alias   | Type       | Description                                                   |
|-----------------|---------|------------|---------------------------------------------------------------|
| `[entryPoints]` |         | `string[]` | Source files to build, glob patterns included                 |
| `--config`      | `-c`    | `string`   | Path to the configuration file, `config.xbuild.ts` by default |
| `--build`       | `--xb`  | `string[]` | Variants to build, by the names the configuration gives them  |
| `--watch`       | `-w`    | `boolean`  | Rebuild on file changes                                       |
| `--serve`       | `-s`    | `string`   | Serve a directory, and watch alongside it                     |
| `--clean`       |         | `boolean`  | Remove `dist` before building                                 |
| `--bundle`      | `-b`    | `boolean`  | Bundle dependencies into the output                           |
| `--minify`      | `-m`    | `boolean`  | Minify the output                                             |
| `--format`      | `-f`    | `string`   | Output module format: `cjs`, `esm`, or `iife`                 |
| `--platform`    | `-p`    | `string`   | Target platform: `browser`, `node`, or `neutral`              |
| `--outdir`      | `-o`    | `string`   | Output directory                                              |
| `--tsconfig`    | `--tsc` | `string`   | Path to the TypeScript configuration file                     |
| `--types`       | `--btc` | `boolean`  | Type-check as part of the build                               |
| `--typeCheck`   | `--tc`  | `boolean`  | Type-check and report, without building                       |
| `--declaration` | `--de`  | `boolean`  | Emit `.d.ts` files                                            |
| `--failOnError` | `--foe` | `boolean`  | Fail the build when TypeScript reports an error               |
| `--verbose`     | `-v`    | `boolean`  | Verbose error stack traces                                    |

::: info 🤫 A flag left out is left alone
Only `--config` and `--clean` carry a default. Every other flag is absent from the parse result unless it was
typed, which is how xBuild tells a flag that was omitted from one that was passed as `false`. A configuration
file therefore keeps what it stated for every flag the command line did not mention.
:::

`--platform` and `--format` restrict their values, so an unrecognized one fails during parsing rather than
reaching the build.

## Examples

```bash
xBuild src/index.ts                                   # a single file, under the defaults
xBuild src/**/*.ts --bundle --minify                  # bundle and minify every match
xBuild src/app.ts -s                                  # watch and serve
xBuild src/app.ts -s dist                             # watch and serve dist
xBuild src/lib.ts --format esm --declaration          # an ESM library with type definitions
xBuild src/server.ts --platform node --outdir dist    # a Node application
xBuild --typeCheck                                    # check only, nothing emitted
xBuild --config custom.xbuild.ts                      # a configuration file elsewhere
```

## Entry points on the command line

Files named on the command line are a run of their own rather than an addition to what the configuration
declares. The declared variants are put aside and a single variant named `argv` takes their place:

```bash
xBuild src/index.ts src/worker.ts --format esm
```

A command line naming no entry point leaves the configuration as the file wrote it.

## Selecting variants

```bash
xBuild --build esm            # one variant
xBuild --build esm cjs        # several
xBuild                        # every variant the configuration declares
```

## Flags reach every variant

`--outdir`, `--minify`, `--bundle`, `--platform`, `--tsconfig`, `--types`, `--failOnError`, and `--declaration`
are written onto every variant rather than onto one, since a flag says what the run is for rather than which
variant it is about. Each settled output directory is also excluded from the watch, without which a build would
write into the tree it is watching and set off the next one.

## Options a project declares

`userArgv` adds [yargs](https://yargs.js.org/) options of the project's own. They appear in `--help` under their
own heading, and the parsed values reach lifecycle hooks through `context.argv`.

```ts
/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { xBuildConfig } from '@remotex-labs/xbuild';

/**
 * Config build
 */

export const config: xBuildConfig = {
    userArgv: {
        env: {
            type: 'string',
            choices: [ 'development', 'staging', 'production' ],
            default: 'development',
            describe: 'Target environment'
        },
        deploy: {
            type: 'boolean',
            default: false,
            describe: 'Deploy after a successful build'
        }
    },
    variants: {
        main: {
            esbuild: { outdir: 'dist', entryPoints: [ 'src/index.ts' ] },
            lifecycle: {
                onSuccess({ context }) {
                    if (context.argv.deploy) console.log('deploying to', context.argv.env);
                }
            }
        }
    }
};
```

```bash
xBuild --env production --deploy
```

## The `$argv` global

`$argv` is a `Record<string, unknown>` the configuration file may read while it is being evaluated, for a setting
that has to follow a flag before any hook runs:

```ts
const isServing = Boolean($argv.serve);

export const config: xBuildConfig = {
    variants: {
        main: {
            esbuild: {
                minify: !isServing,
                entryPoints: [ 'src/index.ts' ]
            }
        }
    }
};
```

::: warning 🔁 It is empty on the first pass
The file runs twice, since the options it declares through `userArgv` are known only once it has been read. The
first run sees an empty `$argv` and has its output isolated; the second sees the whole parsed command line, the
project's own options included. Read `$argv` for a value, and keep side effects out of the path to the export.
:::

## See also

- [config.xbuild.ts](/configuration/file)
- [Lifecycle](/configuration/lifecycle)
- [Getting Started](/guide)
