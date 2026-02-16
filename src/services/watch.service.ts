/**
 * Imports
 */

import { matchesGlob } from 'path';
import { stat, watch } from 'fs/promises';
import { inject } from '@symlinks/symlinks.module';
import { normalize, join } from '@components/path.component';
import { FrameworkService } from '@services/framework.service';

/**
 * Provides a file-watching service that tracks changes in the framework's root directory.
 *
 * @remarks
 * This service sets up a recursive file system watcher, filters excluded files,
 * and debounces changes to optimize performance. It is mainly used for monitoring
 * source files or test files and triggering callbacks on changes.
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
     * Glob patterns that **exclude** paths from being emitted.
     *
     * @remarks
     * Patterns use **Node.js native glob semantics** via `matchesGlob`.
     * Negation syntax (`!pattern`) is **not supported** and must be expressed
     * through explicit include/exclude separation.
     *
     * Typical examples:
     *
     * - `**\/node_modules\/**`
     * - `**\/dist\/**`
     * - `**\/*.spec.ts`
     *
     * @since 2.0.0
     */

    readonly excludes: Array<string>;

    /**
     * Glob patterns that **allow** paths to be emitted.
     *
     * @remarks
     * A file must match **at least one** an include pattern to be considered.
     * Defaults to `['**\/*']`, meaning all files are eligible unless excluded.
     *
     * @since 2.0.0
     */

    readonly include: Array<string>;


    /**
     * Timer used for debouncing file change events.
     *
     * @remarks
     * When multiple file changes occur in quick succession, this timer ensures that
     * the `handleChangedFiles` method is called only once after a short delay,
     * preventing redundant executions and improving performance.
     *
     * @since 2.0.0
     */

    private debounceTimer: NodeJS.Timeout | null = null;

    /**
     * Reference to the core {@link FrameworkService}.
     *
     * @remarks
     * Injected via the {@link inject} helper, this service provides access to
     * framework-level configuration such as the project root path, runtime
     * environment, and shared utilities.
     * It is used here for resolving relative paths and coordinating with the
     * broader testing infrastructure.
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
     * @param excludes - Glob patterns to ignore.
     * @param include - Glob patterns to allow. Defaults to `['**\/*']`.
     *
     * @remarks
     * Include and exclude rules are evaluated as:
     *
     * ```
     * included AND NOT excluded
     * ```
     *
     * @since 2.0.0
     */

    constructor(excludes: Array<string> = [], include: Array<string> = [ '**/*' ]) {
        this.include = include;
        this.excludes = excludes;
    }

    /**
     * Start the file watcher.
     *
     * @param callback - Function to call with the changed file paths.
     * Expects a callback that accepts an array of files.
     * @returns A promise that resolves when the watcher is ready.
     *
     * @remarks
     * This method performs the following steps:
     * 1. Sets up a recursive file system watcher on the framework's root directory.
     * 2. On file changes, normalizes paths, filters excluded files, and schedules
     *    handling of changed files with a debouncing to avoid excessive executions.
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
        const changedFilesSet = new Set<string>();
        const watcher = watch(this.framework.rootPath, { recursive: true });
        for await (const { filename } of watcher) {
            if (!filename) continue;

            const fullPath = normalize(filename);
            if (fullPath.endsWith('~')) continue;

            if (!this.include.some((pattern) => matchesGlob(fullPath, pattern))) continue;
            if (this.excludes.some((pattern) => matchesGlob(fullPath, pattern))) continue;

            // Check if the path is a file (not a directory)
            const absolutePath = join(this.framework.rootPath, fullPath);
            try {
                const stats = await stat(absolutePath);
                if (!stats.isFile()) continue;
            } catch {
                // File might have been deleted or doesn't exist yet
            }

            changedFilesSet.add(fullPath);
            this.debounce(() => this.handleChangedFiles(callback, changedFilesSet));
        }
    }

    /**
     * Handles the changed files after debouncing.
     *
     * @param callback - Function to call with the changed file paths. Expects a callback that accepts an array of files.
     * @param changedFilesSet - Set of changed file paths containing normalized paths of modified files.
     *
     * @remarks
     * Executes the callback with a copy of the changed files and then clears the set
     * for the next batch of changes.
     *
     * @see start
     * @see debounce
     *
     * @since 2.0.0
     */

    private async handleChangedFiles(callback: (files: Array<string>) => void, changedFilesSet: Set<string>): Promise<void> {
        callback?.([ ...changedFilesSet ]);
        changedFilesSet.clear();
    }

    /**
     * Debounce the execution of a function to limit how frequently it runs.
     *
     * @param fn - The function to execute after the debounced delay.
     * @param delay - Optional debounce delay in milliseconds (default is 150 ms).
     *
     * @remarks
     * If multiple calls are made within the delay period, only the last one will execute.
     * This is used in the file watcher to prevent excessive calls to handle file changes
     * when multiple filesystem events occur in quick succession.
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
