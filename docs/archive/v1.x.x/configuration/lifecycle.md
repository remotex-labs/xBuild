# Lifecycle Hooks

The `hooks` field in `xbuild.config.ts` registers functions that customize the build.
Each hook corresponds to a stage of the esbuild operation; all of them are optional and can be provided partially.

## Example

```ts
import type { xBuildConfig } from '@remotex-labs/xbuild';

const config: xBuildConfig = {
    esbuild: {
        entryPoints: [ './src/index.ts' ],
        bundle: true
    },
    hooks: {
        onStart: async (build) => {
            console.log('Build started');
        },
        onEnd: async (result) => {
            console.log('Build finished:', result);
        }
    }
};

export default config;
```

## `HooksInterface`

```ts
export interface HooksInterface {
    /** Called before the build starts */
    onStart: OnStartType;

    /** Called to resolve imports */
    onResolve: OnResolveType;

    /** Called when a file is loaded */
    onLoad: OnLoadType;

    /** Called at the end of the build */
    onEnd: OnEndType;

    /** Called only when the build succeeds */
    onSuccess: OnEndType;
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

Runs before the build starts. Mutate `state` to pass data to later hooks.

### `OnResolveType`

```ts
type OnResolveType = (
    args: OnResolveArgs,
    state: PluginsBuildStateInterface
) => Promise<OnResolveResult | PluginResultType> | OnResolveResult | PluginResultType;
```

Intercepts module resolution. Return a new `path` or `external: true` to change how an import resolves.

### `OnLoadType`

```ts
type OnLoadType = (
    content: string | Uint8Array,
    loader: Loader | undefined,
    args: OnLoadArgs,
    state: PluginsBuildStateInterface
) => Promise<OnLoadResult | PluginResultType> | OnLoadResult | PluginResultType;
```

Runs when esbuild loads a file. Return modified content and a loader type to transform sources.

### `OnEndType`

```ts
type OnEndType = (
    result: BuildResult,
    state: PluginsBuildStateInterface
) => PluginResultType | OnEndResult | Promise<OnEndResult>;
```

Runs after the build completes (`onEnd`) or only after a successful build (`onSuccess`). Useful for logging, cleanup, or post-processing.

## Shared State

```ts
interface PluginsBuildStateInterface {
    [key: string]: unknown;
}
```

A mutable object passed to every hook during a single build - use it to share build-specific metadata across lifecycle stages.

Hooks can return `null`, `void`, or a `Promise` of either (`PluginResultType`) when they have nothing to report.

## See also

- [esbuild plugin hooks](https://esbuild.github.io/plugins/#overview)
- [`xbuild.config.ts` reference](file)
