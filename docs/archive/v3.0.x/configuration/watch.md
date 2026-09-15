# Watch

`watch` tunes the watcher that `--watch` and `--serve` start. New as a configuration block in 3.0.0.

```ts
/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { xBuildConfig } from '@remotex-labs/xbuild';

/**
 * Config build
 */

export const config: xBuildConfig = {
    watch: {
        debounce: 50,
        filter: [ '!docs/**' ],
        followSymlinks: true
    },
    variants: {
        main: {
            esbuild: { outdir: 'dist', entryPoints: [ 'src/index.ts' ] }
        }
    }
};
```

## Options

| Field            | Type            | Default   | Notes                                                     |
|------------------|-----------------|-----------|-----------------------------------------------------------|
| `filter`         | `Array<string>` | see below | Globs selecting which paths emit. A leading `!` excludes. |
| `recursive`      | `boolean`       | `true`    | Watch nested directories as well as the base.             |
| `debounce`       | `number`        | `150`     | Milliseconds to coalesce events into one batch.           |
| `dot`            | `boolean`       | `false`   | Include dotfiles and dot-directories.                     |
| `followSymlinks` | `boolean`       | `false`   | Place additional watchers on symbolic links.              |

A path emits when it matches an include and no exclusion. An empty or omitted list matches every path.

The `filter` and `recursive` defaults above are the ones a configuration file starts from rather than the
watcher's own: constructing a `WatchService` directly leaves `recursive` off and every path matching. See
[Programmatic API](/advanced/programmatic#watchservice).

## The default filter

A configuration file starts from these, whatever else it states:

```ts
filter: [ '**/*.{js,ts,json}', '!**/*.d.ts' ],
recursive: true
```

::: info ➕ `filter` is joined, not replaced
A `filter` the configuration names is concatenated onto that default list rather than put in place of it, so a
file adding `'!docs/**'` keeps the two globs above. To watch something the defaults exclude, add an include for
it; to stop watching something they cover, add an exclusion.
:::

Each settled output directory is excluded automatically as `!<outdir>/**`, without which a build would write into
the tree it is watching and set off the next one.

## `debounce`

Each event restarts the window, so a burst of rapid changes yields a single rebuild rather than one per file.
`0` emits as soon as the event loop allows.

```ts
watch: { debounce: 0 }
```

## What a change triggers

On every batch, xBuild refreshes the file model and reloads the TypeScript configuration before anything is
rebuilt, so the rebuild reads the files as they now are.

The configuration file is tracked by its content version rather than by its path. An edit to it is reparsed,
the command line overrides are reapplied, and the new configuration is handed to the running build. Variants it
gained are constructed, variants it dropped dispose of themselves, and everything else keeps running.

## Shortcuts

A watching run takes the last row of the terminal for a status bar and listens for single keys. See
[Getting Started](/guide#watch-and-serve) for the list.

## See also

- [config.xbuild.ts](/configuration/file)
- [Serve](/configuration/serve)
- [Programmatic API](/advanced/programmatic)
