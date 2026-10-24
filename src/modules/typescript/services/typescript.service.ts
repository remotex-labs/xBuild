/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { CacheEntryInterface } from './interfaces/typescript-service.interface';
import type { DiagnosticInterface, ResolvedModuleInterface } from './interfaces/typescript-service.interface';
import type { CompilerOptions, Diagnostic, ModuleResolver, ParsedCommandLine } from 'typescript/sync';
import type { Program, Snapshot, SyntheticProjectId } from 'typescript/sync';

/**
 * Imports
 */

import { API } from 'typescript/sync';
import { serverFS } from 'typescript/fs';
import { FilesModel } from '@models/files.model';
import { inject, Injectable } from '@remotex-labs/xinject';
import { normalize, relative, dirname } from '@remotex-labs/xmap';
import { DeclarationModel } from '@typescript/models/declaration.model';
import { LanguageHostService } from '@typescript/services/host.service';

/**
 * One TypeScript project, wrapping its program, module resolution, and declaration emit.
 *
 * @remarks
 * Everything a build needs from TypeScript comes through here:
 *
 * - **Diagnostics** - {@link check}
 * - **Declaration files** - {@link emit} and {@link emitBundle}
 * - **Specifier resolution** - {@link resolve}
 *
 * The compiler runs as a TypeScript 7 process that every instance shares,
 * and reads every file through the shared {@link FilesModel},
 * so the program sees the same content the bundler does.
 * Each configuration file gets one shared instance, reference counted,
 * so several consumers naming the same `tsconfig.json` share one program,
 * and the last {@link dispose} tears it down.
 * The parse forces `emitDeclarationOnly` on,
 * since this asks the compiler for types alone while the bundler produces the JavaScript.
 *
 * @example
 * ```ts
 * const service = inject(TypescriptService, 'tsconfig.json');
 *
 * service.check();                               // [] - the project type-checks
 * await service.emit({ index: 'src/index.ts' }); // [ 'D:/app/dist/index.d.ts' ]
 * service.dispose();                             // released - torn down once nothing else holds it
 * ```
 *
 * @see DeclarationModel
 * @see LanguageHostService
 *
 * @since 2.0.0
 */

@Injectable({
    factory(path?: string): TypescriptService {
        return TypescriptService.acquire(path);
    }
})
export class TypescriptService {
    /**
     * The host that owns the program's root files and the versions the compiler last read.
     *
     * @remarks
     * Exposed because it owns the tracked file set, which is what decides the program's roots,
     * and the `exclude` and `excludeTypeChack` globs the type check consults.
     *
     * @example
     * ```ts
     * service.languageHostService.tracked.size; // grows as files outside the configuration are touched
     * ```
     *
     * @see LanguageHostService
     * @since 2.0.0
     */

    readonly languageHostService: LanguageHostService;

    /**
     * The live instances, keyed by their normalized configuration path.
     *
     * @remarks
     * Static, so sharing spans the whole process rather than one injector,
     * and each entry carries the reference count that decides when its program is torn down.
     *
     * @see acquire
     * @since 3.0.0
     */

    private static readonly cache = new Map<string, CacheEntryInterface>();

    /**
     * The compiler process that every instance talks to, started on first use.
     *
     * @remarks
     * One process serves every project, so a second configuration costs a program rather than a process.
     * The last {@link dispose} closes it, and the next instance starts a fresh one.
     *
     * @see connect
     * @since 3.2.0
     */

    private static client?: API;

    /**
     * The diagnostics of every file checked so far, keyed by the file name the compiler reported.
     *
     * @remarks
     * Rebuilt once per program on a {@link check},
     * so several variants reporting against the same program share one type check.
     * The key is the absolute path the compiler reported,
     * so a caller's own names are resolved before they are read back.
     *
     * @see check
     * @since 3.0.0
     */

    private readonly diagnosticsCache = new Map<string, Array<DiagnosticInterface>>();

    /**
     * The declaration cache and emitter bound to this project.
     *
     * @remarks
     * Constructed with this service, whose {@link resolve} is what decides which specifiers name project files.
     *
     * @see DeclarationModel
     * @since 3.0.0
     */

    private readonly declaration: DeclarationModel;

    /**
     * The configuration currently in force, replaced whenever the file behind it is reparsed.
     *
     * @see parseConfig
     * @since 3.0.0
     */

    private parsedConfig: ParsedCommandLine;

    /**
     * The snapshot version of the configuration file behind the current parse.
     *
     * @remarks
     * Taken from the shared file model, which advances a version whenever the watcher re-reads a file that changed,
     * so comparing it against the version the model now holds tells {@link reload} whether anything needs reparsing.
     *
     * @see reload
     * @since 3.0.0
     */

    private configVersion: number;

    /**
     * The modules {@link resolve} has already found, keyed by the directory and the specifier.
     *
     * @remarks
     * Only a specifier that resolved is held, so one that names a file not written yet resolves once it appears.
     * {@link refresh} clears it with the options the resolutions were made under.
     *
     * @see resolve
     * @since 3.2.0
     */

    private readonly resolutions = new Map<string, ResolvedModuleInterface>();

    /**
     * The resolver behind {@link resolve}, created on first use and dropped whenever the compiler options change.
     *
     * @since 3.2.0
     */

    private resolver?: ModuleResolver;

    /**
     * The compiler snapshot holding this project's current program.
     *
     * @remarks
     * Absent until the program is first asked for.
     * Each change produces a new snapshot from this one,
     * so the compiler reuses whatever the change left untouched,
     * and the snapshot it replaces is disposed.
     *
     * @see program
     * @since 3.2.0
     */

    private snapshot?: Snapshot;

    /**
     * The program of {@link snapshot}, returned as it stands while nothing has changed.
     *
     * @see program
     * @since 3.2.0
     */

    private current?: Program;

    /**
     * The program whose diagnostics {@link diagnosticsCache} currently holds.
     *
     * @remarks
     * A {@link check} against the same program reads the cache back rather than asking the compiler again.
     *
     * @since 3.2.0
     */

    private checked?: Program;

    /**
     * The files the current program holds, as the compiler names them.
     *
     * @remarks
     * Read once per program, so asking whether the program holds a file costs a set lookup rather than a request.
     *
     * @see hasSourceFile
     * @since 3.2.0
     */

    private sourceFiles = new Set<string>();

    /**
     * The number of root files the current program was built from, or `-1` when it has to be rebuilt.
     *
     * @remarks
     * Roots are only ever added between reloads,
     * so a count that moved is what tells {@link program} a file joined the project.
     * It is compared against the size of the tracked set, so the fast path never copies the roots.
     *
     * @since 3.2.0
     */

    private rootCount = -1;

    /**
     * Creates a service for one configuration file.
     *
     * @param configPath - Path of the `tsconfig.json` to run against
     *
     * @remarks
     * Prefer injecting the service, which shares and reference counts instances per configuration path.
     * An instance built here stays outside the shared cache, so nothing else can reach it,
     * and {@link dispose} has no hold of its own to release.
     * A configuration that cannot be read does not throw - {@link parseConfig} falls back to a built-in default.
     *
     * @example
     * ```ts
     * const service = new TypescriptService('tsconfig.build.json');
     * service.config.options.emitDeclarationOnly; // true - forced on regardless of the file
     * ```
     *
     * @see acquire
     * @since 3.0.0
     */

    constructor(readonly configPath: string  = 'tsconfig.json') {
        this.parsedConfig = this.parseConfig();
        this.languageHostService = new LanguageHostService(this.parsedConfig);
        this.configVersion = this.languageHostService.filesCache.touch(this.configPath).version;

        this.declaration = new DeclarationModel(this);
    }

    /**
     * Reparses the configuration of every shared instance whose file has changed.
     *
     * @param force - Whether every instance reparses regardless of whether its configuration file has moved
     * @returns The configuration paths reparsed by this call, in the order their instances were acquired
     *
     * @remarks
     * This walks the whole shared cache rather than reaching one instance through a holder.
     * A single call after a watch event covers every project in the process,
     * and a configuration several consumers share is reparsed once rather than once per consumer.
     *
     * Each version comes from the shared file model as it stands rather than from disk,
     * since re-reading a changed file is the watcher's part,
     * so an instance whose configuration has not moved costs a map lookup and nothing more.
     *
     * Forcing skips that comparison and reparses every instance
     * that catches a change the configuration file's own version misses, such as an edit to a file it extends.
     * The cost is the state of every project in the process rather than the state of what moved.
     *
     * A change discards everything the old options fed:
     * the file set, the exclusions, the resolutions, the cached declarations, and the program,
     * so the next {@link check} runs as a full pass.
     * An instance the constructor built rather than the cache is never reached here.
     *
     * @example
     * ```ts
     * const service = inject(TypescriptService, 'tsconfig.json');
     *
     * TypescriptService.reload();     // [] - nothing has been written since the configuration was read
     * TypescriptService.reload();     // [ 'tsconfig.json' ] - reparsed, and service.config describes the edit
     * TypescriptService.reload(true); // [ 'tsconfig.json' ] - reparsed with nothing written since
     * ```
     *
     * @see check
     * @see acquire
     *
     * @since 3.0.0
     */

    static reload(force: boolean = false): Array<string> {
        const reloaded: Array<string> = [];
        for (const [ path, entry ] of TypescriptService.cache) {
            if (entry.instance.refresh(force)) reloaded.push(path);
        }

        return reloaded;
    }

    /**
     * The parsed configuration this service is running against.
     *
     * @returns The compiler options, file names, and raw configuration currently in force
     *
     * @remarks
     * {@link reload} replaces it wholesale,
     * so a reference taken from here describes the configuration as it stood when it was read.
     *
     * @example
     * ```ts
     * service.config.options.rootDir;  // 'D:/app' - defaulted to the working directory when the file omits it
     * service.config.fileNames.length; // 42
     * ```
     *
     * @since 3.0.0
     */

    get config(): ParsedCommandLine {
        return this.parsedConfig;
    }

    /**
     * The program built from the current roots and file contents.
     *
     * @returns The program of a snapshot that reflects every change the file model has observed
     *
     * @remarks
     * Each access first asks the host which files moved since the compiler read them.
     * When nothing moved and no root was added, the current program is returned as it stands.
     * Otherwise the compiler is told which files changed and a new snapshot is built from the current one,
     * so only what the change reaches is parsed and checked again.
     *
     * @example
     * ```ts
     * service.program.getSourceFileNames().length; // 214
     * service.program === service.program;         // true - nothing changed in between
     * ```
     *
     * @see LanguageHostService.collectChanges
     * @since 3.2.0
     */

    get program(): Program {
        const host = this.languageHostService;
        const changed = host.collectChanges();
        if (this.current && changed.length < 1 && host.tracked.size === this.rootCount) return this.current;

        const previous = this.snapshot;
        const id = <SyntheticProjectId | undefined> this.current?.id;
        const program = { rootFiles: host.getScriptFileNames(), compilerOptions: this.parsedConfig.options };
        const fileNotifications = changed.length > 0 ? { changed } : undefined;

        if (previous && id) {
            this.snapshot = previous.update({ fileNotifications, reconfigurePrograms: [{ id, ...program }] });
            this.current = this.snapshot.getProgram(id)!;
            previous.dispose();
        } else {
            const snapshot = TypescriptService.connect().createSnapshot({ fileNotifications, createPrograms: [ program ] });
            this.snapshot = snapshot;
            this.current = snapshot.operation.createdPrograms[0];
        }

        this.rootCount = host.tracked.size;
        this.sourceFiles = new Set(this.current.getSourceFileNames());
        host.observe(this.sourceFiles);

        return this.current;
    }

    /**
     * Reports whether the current program holds a file.
     *
     * @param path - Resolved absolute path of the file
     * @returns `true` when the program reached the file through its roots or their imports
     *
     * @remarks
     * Brings the {@link program} current first, so a file added since the last request is seen.
     *
     * @example
     * ```ts
     * service.hasSourceFile('D:/app/src/index.ts');   // true
     * service.hasSourceFile('D:/app/scratch/note.ts'); // false - nothing reaches it
     * ```
     *
     * @see program
     * @since 3.2.0
     */

    hasSourceFile(path: string): boolean {
        void this.program;

        return this.sourceFiles.has(path);
    }

    /**
     * Type-checks the project and returns the diagnostics of the files named.
     *
     * @param reachable - Files to report on, as the build reaches them, reporting everything checked when omitted
     * @returns Diagnostics of those files, formatted for reporting
     *
     * @remarks
     * The project is checked once per program,
     * its syntactic, semantic, and suggestion diagnostics replacing what was cached,
     * while a check against an unchanged program reads the cache back.
     * The compiler reuses the parts of the previous program that a change left untouched,
     * so a check after an edit costs what the edit reaches.
     * A file under `node_modules` never reaches the check,
     * a file with the configuration's `excludeTypeChack` globs name is turned away next,
     * and a file matched by the configuration's `exclude` globs is skipped after that.
     *
     * The check covers the program while the report covers `reachable`,
     * which is what lets several variants share one service:
     * the diagnostics are computed once for whatever changed,
     * and each variant reads back the files its own build reaches at the cost of a lookup per file.
     * Each name is resolved as it is read, so a build's own paths serve as they are, relative or absolute.
     *
     * @example
     * ```ts
     * service.check(); // [ { file: 'src/index.ts', line: 3, column: 7, code: 2322, category: 1, message: '...' } ]
     * service.check(); // [] once the file is fixed and the watcher has refreshed it
     *
     * service.check(context.stage.reachableFiles); // only what this variant's build reaches
     * ```
     *
     * @see DiagnosticInterface
     * @see LanguageHostService.isTypeCheckExcluded
     *
     * @since 3.0.0
     */

    check(reachable?: Iterable<string>): Array<DiagnosticInterface> {
        const host = this.languageHostService;
        const program = this.program;
        const cache = this.diagnosticsCache;

        if (this.checked !== program) {
            this.checked = program;
            cache.clear();

            const files = [ ...this.sourceFiles ].filter(file =>
                !file.includes('node_modules') && !host.isTypeCheckExcluded(file) && !host.isExcluded(file)
            );

            if (files.length > 0) for (const diagnostic of [
                ...program.getSyntacticDiagnostics(files),
                ...program.getSemanticDiagnostics(files),
                ...program.getSuggestionDiagnostics(files)
            ]) {
                if (!diagnostic.fileName) continue;

                const entry = cache.get(diagnostic.fileName) ?? [];
                entry.push(this.formatDiagnostic(diagnostic));
                cache.set(diagnostic.fileName, entry);
            }
        }

        const result: Array<DiagnosticInterface> = [];
        for (const name of reachable ?? cache.keys()) {
            const diagnostics = cache.get(host.filesCache.resolve(name));
            if (diagnostics) result.push(...diagnostics);
        }

        return result;
    }

    /**
     * Writes one declaration file per project file the entry points reach.
     *
     * @param entryPoints - Entry files to walk, keyed by the output name each entry itself is written under
     * @param outdir - Directory to write into, defaulting to the configuration's `outDir` and then to `dist`
     * @returns The output paths written by this call, empty when everything was already current
     *
     * @remarks
     * This path always passes a directory on, so `declarationDir` is never consulted.
     * Name it explicitly to write somewhere other than `outDir`.
     * The keys name the entries alone, while the files reached through them keep the layout of the source tree.
     * Declarations come out of this project's program, so the checker writes the types the source leaves out,
     * and a type it cannot write surfaces through {@link check} rather than as a failure to write.
     *
     * @example
     * ```ts
     * await service.emit({ index: 'src/index.ts' });          // [ 'dist/index.d.ts', 'dist/builder.d.ts' ] - absolute
     * await service.emit({ index: 'src/index.ts' });          // [] - nothing changed since
     * await service.emit({ index: 'src/index.ts' }, 'types'); // the same files, written under ./types
     * ```
     *
     * @see emitBundle
     * @since 3.0.0
     */

    async emit(entryPoints: Record<string, string>, outdir?: string): Promise<Array<string>> {
        outdir ??= this.config.options.outDir ?? 'dist';

        return this.declaration.emit(entryPoints, outdir);
    }

    /**
     * Writes one bundled declaration file per entry point.
     *
     * @param entryPoints - Entry files to bundle, keyed by the output name each is written under
     * @param outdir - Directory to write into, defaulting to the configuration's `outDir` and then to `dist`
     * @returns The output paths written, in the order the entry points were given
     *
     * @remarks
     * Each entry becomes one file carrying the declarations of everything it reaches,
     * so a package ships a single `.d.ts` instead of a tree mirroring its source.
     * The keys name the outputs, with `.d.ts` appended to each,
     * which is the shape the bundler's own entry points take and what keeps two entries of one name apart.
     * Every call rebuilds its bundles rather than reading a cache, so unlike {@link emit} this always writes.
     *
     * @example
     * ```ts
     * await service.emitBundle({ index: 'src/index.ts' }, 'dist'); // [ 'D:/app/dist/index.d.ts' ]
     * ```
     *
     * @see emit
     * @since 3.0.0
     */

    async emitBundle(entryPoints: Record<string, string>, outdir?: string): Promise<Array<string>> {
        outdir ??= this.config.options.outDir ?? 'dist';

        return this.declaration.emitBundle(entryPoints, outdir);
    }

    /**
     * Re-reads a batch of files so the program sees their current content.
     *
     * @param files - Paths to refresh, relative or absolute
     *
     * @remarks
     * Each path is tracked as it is refreshed,
     * so naming a file the program has not reached yet adds it rather than passing over it.
     *
     * @example
     * ```ts
     * service.touchFiles([ 'src/index.ts' ]);
     * service.check(); // now reflects what is on disk
     * ```
     *
     * @see LanguageHostService.refreshFiles
     * @since 2.0.0
     */

    touchFiles(files: Array<string>): void {
        this.languageHostService.refreshFiles(files);
    }

    /**
     * Resolves a specifier the way the type checker resolves it.
     *
     * @param specifier - Module specifier as written in the source
     * @param containingFile - File the specifier was written in, since resolution is relative to its directory
     * @returns The resolved module, or `undefined` when the specifier resolves to nothing
     *
     * @remarks
     * An alias or a `paths` mapping resolves the way the compiler sees it rather than the way Node would,
     * which is what lets the declarations rewrite an alias into a path that still resolves.
     * The result carries two fields beyond what the compiler returns:
     * the directory the specifier resolved against, and the path from that directory to the target.
     * The first resolution attaches both, and the cached entry serves them back.
     * With no containing file, the working directory stands in for it.
     *
     * @example
     * ```ts
     * const module = service.resolve('@components/builder', 'D:/app/src/index.ts');
     *
     * module?.resolvedFileName;        // 'D:/app/src/components/builder.ts'
     * module?.relativeFileName;        // './components/builder.ts'
     * module?.isExternalLibraryImport; // false - a project file, not a package
     * ```
     *
     * @see ResolvedModuleInterface
     * @since 3.0.0
     */

    resolve(specifier: string, containingFile?: string): ResolvedModuleInterface | undefined {
        const container = containingFile ? this.languageHostService.filesCache.resolve(dirname(containingFile)) : process.cwd();
        const key = `${ container }\0${ specifier }`;
        const cached = this.resolutions.get(key);
        if (cached) return cached;

        this.resolver ??= TypescriptService.connect().createModuleResolver(this.parsedConfig.options);
        const result = <ResolvedModuleInterface | undefined> this.resolver.resolveModuleName(specifier, container).resolvedModule;
        if (result) {
            const path = relative(container, result.resolvedFileName);

            result.container = container;
            result.relativeFileName = path.startsWith('.') ? path : `./${ path }`;
            this.resolutions.set(key, result);
        }

        return result;
    }

    /**
     * Releases this consumer's hold on the shared instance.
     *
     * @remarks
     * The program is torn down and the instance dropped from the shared cache
     * only once the last holder has released it,
     * so a service several consumers share outlives any one of them.
     * Releasing the last instance in the process also closes the compiler process.
     * The hold released is the one the shared cache keeps under this service's configuration path,
     * so a release takes effect only on an instance the shared cache holds.
     *
     * @example
     * ```ts
     * const service = inject(TypescriptService);
     *
     * service.dispose(); // released - torn down only if nothing else holds it
     * ```
     *
     * @see acquire
     * @since 3.0.0
     */

    dispose(): void {
        const entry = TypescriptService.cache.get(this.configPath);
        if (!entry) return;

        entry.refCount--;
        if (entry.refCount > 0) return;

        this.snapshot?.dispose();
        this.resolver?.dispose();
        this.snapshot = this.current = this.checked = this.resolver = undefined;
        TypescriptService.cache.delete(this.configPath);

        if (TypescriptService.cache.size > 0) return;
        TypescriptService.client?.close();
        TypescriptService.client = undefined;
    }

    /**
     * Releases the service when it leaves a `using` scope.
     *
     * @remarks
     * Delegates to {@link dispose}, so scope-bound and explicit release share one reference count.
     *
     * @example
     * ```ts
     * {
     *     using service = inject(TypescriptService);
     *     service.check();
     * } // released here
     * ```
     *
     * @see dispose
     * @since 3.0.0
     */

    [Symbol.dispose ?? Symbol.for('Symbol.dispose')](): void {
        this.dispose();
    }

    /**
     * Returns the shared instance for a configuration path, creating it on the first request.
     *
     * @param path - Path of the `tsconfig.json` the instance runs against
     * @returns The instance for that path, with its reference count raised
     *
     * @remarks
     * The path is normalized before it serves as the key,
     * so the same configuration reached by two spellings is one instance.
     * The instance is constructed with that normalized key,
     * which is what lets a release find its own entry.
     * Reached through the injectable factory rather than called directly.
     *
     * @see dispose
     * @since 3.0.0
     */

    private static acquire(path: string = 'tsconfig.json'): TypescriptService {
        const key = normalize(path);
        const entry = TypescriptService.cache.get(key);

        if (entry) {
            entry.refCount++;

            return entry.instance;
        }

        const instance = new TypescriptService(key);
        TypescriptService.cache.set(key, { instance, refCount: 1 });

        return instance;
    }

    /**
     * Returns the shared compiler process, starting it on the first request.
     *
     * @returns The API client every instance talks to
     *
     * @remarks
     * The compiler reads file content through the shared {@link FilesModel},
     * so the program, the bundler, and the declarations all work from one copy of each file.
     * Everything else - existence checks, directory listings, real paths - goes to the operating system,
     * and writes are dropped, since the bundler owns every output.
     *
     * @see client
     * @since 3.2.0
     */

    private static connect(): API {
        if (TypescriptService.client) return TypescriptService.client;

        const files = inject(FilesModel);

        return TypescriptService.client = new API({
            cwd: process.cwd(),
            fs: {
                stat: serverFS.useOS,
                realpath: serverFS.useOS,
                fileExists: serverFS.useOS,
                directoryExists: serverFS.useOS,
                getAccessibleEntries: serverFS.useOS,
                readFile: (path: string): string | undefined => files.touch(path).text,
                writeFile: serverFS.noop,
                removeFile: serverFS.noop
            }
        });
    }

    /**
     * Rebuilds everything this instance derives from its compiler options once its configuration file has moved.
     *
     * @param force - Whether the rebuild runs even though the configuration file's version has not moved
     * @returns Whether the configuration was reparsed
     *
     * @remarks
     * Split out of {@link reload}, so the shared cache decides which instance reloads,
     * while the state it rebuilds stays with the instance holding it.
     * The version is the one the shared file model already holds,
     * since re-reading a file that changed is the watcher's part,
     * so this observes a change rather than going looking for one.
     * Forcing drops that guard and rebuilds regardless,
     * which is the only way through for a change the version leaves out.
     * The version is taken and stored either way,
     * so a forced rebuild leaves nothing behind for the next call to mistake for a change.
     *
     * @see reload
     * @since 3.0.0
     */

    private refresh(force: boolean = false): boolean {
        const { version } = this.languageHostService.filesCache.touch(this.configPath);
        if (!force && version === this.configVersion) return false;

        this.configVersion = version;
        this.parsedConfig = this.parseConfig();
        this.languageHostService.options = this.parsedConfig;
        this.resolver?.dispose();
        this.resolver = undefined;
        this.resolutions.clear();
        this.declaration.clear();
        this.rootCount = -1;

        return true;
    }

    /**
     * Reduces a compiler diagnostic to the shape that reporting consumes.
     *
     * @param diagnostic - Diagnostic as the compiler produced it
     * @returns The message and category, with the position and code when the diagnostic has a location
     *
     * @remarks
     * Chained messages are flattened into one string, and line and column are counted from one rather than from zero,
     * since the compiler counts from zero while every editor and terminal reports from one.
     * A diagnostic with no file - a configuration error, say - carries the message and category alone.
     * The file is reported relative to the working directory, which is how a build names its own files.
     *
     * @see DiagnosticInterface
     * @since 2.0.0
     */

    private formatDiagnostic(diagnostic: Diagnostic): DiagnosticInterface {
        const result: DiagnosticInterface = {
            message: this.flattenMessage(diagnostic),
            category: diagnostic.category
        };

        if (diagnostic.fileName && diagnostic.startPosition) {
            result.file = relative(process.cwd(), diagnostic.fileName);
            result.line = diagnostic.startPosition.line + 1;
            result.column = diagnostic.startPosition.character + 1;
            result.code = diagnostic.code;
        }

        return result;
    }

    /**
     * Flattens a diagnostic and its chained messages into one string.
     *
     * @param diagnostic - Diagnostic whose text heads the result
     * @param indent - Depth of this message in the chain, which decides its indentation
     * @returns The message, followed by each chained message on its own line, two spaces deeper per level
     *
     * @remarks
     * Matches the layout the compiler prints, so a chained message reads the same here as in an editor.
     *
     * @since 3.2.0
     */

    private flattenMessage(diagnostic: Diagnostic, indent: number = 0): string {
        let message = `${ '  '.repeat(indent) }${ diagnostic.text }`;
        for (const next of diagnostic.messageChain ?? []) message += `\n${ this.flattenMessage(next, indent + 1) }`;

        return message;
    }

    /**
     * Reads the configuration file and forces the options this build depends on.
     *
     * @returns The parsed configuration, with the forced options applied
     *
     * @remarks
     * Declaration emit is forced on and source maps off,
     * since this asks the compiler for types alone while the bundler produces the JavaScript.
     * `stripInternal` and `skipLibCheck` follow from that.
     * A configuration that cannot be read yields a built-in default rather than an error,
     * so a project without a `tsconfig.json` still type-checks under sensible settings.
     * `rootDir` falls back to the working directory,
     * without which output paths would follow whichever directory the sources happen to share.
     *
     * @since 2.0.0
     */

    private parseConfig(): ParsedCommandLine {
        const api = TypescriptService.connect();
        let config: ParsedCommandLine;

        try {
            config = api.parseConfigFile(this.configPath);
        } catch {
            config = api.parseJsonConfigFileContent({
                files: [],
                compilerOptions: { strict: true, target: 'esnext', module: 'nodenext', moduleResolution: 'nodenext' }
            }, { configDirectory: process.cwd() });
        }

        config.options = {
            ...config.options,
            noEmit: true,
            rootDir: config.options.rootDir ?? <CompilerOptions['rootDir']> process.cwd(),
            sourceMap: false,
            skipLibCheck: true,
            stripInternal: true,
            isolatedModules: false,
            declarationMap: false,
            emitDeclarationOnly: true
        };

        return config;
    }
}
