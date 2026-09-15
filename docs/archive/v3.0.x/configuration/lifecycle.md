# Lifecycle

`lifecycle` attaches hooks to a build. It sits on `common`, on a variant, or on both, and the two merge hook by
hook so a variant naming one hook replaces that hook alone.

```ts
variants: {
    main: {
        esbuild: { outdir: 'dist', entryPoints: [ 'src/index.ts' ] },
        lifecycle: {
            onStart({ context }) {
                context.stage.loaded = 0;
            },
            onLoad({ context }) {
                (context.stage.loaded as number)++;
            },
            onEnd({ context, duration }) {
                console.log(`${ context.stage.loaded } files in ${ duration }ms`);
            }
        }
    }
}
```

Where the same hooks are shared between builds or projects and want a name of their own, reach for
[plugins](/configuration/plugins) instead.

## Hooks

| Hook        | Runs                                       | Returns                      |
|-------------|--------------------------------------------|------------------------------|
| `onStart`   | Once, before the build reads a file        | `OnStartResult` or nothing   |
| `onResolve` | As each import is resolved                 | `OnResolveResult` or nothing |
| `onLoad`    | As each file is read                       | `OnLoadResult` or nothing    |
| `onEnd`     | Once the build has finished, either way    | nothing                      |
| `onSuccess` | Once the build has finished with no errors | nothing                      |

Every hook may be synchronous or return a promise, and the build waits either way. `onSuccess` runs ahead of
`onEnd`, and declarations are emitted before either of them.

::: warning 📦 One argument, and the context is inside it
In 3.0.0 a hook is handed a single object, and the shared context is a field on it rather than the object
itself. Destructure it: `onStart({ context })`, `onLoad({ args, contents, loader, context })`,
`onEnd({ context, duration, buildResult })`.
:::

## The shared context

One object for the whole build, so a value a hook writes onto `stage` is still there for the next one.

| Field         | Type                       | Notes                                                        |
|---------------|----------------------------|--------------------------------------------------------------|
| `variantName` | `string`                   | The key the variant is written under.                        |
| `argv`        | `Record<string, unknown>`  | The parsed command line, the project's own options included. |
| `options`     | `BuildOptions`             | The esbuild options this build runs under, already merged.   |
| `logs`        | `LifecycleLogsType`        | What the build has reported so far, by level.                |
| `overrides`   | `Record<string, LogLevel>` | The `logOverride` table, as the configuration wrote it.      |
| `stage`       | `LifecycleStageInterface`  | Scratch state, reset at the start of every build.            |

### `context.stage`

The one part of the context a hook is meant to write to.

| Field            | Type          | Notes                                                                      |
|------------------|---------------|----------------------------------------------------------------------------|
| `startTime`      | `Date`        | Stamped as the build starts.                                               |
| `reachableFiles` | `Set<string>` | Every input the build reaches, from a dependency scan of the entry points. |
| `dropped`        | `Set<string>` | The macro bindings this build drops, as the macro analysis named them.     |
| `[key: string]`  | `unknown`     | Anything a hook leaves behind for a later one.                             |

```ts
onStart({ context }) {
    context.stage.reachableFiles.has('src/index.ts'); // true
    context.stage.count = 0;                          // read back in a later hook
}
```

### `context.logs`

Keyed by every level but `silent`, each bucket holding esbuild messages in the order they arrived:

```ts
onEnd({ context }) {
    context.logs.error.length;   // 0
    context.logs.warning.length; // 2
    context.logs.info.length;
    context.logs.verbose.length;
}
```

## `onStart`

Handed the esbuild module the build resolved, so a hook transforming or building something of its own works
against the same version rather than one it imported for itself. It is the only stage given esbuild.

```ts
async onStart({ esbuild, context }) {
    const out = await esbuild.transform('let a = 1', { minify: true });
    out.code; // 'let a=1;\n'

    if (!context.options.outdir) {
        return { errors: [ { text: 'no outdir' } ] }; // reported against the build, which then stops
    }
}
```

Returning an `OnStartResult` reports errors or warnings against the build instead of throwing at it.

## `onResolve`

```ts
onResolve({ args }) {
    if (args.path.startsWith('node:')) return { path: args.path, external: true };
    if (args.path.startsWith('@/')) return { path: args.path.replace(/^@\//, 'src/') };
}
```

`args` is esbuild's `OnResolveArgs`: the path as written, the importer, the directory a relative path resolves
from, and the kind of import it came from. Returning nothing leaves the path to esbuild.

## `onLoad`

```ts
onLoad({ args, contents, loader }) {
    if (!args.path.endsWith('.txt')) return;

    return {
        contents: `export default ${ JSON.stringify(contents) };`,
        loader: 'js'
    };
}
```

`contents` is the source as it stands at this point in the chain: the file as it was read for the first hook, and
whatever the hook before returned for the ones after it. Returning nothing leaves both the contents and the
loader as they are.

::: warning 🧵 `contents` is a string
It arrives decoded rather than as a `Uint8Array`, so a v2 hook calling `contents.toString()` should drop the
call.
:::

## `onEnd` and `onSuccess`

Both take the same object. `onEnd` runs however the build turned out, `onSuccess` only when nothing failed, so a
hook that publishes or deploys belongs on the second and does not have to guard on `buildResult.errors`.

```ts
onEnd({ duration, buildResult }) {
    console.log(`${ buildResult.errors.length } errors in ${ duration }ms`);
},
async onSuccess({ context }) {
    await publish(context.options.outdir);
}
```

`buildResult` is esbuild's own result widened with the two levels it does not report on one:

| Field      | Type             | Notes                         |
|------------|------------------|-------------------------------|
| `errors`   | `Array<Message>` | esbuild's own.                |
| `warnings` | `Array<Message>` | esbuild's own.                |
| `info`     | `Array<Message>` | Messages that carry no fault. |
| `verbose`  | `Array<Message>` | The quietest level.           |

`duration` is milliseconds, measured from `context.stage.startTime` to the moment the build finished.

## Async

Every hook accepts a synchronous handler or an `async` one, and the build waits on the promise either way.

```ts
lifecycle: {
    async onStart({ context }) {
        await prepare(context.variantName);
    },
    async onEnd({ duration }) {
        await report(duration);
    }
}
```

## Related

`serve` has hooks of its own, `onRequest` and `onStart`. They belong to the server rather than to a build. See
[Serve](/configuration/serve).

## See also

- [Plugins](/configuration/plugins)
- [config.xbuild.ts](/configuration/file)
- [Programmatic API](/advanced/programmatic)
