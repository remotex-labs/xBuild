/**
 * Import will remove at compile time
 */

import type { FunctionLikeType } from '@interfaces/function.interface';

/**
 * Imports
 */

import { stat, watch } from 'fs/promises';
import { join, normalize } from 'path/posix';
import { inject } from '@symlinks/symlinks.module';
import { FrameworkService } from '@services/framework.service';
import { compilePatterns, matchesAny } from '@components/glob.component';

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
     * Compiled regular expressions for file exclusion.
     *
     * @remarks
     * These patterns are derived from the user's configuration (`config.exclude`) and
     * are used to ignore files or directories when scanning for test files or
     * tracking dependencies.
     *
     * @since 2.0.0
     */

    private readonly excludes: Array<RegExp>;

    /**
     * Initializes a new {@link WatchService} instance.
     *
     * @param excludes - Optional list of patterns to exclude from watching.
     *
     * @see compilePatterns
     * @since 2.0.0
     */

    constructor(excludes: Array<string | RegExp> = []) {
        this.excludes = compilePatterns(excludes);
    }

    /**
     * Start the file watcher.
     *
     * @param callback - Function to call with the changed file paths.
     * Expects a {@link FunctionLikeType} that accepts an array of string arrays.
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
     * @see FunctionLikeType
     * @see handleChangedFiles
     *
     * @since 2.0.0
     */

    async start(callback: FunctionLikeType<void, Array<string[]>>): Promise<void> {
        const changedFilesSet = new Set<string>();
        const watcher = watch(this.framework.rootPath, { recursive: true });
        for await (const { filename } of watcher) {
            if (!filename) continue;

            const fullPath = normalize(filename);
            if (fullPath.endsWith('~')) continue;
            if (matchesAny(fullPath, this.excludes)) continue;

            // Check if the path is a file (not a directory)
            const absolutePath = join(this.framework.rootPath, fullPath);
            try {
                const stats = await stat(absolutePath);
                if (!stats.isFile()) continue;
            } catch {
                // File might have been deleted or doesn't exist yet
                // Skip if we can't `stat` it
                continue;
            }

            changedFilesSet.add(fullPath);
            this.debounce(() => this.handleChangedFiles(callback, changedFilesSet));
        }
    }

    /**
     * Handles the changed files after debouncing.
     *
     * @param callback - Function to call with the changed file paths. Expects a {@link FunctionLikeType} that accepts an array of string arrays.
     * @param changedFilesSet - Set of changed file paths containing normalized paths of modified files.
     *
     * @remarks
     * Executes the callback with a copy of the changed files and then clears the set
     * for the next batch of changes.
     *
     * @see start
     * @see debounce
     * @see FunctionLikeType
     *
     * @since 2.0.0
     */

    private async handleChangedFiles(callback: FunctionLikeType<void, Array<string[]>>, changedFilesSet: Set<string>): Promise<void> {
        callback?.([ ...changedFilesSet ]);
        changedFilesSet.clear();
    }

    /**
     * Debounce the execution of a function to limit how frequently it runs.
     *
     * @param fn - The function to execute after the debounce delay.
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
