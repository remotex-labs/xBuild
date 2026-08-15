/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { Stats } from 'fs';
import type { ChangeTypes } from '@constants/watch.constant';
import type { ObserverInterface, NextType } from '@remotex-labs/xobservable';

/**
 * The kind of change carried by a watch event.
 *
 * @remarks
 * The union of the numeric codes exposed by {@link ChangeTypes}.
 *
 * @example
 * ```ts
 * const type: ChangeType = ChangeTypes.Added; // 0
 * ```
 *
 * @see ChangeTypes
 * @since 3.0.0
 */

export type ChangeType = typeof ChangeTypes[keyof typeof ChangeTypes];

/**
 * A single entry describing what happened to one watched path.
 *
 * @remarks
 * Used as the value side of {@link WatchEventType}, keyed by the path relative to the watched base.
 *
 * @example
 * ```ts
 * const change: WatchChangeInterface = { type: ChangeTypes.Change, stats };
 * ```
 *
 * @see ChangeType
 * @since 3.0.0
 */

export interface WatchChangeInterface {
    /**
     * The kind of change that occurred.
     *
     * @example
     * ```ts
     * if (change.type === ChangeTypes.Deleted) forget(path);
     * ```
     *
     * @see ChangeType
     * @since 3.0.0
     */

    type: ChangeType;

    /**
     * The followed `stat` result for the path at the time of the event.
     *
     * @remarks
     * Reflects the symlink target rather than the link itself.
     * Absent for a deleted entry, whose path no longer resolves.
     *
     * @example
     * ```ts
     * change.stats?.mtimeMs; // 1754000000000
     * change.stats;          // undefined - the path was deleted
     * ```
     *
     * @since 3.0.0
     */

    stats?: Stats;
}

/**
 * A batch of path changes accumulated within one debounce window.
 *
 * @remarks
 * Keys are paths relative to the watched base, and each value describes the change on that path.
 * One object is emitted per flush, coalescing every event seen since the previous emission.
 *
 * @example
 * ```ts
 * watcher.subscribe((batch: WatchEventType) => {
 *     Object.keys(batch); // [ 'src/index.ts', 'src/app.ts' ]
 * });
 * ```
 *
 * @see WatchChangeInterface
 * @since 3.0.0
 */

export type WatchEventType = Record<string, WatchChangeInterface>;

/**
 * The subscriber form accepted when observing the watch stream.
 *
 * @remarks
 * Either a full {@link ObserverInterface} carrying `next`, `error`, and `complete`,
 * or a bare `next` callback that receives each emitted {@link WatchEventType} batch.
 * A callback form leaves `error` and `complete` to be supplied as separate arguments.
 *
 * @example
 * ```ts
 * watcher.subscribe((batch) => rebuild(batch));                 // the callback form
 * watcher.subscribe({ next: rebuild, error: report });          // the observer form
 * ```
 *
 * @see WatchEventType
 * @since 3.0.0
 */

export type ObserverType = ObserverInterface<WatchEventType> | NextType<WatchEventType>;

/**
 * Options controlling which paths a watcher tracks and how it reports them.
 *
 * @remarks
 * Every field is optional, so an omitted object watches the base itself,
 * emits every non-dot path it sees, and coalesces those events over 150 milliseconds.
 *
 * @example
 * ```ts
 * new WatchService('src', { recursive: true, filter: [ '**\/*.ts' ], debounce: 100 });
 * ```
 *
 * @see WatchService
 * @since 3.0.0
 */

export interface WatchOptionsInterface {
    /**
     * Whether to include dotfiles and dot-directories.
     *
     * @remarks
     * When `false` or omitted, any path with a segment beginning with `.` is skipped and the filter hides dotfiles.
     * When `true`, dot paths are watched and eligible to match the filter.
     *
     * @example
     * ```ts
     * new WatchService('.', { dot: true }); // reports changes under .github
     * ```
     *
     * @since 3.0.0
     */

    dot?: boolean;

    /**
     * Glob patterns selecting which paths emit change events.
     *
     * @remarks
     * A leading `!` marks an exclusion.
     * A path passes when it matches an include and no exclusion.
     * An empty or omitted list matches every path.
     *
     * @example
     * ```ts
     * new WatchService('src', { filter: [ '**\/*.ts', '!**\/*.spec.ts' ] });
     * ```
     *
     * @see createMatcher
     * @since 3.0.0
     */

    filter?: Array<string>;

    /**
     * Milliseconds to coalesce events before emitting a batch.
     *
     * @remarks
     * Each event restarts the window, so a burst of rapid changes yields a single {@link WatchEventType} emission.
     * Defaults to 150 when omitted.
     *
     * @example
     * ```ts
     * new WatchService('src', { debounce: 0 }); // emit as soon as the event loop allows
     * ```
     *
     * @since 3.0.0
     */

    debounce?: number;

    /**
     * Whether to watch nested directories as well as the base.
     *
     * @example
     * ```ts
     * new WatchService('src', { recursive: true }); // src/models/files.model.ts reports too
     * ```
     *
     * @since 3.0.0
     */

    recursive?: boolean;

    /**
     * Whether to place additional watchers on symbolic links.
     *
     * @remarks
     * `fs.watch` does not follow links,
     * so when `true` the base is scanned once, and every symlink found is watched directly.
     * Links appearing later are picked up from their parent directory's events.
     *
     * @example
     * ```ts
     * new WatchService('src', { followSymlinks: true }); // a linked package reports its own changes
     * ```
     *
     * @since 3.0.0
     */

    followSymlinks?: boolean;
}
