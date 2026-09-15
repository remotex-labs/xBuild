# Getting Started

xBuild bundles a project with [esbuild](https://esbuild.github.io/), type-checks and emits declarations with
TypeScript, and rewrites compile-time macros with [oxc](https://oxc.rs/). One configuration file describes every
output, and one command runs them all.

## Install

::: code-group

```bash [npm]
npm install -D @remotex-labs/xbuild
```

```bash [pnpm]
pnpm add -D @remotex-labs/xbuild
```

```bash [yarn]
yarn add -D @remotex-labs/xbuild
```

:::

xBuild requires Node.js 22 or newer.

## Create `config.xbuild.ts`

```ts
/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { xBuildConfig } from '@remotex-labs/xbuild';

/**
 * Config build
 */

export const config: xBuildConfig = {
    variants: {
        main: {
            esbuild: {
                bundle: true,
                format: 'esm',
                outdir: 'dist',
                platform: 'node',
                entryPoints: [ 'src/index.ts' ]
            }
        }
    }
};
```

A named `config` export wins over a default export, and either is accepted.

## Run a build

```bash
xBuild
```

Every variant the file declares is built. Name one to build it alone:

```bash
xBuild --build main
```

Or skip the file entirely and build the files you name:

```bash
xBuild src/index.ts --bundle --format esm --outdir dist
```

Entry points on the command line replace the declared variants with a single one called `argv`.

## Watch and serve

```bash
xBuild --watch          # rebuild on change
xBuild --serve dist     # serve a directory, and watch it
```

Both take the last row of the terminal for a status bar and listen for shortcuts:

| Key | Action                           |
| --- | -------------------------------- |
| `h` | show the shortcut menu           |
| `b` | run the build                    |
| `r` | reload and rebuild               |
| `v` | toggle verbose reporting         |
| `c` | clear the screen                 |
| `o` | open the served url in a browser |
| `q` | quit                             |

`o` appears only while a server is listening. `Ctrl+C` and `Ctrl+D` leave the same way `q` does, handing the
terminal back before the process exits.

## TypeScript autocomplete

Add the package to `types` so `$$ifdef`, `$$ifndef`, `$$inline`, and `$argv` are declared:

```json
{
    "compilerOptions": {
        "types": [ "node", "@remotex-labs/xbuild" ]
    }
}
```

## Where to go next

- [config.xbuild.ts](/configuration/file) - every field a configuration file may state.
- [CLI](/configuration/cli) - the flags, and the options a project declares for itself.
- [Lifecycle](/configuration/lifecycle) - the hooks a build runs, and what each one is handed.
- [Plugins](/configuration/plugins) - the same hooks as a named, reusable set.
- [Watch](/configuration/watch) - what the watcher tracks, and how it reports.
- [Serve](/configuration/serve) - the static server, over HTTP or HTTPS.
- [Macros](/macros/ifdef) - `$$ifdef`, `$$ifndef`, and `$$inline`.
- [Programmatic API](/advanced/programmatic) - what the package exports to code.

## See also

- [Release Notes](/release)
- [config.xbuild.ts](/configuration/file)
