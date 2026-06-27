/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { PositionInterface, FormatStackFrameInterface } from '@remotex-labs/xmap';

/**
 * Imports
 */

import { readFileSync } from 'fs';
import { Injectable } from '@services/symlinks.service';
import { SourceService, resolve, toPosix } from '@remotex-labs/xmap';

/**
 * Provides the framework's well-known directories and its source-map registry.
 *
 * @remarks
 * Exposes the three locations xBuild reasons about:
 * - {@link rootPath} — the project root.
 * - {@link distPath} — the build-output (dist) folder.
 * - {@link sourcePath} — the source-code root (for example, `src`), which falls back to {@link rootPath}
 *   when it has not been set.
 *
 * It also caches {@link SourceService} instances per file for source-map lookups and detects whether
 * a stack position originates from the framework itself.
 *
 * @example
 * ```ts
 * const framework = inject(FrameworkService);
 * framework.sourcePath = 'src';                       // optional; defaults to rootPath
 * const map = framework.getSourceMap(framework.filePath);
 * ```
 *
 * @since 2.0.0
 */

@Injectable({
    scope: 'singleton'
})
export class FrameworkService {
    /**
     * Absolute path to this framework file.
     *
     * @readonly
     * @since 2.0.0
     */

    readonly filePath: string;

    /**
     * Absolute path to the build-output (dist) directory.
     *
     * @readonly
     * @since 2.0.0
     */

    readonly distPath: string;

    /**
     * Absolute path to the project root directory.
     *
     * @readonly
     * @since 2.0.0
     */

    readonly rootPath: string;

    /**
     * Configured source-code root, or `undefined` to fall back to {@link rootPath}.
     *
     * @remarks
     * Backing field for {@link sourcePath}; always stored as an absolute, POSIX-style path.
     *
     * @since 2.6.0
     */

    private sourceDir?: string;

    /**
     * Cached {@link SourceService} instances, keyed by resolved file path.
     * @since 2.0.0
     */

    private readonly sourceMaps = new Map<string, SourceService>();

    /**
     * Initializes a new {@link FrameworkService} instance.
     *
     * @remarks
     * Resolves the root and dist directories and loads the framework file's own source map.
     *
     * @since 2.0.0
     */

    constructor() {
        this.filePath = import.meta.filename;
        this.rootPath = toPosix(process.cwd());
        this.distPath = toPosix(import.meta.dirname);
        this.setSourceFile(this.filePath);
    }

    /**
     * Absolute path to the source-code root directory.
     *
     * @returns The configured source root, or {@link rootPath} when none has been set.
     *
     * @remarks
     * Point this at the directory holding the source tree (for example, `src`); a value is resolved
     * against {@link rootPath}. Leave it unset to treat the project root as the source root.
     *
     * @example
     * ```ts
     * framework.sourcePath = 'src';        // -> <rootPath>/src
     * framework.sourcePath = undefined;    // -> rootPath
     * ```
     *
     * @since 2.6.0
     */

    get sourcePath(): string {
        return this.sourceDir ?? this.rootPath;
    }

    /**
     * Sets the source-code root directory.
     *
     * @param dir - Source root, absolute or relative to {@link rootPath}; `undefined` resets it
     *              so {@link sourcePath} falls back to {@link rootPath}.
     *
     * @since 2.6.0
     */

    set sourcePath(dir: string | undefined) {
        this.sourceDir = dir ? resolve(this.rootPath, dir) : undefined;
    }

    /**
     * Determines whether a stack position originates from a framework (xBuild) file.
     *
     * @param position - The position information to check
     * @returns `true` when the position's source or source root belongs to xBuild,
     *          excluding the user's `xbuild.config` file
     *
     * @see PositionInterface
     * @see FormatStackFrameInterface
     *
     * @since 2.2.5
     */

    isFrameworkFile(position: PositionInterface | FormatStackFrameInterface): boolean {
        const { source, sourceRoot } = position;
        const normalizedSource = source?.toLowerCase();

        return Boolean(
            (normalizedSource && normalizedSource.includes('xbuild') && !normalizedSource.includes('xbuild.config')) ||
            (sourceRoot && sourceRoot.includes('xBuild'))
        );
    }

    /**
     * Retrieves a cached {@link SourceService} for a given file path.
     *
     * @param path - File path (normalized before lookup)
     * @returns The cached {@link SourceService}, or `undefined` when none is registered
     *
     * @remarks
     * Only source maps registered via {@link setSource} or {@link setSourceFile} are available.
     *
     * @see SourceService
     * @since 2.0.0
     */

    getSourceMap(path: string): SourceService | undefined {
        return this.sourceMaps.get(resolve(path));
    }

    /**
     * Registers a {@link SourceService} from a raw source-map string.
     *
     * @param source - The raw source-map content
     * @param path - File path associated with the source map (used as the cache key)
     *
     * @throws Error - When the source map cannot be parsed
     *
     * @remarks
     * A source map with empty `mappings` is ignored. The path is normalized before caching.
     *
     * @see SourceService
     * @since 2.0.0
     */

    setSource(source: string, path: string): void {
        const key = resolve(path);

        try {
            this.initializeSourceMap(source, key);
        } catch (error) {
            throw this.initializeError(key, error);
        }
    }

    /**
     * Registers a {@link SourceService} from a file's adjacent `.map` companion.
     *
     * @param path - File path whose `<path>.map` source map is loaded
     *
     * @throws Error - When the `.map` file cannot be read or parsed
     *
     * @remarks
     * No-op for a falsy path or when the file is already cached. The path is normalized before caching.
     *
     * @see SourceService
     * @since 2.0.0
     */

    setSourceFile(path: string): void {
        if (!path) return;

        const key = resolve(path);
        if (this.sourceMaps.has(key)) return;

        try {
            this.initializeSourceMap(readFileSync(`${ path }.map`, 'utf-8'), key);
        } catch (error) {
            throw this.initializeError(key, error);
        }
    }

    /**
     * Builds the error thrown when a {@link SourceService} fails to initialize.
     *
     * @param key - Normalized file path being initialized
     * @param error - The underlying failure
     * @returns An {@link Error} describing the failed initialization
     *
     * @since 2.6.0
     */

    private initializeError(key: string, error: unknown): Error {
        return new Error(
            `Failed to initialize SourceService: ${ key }\n${ error instanceof Error ? error.message : String(error) }`
        );
    }

    /**
     * Creates and caches a {@link SourceService} for a source map.
     *
     * @param source - Raw source-map content
     * @param path - Normalized file path used as the cache key
     *
     * @remarks
     * Internal helper for {@link setSource} and {@link setSourceFile}. Source maps with empty
     * `mappings` are skipped rather than cached.
     *
     * @see SourceService
     * @since 2.0.0
     */

    private initializeSourceMap(source: string, path: string): void {
        if (source?.includes('"mappings": ""')) return;

        this.sourceMaps.set(path, new SourceService(source, path));
    }
}
