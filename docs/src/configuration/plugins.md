# Plugins

A plugin is a named set of the same hooks [`lifecycle`](/configuration/lifecycle) takes, packaged so several can
stand beside one another on one build. New in 3.0.0.

```ts
/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { xBuildConfig, LifecyclePluginInterface } from '@remotex-labs/xbuild';

/**
 * Config build
 */

const timing: LifecyclePluginInterface = {
    name: 'timing',
    onSetup({ options }) {
        options.metafile = true;
    },
    onEnd({ duration }) {
        console.log(`done in ${ duration }ms`);
    }
};

export const config: xBuildConfig = {
    common: {
        plugins: [ timing ]
    },
    variants: {
        main: {
            esbuild: { outdir: 'dist', entryPoints: [ 'src/index.ts' ] }
        }
    }
};
```

## When to reach for one

- **`lifecycle`** - the hooks belong to this configuration and nothing else.
- **`plugins`** - the hooks are shared between builds or projects, several sets have to coexist, or a message
  coming out of them should name where it came from.

## Shape

`LifecyclePluginInterface` is every hook of `LifecycleHooksInterface`, plus two fields of its own.

| Field       | Type                                                   | Notes                                                    |
|-------------|--------------------------------------------------------|----------------------------------------------------------|
| `name`      | `string`                                               | Required. Labels the plugin wherever a build reports it. |
| `onSetup`   | `(context: LifecycleContext) => void \| Promise<void>` | Runs before each build of the variant.                   |
| `onStart`   |                                                        | As on `lifecycle`.                                       |
| `onResolve` |                                                        | As on `lifecycle`.                                       |
| `onLoad`    |                                                        | As on `lifecycle`.                                       |
| `onEnd`     |                                                        | As on `lifecycle`.                                       |
| `onSuccess` |                                                        | As on `lifecycle`.                                       |

## `onSetup`

The one place a plugin changes the options a build receives. It is handed the context the rest of the build's
hooks share while it is still open to change, so writing to `options` here decides what esbuild is given.

```ts
const unminified: LifecyclePluginInterface = {
    name: 'unminified',
    onSetup({ options, stage, argv }) {
        options.minify = argv.watch !== true; // a watch cycle builds unminified
        stage.loaded = 0;                     // every later hook of this build reads it back
    }
};
```

It runs on **every** build of the variant rather than once, which is what lets a watch cycle rebuild under
different options. Returning a promise holds the build until it settles.

::: info 🪝 `onSetup` or `onStart`
A hook that shapes the build belongs on `onSetup`, since `options` is still open there. A hook that only runs at
the build's start, and wants esbuild itself, belongs on `onStart`.
:::

## Order

The list applies in the order it is written, and `common` is merged under a variant by appending, so a shared
plugin runs ahead of one a variant adds for itself. The variant's own `lifecycle` set runs last, under the
variant's name.

```ts
common:   { plugins: [ a, b ] },
variants: { main: { plugins: [ c ], lifecycle: { onEnd } } }

// a, then b, then c, then the variant's own lifecycle
```

How far the walk goes depends on the stage:

- **`onSetup`, `onStart`, `onEnd`, `onSuccess`** - every plugin runs. Errors a start hook reports are collected,
  and the build stops on the set of them rather than on the first.
- **`onLoad`** - every plugin runs, as a chain: each is handed the contents and loader the one before returned.
- **`onResolve`** - the first plugin to return anything settles the import, and the rest are not consulted, which
  is how esbuild itself behaves across plugins.

A plugin that throws has the failure recorded against its name and the walk carries on, so one broken plugin does
not take the rest of the stage with it.

## Naming

`name` labels the plugin wherever a build reports it, so a message coming out of one set of hooks names the set
it came from rather than the variant:

```text
✗  timing  Cannot read properties of undefined
```

## See also

- [Lifecycle](/configuration/lifecycle)
- [config.xbuild.ts](/configuration/file)
- [Release Notes](/release)
