/**
 * Import will remove at compile time
 */

import type { Diagnostic, LanguageService, ParsedCommandLine } from 'typescript';

/**
 * Imports
 */

import ts from 'typescript';
import { relative } from 'path';
import { xterm } from '@remotex-labs/xansi/xterm.component';
import { FrameworkService } from '@services/framework.service';
import { inject, Injectable } from '@symlinks/symlinks.module';
import { formatHost } from '@typescript/constants/typescript.constant';
import { DeclarationService } from '@typescript/services/declaration.service';
import { LanguageHostService } from '@typescript/services/language-host.service';

/**
 * Manages TypeScript compilation, type checking, and declaration file generation.
 *
 * @remarks
 * The {@link TypescriptModule} class provides a high-level interface for TypeScript
 * operations including incremental type checking, declaration file generation, and
 * configuration management. It integrates the TypeScript Language Service API with
 * custom services for file tracking and declaration bundling.
 *
 * **Core components**:
 * - {@link LanguageService}: TypeScript's analysis and compilation engine
 * - {@link LanguageHostService}: File tracking and version management
 * - {@link DeclarationService}: Declaration file generation and bundling
 * - {@link FrameworkService}: Project root and path resolution
 *
 * **Key features**:
 * - Incremental type checking with file version tracking
 * - Semantic, syntactic, and suggestion diagnostics
 * - Single and bundled declaration file generation
 * - Hot reloading of TypeScript configuration
 * - Formatted diagnostic output with color coding
 * - Automatic configuration parsing with fallbacks
 *
 * The module is designed as a singleton to maintain state across the application
 * lifecycle, enabling efficient incremental compilation by reusing the language
 * service and document registry.
 *
 * **Initialization process**:
 * 1. Parses TypeScript configuration from tsconfig.json
 * 2. Creates language service host for file management
 * 3. Initializes TypeScript language service
 * 4. Touches all project files to begin tracking
 * 5. Sets up declaration service for output generation
 *
 * @example
 * ```ts
 * // Basic initialization
 * const typescript = new TypescriptModule('tsconfig.json');
 *
 * // Check for type errors
 * const errors = typescript.check();
 * if (errors.length > 0) {
 *   console.error('Type errors found:');
 *   errors.forEach(err => console.error(err));
 * }
 *
 * // Generate declaration files
 * await typescript.emitDeclarations();
 *
 * // Custom output directory
 * const typescript = new TypescriptModule(
 *   'tsconfig.json',
 *   'build/types',
 *   'dist'
 * );
 *
 * // Watch mode workflow
 * const typescript = new TypescriptModule();
 *
 * // File changed
 * typescript.touchFiles('src/index.ts');
 * const errors = typescript.check();
 * await typescript.emitDeclarations(false); // Only emit changed files
 *
 * // Configuration changed
 * typescript.reload('tsconfig.json');
 * const errors = typescript.check();
 * await typescript.emitDeclarations(true); // Force emit all files
 * ```
 *
 * @see LanguageService
 * @see ParsedCommandLine
 * @see DeclarationService
 * @see LanguageHostService
 *
 * @since 2.0.0
 */

@Injectable({
    scope: 'singleton'
})
export class TypescriptModule {
    /**
     * The TypeScript language service instance for analysis and compilation.
     *
     * @remarks
     * Provides access to TypeScript's type checking, diagnostics, and compilation
     * capabilities. This service is the core engine for all TypeScript operations.
     *
     * @see LanguageService
     * @since 2.0.0
     */

    readonly languageService: LanguageService;

    /**
     * The language service host managing file versions and content access.
     *
     * @remarks
     * Implements the bridge between the TypeScript language service and the file system,
     * handling file tracking, version management, and content caching.
     *
     * @see LanguageHostService
     * @since 2.0.0
     */

    readonly languageServiceHost: LanguageHostService;

    /**
     * Parsed TypeScript configuration including compiler options and file lists.
     *
     * @remarks
     * Contains the processed tsconfig.json with all compiler options, file includes/excludes,
     * and resolved paths. Updated when {@link reload} is called.
     *
     * @see ParsedCommandLine
     * @since 2.0.0
     */

    private config: ParsedCommandLine;

    /**
     * Service for generating and bundling declaration files.
     *
     * @remarks
     * Handles the creation of `.d.ts` files from TypeScript sources, supporting both
     * individual file emission and bundled declarations for library distribution.
     *
     * @see DeclarationService
     * @since 2.0.0
     */

    private readonly declarationService: DeclarationService;

    /**
     * Framework service for accessing project root and path utilities.
     *
     * @remarks
     * Provides the project root path used for relative path calculations in diagnostic
     * output and configuration resolution.
     *
     * @see FrameworkService
     * @since 2.0.0
     */

    private readonly frameworkService = inject(FrameworkService);

    /**
     * Initializes a new TypeScript module with configuration and services.
     *
     * @param configPath - Path to the tsconfig.json file, defaults to 'tsconfig.json'.
     * @param fallbackOutDir - Fallback output directory if not specified in config, defaults to 'dist'.
     *
     * @remarks
     * Creates and configures all necessary services for TypeScript operations:
     *
     * **Configuration**:
     * - Parses the TypeScript configuration using {@link parseConfig}
     * - Applies output directory overrides and fallbacks
     * - Sets base and root directories from framework service
     *
     * **Service initialization**:
     * - Creates {@link LanguageHostService} for file tracking
     * - Initializes TypeScript {@link LanguageService} for compilation
     * - Sets up {@link DeclarationService} for declaration generation
     *
     * **File tracking**:
     * - Touches all project files from the configuration
     * - Begins version tracking for incremental compilation
     *
     * The constructor uses dependency injection via {@link inject} to obtain service
     * instances, ensuring proper singleton management and configuration sharing.
     *
     * @example
     * ```ts
     * // Default configuration
     * const typescript = new TypescriptModule();
     *
     * // Custom config path
     * const typescript = new TypescriptModule('config/tsconfig.build.json');
     *
     * // Custom output directory
     * const typescript = new TypescriptModule(
     *   'tsconfig.json',
     *   'build/types'
     * );
     *
     * // Full customization
     * const typescript = new TypescriptModule(
     *   'tsconfig.production.json',
     *   'dist/declarations',
     *   'output'
     * );
     * ```
     *
     * @see parseConfig
     * @see LanguageService
     * @see DeclarationService
     * @see LanguageHostService
     *
     * @since 2.0.0
     */

    constructor(configPath: string = 'tsconfig.json', fallbackOutDir: string = 'dist') {
        this.config = this.parseConfig(configPath, fallbackOutDir);
        this.languageServiceHost = inject(LanguageHostService, this.config.options);
        this.languageService = this.createLanguageService();

        this.languageServiceHost.touchFiles(this.config.fileNames);
        this.declarationService = inject(
            DeclarationService,
            this.languageService,
            this.languageServiceHost
        );
    }

    /**
     * Marks files as modified to trigger incremental recompilation.
     *
     * @param touchFiles - Single file path or array of file paths to mark as modified.
     *
     * @remarks
     * This method updates the version tracking for specified files, signaling to the
     * TypeScript language service that these files have changed and need reanalysis.
     * Only files that are part of the current program are touched.
     *
     * **File validation**:
     * - Checks if each file exists in the current program
     * - Skips files not part of the compilation
     * - Prevents touching external or excluded files
     *
     * **Use cases**:
     * - Watch mode when files change on disk
     * - Virtual file system updates
     * - Forced recompilation of specific files
     * - Incremental build workflows
     *
     * After touching files, call {@link check} to get updated diagnostics or
     * {@link emitDeclarations} to regenerate declaration files.
     *
     * @example
     * ```ts
     * const typescript = new TypescriptModule();
     *
     * // Touch single file
     * typescript.touchFiles('src/index.ts');
     *
     * // Touch multiple files
     * typescript.touchFiles([
     *   'src/index.ts',
     *   'src/utils.ts',
     *   'src/types.ts'
     * ]);
     *
     * // Watch mode pattern
     * watcher.on('change', (filePath) => {
     *   typescript.touchFiles(filePath);
     *   const errors = typescript.check();
     *   if (errors.length > 0) {
     *     console.error('Type errors:', errors);
     *   }
     * });
     * ```
     *
     * @see check
     * @see emitDeclarations
     * @see LanguageHostService.touchFile
     *
     * @since 2.0.0
     */

    touchFiles(touchFiles: string | Array<string>): void {
        const files = Array.isArray(touchFiles) ? touchFiles : [ touchFiles ];
        const program = this.languageService.getProgram()!;

        for (const file of files) {
            if (program.getSourceFile(file)) {
                this.languageServiceHost.touchFile(file);
            }
        }
    }

    /**
     * Performs comprehensive type checking and returns formatted diagnostics.
     *
     * @returns Array of formatted diagnostic messages, empty if no issues found.
     *
     * @remarks
     * This method runs TypeScript's complete diagnostic suite on all project files,
     * collecting semantic errors, syntactic errors, and improvement suggestions.
     * Results are formatted with color coding and relative file paths for readability.
     *
     * **Diagnostic types collected**:
     * - **Semantic diagnostics**: Type errors, incorrect usage, missing declarations
     * - **Syntactic diagnostics**: Parse errors, invalid syntax
     * - **Suggestion diagnostics**: Code improvements, potential issues (slower)
     *
     * **File filtering**:
     * - Excludes files in node_modules
     * - Excludes declaration files (`.d.ts`)
     * - Only checks project source files
     *
     * **Performance note**:
     * Suggestion diagnostics ({@link LanguageService.getSuggestionDiagnostics}) are
     * comprehensive but slow. Consider disabling them in performance-critical scenarios
     * or large projects.
     *
     * The diagnostics are formatted using {@link formatDiagnostics} with color-coded
     * output including file paths, line numbers, error codes, and messages.
     *
     * @example
     * ```ts
     * const typescript = new TypescriptModule();
     *
     * // Run type checking
     * const errors = typescript.check();
     *
     * if (errors.length > 0) {
     *   console.error('Type checking failed:');
     *   errors.forEach(error => console.error(error));
     *   process.exit(1);
     * } else {
     *   console.log('Type checking passed!');
     * }
     *
     * // Example output:
     * // [TS] src/index.ts:10:5 - error TS2322: Type 'string' is not assignable to type 'number'.
     * // [TS] src/utils.ts:25:12 - error TS2304: Cannot find name 'undefined'.
     *
     * // Incremental checking
     * const typescript = new TypescriptModule();
     *
     * watcher.on('change', (file) => {
     *   typescript.touchFiles(file);
     *   const errors = typescript.check();
     *   // Only files with version changes are rechecked
     * });
     * ```
     *
     * @see formatDiagnostics
     * @see LanguageService.getSemanticDiagnostics
     * @see LanguageService.getSyntacticDiagnostics
     * @see LanguageService.getSuggestionDiagnostics
     *
     * @since 2.0.0
     */

    check(): Array<string> {
        const diagnostics: Array<string> = [];
        const files = this.languageService.getProgram()?.getSourceFiles() ?? [];

        const diagnostic = this.formatDiagnostics.bind(this);
        for (const file of files) {
            if (!file.fileName.includes('node_modules') && !file.isDeclarationFile) {
                diagnostics.push(...diagnostic(this.languageService.getSemanticDiagnostics(file.fileName)));
                diagnostics.push(...diagnostic(this.languageService.getSyntacticDiagnostics(file.fileName)));

                // good but slow as hell
                diagnostics.push(...diagnostic(this.languageService.getSuggestionDiagnostics(file.fileName)));
            }
        }

        return diagnostics;
    }

    /**
     * Reloads TypeScript configuration and clears all caches.
     *
     * @param configPath - Path to the tsconfig.json file, defaults to 'tsconfig.json'.
     * @param fallbackOutDir - Fallback output directory if not specified in config, defaults to 'dist'.
     *
     * @remarks
     * This method performs a complete reset of the TypeScript module, useful when
     * configuration files change or when a fresh compilation state is needed. It's
     * essential for watch mode implementations and hot reloading scenarios.
     *
     * **Reload process**:
     * 1. **Parse configuration**: Reads and processes tsconfig.json using {@link parseConfig}
     * 2. **Reset language host**: Clears all file version tracking and caches via {@link LanguageHostService.reload}
     * 3. **Touch files**: Marks all project files for tracking
     * 4. **Clear declaration cache**: Resets declaration service state
     * 5. **Clear semantic cache**: Removes TypeScript's internal type caches
     *
     * **What gets cleared**:
     * - File version tracking
     * - Path resolution cache
     * - Snapshot cache
     * - Semantic type cache
     * - Declaration generation state
     *
     * **Use cases**:
     * - tsconfig.json file changes
     * - Compiler option updates
     * - File list changes (includes/excludes)
     * - Path mapping changes
     * - Full rebuild requirements
     * - Memory pressure recovery
     *
     * After reloading, the module is in a fresh state equivalent to a new construction,
     * but reuses the same language service instance for better performance.
     *
     * @example
     * ```ts
     * const typescript = new TypescriptModule();
     *
     * // Watch tsconfig.json for changes
     * watchFile('tsconfig.json', () => {
     *   console.log('Configuration changed, reloading...');
     *   typescript.reload();
     *
     *   const errors = typescript.check();
     *   if (errors.length === 0) {
     *     console.log('Reload successful!');
     *   }
     * });
     *
     * // Change output directory
     * typescript.reload('tsconfig.json', 'new-output-dir');
     *
     * // Switch to different configuration
     * if (isProduction) {
     *   typescript.reload('tsconfig.production.json');
     * } else {
     *   typescript.reload('tsconfig.development.json');
     * }
     *
     * // Force fresh compilation
     * typescript.reload();
     * await typescript.emitDeclarations(true); // Force emit all
     * ```
     *
     * @see parseConfig
     * @see DeclarationService.reload
     * @see LanguageHostService.reload
     * @see LanguageService.cleanupSemanticCache
     *
     * @since 2.0.0
     */

    reload(configPath: string = 'tsconfig.json', fallbackOutDir: string = 'dist'): void {
        /**
         * Clean cache
         */

        this.config = this.parseConfig(configPath, fallbackOutDir);
        this.languageServiceHost.reload(this.config.options);
        this.languageServiceHost.touchFiles(this.config.fileNames);

        /**
         * Reload typescript configuration
         */

        this.declarationService.reload();
        this.languageService.cleanupSemanticCache();
    }

    /**
     * Generates declaration files for all or modified source files.
     *
     * @param force - If true, emits all files; if false, only emits modified files (defaults to false).
     * @returns A promise that resolves when all declarations are written to disk.
     *
     * @remarks
     * This method generates `.d.ts` declaration files from TypeScript sources, supporting
     * both incremental and full compilation modes. It uses the {@link DeclarationService}
     * to handle file emission with proper path resolution and alias handling.
     *
     * **Emission modes**:
     * - **Incremental** (`force: false`): Only emits files that have been touched since
     *   last emission. Efficient for watch mode and incremental builds.
     * - **Full** (`force: true`): Emits all project files regardless of changes. Required
     *   after configuration changes or for clean builds.
     *
     * **Generated files**:
     * - Individual `.d.ts` files for each source file
     * - Path aliases resolved to relative imports
     * - Source maps (if configured)
     * - Output respects `outDir` configuration
     *
     * **File organization**:
     * The output structure mirrors the source structure:
     * ```
     * src/
     *   index.ts
     *   utils/
     *     helper.ts
     * dist/
     *   index.d.ts
     *   utils/
     *     helper.d.ts
     * ```
     *
     * This method is asynchronous because file writing operations use promises.
     * Multiple files may be emitted in parallel for better performance.
     *
     * @example
     * ```ts
     * const typescript = new TypescriptModule();
     *
     * // Incremental emission (only changed files)
     * await typescript.emitDeclarations();
     *
     * // Force emit all files
     * await typescript.emitDeclarations(true);
     *
     * // Watch mode pattern
     * watcher.on('change', async (file) => {
     *   typescript.touchFiles(file);
     *   await typescript.emitDeclarations(); // Only emits changed file
     * });
     *
     * // Build script
     * const typescript = new TypescriptModule('tsconfig.json', 'types');
     *
     * console.log('Generating declaration files...');
     * await typescript.emitDeclarations(true);
     * console.log('Declaration files generated!');
     *
     * // After configuration reload
     * typescript.reload();
     * await typescript.emitDeclarations(true); // Force required after reload
     * ```
     *
     * @see touchFiles
     * @see emitBundleDeclarations
     * @see DeclarationService.emitDeclarations
     *
     * @since 2.0.0
     */

    async emitDeclarations(force: boolean = false): Promise<void> {
        await this.declarationService.emitDeclarations(force);
    }

    /**
     * Generates bundled declaration files for library distribution.
     *
     * @param entryPoints - Record mapping output file paths to source entry point paths.
     * @returns A promise that resolves when all bundle declarations are written to disk.
     *
     * @remarks
     * This method creates consolidated `.d.ts` files by bundling all types from multiple
     * source files into single declaration files. This is ideal for library packages that
     * want to expose a clean public API without internal file structure.
     *
     * **Entry points structure**:
     * ```ts
     * {
     *   'index': 'src/index.ts',              // → dist/index.d.ts
     *   'components/index': 'src/components/index.ts'  // → dist/components/index.d.ts
     * }
     * ```
     *
     * **Bundling process**:
     * 1. Analyzes each entry point to find exported symbols
     * 2. Collects type declarations from all referenced files
     * 3. Removes internal imports between bundled files
     * 4. Generates a single `.d.ts` with all types
     * 5. Creates a clean export statement for public API
     *
     * **Benefits**:
     * - **Simplified imports**: Users import from a single file
     * - **Reduced file count**: One declaration file per entry point
     * - **Cleaner API**: Internal structure hidden from consumers
     * - **Better tree-shaking**: Clear exported symbols
     * - **Easier versioning**: Single file per major export
     *
     * **Output example**:
     * ```ts
     * // dist/index.d.ts (bundled)
     * declare class MyClass { }
     * declare function myFunction(): void;
     * declare interface MyInterface { }
     *
     * export {
     *   MyClass,
     *   MyFunction,
     *   MyInterface
     * };
     * ```
     *
     * This is particularly useful for library authors who want to provide a clean,
     * flat API surface while maintaining a complex internal file structure.
     *
     * @example
     * ```ts
     * const typescript = new TypescriptModule();
     *
     * // Single entry point
     * await typescript.emitBundleDeclarations({
     *   'index': 'src/index.ts'
     * });
     * // Generates: dist/index.d.ts
     *
     * // Multiple entry points
     * await typescript.emitBundleDeclarations({
     *   'index': 'src/index.ts',
     *   'components/index': 'src/components/index.ts',
     *   'utils/index': 'src/utils/index.ts'
     * });
     * // Generates:
     * // dist/index.d.ts
     * // dist/components/index.d.ts
     * // dist/utils/index.d.ts
     *
     * // Library package setup
     * const entryPoints = {
     *   'index': 'src/index.ts',           // Main API
     *   'testing': 'src/testing/index.ts', // Testing utilities
     *   'internal': 'src/internal/index.ts' // Internal tools
     * };
     *
     * await typescript.emitBundleDeclarations(entryPoints);
     *
     * // Package.json exports
     * {
     *   "exports": {
     *     ".": "./dist/index.d.ts",
     *     "./testing": "./dist/testing.d.ts",
     *     "./internal": "./dist/internal.d.ts"
     *   }
     * }
     * ```
     *
     * @see emitDeclarations
     * @see DeclarationService.emitBundleDeclarations
     *
     * @since 2.0.0
     */

    async emitBundleDeclarations(entryPoints: Record<string, string>): Promise<void> {
        await this.declarationService.emitBundleDeclarations(entryPoints);
    }

    /**
     * Formats TypeScript diagnostics into readable colored strings.
     *
     * @param diagnostics - Array of TypeScript diagnostic objects to format.
     * @returns Array of formatted diagnostic strings with color coding and file locations.
     *
     * @remarks
     * This method transforms raw TypeScript {@link Diagnostic} objects into human-readable
     * error messages with syntax highlighting and relative file paths. Each diagnostic
     * includes the file location, line number, error code, and description.
     *
     * **Output format**:
     * ```
     * [TS] src/index.ts:10:5 - error TS2322: Type 'string' is not assignable to type 'number'.
     * ```
     *
     * **Color coding** (via {@link xterm}):
     * - `[TS]`: Deep orange tag
     * - File path: Cyan (#5fd7ff)
     * - Line:column: Light yellow
     * - "error": Light coral
     * - Error code: Gray
     * - Message: Default color
     *
     * **Diagnostic types**:
     * - **With file location**: Full format with file, line, column, code, and message
     * - **Without file location**: Plain message text (typically configuration errors)
     *
     * **Path handling**:
     * File paths are converted to relative paths from the project root using
     * {@link FrameworkService.rootPath}, making output more readable and portable
     * across different machines.
     *
     * This method is used internally by {@link check} to format all diagnostic output.
     *
     * @example
     * ```ts
     * const typescript = new TypescriptModule();
     * const program = typescript.languageService.getProgram();
     * const sourceFile = program.getSourceFile('src/index.ts');
     *
     * // Get and format diagnostics
     * const diagnostics = typescript.languageService.getSemanticDiagnostics(
     *   sourceFile.fileName
     * );
     * const formatted = typescript.formatDiagnostics(diagnostics);
     *
     * // Output to console
     * formatted.forEach(msg => console.error(msg));
     *
     * // Example formatted output:
     * // [TS] src/utils/helper.ts:25:12 - error TS2304: Cannot find name 'undefined'.
     * // [TS] src/types/index.ts:5:8 - error TS2322: Type '{}' is not assignable to type 'Config'.
     * ```
     *
     * @see check
     * @see Diagnostic
     *
     * @since 2.0.0
     */

    private formatDiagnostics(diagnostics: ReadonlyArray<Diagnostic>): Array<string> {
        if (!diagnostics.length) return [];

        const rootPath = this.frameworkService.rootPath;
        const result: Array<string> = [];

        for (let i = 0; i < diagnostics.length; i++) {
            const diagnostic = diagnostics[i];

            if (diagnostic.file && diagnostic.start !== undefined) {
                const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
                const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                const filePath = relative(rootPath, diagnostic.file.fileName);

                result.push(
                    `${
                        xterm.deepOrange('[TS]')
                    } ${
                        xterm.hex('#5fd7ff')(filePath)
                    }:${
                        xterm.lightYellow(`${ line + 1 }:${ character + 1 }`)
                    } - ${
                        xterm.lightCoral('error')
                    } ${
                        xterm.gray(`TS${ diagnostic.code }`)
                    }: ${ message }`
                );
            } else {
                result.push(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
            }
        }

        return result;
    }

    /**
     * Parses TypeScript configuration file with fallback options.
     *
     * @param tsconfigPath - Path to the tsconfig.json file to parse.
     * @param fallbackOutDir - Fallback output directory if not specified in config.
     * @returns Parsed TypeScript configuration with compiler options and file lists.
     * @throws Error if the configuration file cannot be parsed or contains unrecoverable errors.
     *
     * @remarks
     * This method loads and processes a TypeScript configuration file, applying default
     * compiler options and resolving paths relative to the project root. It handles
     * configuration inheritance (extends), file patterns, and compiler option merging.
     *
     * **Default compiler options applied**:
     * - `skipLibCheck: true`: Skip type checking of declaration files for performance
     * - `stripInternal: true`: Remove `@internal` marked declarations from output
     * - `emitDeclarationOnly: true`: Only generate declaration files, no JavaScript
     *
     * **Path resolution**:
     * - `outDir`: Uses override → config value → fallback (in that order)
     * - `baseUrl`: Uses config value → framework root path
     * - `rootDir`: Uses config value → framework root path
     *
     * **Configuration processing**:
     * TypeScript's {@link ts.getParsedCommandLineOfConfigFile} handles:
     * - Extends resolution (inheriting from base configs)
     * - File pattern matching (include/exclude)
     * - Compiler option validation
     * - Path mapping resolution
     * - Type root resolution
     *
     * **Error handling**:
     * Unrecoverable configuration errors (syntax errors, missing extends, invalid options)
     * are thrown immediately with formatted diagnostic messages.
     *
     * @example
     * ```ts
     * // Basic parsing
     * const config = parseConfig('tsconfig.json');
     * console.log(config.options.target); // ScriptTarget enum
     * console.log(config.fileNames); // ['src/index.ts', 'src/utils.ts', ...]
     *
     * // Custom output directory
     * const config = parseConfig('tsconfig.json', 'build/types');
     * console.log(config.options.outDir); // 'build/types'
     *
     * // With fallback
     * const config = parseConfig('tsconfig.json', undefined, 'output');
     * // Uses config.outDir if present, otherwise 'output'
     *
     * // Error handling
     * try {
     *   const config = parseConfig('invalid-config.json');
     * } catch (error) {
     *   console.error('Configuration error:', error.message);
     * }
     * ```
     *
     * @see FrameworkService
     * @see ParsedCommandLine
     * @see ts.getParsedCommandLineOfConfigFile
     *
     * @since 2.0.0
     */

    private parseConfig(tsconfigPath: string, fallbackOutDir?: string): ParsedCommandLine {
        // todo use the config directly
        // todo exclude includes ??? this.config.fileNames = [ 'src/index.ts' ];
        // add default configuration if not set tsconfig.json
        const config = ts.getParsedCommandLineOfConfigFile(
            tsconfigPath,
            {
                skipLibCheck: true,
                stripInternal: true,
                emitDeclarationOnly: true
            },
            {
                ...ts.sys,
                onUnRecoverableConfigFileDiagnostic: (d) => {
                    throw new Error(ts.formatDiagnostic(d, formatHost));
                }
            }
        );

        if (!config)
            throw new Error(`Unable to parse TypeScript configuration: ${ tsconfigPath }`);

        config.options = {
            ...config.options,
            outDir: config.options.outDir || fallbackOutDir,
            baseUrl: config.options.baseUrl || this.frameworkService.rootPath,
            rootDir: config.options.rootDir || this.frameworkService.rootPath
        };

        return config;
    }

    /**
     * Creates a TypeScript language service instance.
     *
     * @returns A new {@link LanguageService} instance configured with the language service host.
     *
     * @remarks
     * This method initializes the TypeScript language service, which provides the core
     * functionality for type checking, diagnostics, and code analysis. The service is
     * created with:
     *
     * - {@link languageServiceHost}: Provides file access and version tracking
     * - Document registry: Caches parsed syntax trees for performance
     *
     * **Document registry benefits**:
     * - Reuses AST (Abstract Syntax Tree) for unchanged files
     * - Maintains semantic information across compilations
     * - Improves incremental compilation performance
     * - Reduces memory allocation by sharing immutable nodes
     *
     * The language service is stateful and maintains internal caches that can be cleared
     * via {@link LanguageService.cleanupSemanticCache} when needed (typically during
     * configuration reloads).
     *
     * This method is called once during construction and the same instance is reused
     * throughout the module's lifecycle, even across {@link reload} operations.
     *
     * @example
     * ```ts
     * // Called internally during construction
     * const typescript = new TypescriptModule();
     * // typescript.languageService is now available
     *
     * // Access language service capabilities
     * const program = typescript.languageService.getProgram();
     * const diagnostics = typescript.languageService.getSemanticDiagnostics();
     * const suggestions = typescript.languageService.getSuggestionDiagnostics();
     * ```
     *
     * @see LanguageService
     * @see LanguageHostService
     * @see ts.createLanguageService
     * @see ts.createDocumentRegistry
     *
     * @since 2.0.0
     */

    private createLanguageService(): LanguageService {
        return ts.createLanguageService(
            this.languageServiceHost,
            ts.createDocumentRegistry()
        );
    }

    /**
     * Initializes diagnostic system with plugin support (currently unused).
     *
     * @remarks
     * This method is a placeholder for future diagnostic plugin integration, such as
     * support for TypeScript language service plugins that enhance or modify diagnostic
     * behavior (e.g., macros, custom transformers, or specialized type checking).
     *
     * **Potential use cases**:
     * - TypeScript macro plugins
     * - Custom diagnostic filters
     * - Enhanced error messages
     * - Framework-specific type checking
     * - Lint rule integration
     *
     * Currently commented out but reserved for future extensibility. When activated,
     * it would wrap the language service's diagnostic methods to integrate with
     * external plugins.
     *
     * @example
     * ```ts
     * // Future usage (currently disabled)
     * private initializeDiagnostics(): void {
     *   // Add support for ts-plugin macros
     *   getSemanticDiagnostics(this.languageService, ts, this.languageServiceHost);
     *   getSyntacticDiagnostics(this.languageService, ts, this.languageServiceHost);
     * }
     * ```
     *
     * @see LanguageService
     * @see LanguageHostService
     *
     * @since 2.0.0
     */

    private initializeDiagnostics(): void {
        // add support for macros ts-plugin
        // getSemanticDiagnostics(this.languageService, ts, this.languageServiceHost);
        // getSyntacticDiagnostics(this.languageService, ts, this.languageServiceHost);
    }
}
