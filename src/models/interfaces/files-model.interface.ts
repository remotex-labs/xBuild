/**
 * The content of one cached file.
 *
 * @remarks
 * Held as an object rather than a bare string,
 * so a missing file is told apart from an empty one by the snapshot being absent rather than by its text.
 *
 * @example
 * ```ts
 * const snapshot = model.touch('src/index.ts').snapshot;
 *
 * snapshot?.text; // 'export const answer = 42;'
 * ```
 *
 * @see FileSnapshotInterface
 * @since 3.2.0
 */

export type ScriptSnapshotType = { text: string };

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
     * The compiler is told a file changed only when this number moves,
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
     * so the compiler can be told that a file it once parsed is gone.
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
