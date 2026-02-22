---
outline: deep
---

# Guide

xBuild is a general-purpose build tool for JS/TS projects, powered by esbuild under the hood.
Use it to bundle, type-check, serve, watch, and more.

## Features

- ✅ TypeScript support & optional declaration output
- ⚙️ Bundling (`bundle`), minification (`minify`), format control (`format`)
- 🔁 Watch mode & local HTTP serving
- 🔌 `ifdef` plugin for conditional code inclusion
- 🪝 Lifecycle hooks (`onStart`, `onEnd`, `onLoad`, `onResolve`)

## Installation

Install `@remotex-labs/xbuild` globally using npm:

```bash
npm install -g @remotex-labs/xbuild
```

Or using Yarn:

```bash
yarn global add @remotex-labs/xbuild
```

## Quick Start

```bash
xbuild src/index.ts -o dist --bundle --format esm --minify
```

> This bundles src/index.ts into dist/, in ESM format, minified.

### CLI tool

Run the `xBuild -h` CLI tool with various options to build your typeScript projects.

```bash


     ______       _ _     _
     | ___ \     (_) |   | |
__  _| |_/ /_   _ _| | __| |
\ \/ / ___ \ | | | | |/ _` |
 >  <| |_/ / |_| | | | (_| |
/_/\_\____/ \__,_|_|_|\__,_|

Version: <xBuild version>

index.js [file]

A versatile JavaScript and TypeScript toolchain build system.

Positionals:
  entryPoints  The file entryPoints to build                            [string]

Options:
  -h, --help                  Show help                                [boolean]
      --typeCheck, --tc       Perform type checking                    [boolean]
  -n, --node                  Build for node platform                  [boolean]
  -d, --dev                   Array entryPoints to run as development in Node.js
                                                                         [array]
      --debug, --db           Array entryPoints to run in Node.js with debug sta
                              te                                         [array]
  -s, --serve                 Serve the build folder over HTTP         [boolean]
  -o, --outdir                Output directory                          [string]
      --declaration, --de     Add TypeScript declarations              [boolean]
  -w, --watch                 Watch for file changes                   [boolean]
  -c, --config                Build configuration file (js/ts)
                                          [string] [default: "xbuild.config.ts"]
      --tsconfig, --tsc       Set TypeScript configuration file to use
                                             [string] [default: "tsconfig.json"]
  -m, --minify                Minify the code                          [boolean]
  -b, --bundle                Bundle the code                          [boolean]
      --noTypeChecker, --ntc  Skip TypeScript type checking            [boolean]
      --buildOnError, --boe   Continue building even if there are TypeScript typ
                              e errors                                 [boolean]
  -f, --format                Defines the format for the build output ('cjs' | '
                              esm' | 'iif').                            [string]
  -v, --version               Show version number     [boolean] [default: false]

```

### Example Configuration

The `xBuild` configuration file allows you to customize various settings for the build and development process.
By default, xbuild uses `xbuild.config.ts` (`--config` change it). Here’s how you can configure it:

```ts
const config: ConfigurationInterface = {
    declaration: true,
    buildOnError: false,
    noTypeChecker: false,
    esbuild: {
        entryPoints: ['./src/index.ts'],
        bundle: true,
        minify: true,
        format: 'esm',
    },
    serve: {
        active: true,
        port: 8080,
        host: 'localhost',
        onRequest: (req, res, next) => {
            console.log('Server request received');
            next();
        }
    }
};
```
