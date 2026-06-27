/**
 * Imports
 */

import { matchesGlob } from 'path';
import { stat, watch } from 'fs/promises';
import { inject } from '@services/symlinks.service';
import { normalize, join } from '@remotex-labs/xmap';
import { FrameworkService } from '@services/framework.service';

/**
 * Watches the framework's root directory and emits files as they change.
 *
 * @remarks
 * Sets up a recursive watcher, filters paths through the include and exclude globs,
 * and debounces bursts of filesystem events so the callback receives one batch per quiet period.
 *
 * @example
 * ```ts
 * const watcher = new WatchService(['**\/node_modules\/**']);
 * await watcher.start((changedFiles) => {
 *   console.log('Changed files:', changedFiles);
 * });
 * ```
 *
 * @see FrameworkService
 * @since 2.0.0
 */

export class WatchService {
    /**
     * Glob patterns whose matches are excluded from emission.
     *
     * @remarks
     * Patterns use Node.js native glob semantics via {@link matchesGlob}.
     * Negation syntax (`!pattern`) is not supported and must be expressed through explicit include and exclude lists.
     *
     * @since 2.0.0
     */

    readonly excludes: Array<string>;

    /**
     * Glob patterns that allow a path to be emitted.
     *
     * @remarks
     * A path must match at least one include pattern to be eligible.
     * Defaults to `['**\/*']`, so every path is eligible unless an exclude pattern removes it.
     *
     * @since 2.0.0
     */

    readonly include: Array<string>;

    /**
     * Timer handle used to debounce file change events.
     *
     * @remarks
     * Coalesces changes that arrive in quick succession into a single {@link handleChangedFiles} call after a short delay.
     *
     * @since 2.0.0
     */

    private debounceTimer: NodeJS.Timeout | null = null;

    /**
     * Reference to the core {@link FrameworkService}.
     *
     * @remarks
     * Injected via {@link inject}, this provides the project root path against which watched files are resolved.
     *
     * @see inject
     * @see FrameworkService
     *
     * @since 2.0.0
     */

    private readonly framework: FrameworkService = inject(FrameworkService);

    /**
     * Creates a new {@link WatchService}.
     *
     * @param excludes - Glob patterns to ignore. Defaults to none.
     * @param include - Glob patterns to allow. Defaults to `['**\/*']`.
     *
     * @remarks
     * A path is emitted when it matches an include pattern and no exclude pattern.
     *
     * @since 2.0.0
     */

    constructor(excludes: Array<string> = [], include: Array<string> = [ '**/*' ]) {
        this.include = include;
        this.excludes = excludes;
    }

    /**
     * Starts watching the framework root and reports changed files to the callback.
     *
     * @param callback - Receives the batch of changed file paths once events settle.
     * @returns A promise that resolves when the watcher is closed.
     *
     * @remarks
     * For each filesystem event the path is normalized, then dropped if it is already queued in the current debounced
     * window, excluded by a pattern, or not matched by any include pattern.
     * Surviving paths that resolve to a file are queued and flushed to the callback once the events settle.
     * A path whose `stat` fails is treated as deleted and still emitted.
     *
     * @example
     * ```ts
     * const watcher = new WatchService();
     * await watcher.start((changedFiles) => {
     *   console.log('Files changed:', changedFiles);
     * });
     * ```
     *
     * @see handleChangedFiles
     *
     * @since 2.0.0
     */

    async start(callback: (files: Array<string>) => void): Promise<void> {
        const rootPath = this.framework.rootPath;
        const changedFilesSet = new Set<string>();
        const watcher = watch(rootPath, { recursive: true });

        for await (const { filename } of watcher) {
            if (!filename) continue;

            const fullPath = normalize(filename);
            if (fullPath.endsWith('~')) continue;

            if (changedFilesSet.has(fullPath)) {
                this.debounce(() => this.handleChangedFiles(callback, changedFilesSet));
                continue;
            }

            if (this.excludes.some((pattern) => matchesGlob(fullPath, pattern))) continue;
            if (!this.include.some((pattern) => matchesGlob(fullPath, pattern))) continue;

            try {
                if (!(await stat(join(rootPath, fullPath))).isFile()) continue;
            } catch {
                /* deleted or not yet readable - emit anyway */
            }

            changedFilesSet.add(fullPath);
            this.debounce(() => this.handleChangedFiles(callback, changedFilesSet));
        }
    }

    /**
     * Flushes the queued changes to the callback.
     *
     * @param callback - Receives the batch of changed file paths.
     * @param changedFilesSet - Normalized paths accumulated since the last flush.
     *
     * @remarks
     * Passes a snapshot of the queued paths to the callback, then clears the set for the next batch.
     *
     * @see start
     * @see debounce
     *
     * @since 2.0.0
     */

    private handleChangedFiles(callback: (files: Array<string>) => void, changedFilesSet: Set<string>): void {
        callback([ ...changedFilesSet ]);
        changedFilesSet.clear();
    }

    /**
     * Defers a function until no further calls arrive within the delay.
     *
     * @param fn - The function to run once the delay elapses.
     * @param delay - Debounce delay in milliseconds. Defaults to `150`.
     *
     * @remarks
     * Each call cancels the pending timer and starts a new one, so only the last call in a burst runs.
     *
     * @see debounceTimer
     * @see handleChangedFiles
     *
     * @since 2.0.0
     */

    private debounce(fn: () => void, delay = 150): void {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(fn, delay);
    }
}
