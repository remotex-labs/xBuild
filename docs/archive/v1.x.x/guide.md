# Getting Started

xBuild v1 is a general-purpose build tool for JavaScript and TypeScript projects, powered by esbuild.
Use it to bundle, type-check, watch, serve, and run your code during development.

## Installation

::: code-group

```bash [npm]
npm install -g @remotex-labs/xbuild
```

```bash [yarn]
yarn global add @remotex-labs/xbuild
```

:::

## Quick Start

Build a file straight from the command line:

```bash
xbuild src/index.ts -o dist --bundle --format esm --minify
```

This bundles `src/index.ts` into `dist/`, in ESM format, minified.

## Create `xbuild.config.ts`

For anything beyond a one-off build, put the options in a config file.
xBuild loads `xbuild.config.ts` by default (change it with `--config`):

```ts
import type { xBuildConfig } from '@remotex-labs/xbuild';

const config: xBuildConfig = {
    declaration: true,
    buildOnError: false,
    noTypeChecker: false,
    esbuild: {
        entryPoints: [ './src/index.ts' ],
        bundle: true,
        minify: true,
        format: 'esm'
    },
    serve: {
        active: true,
        port: 8080,
        host: 'localhost'
    }
};

export default config;
```

Then run:

```bash
xbuild
```

## Development workflow

```bash
xbuild -w          # rebuild on file changes
xbuild -s          # serve the output folder over HTTP
xbuild -d src/index.ts   # build and run the entry point in Node.js
```

::: tip
`-w`, `-s`, and `-d` combine with the config file - CLI flags override the corresponding config fields.
:::

## Useful Docs

- [CLI options](configuration/cli)
- [`xbuild.config.ts` reference](configuration/file)
- [Lifecycle hooks](configuration/lifecycle)
- [Serve configuration](configuration/serve)
- [Conditional code with `ifdef`](macros/ifdef)
- [Programmatic API](advanced/programmatic)

## See also

- [Release Notes](release)
