/**
 * Import will remove at compile time
 */

import type { FileSnapshotInterface, ScriptSnapshotType } from './interfaces/files-model.interface';

/**
 * Imports
 */

import ts from 'typescript';
import { resolve } from '@components/path.component';
import { Injectable } from '@symlinks/symlinks.module';
import { closeSync, fstatSync, openSync, readFileSync } from 'fs';

/**
 * In-memory cache that maintains lightweight snapshots of file contents (as TypeScript `IScriptSnapshot`)
 * together with modification time and version counters.
 *
 * Primarily used by language servers, transpiler, and incremental build systems to avoid unnecessary
 * file system reads and snapshot recreation when files have not changed.
 *
 * @since 2.0.0
 */

@Injectable({
    scope: 'singleton'
})
export class FilesModel {
    /**
     * Cache that maps original (possibly relative) paths → normalized absolute paths with forward slashes
     * @since 2.0.0
     */

    private readonly resolvedPathCache = new Map<string, string>();

    /**
     * Main storage: resolved absolute path → current file snapshot state
     * @since 2.0.0
     */

    private readonly snapshotsByPath = new Map<string, FileSnapshotInterface>();

    /**
     * Removes all cached paths and snapshots.
     * @since 2.0.0
     */

    clear(): void {
        this.snapshotsByPath.clear();
        this.resolvedPathCache.clear();
    }

    /**
     * Returns the current known snapshot state for the given file path, or `undefined`
     * if the file has never been touched/observed by this cache.
     *
     * @param path - filesystem path (relative or absolute)
     * @returns current snapshot data or `undefined` if not tracked yet
     *
     * @since 2.0.0
     */

    getSnapshot(path: string): FileSnapshotInterface | undefined {
        return this.snapshotsByPath.get(this.resolve(path));
    }

    /**
     * Returns an existing snapshot entry for the given file path, or creates/updates it if not tracked yet.
     *
     * @param path - Filesystem path (relative or absolute).
     * @returns The current snapshot entry for the file (existing or newly created).
     *
     * @remarks
     * This is a convenience method combining:
     * - {@link getSnapshot} (fast path when already tracked), and
     * - {@link touchFile} (tracks the file, reads content if needed, updates version/mtime).
     *
     * Use this when you need a snapshot entry and don't want to handle the `undefined` case.
     *
     * @see {@link touchFile}
     * @see {@link getSnapshot}
     *
     * @since 2.0.0
     */

    getOrTouchFile(path: string): FileSnapshotInterface {
        return this.snapshotsByPath.get(this.resolve(path)) ?? this.touchFile(path);
    }

    /**
     * Returns array containing all currently tracked resolved absolute paths.
     *
     * @returns list of normalized absolute paths (using forward slashes)
     *
     * @since 2.0.0
     */

    getTrackedFilePaths(): Array<string> {
        return [ ...this.snapshotsByPath.keys() ];
    }

    /**
     * Ensures the file is tracked and returns an up-to-date snapshot state.
     *
     * @param path - Filesystem path (relative or absolute)
     * @returns Shallow copy of the current (possibly just updated) snapshot entry
     *
     * @remarks
     * This method implements incremental file tracking with three possible outcomes:
     *
     * **Fast path (no changes):**
     * - mtime hasn't changed → returns existing state without I/O
     *
     * **Update path (file changed):**
     * - mtime changed or file is new → reads content and creates fresh `ScriptSnapshot`
     * - Increments version number for TypeScript language service invalidation
     *
     * **Error path (file unavailable):**
     * - File cannot be read (deleted/permission denied) → clears snapshot and bumps version
     * - Version increment only occurs if there was previous content (prevents silent no-ops)
     *
     * Always returns a shallow copy to prevent accidental mutation of internal state.
     *
     * Typically used in watch mode to notify TypeScript of file changes without full rebuilds.
     *
     * @example
     * ```ts
     * const snapshot = filesModel.touchFile('./src/index.ts');
     *
     * if (snapshot.contentSnapshot) {
     *   languageServiceHost.getScriptSnapshot = () => snapshot.contentSnapshot;
     *   languageServiceHost.getScriptVersion = () => String(snapshot.version);
     * }
     * ```
     *
     * @see {@link getSnapshot}
     * @see {@link FileSnapshotInterface}
     *
     * @since 2.0.0
     */

    touchFile(path: string): FileSnapshotInterface {
        const resolvedPath = this.resolve(path);
        const entry = this.snapshotsByPath.get(resolvedPath) ?? this.createEntry(resolvedPath);

        try {
            this.syncEntry(resolvedPath, entry);
        } catch {
            /**
             * Currently, the catch block only increments the version if the snapshot exists, otherwise silently ignores errors.
             * Suggestion: always increase the version if the file cannot be read, so TS will treat it as changed.
             */

            if(entry.contentSnapshot !== undefined || entry.version > 0) {
                entry.version++;
                entry.mtimeMs = 0;
                entry.contentSnapshot = undefined;
            }
        }

        return { ...entry };
    }

    /**
     * Normalizes the given path to an absolute path using forward slashes.
     * Results are cached to avoid repeated `path.resolve` + replace calls.
     *
     * @param path - any filesystem path
     * @returns normalized absolute path (always `/` separators)
     *
     * @since 2.0.0
     */

    resolve(path: string): string {
        const cached = this.resolvedPathCache.get(path);
        if (cached) return cached;

        const resolved = resolve(path);
        this.resolvedPathCache.set(path, resolved);

        return resolved;
    }

    /**
     * Creates a new snapshot entry for a resolved file path and registers it in the cache.
     *
     * @param resolvedPath - Normalized absolute file path
     * @returns A new {@link FileSnapshotInterface} with initial state (version 0, no content)
     *
     * @remarks
     * This method initializes a new file tracking entry with default values:
     * - `version`: 0 (will increment on first read)
     * - `mtimeMs`: 0 (will update on first sync)
     * - `contentSnapshot`: undefined (will populate on first sync)
     *
     * The entry is immediately added to {@link snapshotsByPath} to prevent duplicate creation.
     *
     * Called internally by {@link touchFile} when encountering a previously unseen file path.
     *
     * @since 2.1.5
     */

    private createEntry(resolvedPath: string): FileSnapshotInterface {
        const entry: FileSnapshotInterface = { version: 0, mtimeMs: 0, contentSnapshot: undefined };
        this.snapshotsByPath.set(resolvedPath, entry);

        return entry;
    }

    /**
     * Synchronizes a snapshot entry with the current file system state.
     *
     * @param resolvedPath - Normalized absolute path to the file
     * @param entry - The snapshot entry to update
     *
     * @remarks
     * This method performs efficient incremental updates:
     *
     * **Optimization check:**
     * - Compares current mtime with cached mtime
     * - Returns immediately if file hasn't changed (fast path)
     *
     * **Update logic:**
     * - Reads file content only when mtime differs
     * - Increments version for TypeScript invalidation
     * - Updates mtime to current value
     * - Creates TypeScript `ScriptSnapshot` from content
     *
     * **File descriptor handling:**
     * - Opens file in read mode (`'r'`)
     * - Ensures file descriptor closure via `finally` block
     * - Throws on read errors (handled by caller)
     *
     * Empty file content results in `undefined` snapshot rather than empty snapshot,
     * signaling that the file has no compilable content.
     *
     * @throws Will propagate file system errors (ENOENT, EACCES, etc.) to caller
     *
     * @since 2.1.5
     */

    private syncEntry(resolvedPath: string, entry: FileSnapshotInterface): void {
        const fd = openSync(resolvedPath, 'r');

        try {
            const { mtimeMs } = fstatSync(fd);
            if (mtimeMs === entry.mtimeMs) return;
            const content = readFileSync(fd, 'utf-8');

            entry.version++;
            entry.mtimeMs = mtimeMs;
            entry.contentSnapshot = content
                ? <ScriptSnapshotType> ts.ScriptSnapshot.fromString(content)
                : undefined;
        } finally {
            closeSync(fd);
        }
    }
}
