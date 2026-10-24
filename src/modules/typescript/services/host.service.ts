/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { ParsedCommandLine } from 'typescript/sync';
import type { FileSnapshotInterface } from '@models/interfaces/files-model.interface';

/**
 * Imports
 */

import { relative } from '@remotex-labs/xmap';
import { inject } from '@remotex-labs/xinject';
import { FilesModel } from '@models/files.model';
import { createMatcher } from '@components/glob.component';

/**
 * The file set and file versions that one TypeScript project hands to the compiler.
 *
 * @remarks
 * The compiler runs in its own process, reads every file through the shared {@link FilesModel},
 * and is never told on its own that a file moved.
 * This host keeps the two halves of that bargain:
 *
 * - **Root files** - the configured entry files plus every path refreshed since, which {@link getScriptFileNames}
 *   hands over as the program's roots
 * - **Change tracking** - the version each program file had when the compiler last saw it,
 *   which {@link collectChanges} compares against the file model to list what the compiler has to re-read
 *
 * Paths matched by the configuration's `exclude` globs are skipped by {@link refreshFiles}
 * and reported as excluded through {@link isExcluded}.
 *
 * @example
 * ```ts
 * const host = new LanguageHostService(parsedConfig); // entry files tracked and read up front
 *
 * host.observe(program.getSourceFileNames());         // versions the compiler just read
 * host.refresh('src/index.ts');                       // the file changed on disk
 * host.collectChanges();                              // [ 'D:/app/src/index.ts' ]
 * host.options = nextParsedConfig;                    // swap configuration and re-track from scratch
 * ```
 *
 * @see FilesModel
 * @since 2.0.0
 */

export class LanguageHostService {
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
     * Resolved absolute paths of every file this host has tracked as a program root.
     *
     * @remarks
     * Copied out by {@link getScriptFileNames}, which is what the program takes as its roots.
     * A path is added the first time it is refreshed, then kept even after the file is deleted,
     * so the compiler observes the deletion as a missing file rather than as a root that vanished.
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
     * The version each file had when the compiler last read it, keyed by the resolved absolute path.
     *
     * @remarks
     * The compiler process caches what it read and re-reads a file only once it is told the file changed.
     * {@link observe} records the versions behind a freshly built program,
     * and {@link collectChanges} compares them against the file model to decide what to tell it.
     *
     * @see observe
     * @see collectChanges
     *
     * @since 3.2.0
     */

    private readonly observed = new Map<string, number>();

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
     * const host = new LanguageHostService(api.parseConfigFile('tsconfig.json'));
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
     * host.options = api.parseConfigFile('tsconfig.json');
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
     * - forgets the {@link observed} versions, since the program that read them is about to be rebuilt,
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
        this.matches = this.compileExclude((<{ exclude?: Array<string> } | undefined> this.config.raw)?.exclude);
        this.exclusions.clear();
        this.observed.clear();

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
     * Returns the resolved paths of every file tracked by this host.
     *
     * @returns A snapshot array of the tracked absolute paths
     *
     * @remarks
     * These are the roots the program is built from, and the compiler follows their imports to the rest.
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
     * Records the current version of every file a freshly built program read.
     *
     * @param paths - Files the program holds, as the compiler names them
     *
     * @remarks
     * The compiler read each of these through the file model while building,
     * so the version the model holds now is the one the compiler saw.
     * A path the model has never read, such as a default library the compiler serves itself, is passed over.
     *
     * @example
     * ```ts
     * host.observe(program.getSourceFileNames());
     * host.collectChanges(); // [] - nothing moved since the program was built
     * ```
     *
     * @see collectChanges
     * @since 3.2.0
     */

    observe(paths: Iterable<string>): void {
        for (const path of paths) {
            const version = this.filesCache.getSnapshot(path)?.version;
            if (version !== undefined) this.observed.set(this.filesCache.resolve(path), version);
        }
    }

    /**
     * Lists the observed files whose version has moved since the compiler read them.
     *
     * @returns The resolved paths the compiler has to re-read, empty when nothing moved
     *
     * @remarks
     * Each path reported is recorded at its new version,
     * so a change is reported once rather than on every later call.
     * A file the model no longer holds counts as a change, which is how a deletion reaches the compiler.
     *
     * @example
     * ```ts
     * host.refresh('src/index.ts'); // the file changed on disk
     * host.collectChanges();        // [ 'D:/app/src/index.ts' ]
     * host.collectChanges();        // []
     * ```
     *
     * @see observe
     * @since 3.2.0
     */

    collectChanges(): Array<string> {
        const changed: Array<string> = [];
        for (const [ path, version ] of this.observed) {
            const current = this.filesCache.getSnapshot(path)?.version ?? -1;
            if (current === version) continue;

            changed.push(path);
            this.observed.set(path, current);
        }

        return changed;
    }

    /**
     * Resolves a path to the absolute form used as the tracking and cache key.
     *
     * @param path - File path, relative or absolute
     * @returns The resolved absolute path
     *
     * @remarks
     * Applies the same normalization {@link FilesModel} applies to its cache keys,
     * so the paths handed to the compiler match the ones tracked here.
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
     * The type check asks this for every file it walks, so it agrees with how {@link refreshFiles} filters paths.
     *
     * @example
     * ```ts
     * host.isExcluded('src/index.spec.ts'); // true - matched by the exclude globs
     * host.isExcluded('src/index.ts');      // false
     * ```
     *
     * @see exclusions
     * @since 3.2.0
     */

    isExcluded(path: string): boolean {
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
     * Centralizes the tracking behind {@link refresh}.
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
