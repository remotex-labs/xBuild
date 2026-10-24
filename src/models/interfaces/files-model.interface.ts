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
 * entry.version; // 1
 * entry.text;    // 'export const answer = 42;'
 * ```
 *
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
     * A missing path is tracked without text rather than left out of the cache,
     * so the compiler can be told that a file it once parsed is gone.
     * An empty file holds an empty string, which is what tells it apart from a missing one.
     *
     * @example
     * ```ts
     * model.touch('src/index.ts').text; // 'export const answer = 42;'
     * model.touch('missing.ts').text;   // undefined
     * ```
     *
     * @since 3.2.0
     */

    text: string | undefined;
}
