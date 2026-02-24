/**
 * Import will remove at compile time
 */

import type { ResolvedModuleWithFailedLookupLocations } from 'typescript';
import type { CompilerOptions, IScriptSnapshot, ModuleResolutionCache } from 'typescript';
import type { FileSnapshotInterface } from '@typescript/models/interfaces/files-model.interface';

/**
 * Imports
 */

import ts from 'typescript';
import { inject } from '@symlinks/symlinks.module';
import { FilesModel } from '@typescript/models/files.model';
import { relative, dirname } from '@components/path.component';

/**
 * Implements a TypeScript Language Service host with file snapshot caching and module resolution.
 *
 * @remarks
 * The `LanguageHostService` implements the {@link ts.LanguageServiceHost} interface to provide
 * TypeScript's language service with file system access, file snapshots, and compiler configuration.
 *
 * @example
 * ```ts
 * // Initialize with compiler options
 * const host = new LanguageHostService({
 *   target: ts.ScriptTarget.ES2020,
 *   module: ts.ModuleKind.ESNext,
 *   paths: {
 *     '@utils/*': ['src/utils/*'],
 *     '@components/*': ['src/components/*']
 *   }
 * });
 *
 * // Track files for analysis
 * host.touchFile('src/index.ts');
 * host.touchFiles(['src/utils.ts', 'src/types.ts']);
 *
 * // Get file snapshots for language service
 * const snapshot = host.getScriptSnapshot('src/index.ts');
 *
 * // Resolve module imports
 * const resolved = host.resolveModuleName('@utils/helpers', 'src/index.ts');
 *
 * // Check for path aliases
 * const hasAliases = host.aliasRegex !== undefined;
 *
 * // Update configuration
 * host.options = { target: ts.ScriptTarget.ES2022 };
 * ```
 *
 * @see {@link ts.LanguageServiceHost} for the implemented interface specification
 * @see {@link FilesModel} for file snapshot caching implementation
 *
 * @since 2.0.0
 */

export class LanguageHostService implements ts.LanguageServiceHost {
    /**
     * Reference to TypeScript's system interface for file operations.
     *
     * @remarks
     * Static reference to `ts.sys` that provides abstracted file system operations
     * (read, write, directory traversal) compatible with different environments (Node.js, browsers, etc.).
     * Used for all file I/O operations in this service to maintain platform independence.
     *
     * @see {@link ts.sys}
     *
     * @since 2.0.0
     */

    private static readonly sys = ts.sys;

    /**
     * Cached regular expression for matching import/export statements with path aliases.
     *
     * @remarks
     * Compiled from `compilerOptions.paths` to efficiently detect imports using path aliases.
     * Regenerated when compiler options change. Undefined if no path aliases are configured.
     *
     * Used by tools that need to identify which import statements use aliases for proper
     * handling during transformation or bundling.
     *
     * @see {@link generateAliasRegex} for pattern generation
     *
     * @since 2.0.0
     */

    private alias: RegExp | undefined;

    private aliasCache = new Map<string, string | undefined>();

    /**
     * Cache for TypeScript module resolution results.
     *
     * @remarks
     * TypeScript's internal module resolution cache that stores resolution results to avoid
     * redundant lookups. Improves performance significantly when resolving many imports,
     * especially in large projects with complex path mappings.
     *
     * Recreated when compiler options change (since different options may affect resolution).
     *
     * @see {@link ts.createModuleResolutionCache}
     *
     * @since 2.0.0
     */

    private moduleResolutionCache: ModuleResolutionCache;

    /**
     * A set containing the file paths of all actively tracked script files.
     *
     * @remarks
     * This set ensures that files are tracked for later operations, such as retrieving script versions
     * or snapshots. Files are added to this set when they are first processed or read by the service.
     *
     * @example
     * ```ts
     * trackFiles.add('/src/main.ts');
     * console.log(trackFiles.has('/src/main.ts')); // true
     * ```
     *
     * @see {@link getScriptFileNames} - Retrieves all tracked files.
     *
     * @since 2.0.0
     */

    private readonly trackFiles = new Set<string>();

    /**
     * Model for managing file snapshots and version tracking.
     *
     * @remarks
     * Delegates file snapshot management to {@link FilesModel} for centralized
     * caching and change detection. Snapshots are tracked by modification time
     * to detect file changes efficiently.
     *
     * @see {@link FilesModel}
     *
     * @since 2.0.0
     */

    private readonly filesCache = inject(FilesModel);

    /**
     * Initializes a new {@link LanguageHostService} instance.
     *
     * @param compilerOptions - Optional TypeScript compiler options (defaults to an empty object)
     *
     * @remarks
     * Performs initialization including:
     * 1. Stores compiler options for later use
     * 2. Generates path alias regex from options if configured
     * 3. Creates module resolution cache with appropriate settings
     *
     * The module resolution cache is necessary for efficient resolution of imports in large projects.
     * Path alias regex is generated up-front and cached for performance.
     *
     * @example
     * ```ts
     * // Create host with default options
     * const host = new LanguageHostService();
     *
     * // Create host with specific compiler options
     * const host = new LanguageHostService({
     *   target: ts.ScriptTarget.ES2020,
     *   module: ts.ModuleKind.ESNext,
     *   paths: {
     *     '@utils/*': ['src/utils/*']
     *   }
     * });
     * ```
     *
     * @since 2.0.0
     */

    constructor(private compilerOptions: CompilerOptions = {}) {
        this.alias = LanguageHostService.generateAliasRegex(compilerOptions);
        this.moduleResolutionCache = ts.createModuleResolutionCache(
            process.cwd(),
            s => s,
            this.compilerOptions
        );
    }

    /**
     * Regular expression that matches import/export statements using path aliases (if `paths` is configured).
     *
     * @remarks
     * Used mainly for advanced refactoring or rewrite tools that need to identify aliased imports.
     *
     * @since 2.0.0
     */

    get aliasRegex(): RegExp | undefined {
        return this.alias;
    }

    /**
     * Replaces current compiler options and regenerates derived state (alias regex, module cache).
     *
     * @param options - new compiler configuration
     *
     * @since 2.0.0
     */

    set options(options: CompilerOptions) {
        this.compilerOptions = options;
        this.alias = LanguageHostService.generateAliasRegex(options);
        this.moduleResolutionCache = ts.createModuleResolutionCache(
            process.cwd(),
            s => s,
            this.compilerOptions
        );
    }

    /**
     * Updates file snapshot in the cache and returns the current state.
     *
     * @param path - file path (relative or absolute)
     * @returns current snapshot data (version, mtime, content snapshot)
     *
     * @see {@link FilesModel#touchFile}
     * @since 2.0.0
     */

    touchFile(path: string): FileSnapshotInterface {
        this.trackFiles.add(this.filesCache.resolve(path));

        return this.filesCache.touchFile(path);
    }

    /**
     * Ensures multiple files are tracked and their snapshots are up to date.
     *
     * @param filesPath - list of file paths to touch
     *
     * @since 2.0.0
     */

    touchFiles(filesPath: Array<string>): void {
        for (const file of filesPath) {
            this.touchFile(file);
        }
    }

    /**
     * Returns current compiler options used by this host.
     *
     * @returns active TypeScript compiler configuration
     *
     * @since 2.0.0
     */

    getCompilationSettings(): CompilerOptions {
        return this.compilerOptions;
    }

    /**
     * Checks whether a file exists on disk.
     *
     * @param path - absolute path
     * @returns `true` if file exists
     *
     * @since 2.0.0
     */

    fileExists(path: string): boolean {
        return LanguageHostService.sys.fileExists(path);
    }

    /**
     * Reads file content from disk.
     *
     * @param path - absolute path
     * @param encoding - optional encoding (defaults to UTF-8)
     * @returns file content or `undefined` if read fails
     *
     * @since 2.0.0
     */

    readFile(path: string, encoding?: string): string | undefined {
        return LanguageHostService.sys.readFile(path, encoding);
    }

    /**
     * Lists files and/or directories matching criteria.
     *
     * @param path - starting directory
     * @param extensions - allowed file extensions
     * @param exclude - glob exclude patterns
     * @param include - glob include patterns
     * @param depth - max recursion depth
     * @returns matching file paths
     *
     * @since 2.0.0
     */

    readDirectory(path: string, extensions?: Array<string>, exclude?: Array<string>, include?: Array<string>, depth?: number): Array<string> {
        return LanguageHostService.sys.readDirectory(path, extensions, exclude, include, depth);
    }

    /**
     * Returns immediate subdirectories of a given path.
     *
     * @param path - directory to list
     * @returns subdirectory names
     *
     * @since 2.0.0
     */

    getDirectories(path: string): Array<string> {
        return LanguageHostService.sys.getDirectories(path);
    }

    /**
     * Checks whether a directory exists.
     *
     * @param path - absolute path
     * @returns `true` if directory exists
     *
     * @since 2.0.0
     */

    directoryExists(path: string): boolean {
        return LanguageHostService.sys.directoryExists(path);
    }

    /**
     * Returns the current working directory used as resolution base.
     *
     * @returns absolute path of cwd
     *
     * @since 2.0.0
     */

    getCurrentDirectory(): string {
        return LanguageHostService.sys.getCurrentDirectory();
    }

    /**
     * Returns names of all known script files tracked by this host.
     *
     * @returns array of resolved absolute paths
     *
     * @remarks
     * Only includes files previously requested via `getScriptSnapshot` or explicitly `touchFile`/`touchFiles`.
     *
     * @since 2.0.0
     */

    getScriptFileNames(): Array<string> {
        return [ ...this.trackFiles ];
    }

    /**
     * Returns a path to a default lib `.d.ts` file matching the given target.
     *
     * @param options - compiler options (mainly `target`)
     * @returns absolute path to lib.d.ts / lib.esxxxx.d.ts
     *
     * @since 2.0.0
     */

    getDefaultLibFileName(options: CompilerOptions): string {
        return ts.getDefaultLibFilePath(options);
    }

    /**
     * Returns string version identifier for the given file.
     *
     * @param path - file path
     * @returns version as string (usually `"0"`, `"1"`, `"2"`, …)
     *
     * @remarks
     * Tracks file in `trackFiles` set as a side effect so it appears in `getScriptFileNames()`.
     *
     * @since 2.0.0
     */

    getScriptVersion(path: string): string {
        const state = this.filesCache.getSnapshot(path);
        this.trackFiles.add(this.filesCache.resolve(path));

        return state ? state.version.toString() : '0';
    }

    /**
     * Checks whether a file is actively tracked (has been requested before).
     *
     * @param path - file path
     * @returns `true` if the file is known to this host
     *
     * @since 2.0.0
     */

    hasScriptSnapshot(path: string): boolean {
        return this.trackFiles.has(this.filesCache.resolve(path));
    }

    /**
     * Returns an up-to-date script snapshot for the file.
     *
     * @param path - file path
     * @returns `IScriptSnapshot` or `undefined` if a file is missing/empty
     *
     * @remarks
     * Automatically touches the file (reads disk if needed) when no snapshot exists yet.
     *
     * @since 2.0.0
     */

    getScriptSnapshot(path: string): IScriptSnapshot | undefined {
        const state = this.filesCache.getSnapshot(path);
        this.trackFiles.add(this.filesCache.resolve(path));
        if (state) return state.contentSnapshot;

        return this.touchFile(path).contentSnapshot;
    }

    /**
     * Resolves module import using current compiler options and cache.
     *
     * @param moduleName - module specifier
     * @param containingFile - path of a file containing the import
     * @returns resolution result (success and failed lookups)
     *
     * @since 2.0.0
     */

    resolveModuleName(moduleName: string, containingFile: string): ResolvedModuleWithFailedLookupLocations {
        return ts.resolveModuleName(
            moduleName, containingFile, this.compilerOptions, ts.sys, this.moduleResolutionCache
        );
    }

    /**
     * Resolves a module specifier to its absolute file path using the host.
     *
     * @param moduleName - import/export specifier (e.g. "lodash", "./utils")
     * @param containingFile - path of a file containing the import
     * @returns resolved absolute path or `undefined` if resolution fails
     *
     * @since 2.0.0
     */

    resolveModuleFileName(moduleName: string, containingFile: string): string | undefined {
        if (this.aliasCache.has(moduleName)) {
            return this.aliasCache.get(moduleName);
        }

        const resolved = this.resolveModuleName(moduleName, containingFile);
        const result = resolved.resolvedModule?.resolvedFileName;
        this.aliasCache.set(moduleName, result);

        return result;
    }

    /**
     * Rewrites path aliases in declaration content to relative paths.
     *
     * @param content - raw declaration text
     * @param fileName - source file name
     * @param type - file extension to append to resolved paths (e.g., `'.d.ts'`, `'.js'`), defaults to empty string
     * @returns content with aliases replaced by relative paths
     *
     * @remarks
     * Ensures emitted files use portable relative imports instead of aliases.
     * The `type` parameter allows flexible transformation of resolved TypeScript source file extensions
     * (`.ts`, `.tsx`) to any target extension.
     *
     * **Common use cases**:
     * - Pass `'.d.ts'` for declaration file generation
     * - Pass `'.js'` for JavaScript output paths
     * - Pass `''` (default) to preserve the resolved file extension
     *
     * @example
     * ```ts
     * // For regular source files (preserve extension)
     * const code = host.resolveAliases(content, 'src/index.ts');
     *
     * // For declaration files
     * const dts = host.resolveAliases(content, 'src/index.ts', '.d.ts');
     * // '@utils/helpers' -> './utils/helpers.d.ts'
     *
     * // For JavaScript output
     * const js = host.resolveAliases(content, 'src/index.ts', '.js');
     * // '@utils/helpers' -> './utils/helpers.js'
     * ```
     *
     * @since 2.0.0
     */

    resolveAliases(content: string, fileName: string, type: string = ''): string {
        if(!this.alias) return content;

        return content.replace(this.alias, (match, importPath) => {
            const resolve = this.resolveModuleFileName(importPath, fileName);
            if (!resolve) return match;

            const targetFile = resolve.replace(/\.tsx?$/, type);
            const relativePath = relative(dirname(fileName), targetFile);

            return match.replace(importPath, relativePath.startsWith('.') ? relativePath : './' + relativePath);
        });
    }

    /**
     * Builds regex that matches import/export declarations using any configured path alias.
     *
     * @param config - compiler options containing `paths`
     * @returns regex or `undefined` if no `paths` configured
     *
     * @since 2.0.0
     */

    private static generateAliasRegex(config: CompilerOptions): RegExp | undefined {
        const paths = config.paths;
        if (!paths || Object.keys(paths).length < 1) return;

        const aliases = Object.keys(paths)
            .map(alias => alias.replace('/*', '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('|');

        return new RegExp(
            '(?:^|\\s)(?:import|export)\\s+' +  // import or export keyword
            '(?:type\\s+)?' +                   // optional 'type' keyword
            '(?:[^\'"]*from\\s+)?' +            // optional '... from' (non-greedy)
            `['"]((${ aliases })[^'"]*)['"]` +  // capture the quoted path with alias
            ';?',                               // optional semicolon
            'gm'
        );
    }
}
