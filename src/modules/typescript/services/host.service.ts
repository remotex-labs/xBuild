/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { ParsedCommandLine } from 'typescript/sync';

/**
 * Imports
 */

import { relative } from '@remotex-labs/xmap';
import { inject } from '@remotex-labs/xinject';
import { FilesModel } from '@models/files.model';
import { createMatcher } from '@components/glob.component';

/**
 * The file set, file versions, and exclusions that one TypeScript project hands to the compiler.
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
 * and reported through {@link isExcluded},
 * while the `excludeTypeChack` globs are reported through {@link isTypeCheckExcluded}.
 *
 * @example
 * ```ts
 * const host = new LanguageHostService(parsedConfig); // entry files tracked and read up front
 *
 * host.observe(program.getSourceFileNames());         // versions the compiler just read
 * host.refreshFiles([ 'src/index.ts' ]);              // the file changed on disk
 * host.collectChanges();                              // [ 'D:/app/src/index.ts' ]
 * host.options = nextParsedConfig;                    // swap configuration and re-track from scratch
 * ```
 *
 * @see FilesModel
 * @since 2.0.0
 */

export class LanguageHostService {
    /**
     * Shared model that reads files, caches their content, and tracks their versions.
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
     * A path is added the first time it is refreshed, then kept even after the file is deleted,
     * so the compiler observes the deletion as a missing file rather than as a root that vanished.
     *
     * @see tracked
     * @since 3.0.0
     */

    private readonly trackedFiles = new Set<string>();

    /**
     * Memoized exclusion verdict per path, keyed by the resolved absolute path.
     *
     * @remarks
     * Exclusion is asked for on every refresh and on every file the type check walks,
     * while the answer only changes with the configuration, so the {@link options} setter clears this.
     *
     * @see isExcluded
     * @since 3.0.0
     */

    private readonly exclusions = new Map<string, boolean>();

    /**
     * The version each file had when the compiler last read it, keyed by the name the compiler gave it.
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
     * The file model revision that {@link collectChanges} last compared against.
     *
     * @remarks
     * While the model's revision still matches, no entry has moved, so the walk over {@link observed} is skipped.
     *
     * @since 3.2.0
     */

    private revision = -1;

    /**
     * A predicate compiled from the configuration's `exclude` globs, tested against working-directory-relative paths.
     *
     * @see isExcluded
     * @since 3.0.0
     */

    private excludes!: (path: string) => boolean;

    /**
     * A predicate compiled from the configuration's `excludeTypeChack` globs,
     * tested against working-directory-relative paths.
     *
     * @see isTypeCheckExcluded
     * @since 3.2.0
     */

    private typeCheckExcludes!: (path: string) => boolean;

    /**
     * Initializes a new {@link LanguageHostService} from a parsed configuration.
     *
     * @param config - Parsed TypeScript configuration carrying the entry file names and the raw globs
     *
     * @remarks
     * Goes through the {@link options} setter, so the entry files are read into the cache and tracked
     * before the host is handed out.
     *
     * @example
     * ```ts
     * const host = new LanguageHostService(api.parseConfigFile('tsconfig.json'));
     * host.getScriptFileNames(); // the configuration's entry files
     * ```
     *
     * @see options
     * @since 3.0.0
     */

    constructor(config: ParsedCommandLine) {
        this.options = config;
    }

    /**
     * The live set of resolved paths currently tracked as program roots.
     *
     * @returns The tracked set itself, growing as files are refreshed
     *
     * @remarks
     * Exposes the same paths as {@link getScriptFileNames} without copying,
     * so asking how many roots there are costs nothing.
     *
     * @example
     * ```ts
     * host.refreshFiles([ 'src/index.ts' ]);
     * host.tracked.size; // 1
     * ```
     *
     * @see getScriptFileNames
     * @since 3.0.0
     */

    get tracked(): ReadonlySet<string> {
        return this.trackedFiles;
    }

    /**
     * Replaces the configuration and re-tracks the project from scratch.
     *
     * @param config - The new parsed configuration
     *
     * @remarks
     * Both glob sets are compiled again, the memoized exclusions and the observed versions are dropped,
     * and the tracked set is replaced by the new entry files, which are read into the cache on the way in.
     * A configuration naming no glob in a set excludes nothing,
     * since {@link createMatcher} reads an empty list as matching every path.
     *
     * @example
     * ```ts
     * host.options = api.parseConfigFile('tsconfig.json');
     * host.getScriptFileNames(); // the new entry files, nothing carried over
     * ```
     *
     * @see createMatcher
     * @since 3.0.0
     */

    set options(config: ParsedCommandLine) {
        const raw = <{ exclude?: Array<string>, excludeTypeChack?: Array<string> } | undefined> config.raw;
        const compile = (globs?: Array<string>): (path: string) => boolean =>
            globs?.length ? createMatcher(globs) : (): boolean => false;

        this.excludes = compile(raw?.exclude);
        this.typeCheckExcludes = compile(raw?.excludeTypeChack);
        this.exclusions.clear();
        this.observed.clear();
        this.trackedFiles.clear();
        this.refreshFiles(config.fileNames);
    }

    /**
     * Re-reads and tracks a batch of files, skipping any path matched by the exclude globs.
     *
     * @param paths - Paths to refresh, relative or absolute
     *
     * @remarks
     * Each retained path is tracked before it is read, so it stays listed even when the file turns out to be gone.
     *
     * @example
     * ```ts
     * host.refreshFiles([ 'src/a.ts', 'src/a.spec.ts' ]); // a.spec.ts skipped when excluded
     * ```
     *
     * @see FilesModel.refresh
     * @since 3.0.0
     */

    refreshFiles(paths: Iterable<string>): void {
        for (const path of paths) {
            if (this.isExcluded(path)) continue;

            const target = this.filesCache.resolve(path);
            this.trackedFiles.add(target);
            this.filesCache.refresh(target);
        }
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
     * A path the model has never read is passed over.
     * Each path is kept as the compiler names it, which is the name a change notification has to carry.
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
            if (version !== undefined) this.observed.set(path, version);
        }

        this.revision = this.filesCache.revision;
    }

    /**
     * Lists the observed files whose version has moved since the compiler read them.
     *
     * @returns The paths the compiler has to re-read, named as it named them, empty when nothing moved
     *
     * @remarks
     * While the file model's revision stands, nothing moved, and the call returns without walking.
     * Each path reported is recorded at its new version,
     * so a change is reported once rather than on every later call.
     * A file the model no longer holds counts as a change, which is how a deletion reaches the compiler.
     *
     * @example
     * ```ts
     * host.refreshFiles([ 'src/index.ts' ]); // the file changed on disk
     * host.collectChanges();                 // [ 'D:/app/src/index.ts' ]
     * host.collectChanges();                 // []
     * ```
     *
     * @see observe
     * @since 3.2.0
     */

    collectChanges(): Array<string> {
        const changed: Array<string> = [];
        if (this.revision === this.filesCache.revision) return changed;

        this.revision = this.filesCache.revision;
        for (const [ path, version ] of this.observed) {
            const current = this.filesCache.getSnapshot(path)?.version ?? -1;
            if (current === version) continue;

            changed.push(path);
            this.observed.set(path, current);
        }

        return changed;
    }

    /**
     * Reports whether a path is excluded by the configuration's `exclude` globs, memorizing the verdict.
     *
     * @param path - File path as the caller holds it, relative or absolute
     * @returns `true` when the path matches the exclude globs
     *
     * @remarks
     * The path is resolved before the verdict is stored, so the same file reached by two spellings is matched once,
     * and every later lookup of either costs a map read.
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
            target, excluded = this.excludes(relative(process.cwd(), target))
        );

        return excluded;
    }

    /**
     * Reports whether the configuration's `excludeTypeChack` globs leave a file out of the type check.
     *
     * @param path - Absolute path of the file, as the compiler names it
     * @returns `true` when the path matches the `excludeTypeChack` globs
     *
     * @remarks
     * The globs are tested against the path relative to the working directory, which is how a project writes them.
     *
     * @example
     * ```ts
     * host.isTypeCheckExcluded('D:/app/src/generated/api.ts'); // true - with [ 'src/generated/**' ]
     * ```
     *
     * @since 3.2.0
     */

    isTypeCheckExcluded(path: string): boolean {
        return this.typeCheckExcludes(relative(process.cwd(), path));
    }
}
