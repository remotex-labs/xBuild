/**
 * Import will remove at compile time
 */

import type { IScriptSnapshot } from 'typescript';

/**
 * Represents the cached state of a single file for incremental TypeScript processing.
 *
 * Stores the modification timestamp, a version counter that increments on every meaningful change,
 * and an optional TypeScript `ScriptSnapshot` containing the file content in a memory-efficient form.
 *
 * Used by language services and build tools to quickly determine whether a file needs to be reparsed.
 *
 * @since 2.0.0
 */

export interface FileSnapshotInterface {
    /**
     * Last known modification time of the file in milliseconds since epoch.
     *
     * Set to `0` when the file no longer exists or cannot be accessed.
     *
     * @remarks
     * Compared directly against `fs.stat().mtimeMs` to detect changes without reading content.
     *
     * @since 2.0.0
     */

    mtimeMs: number;

    /**
     * Monotonically increasing integer that changes whenever the file content or accessibility status changes.
     *
     * Used by TypeScript language services as the script version identifier.
     *
     * @remarks
     * - Incremented on every successful content read with changed mtime
     * - Incremented when a file becomes unreadable (if it previously had content or version bigger than 0)
     * - Not incremented on no-op accesses (unchanged mtime)
     *
     * @example
     * ```ts
     * // Typical usage in LanguageServiceHost
     * getScriptVersion(fileName: string): string {
     *   const snapshot = cache.touchFile(fileName);
     *   return String(snapshot.version);
     * }
     * ```
     *
     * @since 2.0.0
     */

    version: number;

    /**
     * TypeScript script snapshot containing the file's source text, or `undefined` if the file is missing,
     * empty, or inaccessible.
     *
     * @remarks
     * - Created via `ts.ScriptSnapshot.fromString(content)`
     * - Kept `undefined` for zero-length or non-readable files to save memory
     * - Consumers should check existence before calling methods like `getText()`
     *
     * @see {@link https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API#script-snapshot | TypeScript Compiler API – Script Snapshots}
     *
     * @since 2.0.0
     */

    contentSnapshot: IScriptSnapshot | undefined;
}
