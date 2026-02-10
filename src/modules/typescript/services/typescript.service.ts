/**
 * Import will remove at compile time
 */

import type { ParsedCommandLine, LanguageService, Diagnostic } from 'typescript';
import type { CachedServiceInterface, DiagnosticsInterface } from './interfaces/typescript-service.interface';

/**
 * Imports
 */

import ts from 'typescript';
import { Injectable } from '@symlinks/symlinks.module';
import { BundlerService } from '@typescript/services/bundler.service';
import { EmitterService } from '@typescript/services/emitter.service';
import { LanguageHostService } from '@typescript/services/hosts.service';

/**
 * Manages TypeScript language services with caching and reference counting for shared compiler instances.
 * Provides type checking, code emission, and bundling capabilities through a unified interface that coordinates
 * multiple internal services while maintaining efficient resource usage across multiple consumers.
 *
 * @remarks
 * This service implements a caching strategy to share language service instances across multiple consumers
 * that reference the same `tsconfig.json` file. The lifecycle is managed through reference counting:
 * - Each instantiation increments the reference count for the config path
 * - Calling {@link dispose} decrements the count
 * - When the count reaches zero, the language service is cleaned up automatically
 *
 * The service coordinates three key subsystems:
 * - Language service and host for type checking and analysis
 * - Emitter service for standard TypeScript compilation output
 * - Bundler service for creating bundled outputs from entry points
 *
 * @example
 * ```ts
 * const service = new TypescriptService('tsconfig.json');
 *
 * // Type check all files
 * const diagnostics = service.check();
 * if (diagnostics.length > 0) {
 *   console.error('Type errors found:', diagnostics);
 * }
 *
 * // Emit compiled output
 * await service.emit('./dist');
 *
 * // Clean up when done
 * service.dispose('tsconfig.json');
 * ```
 *
 * @see {@link EmitterService}
 * @see {@link BundlerService}
 * @see {@link LanguageHostService}
 *
 * @since 2.0.0
 */

@Injectable({
    providers: [{ useValue: 'tsconfig.json' }]
})
export class TypescriptService {
    /**
     * Parsed TypeScript compiler configuration including options, file names, and project references.
     * @since 2.0.0
     */

    readonly config: ParsedCommandLine;

    /**
     * TypeScript language service instance providing type checking, intellisense, and compilation capabilities.
     * @since 2.0.0
     */

    readonly languageService: LanguageService;

    /**
     * Custom language service host managing file system interactions and compiler options.
     * @since 2.0.0
     */

    readonly languageHostService: LanguageHostService;

    /**
     * Shared cache mapping config paths to language service instances with reference counting.
     *
     * @remarks
     * This static cache enables multiple service instances to share the same underlying language service
     * when they reference the same `tsconfig.json` file, reducing memory usage and compilation overhead.
     * Entries are automatically cleaned up when reference counts reach zero.
     *
     * @since 2.0.0
     */

    private static readonly serviceCache = new Map<string, CachedServiceInterface>();

    /**
     * Service responsible for emitting compiled TypeScript output files.
     * @since 2.0.0
     */

    private readonly emitterService: EmitterService;

    /**
     * Service responsible for creating bundled outputs from entry points.
     * @since 2.0.0
     */

    private readonly bundlerService: BundlerService;

    /**
     * Creates a new TypeScript service instance or retrieves a cached one for the specified configuration.
     *
     * @param configPath - Path to the `tsconfig.json` file, defaults to `'tsconfig.json'` in the current directory
     *
     * @remarks
     * The constructor performs the following initialization steps:
     * - Acquires or creates a cached language service for the config path
     * - Increments the reference count for the shared service instance
     * - Touches all files listed in the parsed configuration to ensure they're loaded
     * - Initializes emitter and bundler services with the language service
     *
     * If a language service already exists for the given config path, it will be reused rather than
     * creating a new instance, improving performance and reducing memory usage.
     *
     * @example
     * ```ts
     * // Use default tsconfig.json
     * const service = new TypescriptService();
     *
     * // Use custom config path
     * const customService = new TypescriptService('./custom-tsconfig.json');
     * ```
     *
     * @see {@link acquireLanguageService}
     * @see {@link LanguageHostService.touchFiles}
     *
     * @since 2.0.0
     */

    constructor(private configPath: string = 'tsconfig.json') {
        const { config, host, service } = this.acquireLanguageService();

        this.config = config;
        this.languageService = service;
        this.languageHostService = host;
        this.languageHostService.touchFiles(this.config.fileNames);

        this.emitterService = new EmitterService(service, host);
        this.bundlerService = new BundlerService(service, host);
    }

    /**
     * Performs type checking on all source files in the project and returns collected diagnostics.
     *
     * @returns Array of formatted diagnostic information including errors, warnings, and suggestions
     *
     * @remarks
     * This method filters out files that should not be checked (such as `node_modules` and declaration files)
     * and collects three types of diagnostics for each remaining file:
     * - Semantic diagnostics (type errors, type mismatches)
     * - Syntactic diagnostics (parse errors, invalid syntax)
     * - Suggestion diagnostics (optional improvements can be slow)
     *
     * If the language service has no program available, an empty array is returned.
     *
     * @example
     * ```ts
     * const service = new TypescriptService();
     * const diagnostics = service.check();
     *
     * for (const diagnostic of diagnostics) {
     *   console.log(`${diagnostic.file}:${diagnostic.line}:${diagnostic.column}`);
     *   console.log(`${diagnostic.message}`);
     * }
     * ```
     *
     * @see {@link shouldCheckFile}
     * @see {@link collectDiagnostics}
     *
     * @since 2.0.0
     */

    check(filesList?: Array<string>): Array<DiagnosticsInterface> {
        const program = this.languageService.getProgram();
        if (!program) return [];

        const files = (filesList && filesList.length > 0) ?
            filesList.map(file => program.getSourceFile(file)!) :
            this.languageService.getProgram()?.getSourceFiles();

        if (!files) return [];

        return files
            .filter(file => this.shouldCheckFile(file))
            .flatMap(file => this.collectDiagnostics(file));
    }

    /**
     * Marks files as modified to trigger recompilation and updates configuration if the config file changed.
     *
     * @param files - Array of file paths that have been modified or created
     *
     * @remarks
     * This method performs two key operations:
     * - For files that exist in the script snapshot cache, marks them as touched to invalidate cached data
     * - If the modified files include the `tsconfig.json` file, reloads the configuration and updates the host options
     *
     * This is essential for watch mode scenarios where files change during development and the service
     * needs to stay synchronized with the file system state.
     *
     * @example
     * ```ts
     * const service = new TypescriptService();
     *
     * // Notify service of file changes
     * service.touchFiles(['src/index.ts', 'src/utils.ts']);
     *
     * // Config change triggers reload
     * service.touchFiles(['tsconfig.json']);
     * ```
     *
     * @see {@link LanguageHostService.touchFile}
     * @see {@link LanguageHostService.hasScriptSnapshot}
     *
     * @since 2.0.0
     */

    touchFiles(files: Array<string>): void {
        for (const file of files) {
            if (this.languageHostService.hasScriptSnapshot(file)) {
                this.languageHostService.touchFile(file);
            }

            if (file.includes(this.configPath)) {
                const cached = TypescriptService.serviceCache.get(this.configPath)!;
                cached.config = this.parseConfig();
                cached.host.options = cached.config.options;
            }
        }
    }

    /**
     * Emits a bundled output by processing specified entry points through the bundler service.
     *
     * @param entryPoints - Record mapping bundle names to their entry point file paths
     * @param outdir - Optional output directory path, uses compiler options default if not specified
     *
     * @returns Promise that resolves when bundling and emission completes
     *
     * @remarks
     * This method delegates to the bundler service which handles dependency resolution, tree shaking,
     * and output generation. Unlike standard emission, bundling combines multiple modules into
     * optimized output files.
     *
     * @example
     * ```ts
     * const service = new TypescriptService();
     *
     * await service.emitBundle(
     *   { 'main': './src/index.ts', 'worker': './src/worker.ts' },
     *   './dist/bundles'
     * );
     * ```
     *
     * @see {@link BundlerService.emit}
     *
     * @since 2.0.0
     */

    async emitBundle(entryPoints: Record<string, string>, outdir?: string): Promise<void> {
        await this.bundlerService.emit(entryPoints, outdir);
    }

    /**
     * Emits compiled TypeScript output files to the specified directory.
     *
     * @param outdir - Optional output directory path, uses compiler options default if not specified
     *
     * @returns Promise that resolves when emission completes
     *
     * @remarks
     * This method performs standard TypeScript compilation, emitting JavaScript files, declaration files,
     * and source maps according to the compiler options. The emission includes all files in the program
     * that are not excluded by configuration.
     *
     * @example
     * ```ts
     * const service = new TypescriptService();
     *
     * // Emit to default outDir from tsconfig
     * await service.emit();
     *
     * // Emit to custom directory
     * await service.emit('./build');
     * ```
     *
     * @see {@link EmitterService.emit}
     *
     * @since 2.0.0
     */

    async emit(outdir?: string): Promise<void> {
        await this.emitterService.emit(outdir);
    }

    /**
     * Decrements the reference count for a cached service and cleans up if no longer in use.
     *
     * @param tsconfigPath - Path to the TypeScript configuration file identifying which cached service to dispose
     *
     * @remarks
     * This method implements the cleanup phase of the reference counting lifecycle. When the reference count
     * reaches zero, the language service is disposed of and removed from the cache. This should be called
     * when a consumer no longer needs the TypeScript service to prevent resource leaks.
     *
     * If no cached service exists for the given path, this method does nothing.
     *
     * @example
     * ```ts
     * const service = new TypescriptService('tsconfig.json');
     *
     * // Use the service...
     * const diagnostics = service.check();
     *
     * // Clean up when done
     * service.dispose('tsconfig.json');
     * ```
     *
     * @see {@link cleanupUnusedServices}
     *
     * @since 2.0.0
     */

    dispose(tsconfigPath: string): void {
        const cached = TypescriptService.serviceCache.get(tsconfigPath);
        if (!cached) return;

        cached.refCount--;
        TypescriptService.cleanupUnusedServices();
    }

    /**
     * Removes cached language services with zero references and disposes of their resources.
     *
     * @remarks
     * This static method iterates through the service cache and removes entries where the reference
     * count has dropped below one. For each removed entry, the language service's `dispose()` method
     * is called to clean up internal resources before deletion from the cache.
     *
     * This method is called automatically by {@link dispose} and should not typically be invoked directly.
     *
     * @see {@link dispose}
     *
     * @since 2.0.0
     */

    private static cleanupUnusedServices(): void {
        for (const [ path, cached ] of this.serviceCache) {
            if (cached.refCount < 1) {
                cached.service.dispose();
                this.serviceCache.delete(path);
            }
        }
    }

    /**
     * Determines whether a source file should be included in type checking.
     *
     * @param file - TypeScript source file to evaluate
     *
     * @returns `true` if the file should be checked, `false` if it should be excluded
     *
     * @remarks
     * Files are excluded from checking if they meet either condition:
     * - Located in the ` node_modules ` directory (third-party dependencies)
     * - Are TypeScript declaration files (`.d.ts` files)
     *
     * @since 2.0.0
     */

    private shouldCheckFile(file: ts.SourceFile): boolean {
        return file && !file.fileName.includes('node_modules') && !file.isDeclarationFile;
    }

    /**
     * Collects all diagnostic information for a source file, including errors, warnings, and suggestions.
     *
     * @param file - TypeScript source file to collect diagnostics from
     *
     * @returns Array of formatted diagnostic objects with file location and message details
     *
     * @remarks
     * This method gathers three types of diagnostics:
     * - Semantic diagnostics: type errors, undefined variables, type mismatches
     * - Syntactic diagnostics: parse errors, invalid syntax, malformed code
     * - Suggestion diagnostics: optional code improvements (can impact performance)
     *
     * Each diagnostic is formatted using {@link formatDiagnostic} to provide consistent output.
     *
     * @see {@link formatDiagnostic}
     *
     * @since 2.0.0
     */

    private collectDiagnostics(file: ts.SourceFile): DiagnosticsInterface[] {
        return [
            ...this.languageService.getSemanticDiagnostics(file.fileName),
            ...this.languageService.getSyntacticDiagnostics(file.fileName),
            ...this.languageService.getSuggestionDiagnostics(file.fileName) // optional: slow
        ].map(d => this.formatDiagnostic(d));
    }

    /**
     * Retrieves an existing cached language service or creates a new one if none exists.
     *
     * @returns Cached service interface containing config, host, service, and reference count
     *
     * @remarks
     * This method checks the static service cache for an existing language service matching the
     * current `configPath`. If found, it increments the reference count and returns the cached instance.
     * If not found, it delegates to {@link createLanguageService} to create and cache a new instance.
     *
     * @see {@link createLanguageService}
     *
     * @since 2.0.0
     */

    private acquireLanguageService(): CachedServiceInterface {
        const cached = TypescriptService.serviceCache.get(this.configPath);
        if (cached) {
            cached.refCount++;

            return cached;
        }

        return this.createLanguageService();
    }

    /**
     * Creates a new language service instance with host and caches it for future reuse.
     *
     * @returns Newly created cached service interface with reference count initialized to 1
     *
     * @remarks
     * This method performs the following steps:
     * - Parses the TypeScript configuration using {@link parseConfig}
     * - Creates a new language service host with the parsed options
     * - Initializes a TypeScript language service with the host and document registry
     * - Wraps everything in a cache entry with `refCount` set to 1
     * - Stores the entry in the static service cache
     *
     * @see {@link parseConfig}
     * @see {@link LanguageHostService}
     *
     * @since 2.0.0
     */

    private createLanguageService(): CachedServiceInterface {
        const config = this.parseConfig();
        const host = new LanguageHostService(config.options);
        const service = ts.createLanguageService(host, ts.createDocumentRegistry());

        const cached: CachedServiceInterface = { config, host, service, refCount: 1 };
        TypescriptService.serviceCache.set(this.configPath, cached);

        return cached;
    }

    /**
     * Creates a new language service instance with host and caches it for future reuse.
     *
     * @returns Newly created cached service interface with reference count initialized to 1
     *
     * @remarks
     * This method performs the following steps:
     * - Parses the TypeScript configuration using {@link parseConfig}
     * - Creates a new language service host with the parsed options
     * - Initializes a TypeScript language service with the host and document registry
     * - Wraps everything in a cache entry with `refCount` set to 1
     * - Stores the entry in the static service cache
     *
     * @see {@link parseConfig}
     * @see {@link LanguageHostService}
     *
     * @since 2.0.0
     */

    private parseConfig(): ParsedCommandLine {
        let config = ts.getParsedCommandLineOfConfigFile(
            this.configPath,
            {
                skipLibCheck: true,
                stripInternal: true,
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
                    declaration: true,
                    skipLibCheck: true,
                    moduleResolution: ts.ModuleResolutionKind.NodeNext
                },
                errors: [],
                fileNames: [],
                projectReferences: undefined
            };
        }

        config.options = {
            ...config.options,
            rootDir: config.options?.rootDir ?? process.cwd()
        };

        return config;
    }

    /**
     * Converts a TypeScript diagnostic into a standardized diagnostic interface with a formatted message and location.
     *
     * @param diagnostic - Raw TypeScript diagnostic from the compiler
     *
     * @returns Formatted diagnostic object with message, file path, line, column, and error code
     *
     * @remarks
     * This method flattens multi-line diagnostic messages into a single string using newline separators.
     * If the diagnostic includes file and position information, it calculates the human-readable line and
     * column numbers (1-indexed) and includes the diagnostic code.
     *
     * If no file or position information is available, only the message is included in the result.
     *
     * @since 2.0.0
     */

    private formatDiagnostic(diagnostic: Diagnostic): DiagnosticsInterface {
        const result: DiagnosticsInterface = {
            message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
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
}
