# xBuild

[![Documentation](https://img.shields.io/badge/Documentation-orange?logo=typescript&logoColor=f5f5f5)](https://remotex-labs.github.io/xBuild/)
[![npm version](https://img.shields.io/npm/v/@remotex-labs/xbuild.svg)](https://www.npmjs.com/package/@remotex-labs/xbuild)
[![License: MPL 2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)
[![Node.js CI](https://github.com/remotex-labs/xbuild/actions/workflows/test.yml/badge.svg)](https://github.com/remotex-labs/xBuild/actions/workflows/test.yml)
[![Discord](https://img.shields.io/discord/1364348850696884234?logo=Discord&label=Discord)](https://discord.gg/psV9grS9th)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/remotex-labs/xBuild)

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

Usage: xBuild [files..] [options]

xBuild Options:
      --entryPoints         Specific files to build (supports glob patterns)
                                                                         [array]
      --typeCheck, --tc     Perform type checking without building output
                                                                       [boolean]
  -p, --platform            Target platform for the build output
                                [string] [choices: "browser", "node", "neutral"]
  -s, --serve               Start server to the <folder>                [string]
  -o, --outdir              Directory for build output files            [string]
      --declaration, --de   Generate TypeScript declaration files (.d.ts)
                                                                       [boolean]
  -w, --watch               Watch mode - rebuild on file changes       [boolean]
  -c, --config              Path to build configuration file
                                          [string] [default: "config.xbuild.ts"]
      --tsconfig, --tsc     Path to TypeScript configuration file       [string]
  -m, --minify              Minify the build output                    [boolean]
  -b, --bundle              Bundle dependencies into output files      [boolean]
      --types, --btc        Enable type checking during build process  [boolean]
      --failOnError, --foe  Fail build when TypeScript errors are detected
                                                                       [boolean]
  -f, --format              Output module format
                                        [string] [choices: "cjs", "esm", "iife"]
  -v, --verbose             Verbose error stack traces                 [boolean]
      --build, --xb         Select an build configuration variant by names (as
                            defined in your config file)                 [array]

Positionals:
  entryPoints  Specific files to build (supports glob patterns)          [array]

Options:
  -h, --help     Show help                                             [boolean]
      --version  Show version number                                   [boolean]

Examples:
  xBuild src/index.ts                       Build a single file with default
                                            settings
  xBuild src/**/*.ts --bundle --minify      Bundle and minify all TypeScript
                                            files
  xBuild src/app.ts -s                      Development mode with watch and dev
                                            server
  xBuild src/app.ts -s dist                 Development mode with watch and dev
                                            server from dist folder
  xBuild src/lib.ts --format esm            Build ESM library with type
  --declaration                             definitions
  xBuild src/server.ts --platform node      Build Node.js application to dist
  --outdir dist                             folder
  xBuild --typeCheck                        Type check only without generating
                                            output
  xBuild --config custom.xbuild.ts          Use custom configuration file

For more information, check the documentation
https://remotex-labs.github.io/xBuild/
```

## Configuration

The `xBuild` configuration file allows you to customize various settings for the build and development process.
By default, xbuild uses `config.xbuild.ts` (`--config` change it). Here's how you can configure it:

### Example Configuration

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

export const config: xBuildConfig = {
    common: {
        define: {
            __VERSION: pkg.version
        },
        esbuild: {
            bundle: true,
            minify: true,
            format: 'esm',
            target: [ `node${ version.slice(1) }` ],
            platform: 'node',
            packages: 'external',
            sourcemap: true,
            external: [ './index.js' ],
            sourceRoot: `https://github.com/remotex-labs/xBuild/tree/v${ pkg.version }/`,
            loader: {
                '.html': 'text'
            }
        },
        lifecycle: {
            onStart(): void {
                console.log('starting build...');
            }
        }
    },
    variants: {
        bash: {
            esbuild: {
                entryPoints: {
                    bash: 'src/bash.ts'
                }
            }
        },
        index: {
            esbuild: {
                entryPoints: {
                    index: 'src/index.ts'
                }
            }
        }
    }
};
```

## Using the ifdef Plugin

The `ifdef` in `xBuild` allows to conditionally include or exclude code based on defined variables. Here's an example:

```ts
$$ifdef('DEBUG', () => {
    console.log('Debug mode is enabled');
});

$$ifndef('FEATURE_X', () => {
    console.log('Feature X is not active');
});

const $$logger = $$ifdef('DEBUG', (...args: Array<unknown>) => {
    console.debug(...args);
});

$$logger('some log that will be in debug mode only');

const result = $$inline(() => {
    console.log('compile time log');

    return 'run in compile time and retrun string result';
});

console.log(result);
```

### Setting Conditions in Configuration

To enable these blocks during the build, define your conditions in the `xBuild` configuration file:

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

export const config: xBuildConfig = {
    common: {
        define: {
            __VERSION: pkg.version,
        },
        esbuild: {
            bundle: true,
            minify: true,
            format: 'esm',
            target: [ `node${ version.slice(1) }` ],
            platform: 'node',
            packages: 'external',
            sourcemap: true,
            external: [ './index.js' ],
            sourceRoot: `https://github.com/remotex-labs/xBuild/tree/v${ pkg.version }/`,
            loader: {
                '.html': 'text'
            }
        },
        lifecycle: {
            onStart(): void {
                console.log('starting build...');
            }
        }
    },
    variants: {
        bash: {
            define: {
                DEBUG: true,        // Enables the DEBUG section
                FEATURE_X: false,    // Excludes the FEATURE_X section
            },
            esbuild: {
                entryPoints: {
                    bash: 'src/bash.ts'
                }
            }
        },
        index: {
            esbuild: {
                entryPoints: {
                    index: 'src/index.ts'
                }
            }
        }
    }
};
```

## Hooks

The `LifecycleHooksInterface` interface provides a structure for lifecycle hooks to customize the build process.

```ts
export interface LifecycleHooksInterface {
    onEnd?: OnEndType;
    onLoad?: OnLoadType;
    onStart?: OnStartType;
    onSuccess?: OnEndType;
    onResolve?: OnResolveType;
}
```

## Links

- [Documentation](https://remotex-labs.github.io/xBuild/)
- [GitHub Repository](https://github.com/remotex-labs/xBuild)
- [Issue Tracker](https://github.com/remotex-labs/xBuild/issues)
- [npm Package](https://www.npmjs.com/package/@remotex-labs/xbuild)
