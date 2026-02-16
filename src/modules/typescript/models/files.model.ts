/**
 * Import will remove at compile time
 */

import type { FileSnapshotInterface, ScriptSnapshotType } from './interfaces/files-model.interface';

/**
 * Imports
 */

import ts from 'typescript';
import { readFileSync, statSync } from 'fs';
import { resolve } from '@components/path.component';
import { Injectable } from '@symlinks/symlinks.module';

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
     * - If mtime hasn't changed → returns existing state (fast path)
     * - If mtime changed or a file is new → reads content and creates fresh `ScriptSnapshot`
     * - If a file cannot be read (deleted / permission / etc.) → clears snapshot and bumps version
     *
     * @param path - filesystem path (relative or absolute)
     * @returns shallow copy of the current (possibly just updated) snapshot entry
     *
     * @remarks
     * Always returns a shallow copy to prevent accidental mutation of internal state.
     *
     * In case of I/O errors, the version is incremented only when there was meaningful
     * previous content or the entry was already versioned (prevents silent no-op).
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
        let entry = this.snapshotsByPath.get(resolvedPath);

        if (!entry) {
            entry = { version: 0, mtimeMs: 0, contentSnapshot: undefined };
            this.snapshotsByPath.set(resolvedPath, entry);
        }

        try {
            const stats = statSync(resolvedPath);
            const currentMtimeMs = stats.mtimeMs;
            if (currentMtimeMs === entry.mtimeMs) {
                return { ...entry };
            }

            const content = readFileSync(resolvedPath, 'utf-8');
            const newSnapshot = content ? <ScriptSnapshotType>ts.ScriptSnapshot.fromString(content) : undefined;

            entry.version++;
            entry.mtimeMs = currentMtimeMs;
            entry.contentSnapshot = newSnapshot;
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
}
