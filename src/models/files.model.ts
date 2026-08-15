/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { Stats } from 'fs';
import type { TextChangeRange } from 'typescript';
import type { FileSnapshotInterface, ScriptSnapshotType } from './interfaces/files-model.interface';

/**
 * Imports
 */

import { readFileSync, statSync } from 'fs';
import { resolve } from '@remotex-labs/xmap';
import { Injectable } from '@remotex-labs/xinject';

/**
 * In-memory cache of file contents keyed by resolved absolute path.
 *
 * @remarks
 * Backs the TypeScript language service, which asks for a script version on every request and only reparses when
 * that version changes.
 * Content is read once and re-read only when the modification time moves,
 * so repeated lookups of an unchanged file cost a map read.
 * Reach for {@link touch} when any cached content will do,
 * {@link refresh} when the file may have changed on disk or when a watcher already carries its `Stats`,
 * and {@link refreshAll} to catch what the watcher failed to report.
 *
 * @example
 * ```ts
 * const model = inject(FilesModel);
 *
 * model.touch('src/index.ts').version;   // 1 - read from disk
 * model.touch('src/index.ts').version;   // 1 - served from the cache
 * model.refresh('src/index.ts').version; // 2 - the file changed on disk
 * model.clear();                         // every entry dropped
 * ```
 *
 * @see FileSnapshotInterface
 * @since 2.0.0
 */

@Injectable({
    scope: 'singleton'
})
export class FilesModel {
    /**
     * Memoized mapping from an input path to its resolved absolute form.
     *
     * @remarks
     * Kept apart from {@link cache} because several input paths can resolve to the same absolute path,
     * and resolution is repeated far more often than content changes.
     *
     * @since 3.0.0
     */

    private readonly resolved = new Map<string, string>();

    /**
     * Entries keyed by resolved absolute path.
     *
     * @remarks
     * Holds one {@link FileSnapshotInterface} per tracked path, including paths that carry no readable file.
     *
     * @since 3.0.0
     */

    private readonly cache = new Map<string, FileSnapshotInterface>();

    /**
     * Drops every cached entry and every memoized path.
     *
     * @remarks
     * Leaves the model in its initial state, so the next request re-reads from disk and restarts versions at `1`.
     *
     * @example
     * ```ts
     * model.touch('src/index.ts');
     * model.clear();
     * model.getSnapshot('src/index.ts'); // undefined
     * ```
     *
     * @since 2.0.0
     */

    clear(): void {
        this.cache.clear();
        this.resolved.clear();
    }

    /**
     * Returns the cached entry for a path without touching the filesystem.
     *
     * @param path - Filesystem path, relative or absolute
     * @returns The cached entry, or `undefined` when the path was never tracked
     *
     * @remarks
     * A pure cache read: it never reads or stats the file, so an untracked path stays untracked.
     * Use {@link touch} to track the path instead.
     *
     * @example
     * ```ts
     * model.getSnapshot('src/index.ts'); // undefined - never tracked
     * model.touch('src/index.ts');
     * model.getSnapshot('src/index.ts'); // { mtimeMs: 1754000000000, version: 1, snapshot: { ... } }
     * ```
     *
     * @see touch
     * @since 2.0.0
     */

    getSnapshot(path: string): FileSnapshotInterface | undefined {
        return this.cache.get(this.resolve(path));
    }

    /**
     * Returns the entry for a path, reading the file when it is not tracked yet.
     *
     * @param path - Filesystem path, relative or absolute
     * @param encoding - Encoding used when the file is read, defaulting to `utf-8`
     * @returns The entry for the path, cached or newly created
     *
     * @remarks
     * A tracked path is returned as it stands, without a `stat` call, however stale it may be.
     * Use {@link refresh} when the file may have changed since it was cached.
     *
     * @example
     * ```ts
     * model.touch('src/index.ts').version; // 1 - read from disk
     * model.touch('src/index.ts').version; // 1 - served from the cache, no stat
     * ```
     *
     * @see refresh
     * @since 3.0.0
     */

    touch(path: string, encoding?: BufferEncoding): FileSnapshotInterface {
        const target = this.resolve(path);

        return this.cache.get(target) ?? this.sync(target, this.stat(target), encoding);
    }

    /**
     * Synchronizes a path with the filesystem and returns its entry.
     *
     * @param path - Filesystem path, relative or absolute
     * @param stats - Already obtained `Stats` for the path, sparing a `stat` call
     * @param encoding - Encoding used when the file is read, defaulting to `utf-8`
     * @returns The entry for the path, rebuilt only when the file actually changed
     *
     * @remarks
     * The content is re-read when the modification time differs from the cached one,
     * so calling this on an unchanged file leaves its version intact.
     * A path that is missing or is not a regular file yields an entry with an `undefined` snapshot.
     *
     * @example
     * ```ts
     * model.touch('src/index.ts').version;   // 1
     * model.refresh('src/index.ts').version; // 1 - mtime unchanged
     * model.refresh('src/index.ts').version; // 2 - the file was written to
     * ```
     *
     * @see touch
     * @since 3.0.0
     */

    refresh(path: string, stats?: Stats, encoding?: BufferEncoding): FileSnapshotInterface {
        const target = this.resolve(path);

        return this.sync(target, stats ?? this.stat(target), encoding);
    }

    /**
     * Synchronizes a set of paths, or every path already tracked.
     *
     * @param paths - Paths to synchronize, defaulting to everything in the cache
     *
     * @remarks
     * The safety net under file watching: a change that goes unreported leaves an entry stale with nothing to
     * announce it - the version never moves,
     * so the language service is never told to reparse, and the build keeps compiling text that is no longer on disk.
     * Sweeping asks the filesystem rather than the watcher,
     * so a missed event costs a needless rebuild at worst rather than a wrong one.
     * Every path gets a `stat`, and only the ones whose time moved are read again.
     * The keys it walks are already resolved,
     * so re-synchronizing them writes back over the same keys and cannot extend the walk.
     * A tracked path that is still missing keeps the entry and the version it had,
     * so repeated sweeps do not inflate the versions of files that were deleted.
     *
     * @example
     * ```ts
     * model.refreshAll([ 'src/index.ts' ]); // that one path
     * model.refreshAll();                   // every tracked path, re-read where it changed
     * ```
     *
     * @see refresh
     * @since 3.0.0
     */

    refreshAll(paths?: Array<string>): void {
        const pathList = paths ?? this.cache.keys();
        for (const path of pathList) {
            this.refresh(path);
        }
    }

    /**
     * Normalizes a path to its absolute form.
     *
     * @param path - Filesystem path, relative or absolute
     * @returns Absolute path with forward slashes
     *
     * @remarks
     * The result is memoized per input string, since the same paths are resolved on every cache lookup.
     *
     * @example
     * ```ts
     * model.resolve('src/index.ts'); // 'D:/project/src/index.ts'
     * ```
     *
     * @since 2.0.0
     */

    resolve(path: string): string {
        let target = this.resolved.get(path);
        if (target === undefined) this.resolved.set(path, target = resolve(path));

        return target;
    }

    /**
     * Brings the entry for a resolved path in line with the given filesystem state.
     *
     * @param target - Resolved absolute path
     * @param info - `Stats` for the path, or `undefined` when it does not exist
     * @param encoding - Encoding used when the file is read, defaulting to `utf-8`
     * @returns The entry for the path, reused when nothing changed
     *
     * @remarks
     * A path that is not a regular file keeps its already empty entry untouched,
     * so repeated events for a missing path do not inflate its version.
     * A file whose modification time matches the cached one is left as is, and the content is not read.
     *
     * @since 3.0.0
     */

    private sync(target: string, info: Stats | undefined, encoding: BufferEncoding = 'utf-8'): FileSnapshotInterface {
        const entry = this.cache.get(target);

        if (!info?.isFile()) {
            if (entry && !entry.snapshot) return entry;

            return this.store(target, { mtimeMs: 0, snapshot: undefined, version: (entry?.version ?? 0) + 1 });
        }

        if (entry?.mtimeMs === info.mtimeMs) return entry;

        return this.store(target, {
            mtimeMs: info.mtimeMs,
            version: (entry?.version ?? 0) + 1,
            snapshot: this.snapshot(readFileSync(target, encoding))
        });
    }

    /**
     * Computes the span that differs between two versions of a text.
     *
     * @param oldText - Text the language service last parsed
     * @param newText - Text that replaces it
     * @returns The replaced span in `oldText` together with the length of its replacement
     *
     * @remarks
     * Narrows the change by trimming the shared prefix and the shared suffix,
     * which lets the language service reuse the untouched parts of the syntax tree.
     * The suffix scan stops at the prefix boundary, so the two never overlap on a text that shrank.
     *
     * @since 3.0.0
     */

    private changeRange(oldText: string, newText: string): TextChangeRange {
        const oldLength = oldText.length;
        const newLength = newText.length;
        const max = Math.min(oldLength, newLength);

        let prefix = 0;
        while (prefix < max && oldText.charCodeAt(prefix) === newText.charCodeAt(prefix)) prefix++;

        let suffix = 0;
        while (suffix < max - prefix && oldText.charCodeAt(oldLength - 1 - suffix) === newText.charCodeAt(newLength - 1 - suffix)) suffix++;

        return {
            span: { start: prefix, length: oldLength - prefix - suffix },
            newLength: newLength - prefix - suffix
        };
    }

    /**
     * Wraps file content in a script snapshot.
     *
     * @param text - Content read from disk
     * @returns A snapshot exposing the content both as `text` and through the `IScriptSnapshot` methods
     *
     * @remarks
     * `getChangeRange` closes over this text as the new version and delegates to {@link changeRange},
     * so the language service can diff against any earlier snapshot it still holds.
     *
     * @since 3.0.0
     */

    private snapshot(text: string): ScriptSnapshotType {
        return {
            text,
            getText: (start, end): string => text.slice(start, end),
            getLength: (): number => text.length,
            getChangeRange: (previous):
                TextChangeRange => this.changeRange(previous.getText(0, previous.getLength()), text)
        };
    }

    /**
     * Writes an entry to the cache and hands it back.
     *
     * @param target - Resolved absolute path
     * @param entry - Entry to store under that path
     * @returns The stored entry
     *
     * @remarks
     * Exists so {@link sync} can store and return in a single expression.
     *
     * @since 3.0.0
     */

    private store(target: string, entry: FileSnapshotInterface): FileSnapshotInterface {
        this.cache.set(target, entry);

        return entry;
    }

    /**
     * Reads the filesystem state of a path.
     *
     * @param path - Resolved absolute path
     * @returns The `Stats` for the path, or `undefined` when it does not exist
     *
     * @remarks
     * A missing path is an ordinary outcome here rather than a failure, so the throwing form is disabled.
     *
     * @since 3.0.0
     */

    private stat(path: string): Stats | undefined {
        return statSync(path, { throwIfNoEntry: false });
    }
}
