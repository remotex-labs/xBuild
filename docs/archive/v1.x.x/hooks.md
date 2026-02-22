# Lifecycle Hooks
The `hooks` field in your `xbuild.config.ts` allows you to register lifecycle hook functions that customize the behavior of the build process.
These hooks are optional and can be partially provided. Each one corresponds to a specific stage in the `esbuild` operation.

## Example

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

## `HooksInterface`

```ts
export interface HooksInterface {
  /** Called at the end of the build */
  onEnd: OnEndType;

  /** Called after build ends successfully (alias of onEnd) */
  onSuccess: OnEndType;

  /** Called when a file is loaded */
  onLoad: OnLoadType;

  /** Called before the build starts */
  onStart: OnStartType;

  /** Called to resolve imports */
  onResolve: OnResolveType;
}
```

## Hook Signatures

### `OnStartType`

```ts
type OnStartType = (
  build: PluginBuild,
  state: PluginsBuildStateInterface
) => PluginResultType | OnEndResult | Promise<OnEndResult>;
```

- **Called before the build starts**
- You can mutate the `state` object to pass data to other hooks

---

### `OnEndType`

```ts
type OnEndType = (
  result: BuildResult,
  state: PluginsBuildStateInterface
) => PluginResultType | OnEndResult | Promise<OnEndResult>;
```

- **Called after the build completes**
- Useful for logging, cleanup, or finalizing output

---

### `OnResolveType`

```ts
type OnResolveType = (
  args: OnResolveArgs,
  state: PluginsBuildStateInterface
) => Promise<OnResolveResult | PluginResultType> | OnResolveResult | PluginResultType;
```

- **Intercepts and modifies module resolution**
- You can return a new `path` or `external: true` to customize behavior

---

### `OnLoadType`

```ts
type OnLoadType = (
  content: string | Uint8Array,
  loader: Loader | undefined,
  args: OnLoadArgs,
  state: PluginsBuildStateInterface
) => Promise<OnLoadResult | PluginResultType> | OnLoadResult | PluginResultType;
```

- **Called when esbuild loads a file**
- Can return modified content and loader type

## `PluginsBuildStateInterface`

```ts
interface PluginsBuildStateInterface {
  [key: string]: unknown;
}
```

A shared mutable object that is passed to all hooks during a single build. Useful for storing build-specific metadata across lifecycle stages.

## `PluginResultType`

```ts
type PluginResultType = Promise<null | void> | null | void;
```

Hooks can return `null`, `void`, or a `Promise` of either.


## See Also

- [`esbuild` plugin hooks](https://esbuild.github.io/plugins/#overview)
- [`xbuild.config.ts`](configuration.md)
