# Programmatic API

`@remotex-labs/xbuild` exports the pieces a build is made of, so a project can run a watcher, serve a directory,
or drive TypeScript from code rather than from the CLI.

::: warning 🗑️ `BuildService`, `overwriteConfig`, and `patchConfig` are gone
v2 exported a build service and two functions for replacing or patching the active configuration at runtime.
3.0.0 removes all three from the public surface: a build's configuration comes from `config.xbuild.ts` and the
command line, and is re-read from the file while a watch runs. What remains exported is listed below.
:::

## What is exported

| Export                                                          | Kind      | Purpose                                              |
|-----------------------------------------------------------------|-----------|------------------------------------------------------|
| `WatchService`                                                  | class     | Watch a tree and emit debounced batches of changes.  |
| `ServerModule`                                                  | class     | Serve a directory over HTTP or HTTPS.                |
| `Typescript`                                                    | class     | Type-check, emit declarations, resolve modules.      |
| `getSource`, `getErrorStack`, `getErrorMetadata`, `formatStack` | functions | Resolve and render a stack against original sources. |
| `xBuildConfig` and the configuration, lifecycle, and log types  | types     | Typing a configuration file and its hooks.           |

## `WatchService`

A watcher is a subject: subscribe to it, or compose on it with the operators from
[xObservable](https://remotex-labs.github.io/xObservable/).

```ts
import { WatchService } from '@remotex-labs/xbuild';

const watcher = new WatchService('src', {
    debounce: 100,
    recursive: true,
    filter: [ '**/*.ts', '!**/*.spec.ts' ]
});

const unsubscribe = watcher.subscribe(batch => {
    Object.keys(batch);          // [ 'src/index.ts' ]
    batch['src/index.ts'].type;  // 1 - a later modification
});
```

Each emission is a record keyed by path, so a burst of rapid edits arrives as one batch rather than one event per
file. `type` is a numeric code - `0` added, `1` changed, `2` deleted - and `stats` carries the `fs.Stats` the path
was seen with where there are any. See [Watch](/configuration/watch) for what the options do.

## `ServerModule`

```ts
import { ServerModule } from '@remotex-labs/xbuild';

const server = new ServerModule({ port: 3000, host: 'localhost', verbose: true }, 'dist');

server.subscribe(event => {
    if (event.type === 'start') console.log(event.url);
});

await server.start();
await server.stop();
```

The configuration and the directory are separate arguments, and the configuration object is written back to: the
defaults land on it when the server is constructed, and the assigned port once it is listening. The server writes
nothing itself and reports everything as events, so what reaches a terminal is the caller's to decide. See
[Serve](/configuration/serve).

## `Typescript`

The TypeScript module a variant uses, reachable on its own:

```ts
import { Typescript } from '@remotex-labs/xbuild';

const ts = new Typescript('tsconfig.json');

ts.check([ 'src/index.ts' ]);                              // diagnostics for those files
await ts.emitBundle({ index: 'src/index.ts' }, 'types');   // one rolled-up .d.ts per entry point
await ts.emit({ index: 'src/index.ts' }, 'types');         // one .d.ts per input file
ts.resolve('./utils', 'src/index.ts');                     // the resolved module, or undefined
ts.dispose();
```

`Typescript.reload()` re-reads the configuration files and returns the paths it re-read, which is what a watch
cycle calls before rebuilding.

## Stack helpers

The same helpers xBuild reports its own errors through, backed by
[xMap](https://remotex-labs.github.io/xMap/):

```ts
import { getErrorMetadata, formatStack } from '@remotex-labs/xbuild';

try {
    run();
} catch (error) {
    const metadata = getErrorMetadata(error as Error, { linesBefore: 2, linesAfter: 2 });
    console.log(formatStack(metadata, 'TypeError', (error as Error).message));
}
```

`getSource` returns the `SourceService` registered for a file, or `null`, and `getErrorStack` parses a raw error
or esbuild message into frames without resolving them.

## Types

Everything a configuration file and its hooks are typed with is exported as types:

```ts
/**
 * Type-only imports erased during TypeScript compilation.
 */

import type {
    xBuildConfig,
    LogLevelType,
    LogOverridesType,
    LifecycleHooksInterface,
    LifecyclePluginInterface,
    LifecycleContextInterface,
    BaseConfigurationInterface,
    VariantConfigurationInterface,
    WatchOptionsInterface,
    ServerConfigurationInterface
} from '@remotex-labs/xbuild';
```

`Options` from [yargs](https://yargs.js.org/) is re-exported too, since that is what `userArgv` entries are.

## Globals

The package declares four globals, available once it is in `types`:

```ts
function $$inline<T>(callback: () => T): T | undefined;
function $$ifdef<T>(define: DefineType, callback: T): /* ... */;
function $$ifndef<T>(define: DefineType, callback: T): /* ... */;
var $argv: Record<string, unknown>;
```

The three macros are compile-time and never run. `$argv` is real, and holds the parsed command line while a
configuration file is being evaluated. See [Macros](/macros/ifdef) and
[The `$argv` global](/configuration/cli#the-argv-global).

## See also

- [config.xbuild.ts](/configuration/file)
- [Lifecycle](/configuration/lifecycle)
- [Watch](/configuration/watch)
- [Serve](/configuration/serve)
