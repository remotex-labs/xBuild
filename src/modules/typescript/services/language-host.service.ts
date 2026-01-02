/**
 * Import will remove at compile time
 */

import type { CompilerOptions, IScriptSnapshot } from 'typescript';
import type { CacheStatsInterface, FileStateInterface } from './interfaces/language-host.interface';

/**
 * Imports
 */

import ts from 'typescript';
import { resolve } from 'path';
import { Injectable } from '@symlinks/symlinks.module';

/**
 * Provides a TypeScript language service host for managing source files and compilation.
 *
 * @remarks
 * The {@link LanguageHostService} acts as a bridge between the TypeScript compiler API
 * and the file system. It implements the necessary methods to provide TypeScript's
 * language service with information about files, directories, and compilation settings.
 *
 * Key responsibilities include:
 * - Tracking file versions for incremental compilation
 * - Caching resolved file paths for performance
 * - Providing file content snapshots to the language service
 * - Delegating file system operations to TypeScript's system interface
 *
 * This service is essential for implementing features like incremental type checking,
 * code analysis, and compilation in development tools.
 *
 * @example
 * ```ts
 * const compilerOptions: CompilerOptions = {
 *   target: ts.ScriptTarget.ES2020,
 *   module: ts.ModuleKind.ESNext
 * };
 *
 * const languageHost = new LanguageHostService(compilerOptions);
 * languageHost.touchFiles('src/index.ts');
 * const snapshot = languageHost.getScriptSnapshot('src/index.ts');
 * ```
 *
 * @see CompilerOptions
 * @since 2.0.0
 */

@Injectable({
    scope: 'singleton'
})
export class LanguageHostService {
    /**
     * Cache of resolved absolute file paths.
     *
     * @remarks
     * This cache improves performance by avoiding repeated path resolution operations.
     * Paths are resolved once and stored for further lookups.
     *
     * @see resolvePath
     * @since 2.0.0
     */

    private readonly resolvedPaths = new Map<string, string>();

    /**
     * Tracks state and version information for each file to support incremental compilation.
     *
     * @remarks
     * Maintains a {@link FileStateInterface} for each file, storing multiple version counters
     * that track different stages of the compilation pipeline. Each time a file is modified
     * (via {@link touchFiles}), its version number is incremented, triggering appropriate
     * cache invalidations and re-analysis.
     *
     * The state tracking enables the TypeScript language service to:
     * - Determine which files have changed and need reanalysis
     * - Avoid redundant diagnostic computation for unchanged files
     * - Validate snapshot cache freshness efficiently
     * - Coordinate incremental compilation across multiple version dimensions
     *
     * @see touchFiles
     * @see getScriptVersion
     * @see FileStateInterface
     *
     * @since 2.0.0
     */

    private readonly fileStates = new Map<string, FileStateInterface>();

    /**
     * Cache of script snapshots for improved performance.
     *
     * @remarks
     * This cache stores {@link IScriptSnapshot} instances keyed by file path to avoid
     * repeatedly reading and parsing the same file content. Snapshots are immutable
     * representations of file content at a specific point in time, used by the
     * TypeScript language service for analysis.
     *
     * The cache improves performance by:
     * - Reducing file system I/O operations
     * - Avoiding redundant snapshot creation for unchanged files
     * - Enabling faster incremental compilation
     *
     * Cache validation is performed by comparing snapshot versions stored in
     * {@link fileStates} against the current file version. When the cached snapshot's
     * version matches the file's current version, the snapshot is reused; otherwise,
     * the file is re-read from disk, and a new snapshot is created.
     *
     * Cached snapshots should be invalidated when files are modified, typically
     * by calling {@link touchFiles} to increment the file version in {@link fileStates}.
     * The cache can be inspected using {@link reportStats} for monitoring memory usage.
     *
     * @see touchFiles
     * @see reportStats
     * @see IScriptSnapshot
     * @see getScriptSnapshot
     * @see FileStateInterface
     *
     * @since 2.0.0
     */

    private readonly snapshotCache = new Map<string, IScriptSnapshot>();

    /**
     * Reference to TypeScript's system interface for file operations.
     *
     * @remarks
     * This property provides access to platform-specific file system operations
     * such as reading files, checking file existence, and listing directories.
     * It delegates to TypeScript's built-in system implementation.
     *
     * @since 2.0.0
     */

    private readonly sys = ts.sys;

    /**
     * Initializes a new {@link LanguageHostService} instance.
     *
     * @param options - TypeScript compiler options to use for compilation.
     *
     * @remarks
     * The provided compiler options determine how TypeScript analyzes and
     * compiles source files. Common options include target ECMAScript version,
     * module system, and strictness settings.
     *
     * @example
     * ```ts
     * const host = new LanguageHostService({
     *   target: ts.ScriptTarget.ES2020,
     *   module: ts.ModuleKind.ESNext,
     *   strict: true
     * });
     * ```
     *
     * @see CompilerOptions
     * @since 2.0.0
     */

    constructor(private options: CompilerOptions = {}) {
    }

    /**
     * Retrieves statistics about the current state of internal caches.
     *
     * @returns A {@link CacheStatsInterface} object containing cache metrics.
     *
     * @remarks
     * This method provides insights into the performance and memory usage of the
     * {@link LanguageHostService}. The returned statistics include:
     *
     * - `trackedFiles`: Number of files being tracked for version changes
     * - `pathCacheSize`: Number of resolved paths cached in memory
     * - `snapshotCacheSize`: Number of script snapshots stored in the cache
     *
     * These metrics are useful for:
     * - Monitoring memory usage in large projects
     * - Debugging cache behavior and performance issues
     * - Understanding the overhead of file tracking
     * - Optimizing cache invalidation strategies
     *
     * @example
     * ```ts
     * const languageHost = new LanguageHostService(compilerOptions);
     * languageHost.touchFiles('src/index.ts');
     *
     * const stats = languageHost.getCacheStats();
     * console.log(`Tracking ${stats.trackedFiles} files`);
     * console.log(`Path cache: ${stats.pathCacheSize} entries`);
     * console.log(`Snapshot cache: ${stats.snapshotCacheSize} entries`);
     * ```
     *
     * @see fileVersions
     * @see resolvedPaths
     * @see snapshotCache
     * @see CacheStatsInterface
     *
     * @since 2.0.0
     */

    getCacheStats(): CacheStatsInterface {
        return {
            trackedFiles: this.fileStates.size,
            pathCacheSize: this.resolvedPaths.size,
            snapshotCacheSize: this.snapshotCache.size
        };
    }

    /**
     * Clears all internal caches and optionally updates compiler options.
     *
     * @param options - New TypeScript compiler options to use, or empty object to keep existing options.
     *
     * @remarks
     * This method performs a complete cache invalidation and optionally reconfigures the
     * language host with new compiler options. It clears all three internal caches:
     * - {@link fileStates}: All file version tracking and analysis state
     * - {@link resolvedPaths}: All cached path resolutions
     * - {@link snapshotCache}: All cached file content snapshots
     *
     * Additionally, if new compiler options are provided, they replace the existing
     * configuration. This allows the language host to adapt to configuration changes
     * (such as tsconfig.json updates) while maintaining a clean state.
     *
     * After calling this method:
     * - The language host is reset to a clean state
     * - All files will need to be tracked again via {@link touchFile} or {@link touchFiles}
     * - All snapshots will be re-read from disk on next access
     * - New compiler options (if provided) will affect subsequent operations
     *
     * Use cases for reloading:
     * - Applying tsconfig.json changes without restarting the process
     * - Recovering from memory pressure by clearing large caches
     * - Forcing a full recompilation by invalidating all cached state
     * - Switching between different compilation configurations
     * - Clearing stale state after major file system changes
     * - Testing and debugging with different compiler options
     * - Periodic cleanup in long-running processes
     *
     * Performance implications:
     * - All file snapshots will be re-read from disk on next access
     * - All path resolutions will be recalculated
     * - All files will be treated as new and require full analysis
     * - Next compilation will be slower due to cold caches
     * - Module resolution may behave differently with new options
     *
     * This is a destructive operation that cannot be undone. Use with caution in
     * production environments as it will temporarily degrade performance until
     * caches are rebuilt.
     *
     * @example
     * ```ts
     * const languageHost = new LanguageHostService({
     *   target: ts.ScriptTarget.ES2020
     * });
     *
     * // Track some files and build up caches
     * languageHost.touchFiles(['src/index.ts', 'src/utils.ts']);
     * languageHost.getScriptSnapshot('src/index.ts');
     *
     * const stats = languageHost.getCacheStats();
     * console.log(`Tracked: ${stats.trackedFiles}, Cached: ${stats.snapshotCacheSize}`);
     * // Output: Tracked: 2, Cached: 1
     *
     * // Reset caches but keep same options
     * languageHost.reload();
     *
     * const statsAfter = languageHost.getCacheStats();
     * console.log(`Tracked: ${statsAfter.trackedFiles}, Cached: ${statsAfter.snapshotCacheSize}`);
     * // Output: Tracked: 0, Cached: 0
     *
     * // Reset caches and update compiler options
     * languageHost.reload({
     *   target: ts.ScriptTarget.ES2022,
     *   module: ts.ModuleKind.ESNext,
     *   strict: true
     * });
     *
     * // Use case: Watch tsconfig.json for changes
     * watchConfigFile('tsconfig.json', (newConfig) => {
     *   const options = parseCompilerOptions(newConfig);
     *   languageHost.reload(options); // Apply new config
     *   // Trigger recompilation...
     * });
     *
     * // Use case: Switch between production and development configs
     * if (isProduction) {
     *   languageHost.reload(productionOptions);
     * } else {
     *   languageHost.reload(developmentOptions);
     * }
     * ```
     *
     * @see fileStates
     * @see resolvedPaths
     * @see snapshotCache
     * @see getCacheStats
     * @see CompilerOptions
     *
     * @since 2.0.0
     */

    reload(options?: CompilerOptions): void {
        this.fileStates.clear();
        this.resolvedPaths.clear();
        this.snapshotCache.clear();
        this.options = options || this.options;
    }

    /**
     * Marks multiple files as modified by incrementing their version numbers.
     *
     * @param filesPath - Array of file paths that have been modified (can be relative or absolute).
     *
     * @remarks
     * This method is a batch operation that calls {@link touchFile} for each file path
     * in the provided array. It should be used when multiple files need to be marked as
     * changed simultaneously, such as after a bulk file operation or when processing
     * watch mode events.
     *
     * Each file in the array will:
     * - Have its absolute path resolved
     * - Get its version number incremented if already tracked
     * - Be initialized with version 1 if not yet tracked
     *
     * This triggers the same cache invalidation and incremental compilation behavior
     * as {@link touchFile}, but for multiple files efficiently.
     *
     * @example
     * ```ts
     * // Mark multiple files as changed
     * languageHost.touchFiles([
     *   'src/index.ts',
     *   'src/utils/helper.ts',
     *   'src/types/index.ts'
     * ]);
     *
     * // Useful in watch mode scenarios
     * const changedFiles = ['src/app.ts', 'src/config.ts'];
     * languageHost.touchFiles(changedFiles);
     * ```
     *
     * @see touchFile
     * @see fileStates
     * @see getScriptVersion
     * @see FileStateInterface
     *
     * @since 2.0.0
     */

    touchFiles(filesPath: Array<string>): void {
        for(const file of filesPath) {
            this.touchFile(file);
        }
    }

    /**
     * Marks a file as modified by incrementing its version number.
     *
     * @param filePath - Path to the file that has been modified (can be relative or absolute).
     *
     * @remarks
     * This method should be called whenever a file is changed to notify the
     * TypeScript language service that the file needs to be reanalyzed.
     *
     * The method performs the following:
     * - Resolves the file path to an absolute path
     * - If the file is already tracked, increments its version number
     * - If the file is new, creates initial state with version 1
     *
     * Incrementing the version triggers:
     * - Cache invalidation for the file's snapshot
     * - Incremental compilation on next analysis
     * - Re-computation of diagnostics
     *
     * The analyzed version and snapshot version remain unchanged, allowing
     * the system to detect that the file needs reanalysis and the cached
     * snapshot is now stale.
     *
     * @example
     * ```ts
     * // Mark a file as changed
     * languageHost.touchFiles('src/utils/helper.ts');
     *
     * // Touch multiple times
     * languageHost.touchFiles('src/index.ts'); // version: 1
     * languageHost.touchFiles('src/index.ts'); // version: 2
     * languageHost.touchFiles('src/index.ts'); // version: 3
     * ```
     *
     * @see fileStates
     * @see resolvePath
     * @see getScriptVersion
     * @see FileStateInterface
     *
     * @since 2.0.0
     */

    touchFile(filePath: string): void {
        const absolutePath = this.resolvePath(filePath);
        const state = this.fileStates.get(absolutePath);

        if (state) {
            state.version++;
        } else {
            this.fileStates.set(absolutePath, {
                version: 1,
                analyzedVersion: 0,
                snapshotVersion: 0
            });
        }
    }

    /**
     * Checks if a file has been modified since its last analysis and updates the analyzed version.
     *
     * @param fileName - Path to the file to check (can be relative or absolute).
     * @returns `true` if the file needs reanalysis, otherwise `false`.
     *
     * @remarks
     * This method determines whether a file needs to be reanalyzed by comparing
     * its current version with the last analyzed version. When a change is detected,
     * it automatically updates the analyzed version to match the current version.
     *
     * Return behavior:
     * - Returns `true` if the file has not been tracked yet (no state exists)
     * - Returns `true` if the file version is ahead of the analyzed version (file was modified)
     * - Returns `false` if the analyzed version matches the current version (no changes)
     *
     * Side effects:
     * - Automatically updates `analyzedVersion` to match `version` when returning `true`
     * - This ensures subsequent calls return `false` until the file is modified again
     *
     * This method is useful for:
     * - Implementing incremental compilation that only analyzes changed files
     * - Avoiding redundant diagnostic computation
     * - Tracking which files need attention in watch mode
     * - Coordinating analysis across multiple files efficiently
     *
     * @example
     * ```ts
     * const languageHost = new LanguageHostService(compilerOptions);
     *
     * // First check - file not tracked yet
     * console.log(languageHost.isTouched('src/index.ts')); // true
     *
     * // Second check - analyzed version now matches
     * console.log(languageHost.isTouched('src/index.ts')); // false
     *
     * // Modify the file
     * languageHost.touchFiles('src/index.ts');
     *
     * // File needs analysis again
     * console.log(languageHost.isTouched('src/index.ts')); // true
     * console.log(languageHost.isTouched('src/index.ts')); // false
     * ```
     *
     * @see touchFile
     * @see fileStates
     * @see FileStateInterface
     *
     * @since 2.0.0
     */

    isTouched(fileName: string): boolean {
        const file = this.resolvePath(fileName);
        const state = this.fileStates.get(file);

        if (!state) {
            this.touchFile(fileName);

            return true;
        }

        if (state.analyzedVersion < state.version) {
            state.analyzedVersion = state.version;

            return true;
        }

        return false;
    }

    /**
     * Checks whether a file exists on the file system.
     *
     * @param path - Path to the file to check.
     * @returns `true` if the file exists, otherwise `false`.
     *
     * @remarks
     * This method delegates to TypeScript's system interface for file existence checking.
     *
     * @see sys
     * @since 2.0.0
     */

    fileExists(path: string): boolean {
        return this.sys.fileExists(path);
    }

    /**
     * Reads the contents of a file from the file system.
     *
     * @param path - Path to the file to read.
     * @param encoding - Optional character encoding (defaults to UTF-8).
     * @returns The file contents as a string, or `undefined` if the file cannot be read.
     *
     * @remarks
     * This method delegates to TypeScript's system interface for file reading.
     *
     * @see sys
     * @since 2.0.0
     */

    readFile(path: string, encoding?: string): string | undefined {
        return this.sys.readFile(path, encoding);
    }

    /**
     * Recursively reads a directory and returns matching file paths.
     *
     * @param path - Directory path to search.
     * @param extensions - Optional array of file extensions to include (e.g., `['.ts', '.tsx']`).
     * @param exclude - Optional array of glob patterns to exclude.
     * @param include - Optional array of glob patterns to include.
     * @param depth - Optional maximum recursion depth.
     * @returns An array of file paths matching the criteria.
     *
     * @remarks
     * This method delegates to TypeScript's system interface for directory traversal.
     * It supports filtering by extension, inclusion/exclusion patterns, and depth limits.
     *
     * @see sys
     * @since 2.0.0
     */

    readDirectory(path: string, extensions?: Array<string>, exclude?: Array<string>, include?: Array<string>, depth?: number): Array<string> {
        return this.sys.readDirectory(path, extensions, exclude, include, depth);
    }

    /**
     * Lists all subdirectories within a given directory.
     *
     * @param path - Directory path to list.
     * @returns An array of subdirectory names.
     *
     * @remarks
     * This method delegates to TypeScript's system interface for directory listing.
     *
     * @see sys
     * @since 2.0.0
     */

    getDirectories(path: string): Array<string> {
        return this.sys.getDirectories(path);
    }

    /**
     * Checks whether a directory exists on the file system.
     *
     * @param path - Path to the directory to check.
     * @returns `true` if the directory exists, otherwise `false`.
     *
     * @remarks
     * This method delegates to TypeScript's system interface for directory existence checking.
     *
     * @see sys
     * @since 2.0.0
     */

    directoryExists(path: string): boolean {
        return this.sys.directoryExists(path);
    }

    /**
     * Returns the current working directory.
     *
     * @returns The absolute path to the current working directory.
     *
     * @remarks
     * This method delegates to TypeScript's system interface.
     *
     * @see sys
     * @since 2.0.0
     */

    getCurrentDirectory(): string {
        return this.sys.getCurrentDirectory();
    }

    /**
     * Returns an array of all tracked script file names.
     *
     * @returns An array of absolute file paths for all files with version information.
     *
     * @remarks
     * This method returns the keys from {@link fileStates}, representing all files
     * that have been touched or modified since the service was created.
     *
     * @see fileStates
     * @see touchFiles
     * @since 2.0.0
     */

    getScriptFileNames(): Array<string> {
        return Array.from(this.fileStates.keys());
    }

    /**
     * Returns the TypeScript compiler options for this host.
     *
     * @returns The {@link CompilerOptions} provided during construction.
     *
     * @see CompilerOptions
     * @since 2.0.0
     */

    getCompilationSettings(): CompilerOptions {
        return this.options;
    }

    /**
     * Returns the path to TypeScript's default library file.
     *
     * @param options - Compiler options to determine the appropriate lib file.
     * @returns The absolute path to the default library file (e.g., `lib.d.ts`).
     *
     * @remarks
     * This method uses TypeScript's built-in `getDefaultLibFilePath` function
     * to locate the correct library file based on the target ECMAScript version.
     *
     * @see CompilerOptions
     * @since 2.0.0
     */

    getDefaultLibFileName(options: CompilerOptions): string {
        return ts.getDefaultLibFilePath(options);
    }

    /**
     * Returns the version number of a script file.
     *
     * @param fileName - Path to the file.
     * @returns The version number as a string, or `'0'` if the file has not been tracked.
     *
     * @remarks
     * The version number is incremented each time {@link touchFiles} is called for the file.
     * This allows the TypeScript language service to perform incremental analysis.
     *
     * @see touchFiles
     * @see fileVersions
     * @since 2.0.0
     */

    getScriptVersion(fileName: string): string {
        const file = this.resolvePath(fileName);
        const version = this.fileStates.get(file);
        if(version) return version.version.toString();

        return '0';
    }

    /**
     * Returns a snapshot of a script file's content.
     *
     * @param fileName - Path to the file.
     * @returns An {@link IScriptSnapshot} containing the file content, or `undefined` if the file does not exist.
     *
     * @remarks
     * This method reads the file from `disk` and creates a snapshot object that
     * the TypeScript language service can use for analysis. Snapshots are
     * immutable representations of file content at a specific point in time.
     *
     * @see readFile
     * @see fileExists
     * @see IScriptSnapshot
     *
     * @since 2.0.0
     */

    getScriptSnapshot(fileName: string): IScriptSnapshot | undefined {
        const file = this.resolvePath(fileName);
        const state = this.fileStates.get(file);
        const cached = this.snapshotCache.get(file);

        if (state && cached && state.snapshotVersion === state.version) {
            return cached;
        }

        if (!this.fileExists(file)) {
            this.snapshotCache.delete(file);

            return undefined;
        }

        const content = this.readFile(file);
        if (content !== undefined) {
            const snapshot = ts.ScriptSnapshot.fromString(content);
            this.snapshotCache.set(file, snapshot);
            if (state) {
                state.snapshotVersion = state.version;
            } else {
                this.fileStates.set(file, {
                    version: 1,
                    analyzedVersion: 0,
                    snapshotVersion: 1
                });
            }

            return snapshot;
        }

        return undefined;
    }

    /**
     * Resolves a file path to an absolute path and caches the result.
     *
     * @param filePath - The file path to resolve (can be relative or absolute).
     * @returns The resolved absolute file path.
     *
     * @remarks
     * This method uses Node.js's `path.resolve` to convert relative paths to
     * absolute paths. Results are cached in {@link resolvedPaths} to improve
     * performance for repeated lookups.
     *
     * @see resolvedPaths
     * @since 2.0.0
     */

    resolvePath(filePath: string): string {
        let resolved = this.resolvedPaths.get(filePath);
        if (!resolved) {
            resolved = resolve(filePath);
            this.resolvedPaths.set(filePath, resolved);
        }

        return resolved;
    }
}
