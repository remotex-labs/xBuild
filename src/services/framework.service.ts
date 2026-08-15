/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { PositionInterface, FormatStackFrameInterface } from '@remotex-labs/xmap';

/**
 * Imports
 */

import { cwd } from 'process';
import { readFileSync } from 'fs';
import { FilesModel } from '@models/files.model';
import { inject, Injectable } from '@remotex-labs/xinject';
import { normalize, SourceService } from '@remotex-labs/xmap';

/**
 * Matches a path that belongs to the framework rather than to the project being built.
 *
 * @remarks
 * Case-insensitive, since the same file surfaces as `xBuild` from a checkout and as `xbuild` from `node_modules`.
 * The lookahead spares a project's own `xbuild.config`, which names the framework without being part of it.
 *
 * @since 3.0.0
 */

const FRAMEWORK_PATH_REGEX = /xbuild(?!\.config)/i;

/**
 * Matches a source map whose `mappings` field is empty.
 *
 * @remarks
 * Such a map resolves nothing,
 * so keeping it would cost a lookup on every frame and answer with the generated position anyway.
 * Kept at module level so the pattern is compiled once rather than on every registration.
 *
 * @since 3.0.0
 */

const EMPTY_MAPPINGS_REGEX = /"mappings"\s*:\s*""/;

/**
 * Holds the framework's own paths and the source maps a stack trace is resolved through.
 *
 * @remarks
 * Two jobs in service of one thing - reporting an error against the source a reader recognizes.
 * It tells framework frames apart from a project's own,
 * and it hands out the {@link SourceService} that maps a generated position back to its source.
 * Maps arrive either as text through {@link addSourceMap} or read from a `.map` companion through
 * {@link loadSourceMap}, and both are keyed by resolved path, so the same file registered under a relative and an
 * absolute path is parsed once.
 * The framework's own map is loaded on construction, which is what lets an error thrown inside the build be reported
 * against its source.
 * Registered as a singleton, so every consumer shares one registry.
 *
 * @example
 * ```ts
 * const framework = inject(FrameworkService);
 *
 * framework.projectRoot;                                        // 'D:/app' - where the build was started
 * framework.getSourceMap(framework.frameworkFile);              // the framework's own SourceService
 * framework.isFrameworkFile({ source: 'D:/app/src/index.ts' }); // false - a project file
 * ```
 *
 * @see SourceService
 * @since 2.0.0
 */

@Injectable({
    scope: 'singleton'
})
export class FrameworkService {
    /**
     * Absolute path of the framework file this service was loaded from.
     *
     * @remarks
     * Normalized like {@link frameworkRoot} and {@link projectRoot},
     * so all three compare and join the same way whatever the platform.
     *
     * @example
     * ```ts
     * framework.frameworkFile; // 'D:/app/node_modules/@remotex-labs/xbuild/dist/index.js'
     * ```
     *
     * @since 3.0.0
     */

    readonly frameworkFile: string;

    /**
     * Absolute path of the directory the framework was distributed in.
     *
     * @remarks
     * Where anything shipped beside the build is found, the server's certificates among them.
     *
     * @example
     * ```ts
     * framework.frameworkRoot; // 'D:/app/node_modules/@remotex-labs/xbuild/dist'
     * ```
     *
     * @since 3.0.0
     */

    readonly frameworkRoot: string;

    /**
     * Absolute path of the directory the build was started from.
     *
     * @remarks
     * The user's project root rather than the framework's,
     * so it is what a path is made relative to when a frame is printed.
     *
     * @example
     * ```ts
     * framework.projectRoot; // 'D:/app'
     * ```
     *
     * @since 3.0.0
     */

    readonly projectRoot: string;

    /**
     * Shared file cache, held on the class so {@link resolve} needs no instance.
     *
     * @remarks
     * What is wanted here is the memo it keeps rather than the snapshots: resolving through it is what keeps this
     * registry, the file cache, and everything else keyed by path agreeing on what one path is.
     * Claimed by the first {@link resolve} rather than by a static initializer, since an initializer would run while
     * this module is being imported, and importing it must not reach the container.
     *
     * @see FilesModel
     * @since 3.0.0
     */

    private static files?: FilesModel;

    /**
     * Source maps keyed by the resolved path of the file each one describes.
     *
     * @since 2.0.0
     */

    private readonly sourceMaps = new Map<string, SourceService>();

    /**
     * Captures the framework's paths and loads its own source map.
     *
     * @throws Error - When the framework ships without a readable `.map` companion
     *
     * @remarks
     * A framework shipped without its map is a broken build rather than a supported one,
     * so the read failure surfaces here instead of being swallowed.
     *
     * @example
     * ```ts
     * const framework = new FrameworkService();
     * framework.getSourceMap(framework.frameworkFile); // SourceService
     * ```
     *
     * @see loadSourceMap
     * @since 2.0.0
     */

    constructor() {
        this.projectRoot = normalize(cwd());
        this.frameworkFile = normalize(import.meta.filename);
        this.frameworkRoot = normalize(import.meta.dirname);

        this.loadSourceMap(this.frameworkFile);
    }

    /**
     * Normalizes a path to the absolute form every cache here is keyed by.
     *
     * @param path - Filesystem path, relative or absolute
     * @returns Absolute path with forward slashes
     *
     * @remarks
     * Static so that a caller with no framework service in hand can still key a path the way this package does, which
     * is what keeps entry-point names, source-map keys, and file entries from disagreeing about one file.
     * The first call claims the file cache, and every later call finds it already claimed, so the container is reached
     * only once something asks for a path rather than when this module is imported.
     * Resolution is memoized by the cache behind it, so resolving the same path again costs a lookup.
     *
     * @example
     * ```ts
     * FrameworkService.resolve('src/index.ts'); // 'D:/app/src/index.ts'
     * ```
     *
     * @see FilesModel
     * @since 3.0.0
     */

    static resolve(path: string): string {
        return (FrameworkService.files ??= inject(FilesModel)).resolve(path);
    }

    /**
     * Reports whether a position belongs to the framework rather than to the project being built.
     *
     * @param position - Position or stack frame to judge, as the source map resolver reports it
     * @returns `true` when the position comes from framework code
     *
     * @remarks
     * The judgment is made on the path, matched case-insensitively, since the same file surfaces as `xBuild` from a
     * checkout and as `xbuild` from `node_modules`.
     * A project's own `xbuild.config` names the framework without being part of it, so it is excluded by name.
     * The source root is consulted only when the source itself does not settle the question.
     *
     * @example
     * ```ts
     * framework.isFrameworkFile({ source: 'D:/app/node_modules/xbuild/dist/index.js' }); // true
     * framework.isFrameworkFile({ source: 'D:/app/xbuild.config.ts' });                  // false
     * framework.isFrameworkFile({ source: 'D:/app/src/index.ts' });                      // false
     * ```
     *
     * @see PositionInterface
     * @see FormatStackFrameInterface
     *
     * @since 2.2.5
     */

    isFrameworkFile(position: PositionInterface | FormatStackFrameInterface): boolean {
        return FRAMEWORK_PATH_REGEX.test(position.source ?? '') || FRAMEWORK_PATH_REGEX.test(position.sourceRoot ?? '');
    }

    /**
     * Returns the source map registered for a file.
     *
     * @param path - Path of the file, relative or absolute
     * @returns The source map of that file, or `undefined` when none was registered
     *
     * @remarks
     * A pure registry read: a file that was never registered stays unregistered, since nothing here reaches the disk.
     * Use {@link loadSourceMap} to register one.
     *
     * @example
     * ```ts
     * framework.getSourceMap('dist/index.js'); // undefined - never registered
     * framework.loadSourceMap('dist/index.js');
     * framework.getSourceMap('dist/index.js'); // SourceService
     * ```
     *
     * @see SourceService
     * @since 2.0.0
     */

    getSourceMap(path: string): SourceService | undefined {
        return this.sourceMaps.get(FrameworkService.resolve(path));
    }

    /**
     * Registers a source map from its text.
     *
     * @param path - Path of the file the map describes, relative or absolute
     * @param source - Raw source map content
     *
     * @throws Error - When the content is not a source map the resolver can parse
     *
     * @remarks
     * A file that already carries a map keeps it, so the first registration wins, and a later call costs only a lookup.
     * A map with empty mappings is dropped rather than registered, resolving through such a map being the same as not
     * resolving at all.
     *
     * @example
     * ```ts
     * framework.addSourceMap('dist/index.js', readFileSync('dist/index.js.map', 'utf-8'));
     * framework.getSourceMap('dist/index.js'); // SourceService
     * ```
     *
     * @see loadSourceMap
     * @since 3.0.0
     */

    addSourceMap(path: string, source: string): void {
        const key = FrameworkService.resolve(path);
        if (this.sourceMaps.has(key)) return;

        this.register(key, source);
    }

    /**
     * Registers the source map a file's `.map` companion carries.
     *
     * @param path - Path of the generated file, relative or absolute
     *
     * @throws Error - When the companion cannot be read or does not parse
     *
     * @remarks
     * The companion is looked for beside the file, as `<path>.map`, which is where every file this toolchain emits
     * carries its map.
     * A file that already carries a map is left alone before the disk is touched,
     * so repeating the call on a tracked file costs only a lookup.
     * An empty path is ignored outright,
     * and a companion that parses but maps nothing registers no map and raises nothing.
     *
     * @example
     * ```ts
     * framework.loadSourceMap('dist/index.js'); // reads dist/index.js.map
     * framework.loadSourceMap('dist/index.js'); // cached - no read
     * ```
     *
     * @see addSourceMap
     * @since 3.0.0
     */

    loadSourceMap(path: string): void {
        if (!path) return;

        const key = FrameworkService.resolve(path);
        if (this.sourceMaps.has(key)) return;

        let source: string;
        try {
            source = readFileSync(`${ key }.map`, 'utf-8');
        } catch (error) {
            throw FrameworkService.failure(key, error);
        }

        this.register(key, source);
    }

    /**
     * Builds the error reported when a source map cannot be registered.
     *
     * @param key - Resolved path of the file the map describes
     * @param error - Failure raised while reading or parsing it
     * @returns The error to throw, naming the file and carrying the original reason
     *
     * @remarks
     * The reading and the parsing halves fail in the same way as far as a caller is concerned,
     * so both report the file first and the reason after it.
     *
     * @since 3.0.0
     */

    private static failure(key: string, error: unknown): Error {
        return new Error(
            `Failed to load source map for: ${ key }\n${ error instanceof Error ? error.message : String(error) }`
        );
    }

    /**
     * Parses a source map and files it under a resolved path.
     *
     * @param key - Resolved path of the file the map describes
     * @param source - Raw source map content
     *
     * @throws Error - When the content is not a source map the resolver can parse
     *
     * @remarks
     * The single point where a map enters the registry,
     * so both entry points resolve their path once and skip an already registered file before reaching here.
     * A map with empty mappings is dropped rather than registered, since resolving through such a map answers with
     * the position it was given.
     *
     * @since 3.0.0
     */

    private register(key: string, source: string): void {
        if (EMPTY_MAPPINGS_REGEX.test(source)) return;

        try {
            this.sourceMaps.set(key, new SourceService(source, key));
        } catch (error) {
            throw FrameworkService.failure(key, error);
        }
    }
}
