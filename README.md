# xBuild
[![npm version](https://img.shields.io/badge/Documentation-orange?logo=typescript&logoColor=f5f5f5)](https://remotex-labs.github.io/xBuild/)
[![npm version](https://img.shields.io/npm/v/@remotex-labs/xbuild.svg)](https://www.npmjs.com/package/@remotex-labs/xbuild)
[![License: MPL 2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)
[![Node.js CI](https://github.com/remotex-labs/xBuild/actions/workflows/node.js.yml/badge.svg)](https://github.com/remotex-labs/xBuild/actions/workflows/node.js.yml)

`@remotex-labs/xbuild` is a versatile TypeScript toolchain build system

## Installation

Install `@remotex-labs/xbuild` globally using npm:

```bash
npm install -g @remotex-labs/xbuild
```

Or using Yarn:

```bash
yarn global add @remotex-labs/xbuild
```

## Usage

Run the `xBuild -h` CLI tool with various options to build your typeScript projects.
Command-Line Options

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

## Configuration

The `xBuild` configuration file allows you to customize various settings for the build and development process.
By default, xbuild uses `xbuild.config.ts` (`--config` change it). Here’s how you can configure it:

### Example Configuration
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

You can also define multiple configurations as an array:
```ts
/**
 * Import will remove at compile time
 */

import type { xBuildConfig } from '@remotex-labs/xbuild';

/**
 * Imports
 */

import { version } from 'process';
import pkg from './package.json' with { type: 'json' };

/**
 * Config build
 */

const config: Array<xBuildConfig> = [
    {
        declaration: true,
        esbuild: {
            bundle: true,
            minify: true,
            format: 'esm',
            outdir: 'dist/esm',
            target: [ `node${ version.slice(1) }` ],
            platform: 'node',
            packages: 'external',
            sourcemap: true,
            sourceRoot: `https://github.com/remotex-lab/xmap/tree/v${ pkg.version }/`,
            entryPoints: [ 'src/index.ts' ]
        }
    },
    {
        declaration: false,
        noTypeChecker: true,
        esbuild: {
            bundle: true,
            format: 'cjs',
            outdir: 'dist/cjs'
        }
    }
];

export default config;
```

## Using the ifdef Plugin
The `ifdef` plugin in `xBuild` allows to conditionally include or exclude code based on defined variables. Here’s an example:
```ts
// main.ts

console.log("This code always runs");

// If the `DEBUG` flag is set in your build config, this block will be included
// ifdef DEBUG
console.log("Debug mode is enabled");
// endif

// ifdef FEATURE_X
console.log("Feature X is active");
// endif
```

### Setting Conditions in Configuration
To enable these blocks during the build, define your conditions in the `xBuild` configuration file:
```ts
export default {
    esbuild: {
        entryPoints: ['./src/main.ts'],
        outdir: 'dist',
        minify: false,
        format: 'esm',
        bundle: true,
    },
    define: {
        DEBUG: true,        // Enables the DEBUG section
        FEATURE_X: false,    // Excludes the FEATURE_X section
    }
};
```
In this example:
* When `DEBUG` is set to `true`, the `Debug mode is enabled` message is included.
* When `FEATURE_X` is `false`, the `console.log("Feature X is active");` line is excluded.

This approach helps to manage feature toggles and debug code efficiently, making it possible to build different versions of your code based on a configuration.

## Hooks 
The `HooksInterface` interface provides a structure for lifecycle hooks to customize the build process.
```ts
export interface HooksInterface {
    onEnd: OnEndType;
    onLoad: OnLoadType;
    onStart: OnStartType;
    onResolve: OnResolveType;
}
```

```ts
/**
 * Imports will be remove at compile time
 */

import type { xBuildConfig } from '@remotex-labs/xbuild';

/**
 * Imports
 */

import { version } from 'process';
import pkg from './package.json' with { type: 'json' };

/**
 * Config build
 */

const config: xBuildConfig = {
    dev: true,
    watch: true,
    declaration: true,
    buildOnError: false,
    noTypeChecker: false,
    esbuild: {
        entryPoints: ['./src/index.ts'],
        bundle: true,
        minify: true,
        target: 'es2020'
    },
    serve: {
        port: 8080,
        host: 'localhost',
        active: true // can be activeate using -s instead 
    },
    hooks: {
        onStart: async (build) => {
            console.log('Build started');
        },
        onEnd: async (result) => {
            console.log('Build finished:', result);
        }
    },
    define: {
        '__ENV__': 'development',
    }
};

export default config;
```

## Using the ifdef and macros
```ts
// main.ts

console.log("This code always runs");

// If the `DEBUG` flag is set in your build config, this block will be included
// ifdef DEBUG
export function $$logger(...args: Array<unknown>): void {
    console.log(...args);
}
// endif

// ifdef FEATURE_X
console.log("Feature X is active");
// endif


$$logger('data'); // will be deleted if $$logger does not exist
```

## Links
- [Documentation](https://remotex-labs.github.io/xBuild/)
- [GitHub Repository](https://github.com/remotex-labs/xBuild)
- [Issue Tracker](https://github.com/remotex-labs/xBuild/issues)
- [npm Package](https://www.npmjs.com/package/@remotex-labs/xbuild)
