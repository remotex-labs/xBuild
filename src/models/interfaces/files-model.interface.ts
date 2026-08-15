/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { IScriptSnapshot } from 'typescript';

/**
 * A TypeScript script snapshot that also carries its source text.
 *
 * @remarks
 * `IScriptSnapshot` only hands out content through `getText`, which slices a new string on every call.
 * The added `text` property keeps the content the snapshot was built from, so a cache can read it back as it is.
 *
 * @example
 * ```ts
 * const snapshot = model.touch('src/index.ts').snapshot;
 *
 * snapshot?.text;          // 'export const answer = 42;'
 * snapshot?.getLength();   // 25
 * snapshot?.getText(0, 6); // 'export'
 * ```
 *
 * @see FileSnapshotInterface
 * @since 2.0.0
 */

export type ScriptSnapshotType = IScriptSnapshot & { text: string };

/**
 * Cached state of one tracked file.
 *
 * @remarks
 * An entry is replaced as a whole whenever the file changes,
 * so an entry handed out earlier keeps the values it was read with.
 *
 * @example
 * ```ts
 * const entry = model.touch('src/index.ts');
 *
 * entry.version;        // 1
 * entry.snapshot?.text; // 'export const answer = 42;'
 * ```
 *
 * @see ScriptSnapshotType
 * @since 2.0.0
 */

export interface FileSnapshotInterface {
    /**
     * Modification time the content was read at, in milliseconds since the epoch.
     *
     * @remarks
     * Compared against the time reported by a fresh `stat` to decide whether the file has to be read again.
     * A path that carries no readable file holds `0`.
     *
     * @example
     * ```ts
     * model.touch('src/index.ts').mtimeMs; // 1754000000000
     * model.touch('missing.ts').mtimeMs;   // 0
     * ```
     *
     * @since 2.0.0
     */

    mtimeMs: number;

    /**
     * Counter that moves up every time the entry is rebuilt.
     *
     * @remarks
     * The language service asks for this on every request and reparses the file only when the number changed,
     * so it stands still for as long as the modification time does.
     * A file that disappears counts as a change and moves the counter too.
     *
     * @example
     * ```ts
     * model.touch('src/index.ts').version;   // 1
     * model.refresh('src/index.ts').version; // 1 - unchanged on disk
     * model.refresh('src/index.ts').version; // 2 - the file was written to
     * ```
     *
     * @since 2.0.0
     */

    version: number;

    /**
     * Content of the file, or `undefined` when the path carries no readable file.
     *
     * @remarks
     * A missing path is tracked with an empty snapshot rather than left out of the cache,
     * so the language service can be told that a file it once parsed is gone.
     *
     * @example
     * ```ts
     * model.touch('src/index.ts').snapshot?.text; // 'export const answer = 42;'
     * model.touch('missing.ts').snapshot;         // undefined
     * ```
     *
     * @see ScriptSnapshotType
     * @since 3.0.0
     */

    snapshot: ScriptSnapshotType | undefined;
}
