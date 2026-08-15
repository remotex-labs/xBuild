/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { FileSnapshotInterface } from '@models/interfaces/files-model.interface';
import type { IScriptSnapshot, SourceFile, ParsedCommandLine, CompilerOptions } from 'typescript';

/**
 * Imports
 */

import ts from 'typescript';
import { relative } from '@remotex-labs/xmap';
import { inject } from '@remotex-labs/xinject';
import { FilesModel } from '@models/files.model';
import { createMatcher } from '@components/glob.component';

/**
 * A TypeScript language service host backed by cached file snapshots and the set of files it has tracked.
 *
 * @remarks
 * Satisfies `ts.LanguageServiceHost`, giving the language service its filesystem access, script snapshots, and
 * compiler configuration.
 * Reads and versions are delegated to the shared {@link FilesModel}, while the file set handed over through
 * {@link getScriptFileNames} is maintained here.
 * A path enters the tracked set the first time it is refreshed or its version is queried,
 * so the set grows from the configured entry files to every dependency the language service resolves into them.
 * Paths matched by the configuration's `exclude` globs are skipped by {@link refreshFiles} and reported as ignored
 * to incremental checks through {@link ignoreSourceFile}.
 *
 * @example
 * ```ts
 * const host = new LanguageHostService(parsedConfig); // entry files tracked and read up front
 *
 * host.refresh('src/index.ts');                       // re-read and track one file
 * host.getScriptSnapshot('src/index.ts');             // what the language service parses
 * host.options = nextParsedConfig;                    // swap configuration and re-track from scratch
 * ```
 *
 * @see FilesModel
 * @since 2.0.0
 */

export class LanguageHostService implements ts.LanguageServiceHost {
    /**
     * Shared model that reads files, caches their snapshots, and tracks their versions.
     *
     * @remarks
     * Registered as a singleton, so every host and build step works against one cache keyed by resolved absolute path.
     *
     * @example
     * ```ts
     * host.filesCache.touch('src/index.ts').version; // 1
     * ```
     *
     * @see FilesModel
     * @since 3.0.0
     */

    readonly filesCache = inject(FilesModel);

    /**
     * Resolved absolute paths of every file this host has tracked for the language service.
     *
     * @remarks
     * Returned verbatim from {@link getScriptFileNames}.
     * A path is added the first time it is refreshed or its version is queried, then kept even after the file is
     * deleted, so the language service observes the deletion through an empty snapshot rather than a vanishing file.
     *
     * @see track
     * @since 3.0.0
     */

    private readonly trackedFiles = new Set<string>();

    /**
     * Memoized exclusion verdict per path, keyed by the resolved absolute path.
     *
     * @remarks
     * Exclusion is asked for on every refresh and on every source file an incremental check walks,
     * while the answer only changes with the configuration, so {@link reload} clears this rather than recomputing it.
     *
     * @see isExcluded
     * @since 3.0.0
     */

    private readonly exclusions = new Map<string, boolean>();

    /**
     * A predicate compiled from the configuration's `exclude` globs, tested against working-directory-relative
     * paths.
     *
     * @remarks
     * Assigned by {@link reload} before any lookup can reach it, hence the definite assignment.
     * It takes a relative path, so {@link isExcluded} is what callers use.
     *
     * @see compileExclude
     * @since 3.0.0
     */

    private matches!: (path: string) => boolean;

    /**
     * Initializes a new {@link LanguageHostService} from a parsed configuration.
     *
     * @param config - Parsed TypeScript configuration carrying the compiler options, entry file names,
     * and the raw `exclude` globs
     *
     * @remarks
     * Runs {@link reload}, so the entry files are read into the cache and tracked before the host is handed out.
     *
     * @example
     * ```ts
     * const config = ts.getParsedCommandLineOfConfigFile('tsconfig.json', {}, ts.sys as never)!;
     * const host = new LanguageHostService(config);
     * host.getScriptFileNames(); // the configuration's entry files
     * ```
     *
     * @see reload
     * @since 3.0.0
     */

    constructor(private config: ParsedCommandLine) {
        this.reload();
    }

    /**
     * The live set of resolved paths currently tracked by this host.
     *
     * @returns The tracked set itself, mutated as files are refreshed and cleared
     *
     * @remarks
     * Exposes the same paths as {@link getScriptFileNames} without copying,
     * so a caller can iterate them or feed them straight back into {@link refreshFiles}.
     *
     * @example
     * ```ts
     * host.refresh('src/index.ts');
     * host.tracked.has(host.realpath('src/index.ts')); // true
     * ```
     *
     * @see getScriptFileNames
     * @since 3.0.0
     */

    get tracked(): Set<string> {
        return this.trackedFiles;
    }

    /**
     * A source-file predicate that incremental checks can use to skip excluded files.
     *
     * @returns A predicate reporting `true` for a source file whose path matches the exclude globs
     *
     * @remarks
     * Bridges the path-based {@link isExcluded} to TypeScript's `ignoreSourceFile` hook by reading the absolute
     * `fileName`, so it agrees with how {@link refreshFiles} filters paths.
     *
     * @example
     * ```ts
     * builder.getSemanticDiagnosticsOfNextAffectedFile(undefined, host.ignoreSourceFile);
     * ```
     *
     * @see refreshFiles
     * @since 3.0.0
     */

    get ignoreSourceFile(): (file: SourceFile) => boolean {
        return (file: SourceFile): boolean => this.isExcluded(file.fileName);
    }

    /**
     * Replaces the configuration and re-tracks the project from scratch.
     *
     * @param config - The new parsed configuration
     *
     * @remarks
     * Delegates to {@link reload}, so the exclude predicate is recompiled and the new `config.fileNames` replace the
     * tracked set entirely.
     *
     * @example
     * ```ts
     * host.options = ts.getParsedCommandLineOfConfigFile('tsconfig.json', {}, ts.sys as never)!;
     * host.getScriptFileNames(); // the new entry files, nothing carried over
     * ```
     *
     * @see reload
     * @since 3.0.0
     */

    set options(config: ParsedCommandLine) {
        this.config = config;
        this.reload();
    }

    /**
     * Drops the tracked set and repopulates it from the configured entry files.
     *
     * @remarks
     * The {@link filesCache} snapshots survive, so only membership is reset,
     * and the files are re-read on the way back in through {@link refreshFiles}.
     *
     * @example
     * ```ts
     * host.refresh('src/scratch.ts');
     * host.clearTracked();
     * host.getScriptFileNames(); // back to the configured entry files, scratch.ts dropped
     * ```
     *
     * @see refreshFiles
     * @since 3.0.0
     */

    clearTracked(): void {
        this.trackedFiles.clear();
        this.refreshFiles(this.config.fileNames);
    }

    /**
     * Rebuilds the exclude predicate and the tracked set from the current configuration.
     *
     * @remarks
     * The single initialization path shared by the constructor and the {@link options} setter:
     * - compiles the `exclude` globs into {@link matches},
     * - drops the memoized {@link exclusions}, whose verdicts belong to the previous globs,
     * - refreshes every entry file through {@link clearTracked}, which reads them into the cache and tracks them.
     *
     * Call it directly when the configuration object was edited in place rather than replaced.
     *
     * @example
     * ```ts
     * host.reload();
     * host.getScriptFileNames(); // what the configuration now selects
     * ```
     *
     * @see clearTracked
     * @since 3.0.0
     */

    reload(): void {
        this.matches = this.compileExclude(this.config.raw?.exclude);
        this.exclusions.clear();

        this.clearTracked();
    }

    /**
     * Re-reads a file from the disk, tracks it, and returns its entry.
     *
     * @param path - File path, relative or absolute
     * @returns The entry for the file, with `version` advanced when the content changed
     *
     * @remarks
     * The path is tracked before the read, so it stays listed even when the file turns out to be gone.
     * Exclusion is not consulted here - {@link refreshFiles} is the caller that filters.
     *
     * @example
     * ```ts
     * const state = host.refresh('src/index.ts');
     * state.version;        // 1 at first sight, advanced on every later change
     * state.snapshot?.text; // the content just read
     * ```
     *
     * @see track
     * @since 3.0.0
     */

    refresh(path: string): FileSnapshotInterface {
        return this.filesCache.refresh(this.track(path));
    }

    /**
     * Refreshes and tracks a batch of files, skipping any path matched by the exclude globs.
     *
     * @param paths - Paths to refresh, defaulting to the currently tracked set
     *
     * @remarks
     * Each retained path goes through {@link refresh} and so becomes tracked.
     * Calling it with no argument brings the already tracked files current, which is what a watch cycle does.
     *
     * @example
     * ```ts
     * host.refreshFiles([ 'src/a.ts', 'src/a.spec.ts' ]); // a.spec.ts skipped when excluded
     * host.refreshFiles();                                // re-read everything already tracked
     * ```
     *
     * @see refresh
     * @since 3.0.0
     */

    refreshFiles(paths: Array<string> | Set<string> = this.trackedFiles): void {
        for (const path of paths) {
            if (this.isExcluded(path)) continue;
            this.refresh(path);
        }
    }

    /**
     * Returns the compiler options currently in force.
     *
     * @returns The active TypeScript compiler options
     *
     * @example
     * ```ts
     * host.getCompilationSettings().target; // ts.ScriptTarget.ES2020
     * ```
     *
     * @since 2.0.0
     */

    getCompilationSettings(): CompilerOptions {
        return this.config.options;
    }

    /**
     * Reports whether a file exists on disk.
     *
     * @param path - Absolute path
     * @returns `true` when the file exists
     *
     * @remarks
     * Goes straight to `ts.sys`, bypassing the snapshot cache, so it reflects the filesystem as it stands now.
     *
     * @example
     * ```ts
     * host.fileExists('/project/src/index.ts'); // true
     * ```
     *
     * @since 2.0.0
     */

    fileExists(path: string): boolean {
        return ts.sys.fileExists(path);
    }

    /**
     * Reads file content through the snapshot cache.
     *
     * @param path - File path, relative or absolute
     * @param encoding - Encoding used when the file is read, defaulting to `utf-8`
     * @returns The file content, or `undefined` when the path holds no readable file
     *
     * @remarks
     * Served from the cache once the file has been read, so the encoding only takes effect on the first read of a path.
     *
     * @example
     * ```ts
     * host.readFile('src/index.ts'); // export const x = 10;
     * host.readFile('src/gone.ts');  // undefined
     * ```
     *
     * @see FilesModel.touch
     * @since 3.0.0
     */

    readFile(path: string, encoding?: BufferEncoding): string | undefined {
        return this.filesCache.touch(path, encoding).snapshot?.text;
    }

    /**
     * Lists the files under a directory that match the given criteria.
     *
     * @param path - Directory to start from
     * @param extensions - File extensions to accept
     * @param exclude - Glob patterns to skip
     * @param include - Glob patterns to keep
     * @param depth - Maximum recursion depth
     * @returns The matching file paths
     *
     * @example
     * ```ts
     * host.readDirectory('src', [ '.ts' ], [ 'node_modules' ], undefined, 2); // [ 'src/index.ts', ... ]
     * ```
     *
     * @since 2.0.0
     */

    readDirectory(path: string, extensions?: Array<string>, exclude?: Array<string>, include?: Array<string>, depth?: number): Array<string> {
        return ts.sys.readDirectory(path, extensions, exclude, include, depth);
    }

    /**
     * Returns the immediate subdirectories of a path.
     *
     * @param path - Directory to list
     * @returns The subdirectory names
     *
     * @example
     * ```ts
     * host.getDirectories('src'); // [ 'services', 'models' ]
     * ```
     *
     * @since 2.0.0
     */

    getDirectories(path: string): Array<string> {
        return ts.sys.getDirectories(path);
    }

    /**
     * Reports whether a directory exists.
     *
     * @param path - Absolute path
     * @returns `true` when the directory exists
     *
     * @example
     * ```ts
     * host.directoryExists('src/services'); // true
     * ```
     *
     * @since 2.0.0
     */

    directoryExists(path: string): boolean {
        return ts.sys.directoryExists(path);
    }

    /**
     * Returns the working directory that relative paths resolve against.
     *
     * @returns The absolute path of the current working directory
     *
     * @example
     * ```ts
     * host.getCurrentDirectory(); // '/project'
     * ```
     *
     * @since 2.0.0
     */

    getCurrentDirectory(): string {
        return ts.sys.getCurrentDirectory();
    }

    /**
     * Returns the resolved paths of every file tracked by this host.
     *
     * @returns A snapshot array of the tracked absolute paths
     *
     * @remarks
     * This is the program's file set as far as the language service is concerned.
     * A deleted file stays listed, so its removal surfaces as a diagnostic rather than as a silently shrinking program.
     *
     * @example
     * ```ts
     * host.getScriptFileNames(); // [ '/project/src/index.ts', '/project/src/utils.ts' ]
     * ```
     *
     * @see tracked
     * @since 2.0.0
     */

    getScriptFileNames(): Array<string> {
        return [ ...this.trackedFiles ];
    }

    /**
     * Returns the path of the default lib file matching the given options.
     *
     * @param options - Compiler options, of which `target` decides the lib
     * @returns Absolute path to the matching `lib.*.d.ts`
     *
     * @example
     * ```ts
     * host.getDefaultLibFileName({ target: ts.ScriptTarget.ES2020 }); // '.../lib.es2020.full.d.ts'
     * ```
     *
     * @since 2.0.0
     */

    getDefaultLibFileName(options: CompilerOptions): string {
        return ts.getDefaultLibFilePath(options);
    }

    /**
     * Returns the version identifier of a file and tracks it.
     *
     * @param path - File path, relative or absolute
     * @returns The version as a string, such as `'1'` or `'2'`
     *
     * @remarks
     * The language service reparses a file only when this string changes, so the value must stay stable while the file
     * does.
     * The read is served from the cache, and {@link refresh} is what moves the version forward.
     *
     * @example
     * ```ts
     * host.getScriptVersion('src/index.ts'); // '1'
     * host.refresh('src/index.ts');          // the file changed on disk
     * host.getScriptVersion('src/index.ts'); // '2' - the language service reparses it
     * ```
     *
     * @see track
     * @since 2.0.0
     */

    getScriptVersion(path: string): string {
        return this.filesCache.touch(this.track(path)).version.toString();
    }

    /**
     * Returns the script snapshot of a file.
     *
     * @param path - File path, relative or absolute
     * @returns The snapshot, or `undefined` when the path holds no readable file
     *
     * @remarks
     * Reads through the cache, loading from the disk at first sight only.
     * Unlike {@link getScriptVersion}, it leaves the tracked set alone - tracking is driven by version queries.
     *
     * @example
     * ```ts
     * const snapshot = host.getScriptSnapshot('src/index.ts');
     * snapshot?.getText(0, snapshot.getLength()); // export const x = 10;
     * ```
     *
     * @see getScriptVersion
     * @since 2.0.0
     */

    getScriptSnapshot(path: string): IScriptSnapshot | undefined {
        return this.filesCache.touch(path).snapshot;
    }

    /**
     * Resolves a path to the absolute form used as the tracking and cache key.
     *
     * @param path - File path, relative or absolute
     * @returns The resolved absolute path
     *
     * @remarks
     * Implements the optional `realpath` host hook with the same normalization {@link FilesModel} applies to its cache
     * keys, so the paths reported to TypeScript match the ones tracked here.
     *
     * @example
     * ```ts
     * host.realpath('src/index.ts'); // '/project/src/index.ts'
     * ```
     *
     * @see FilesModel.resolve
     * @since 3.0.0
     */

    realpath(path: string): string {
        return this.filesCache.resolve(path);
    }

    /**
     * Compiles exclude globs into a matcher over working-directory-relative paths.
     *
     * @param globs - Patterns whose matching paths are excluded, or `undefined` when the configuration has none
     * @returns A predicate reporting `true` for a matched relative path, or one that always reports `false`
     *
     * @remarks
     * The empty case is handled explicitly, since {@link createMatcher} reads an empty pattern list as matching
     * everything, which would exclude the whole project.
     *
     * @see createMatcher
     * @since 3.0.0
     */

    private compileExclude(globs?: Array<string>): (path: string) => boolean {
        return globs && globs.length > 0 ? createMatcher(globs) : (): boolean => false;
    }

    /**
     * Reports whether a path is excluded by the configuration, memorizing the verdict.
     *
     * @param path - File path as the caller holds it, relative or absolute
     * @returns `true` when the path matches the exclude globs
     *
     * @remarks
     * The path is resolved before the verdict is stored, so the same file reached by two spellings is matched once,
     * and every later lookup of either costs a map read.
     *
     * @see exclusions
     * @since 3.0.0
     */

    private isExcluded(path: string): boolean {
        const target = this.filesCache.resolve(path);
        let excluded = this.exclusions.get(target);
        if (excluded === undefined) this.exclusions.set(
            target, excluded = this.matches(relative(process.cwd(), target))
        );

        return excluded;
    }

    /**
     * Adds a path to the tracked set and returns its resolved key.
     *
     * @param path - File path, relative or absolute
     * @returns The resolved absolute path used as the tracking key
     *
     * @remarks
     * Centralizes the tracking shared by {@link refresh} and {@link getScriptVersion}.
     * A path is added the first time it is seen and never removed,
     * so a deletion leaves a still-listed entry that resolves to an empty snapshot.
     *
     * @see trackedFiles
     * @since 3.0.0
     */

    private track(path: string): string {
        const target = this.filesCache.resolve(path);
        this.trackedFiles.add(target);

        return target;
    }
}
