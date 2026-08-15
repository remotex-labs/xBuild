/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { ModuleResolutionCache, SourceFile } from 'typescript';
import type { LanguageService, Diagnostic, Program } from 'typescript';
import type { EmitAndSemanticDiagnosticsBuilderProgram } from 'typescript';
import type { CacheEntryInterface } from './interfaces/typescript-service.interface';
import type { ParsedCommandLine, BuilderProgramHost, ReadBuildProgramHost } from 'typescript';
import type { DiagnosticInterface, ResolvedModuleInterface } from './interfaces/typescript-service.interface';

/**
 * Imports
 */

import ts from 'typescript';
import { Injectable } from '@remotex-labs/xinject';
import { normalize, relative, dirname } from '@remotex-labs/xmap';
import { DeclarationModel } from '@typescript/models/declaration.model';
import { LanguageHostService } from '@typescript/services/host.service';

/**
 * One TypeScript project, wrapping its language service, module resolution, and declaration emit.
 *
 * @remarks
 * Everything a build needs from TypeScript comes through here:
 *
 * - **Diagnostics** - {@link check}
 * - **Declaration files** - {@link emit} and {@link emitBundle}
 * - **Specifier resolution** - {@link resolve}
 *
 * Each configuration file gets one shared instance, reference counted,
 * so several consumers naming the same `tsconfig.json` share one language service,
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
     * The language service this project's queries run against.
     *
     * @remarks
     * Backed by {@link languageHostService} and a document registry,
     * so the syntax trees of shared files survive between requests.
     *
     * @example
     * ```ts
     * service.languageService.getProgram()?.getSourceFiles().length; // 214
     * ```
     *
     * @since 2.0.0
     */

    readonly languageService: LanguageService;

    /**
     * The host the language service reads files and versions through.
     *
     * @remarks
     * Exposed because it owns the tracked file set, which is what decides the program's file list.
     *
     * @example
     * ```ts
     * service.languageHostService.tracked.size; // grows as the language service resolves imports
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
     * and each entry carries the reference count that decides when its language service is torn down.
     *
     * @see acquire
     * @since 3.0.0
     */

    private static readonly cache = new Map<string, CacheEntryInterface>();

    /**
     * The diagnostics of every file checked so far, keyed by the file name the compiler reported.
     *
     * @remarks
     * Only the affected files are recomputed on a {@link check},
     * so the untouched entries here are what makes the result whole-project rather than only-what-changed.
     * The key is the absolute path the compiler reported,
     * so a caller's own names are resolved before they are read back.
     *
     * @see reconcileDiagnostics
     * @since 3.0.0
     */

    private readonly diagnosticsCache = new Map<string, Array<DiagnosticInterface>>();

    /**
     * The host the builder program reads through.
     *
     * @remarks
     * Routes every read to {@link languageHostService},
     * so the builder sees the same cached content the language service does
     * rather than reaching the disk a second time and disagreeing with it.
     *
     * @since 3.0.0
     */

    private readonly builderHost: ReadBuildProgramHost & BuilderProgramHost = {
        createHash: ts.sys.createHash,
        readFile: (file: string, encoding?: BufferEncoding): string | undefined =>
            this.languageHostService.readFile(file, encoding),
        getCurrentDirectory: (): string => ts.sys.getCurrentDirectory(),
        useCaseSensitiveFileNames: (): boolean => ts.sys.useCaseSensitiveFileNames
    };

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
     * The cache backing {@link resolve}, rebuilt whenever the compiler options change.
     *
     * @see createResolutionCache
     * @since 3.0.0
     */

    private resolutionCache: ModuleResolutionCache;

    /**
     * The builder program of the last {@link check}, carried forward, so the next check only revisits what changed.
     *
     * @remarks
     * Absent before the first check and after a {@link reload}, either of which makes the next check a full pass.
     *
     * @since 3.0.0
     */

    private builder?: EmitAndSemanticDiagnosticsBuilderProgram;

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
        this.resolutionCache = this.createResolutionCache();
        this.languageService = ts.createLanguageService(
            this.languageHostService, ts.createDocumentRegistry(true)
        );

        this.declaration = new DeclarationModel(this);
    }

    /**
     * Reparses the configuration of every shared instance whose file has changed.
     *
     * @returns The configuration paths reparsed by this call, in the order their instances were acquired
     *
     * @remarks
     * This walks the whole shared cache rather than reaching one instance through a holder.
     * A single call after a watch event covers every project in the process,
     * and a configuration several consumers share is reparsed once rather than once per consumer.
     * Each version comes from the shared file model as it stands rather than from disk,
     * since re-reading a changed file is the watcher's part,
     * so an instance whose configuration has not moved costs a map lookup and nothing more.
     * A change discards everything the old options fed:
     * the file set, the resolution cache, the cached declarations, the cached diagnostics, and the builder program,
     * so the next {@link check} runs as a full pass.
     * An instance the constructor built rather than the cache is never reached here.
     *
     * @example
     * ```ts
     * const service = inject(TypescriptService, 'tsconfig.json');
     *
     * TypescriptService.reload(); // [] - nothing has been written since the configuration was read
     * TypescriptService.reload(); // [ 'tsconfig.json' ] - reparsed, and service.config describes the edit
     * ```
     *
     * @see check
     * @see acquire
     *
     * @since 3.0.0
     */

    static reload(): Array<string> {
        const reloaded: Array<string> = [];
        for (const [ path, entry ] of TypescriptService.cache) {
            if (entry.instance.refresh()) reloaded.push(path);
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
     * Type-checks the project and returns the diagnostics of the files named.
     *
     * @param reachable - Files to report on, as the build reaches them, reporting everything checked when omitted
     * @returns Diagnostics of those files, formatted for reporting
     *
     * @remarks
     * Only the files the builder reports as affected are rechecked,
     * their semantic, syntactic, and suggestion diagnostics replacing what was cached for them,
     * while untouched files keep the diagnostics they already had.
     * That is what makes the result whole-project without rechecking it whole.
     * A file matched by the configuration's `exclude` globs is skipped,
     * and a file that has left the program loses its cached diagnostics
     * rather than reporting them against a file that is no longer there.
     *
     * The check covers the program while the report covers `reachable`,
     * which is what lets several variants share one service:
     * the diagnostics are computed once for whatever changed,
     * and each variant reads back the files its own build reaches at the cost of a lookup per file.
     * Narrowing the check instead would consume a file for the variant that saw it first
     * and leave the next one with nothing to report.
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
     * @see reconcileDiagnostics
     *
     * @since 3.0.0
     */

    check(reachable?: Iterable<string>): Array<DiagnosticInterface> {
        const program = this.languageService.getProgram();
        if (!program) return [];

        const ignore = this.languageHostService.ignoreSourceFile;
        const skip = (file: SourceFile): boolean => {
            if(file.fileName.includes('node_modules')) return true;

            return ignore(file);
        };

        let affected;
        this.builder = ts.createEmitAndSemanticDiagnosticsBuilderProgram(program, this.builderHost, this.builder);
        while (affected = this.builder.getSemanticDiagnosticsOfNextAffectedFile(undefined, skip)) {
            if ('fileName' in affected.affected) {
                const file = affected.affected;
                this.diagnosticsCache.set(file.fileName, [
                    ...affected.result,
                    ...this.builder!.getSyntacticDiagnostics(file),
                    ...this.languageService.getSuggestionDiagnostics(file.fileName)
                ].map(diagnostic => this.formatDiagnostic(diagnostic)));
            }
        }

        return this.reconcileDiagnostics(program, reachable ?? this.diagnosticsCache.keys());
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
     * Nothing is type-checked here: declarations are produced by an isolated-declarations pass,
     * and a declaration the compiler cannot infer surfaces through {@link check} rather than as a failure to write.
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
     * Re-reads a batch of files so the language service sees their current content.
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
        const dirCache = this.resolutionCache.getOrCreateCacheForDirectory(container);
        const cached = dirCache.get(specifier, undefined)?.resolvedModule;
        if(cached) return cached as ResolvedModuleInterface;

        const result = <ResolvedModuleInterface> ts.resolveModuleName(
            specifier, containingFile ?? '', this.parsedConfig.options, this.languageHostService, this.resolutionCache
        ).resolvedModule;

        if (result) {
            const path = relative(container, result.resolvedFileName);

            result.container = container;
            result.relativeFileName = path.startsWith('.') ? path : `./${ path }`;
        }

        return result;
    }

    /**
     * Releases this consumer's hold on the shared instance.
     *
     * @remarks
     * The language service is torn down and the instance dropped from the shared cache
     * only once the last holder has released it,
     * so a service several consumers share outlives any one of them.
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

        this.languageService.dispose();
        TypescriptService.cache.delete(this.configPath);
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

    [Symbol.dispose](): void {
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
     * Rebuilds everything this instance derives from its compiler options once its configuration file has moved.
     *
     * @returns Whether the configuration was reparsed
     *
     * @remarks
     * Split out of {@link reload}, so the shared cache decides which instance reloads,
     * while the state it rebuilds stays with the instance holding it.
     * The version is the one the shared file model already holds,
     * since re-reading a file that changed is the watcher's part,
     * so this observes a change rather than going looking for one.
     *
     * @see reload
     * @since 3.0.0
     */

    private refresh(): boolean {
        const { version } = this.languageHostService.filesCache.touch(this.configPath);
        if (version === this.configVersion) return false;

        this.configVersion = version;
        this.parsedConfig = this.parseConfig();
        this.languageHostService.options = this.parsedConfig;
        this.resolutionCache = this.createResolutionCache();
        this.declaration.clear();
        this.diagnosticsCache.clear();
        this.builder = undefined;

        return true;
    }

    /**
     * Builds the module resolution cache for the current options.
     *
     * @returns A cache keyed the way the language host normalizes paths
     *
     * @remarks
     * Real paths go through the host,
     * so a symlinked file is keyed the same here as in the file cache,
     * and the two cannot disagree about which file a specifier reached.
     *
     * @since 3.0.0
     */

    private createResolutionCache(): ModuleResolutionCache {
        return ts.createModuleResolutionCache(
            ts.sys.getCurrentDirectory(),
            path => this.languageHostService.realpath(path),
            this.parsedConfig.options
        );
    }

    /**
     * Reads the diagnostics of a set of files out of the cache, dropping whatever no longer belongs to the program.
     *
     * @param program - Program the files are looked up in
     * @param reachable - Files to read, named as the caller has them, relative or absolute
     * @returns The cached diagnostics of those files, in the order they were named
     *
     * @remarks
     * The walk covers the files asked for rather than the cache,
     * so reporting one variant's inputs costs what that variant reaches rather than what the project holds.
     * Each name is resolved before the lookup,
     * since the cache is keyed by the absolute path the compiler reported,
     * while a build names its inputs relative to its own working directory.
     * A file that leaves the program - deleted, excluded, or no longer reached -
     * would otherwise keep reporting the diagnostics it had when it left,
     * since nothing marks it affected once it is gone,
     * so a name the program no longer carries is dropped from the cache as it is read.
     *
     * @since 3.0.0
     */

    private reconcileDiagnostics(program: Program, reachable: Iterable<string>): Array<DiagnosticInterface> {
        const files = this.languageHostService.filesCache;
        const result: Array<DiagnosticInterface> = [];

        for (const name of reachable) {
            const path = files.resolve(name);
            const diagnostics = this.diagnosticsCache.get(path);

            if (!diagnostics) continue;
            if (program.getSourceFile(path)) result.push(...diagnostics);
            else this.diagnosticsCache.delete(path);
        }

        return result;
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
     *
     * @see DiagnosticInterface
     * @since 2.0.0
     */

    private formatDiagnostic(diagnostic: Diagnostic): DiagnosticInterface {
        const result: DiagnosticInterface = {
            message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
            category: diagnostic.category
        };

        if (diagnostic.file && diagnostic.start !== undefined) {
            const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            result.file = diagnostic.file.fileName;
            result.line = line + 1;
            result.column = character + 1;
            result.code = diagnostic.code;
        }

        return result;
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
        let config = ts.getParsedCommandLineOfConfigFile(
            this.configPath,
            {
                sourceMap: false,
                skipLibCheck: true,
                stripInternal: true,
                declarationMap: false,
                emitDeclarationOnly: true
            },
            {
                ...ts.sys,
                onUnRecoverableConfigFileDiagnostic: () => {}
            }
        );

        if (!config) {
            config = {
                options: {
                    strict: true,
                    target: ts.ScriptTarget.ESNext,
                    module: ts.ModuleKind.NodeNext,
                    sourceMap: false,
                    skipLibCheck: true,
                    stripInternal: true,
                    declarationMap: false,
                    emitDeclarationOnly: true,
                    moduleResolution: ts.ModuleResolutionKind.NodeNext
                },
                errors: [],
                fileNames: [],
                projectReferences: undefined
            };
        }

        config.options = {
            ...config.options,
            noEmit: true,
            rootDir: config.options?.rootDir ?? process.cwd(),
            isolatedModules: false,
            useCaseSensitiveFileNames: true
        };

        return config;
    }
}
