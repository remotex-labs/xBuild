/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { FSWatcher, Dirent } from 'fs';
import type {  ErrorType, CompleteType, UnsubscribeType } from '@remotex-labs/xobservable';
import type { WatchEventType, ChangeType, ObserverType } from './interfaces/watch-service.interface';
import type { WatchChangeInterface, WatchOptionsInterface } from './interfaces/watch-service.interface';

/**
 * Imports
 */

import { Injectable } from '@remotex-labs/xinject';
import { Subject } from '@remotex-labs/xobservable';
import { ChangeCode } from '@constants/watch.constant';
import { createMatcher } from '@components/glob.component';
import { resolve, join, relative } from '@remotex-labs/xmap';
import { watch, realpathSync, readdirSync, lstatSync, statSync } from 'fs';

/**
 * A filesystem watcher that multicasts debounced batches of path changes to every subscriber.
 *
 * @remarks
 * Extends a multicast {@link Subject}: the underlying `fs.watch` handles are opened on the **first** subscription and
 * torn down only when the **last** subscription ends, while every active subscriber receives each emitted batch.
 * Events are filtered by a glob matcher, coalesced within a debounced window, and delivered as a single
 * {@link WatchEventType} keyed by path relative to the base.
 * Because `fs.watch` never follows symbolic links,
 * {@link WatchOptionsInterface.followSymlinks} places explicit watchers on the links it finds.
 * As a {@link Subject}, the emitted stream can be reshaped with `pipe` and operators before subscribing.
 *
 * @example
 * <caption>Multiple independent subscribers - each receives every batch</caption>
 * ```ts
 * const watcher = new WatchService('src', { recursive: true, filter: [ '**\/*.{ts,js}' ], debounce: 100 });
 *
 * const stopA = watcher.subscribe((changes) => rebuild(changes)); // opens the fs watchers
 * const stopB = watcher.subscribe((changes) => reloadTypes(changes)); // reuses them
 *
 * stopB(); // watchers stay open - `stopA` is still subscribed
 * stopA(); // last subscriber leaves - every handle is closed
 * ```
 *
 * @example
 * <caption>Scoped teardown - the subscription disposes automatically at the end of the block</caption>
 * ```ts
 * const watcher = new WatchService(cwd(), { followSymlinks: true, filter: [ '**\/*.{ts,js}' ] });
 * using sub = watcher.subscribe((changes) => console.log(Object.keys(changes)));
 * ```
 *
 * @see Subject.pipe
 * @see WatchEventType
 * @see WatchOptionsInterface
 *
 * @since 3.0.0
 */

@Injectable({
    scope: 'singleton'
})
export class WatchService extends Subject<WatchEventType> {
    /**
     * The absolute root path being watched.
     *
     * @since 3.0.0
     */

    private readonly base: string;

    /**
     * Predicate deciding whether a path passes the configured filter.
     *
     * @since 3.0.0
     */

    private readonly matcher: ReturnType<typeof createMatcher>;

    /**
     * Active `fs.watch` handles, keyed by the path each was opened on.
     *
     * @since 3.0.0
     */

    private readonly watchers = new Map<string, FSWatcher>();

    /**
     * Changes accumulated in the current debounced window, keyed by path relative to the base.
     *
     * @since 3.0.0
     */

    private readonly pending = new Map<string, WatchChangeInterface>();

    /**
     * Count of currently active subscriptions, used to start watchers on the first and stop them on the last.
     *
     * @since 3.0.0
     */

    private subscriptions = 0;

    /**
     * Handle for the scheduled debounced flush, or `undefined` while idle.
     *
     * @since 3.0.0
     */

    private timer?: ReturnType<typeof setTimeout>;

    /**
     * Creates a watcher rooted at a base path.
     *
     * @param base - Directory to watch, resolved to an absolute path
     * @param options - Filtering, debounce, recursion, and symlink behavior
     *
     * @remarks
     * No watcher is opened until the first subscriber attaches, so constructing one costs a resolve and a matcher.
     *
     * @example
     * ```ts
     * const watcher = new WatchService('src', { filter: [ '**\/*.ts' ] }); // nothing is watched yet
     * ```
     *
     * @see WatchOptionsInterface
     * @since 3.0.0
     */

    constructor(base: string, private options?: WatchOptionsInterface) {
        super();

        this.base = resolve(base);
        this.matcher = createMatcher(this.options?.filter ?? [], {
            dot: this.options?.dot ?? false
        });
    }

    /**
     * Subscribes to the debounced change stream, starting the watchers on the first subscriber.
     *
     * @param observerOrNext - A full observer object, or a `next` callback
     * @param error - Error handler, used when the first argument is a `next` callback
     * @param complete - Completion handler, used when the first argument is a `next` callback
     * @returns Idempotent, disposable unsubscribe function that detaches this subscriber and,
     * once it is the last one, closes every open watcher
     *
     * @remarks
     * The first subscription opens the `fs.watch` handles, and each later subscription reuses them.
     * Unsubscribing runs at most once.
     * The handles, the pending batch, and the flush timer are released only when the final subscriber leaves,
     * so a watcher shared by several consumers stays alive until all of them detach.
     *
     * @example
     * ```ts
     * const stop = watcher.subscribe((changes) => rebuild(changes));
     * stop(); // detaches, and closes the handles when no other subscriber is left
     * ```
     *
     * @see ObserverType
     * @see Subject.subscribe
     *
     * @since 3.0.0
     */

    override subscribe(observerOrNext?: ObserverType, error?: ErrorType, complete?: CompleteType): UnsubscribeType {
        const unsubscribe = super.subscribe(observerOrNext, error, complete);
        if (++this.subscriptions === 1) this.start();

        return this.toUnsubscribe(() => {
            unsubscribe();
            if (--this.subscriptions === 0) this.stop();
        });
    }

    /**
     * The debounced window in milliseconds, defaulting to 150.
     *
     * @since 3.0.0
     */

    private get debounce(): number {
        return this.options?.debounce ?? 150;
    }

    /**
     * Opens the base watcher and the symlink watchers when configured.
     *
     * @remarks
     * Invoked once when the subscriber count rises from zero to one.
     *
     * @since 3.0.0
     */

    private start(): void {
        this.watch(this.base, this.ignored.bind(this), this.options?.recursive);
        if (this.options?.followSymlinks) this.watchSymlinks(this.base);
    }

    /**
     * Clears the pending timer and closes every open watcher.
     *
     * @remarks
     * Invoked once when the subscriber count falls back to zero, returning the service to its pre-subscription state so
     * a later subscription can start clean.
     *
     * @since 3.0.0
     */

    private stop(): void {
        if (this.timer) clearTimeout(this.timer);
        for (const watcher of this.watchers.values()) watcher.close();

        this.timer = undefined;
        this.pending.clear();
        this.watchers.clear();
    }

    /**
     * Emits the accumulated batch to every subscriber and clears the window.
     *
     * @remarks
     * A no-op when nothing is pending, so an expired timer with no changes emits nothing.
     * A `next` that throws is reported to that subscriber's own `error` handler by the {@link Subject},
     * which then rethrows the failures as one aggregate.
     * That aggregate is swallowed here, so one faulty consumer cannot stop the watcher for the others.
     *
     * @since 3.0.0
     */

    private flush(): void {
        this.timer = undefined;
        if (this.pending.size === 0) return;

        const batch = Object.fromEntries(this.pending) as WatchEventType;
        this.pending.clear();

        try {
            this.next(batch);
        } catch {
            /* handled per-observer by the Subject */
        }
    }

    /**
     * Closes and forgets the watcher registered on a path, if any.
     *
     * @param path - Path whose watcher should be released
     *
     * @since 3.0.0
     */

    private watcherClose(path: string): void {
        const watcher = this.watchers.get(path);
        if (!watcher) return;

        watcher.close();
        this.watchers.delete(path);
    }

    /**
     * Classifies a raw watch event and queues it for the next flush.
     *
     * @param event - The `fs.watch` event name, either `rename` or `change`
     * @param path - Absolute path the event refers to
     *
     * @remarks
     * A symlink is stat-followed: when it resolves to a matching file, it is watched directly,
     * and when it resolves to a directory under a recursive watch, it is watched recursively.
     * A broken link is dropped.
     * The change type is read from that followed `stat` - a missing entry is {@link ChangeCode.Deleted} and closes its
     * watcher, an entry whose `birthtime` equals its `mtime` is {@link ChangeCode.Added},
     * and anything else is {@link ChangeCode.Change}.
     * Only paths that pass the filter arm the debounced timer and enter the pending batch.
     *
     * @since 3.0.0
     */

    private watcherEvent(event: string, path: string): void {
        const relativePath = relative(this.base, path);
        const link = lstatSync(path, { throwIfNoEntry: false });
        const stats = link?.isSymbolicLink() ? statSync(path, { throwIfNoEntry: false }) : link;

        if (link?.isSymbolicLink()) {
            if (!stats) return;
            if (event === 'rename') this.watcherClose(path);

            if (stats.isFile() && this.matcher(path)) this.watch(path);
            else if (stats.isDirectory() && this.options?.recursive)
                this.watch(path, this.ignored.bind(this), true);
        }

        if (!this.matcher(relativePath)) return;
        if (this.timer) this.timer.refresh();
        else this.timer = setTimeout(this.flush.bind(this), this.debounce);

        let type: ChangeType;
        if (!stats) {
            this.watcherClose(path);
            type = ChangeCode.Deleted;
        } else {
            type = stats.birthtimeMs === stats.mtimeMs ? ChangeCode.Added : ChangeCode.Change;
        }

        this.pending.set(relativePath, { type, stats });
    }

    /**
     * Opens an `fs.watch` on a path and registers its change and error handlers.
     *
     * @param path - Path to watch, ignored if already watched or filtered out by {@link ignored}
     * @param ignore - Optional per-entry ignore predicate forwarded to `fs.watch`
     * @param recursive - Whether the watch should cover nested entries
     *
     * @remarks
     * The watch is opened on the real (symlink-resolved) path, while events are reported against the original `path`.
     * A watcher error closes the watcher and forwards the error to every subscriber.
     *
     * @since 3.0.0
     */

    private watch(path: string, ignore?: (filename: string) => boolean, recursive: boolean = false): void {
        if (this.watchers.has(path) || this.ignored(path)) return;
        const watcher = watch(realpathSync(path), { recursive, ignore }, (event, filename) => {
            if (!filename) return;
            const target = path.includes(filename) ? path : join(path, filename);
            this.watcherEvent(event, target);
        });

        watcher.on('error', (error: Error) => {
            this.watcherClose(path);
            this.error(error);
        });

        this.watchers.set(path, watcher);
    }

    /**
     * Whether a path should be skipped by the watcher.
     *
     * @param target - Path to test
     * @returns `true` for an empty path, a `~` backup file, or - unless `dot` is set - any dot-prefixed segment
     *
     * @since 3.0.0
     */

    private ignored(target: string): boolean {
        if (!target || target.endsWith('~')) return true;
        if (!this.options?.dot) {
            if (target && target.split(/[/\\]/).some(
                seg => seg.startsWith('.'))
            ) return true;
        }

        return false;
    }

    /**
     * Walks the tree under a root and watches every symbolic link found.
     *
     * @param root - Directory to scan for links
     *
     * @remarks
     * Iterative and single-level per read, so ignored directories are pruned before entry and never fully materialized.
     * Descends into real subdirectories only when recursion is enabled.
     * Unreadable directories are skipped silently.
     *
     * @since 3.0.0
     */

    private watchSymlinks(root: string): void {
        const stack: Array<string> = [ root ];

        while (stack.length) {
            const dir = stack.pop()!;

            let entries: Array<Dirent>;
            try {
                entries = readdirSync(dir, { withFileTypes: true });
            } catch {
                continue;
            }

            for (const entry of entries) {
                const full = join(entry.parentPath ?? dir, entry.name);
                if (this.ignored(full)) continue;

                if (entry.isSymbolicLink()) {
                    this.watch(full, this.ignored.bind(this), this.options?.recursive);
                } else if (this.options?.recursive && entry.isDirectory()) {
                    stack.push(full);
                }
            }
        }
    }
}
