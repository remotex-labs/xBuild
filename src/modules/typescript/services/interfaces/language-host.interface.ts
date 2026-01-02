/**
 * Represents statistics about the internal caches used by {@link LanguageHostService}.
 *
 * @remarks
 * This interface provides metrics about the memory usage and state of various caches
 * maintained by the language host service. These statistics are useful for:
 *
 * - Monitoring memory consumption in large projects
 * - Debugging performance issues related to caching
 * - Understanding the overhead of file tracking and compilation
 * - Optimizing cache invalidation strategies
 * - Profiling incremental compilation behavior
 *
 * The statistics can help identify potential issues such as:
 * - Memory leaks from unbounded cache growth
 * - Inefficient cache utilization
 * - Unnecessary file tracking
 *
 * @example
 * ```ts
 * const languageHost = new LanguageHostService(compilerOptions);
 *
 * // Track some files
 * languageHost.touchFiles(['src/index.ts', 'src/utils.ts']);
 *
 * // Get cache statistics
 * const stats = languageHost.getCacheStats();
 * console.log(`Tracking ${stats.trackedFiles} files`);
 * console.log(`Path cache: ${stats.pathCacheSize} entries`);
 * console.log(`Snapshot cache: ${stats.snapshotCacheSize} snapshots`);
 *
 * // Monitor memory usage
 * if (stats.snapshotCacheSize > 1000) {
 *   console.warn('Large snapshot cache detected');
 * }
 * ```
 *
 * @see LanguageHostService
 * @see LanguageHostService.getCacheStats
 *
 * @since 2.0.0
 */

export interface CacheStatsInterface {
    /**
     * The number of files currently being tracked for version changes.
     *
     * @remarks
     * This count represents files that have been touched via {@link LanguageHostService.touchFiles}
     * and are being monitored for incremental compilation. Each tracked file has an associated
     * version number that increments when the file is modified.
     *
     * A high number may indicate:
     * - A large project with many source files
     * - Files that should be excluded from tracking
     * - Potential memory overhead from tracking unnecessary files
     *
     * @see LanguageHostService.touchFiles
     * @see LanguageHostService.fileVersions
     *
     * @since 2.0.0
     */

    trackedFiles: number;

    /**
     * The number of resolved file paths stored in the cache.
     *
     * @remarks
     * This count represents the number of file paths that have been resolved from relative
     * to absolute paths and cached for performance. Path resolution can be expensive, so
     * caching improves repeated lookups.
     *
     * This value typically grows as more files are accessed and should roughly correlate
     * with {@link trackedFiles}, though it may be larger if paths are resolved but not tracked.
     *
     * @see LanguageHostService.resolvePath
     * @see LanguageHostService.resolvedPaths
     *
     * @since 2.0.0
     */

    pathCacheSize: number;

    /**
     * The number of script snapshots currently stored in the cache.
     *
     * @remarks
     * This count represents the number of {@link IScriptSnapshot} instances cached in memory.
     * Snapshots contain file content and are used by the TypeScript language service for
     * analysis. Caching them avoids repeated file reads and snapshot creation.
     *
     * A large snapshot cache may indicate:
     * - Many files being actively analyzed
     * - Snapshots that should be invalidated but haven't been
     * - High memory usage that could be optimized
     *
     * The cache should be cleared or updated when files are modified to ensure fresh content.
     *
     * @see IScriptSnapshot
     * @see LanguageHostService.snapshotCache
     * @see LanguageHostService.getScriptSnapshot
     *
     * @since 2.0.0
     */

    snapshotCacheSize: number;
}

/**
 * Represents the state and version tracking information for a single file.
 *
 * @remarks
 * This interface maintains multiple version counters for a file to support efficient
 * incremental compilation and analysis. Each version number serves a specific purpose
 * in tracking the file's lifecycle through the compilation pipeline:
 *
 * - The file content version tracks physical changes to the file
 * - The analyzed version tracks when diagnostics were last computed
 * - The snapshot version tracks when the cached snapshot was created
 *
 * By maintaining separate version counters, the language service can:
 * - Determine if a file needs re-analysis without re-reading content
 * - Avoid redundant diagnostic computation for unchanged files
 * - Coordinate cache invalidation across different subsystems
 * - Optimize incremental compilation in watch mode
 *
 * @example
 * ```ts
 * const fileState: FileStateInterface = {
 *   version: 3,           // File has been modified 3 times
 *   analyzedVersion: 2,   // Last analyzed at version 2 (needs re-analysis)
 *   snapshotVersion: 3    // Snapshot is current with a file version
 * };
 *
 * // Check if analysis is needed
 * if (fileState.version > fileState.analyzedVersion) {
 *   // Re-run diagnostics
 *   analyzedVersion = version;
 * }
 * ```
 *
 * @see LanguageHostService
 * @see SnapshotCacheInterface
 *
 * @since 2.0.0
 */

export interface FileStateInterface {
    /**
     * The current version number of the file content.
     *
     * @remarks
     * Increments each time the file is modified via {@link LanguageHostService.touchFiles}.
     * This is the primary version counter used to track file changes and trigger
     * cache invalidation throughout the compilation pipeline.
     *
     * @see LanguageHostService.touchFiles
     * @see LanguageHostService.fileVersions
     *
     * @since 2.0.0
     */

    version: number;

    /**
     * The file version at which diagnostics were last computed.
     *
     * @remarks
     * Used to determine if a file needs re-analysis by comparing against {@link version}.
     * When `version > analyzedVersion`, the file has changed since last analysis and
     * should be re-checked for errors, warnings, and suggestions.
     *
     * This optimization prevents redundant diagnostic computation for unchanged files,
     * significantly improving performance in incremental compilation scenarios.
     *
     * @since 2.0.0
     */

    analyzedVersion: number;

    /**
     * The file version associated with the currently cached snapshot.
     *
     * @remarks
     * Tracks which file version the cached {@link IScriptSnapshot} represents.
     * When `version > snapshotVersion`, the snapshot is stale and should be
     * refreshed from the disk before use.
     *
     * This allows quick validation of snapshot cache freshness without comparing
     * file content or timestamps.
     *
     * @see SnapshotCacheInterface
     * @see IScriptSnapshot
     *
     * @since 2.0.0
     */

    snapshotVersion: number;
}
