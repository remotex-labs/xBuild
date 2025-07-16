/**
 * Import will remove at compile time
 */

import type { ParsedCommandLine, Diagnostic, LanguageService } from 'typescript';
import type { EmitOutputInterface } from '@typescript/interfaces/typescript.interface';

/**
 * Imports
 */

import ts from 'typescript';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, relative, resolve, join } from 'path';
import { xterm } from '@remotex-labs/xansi/xterm.component';
import { formatHost } from '@typescript/constants/typescript.constant';
import { LanguageHostService } from '@typescript/services/language-host.service';
import { DeclarationBundlerService } from '@typescript/services/declaration-bundler.service';

/**
 * Manages TypeScript compilation, type checking, and declaration file generation using TypeScript's
 * language service API.
 *
 * @remarks
 * This module provides an interface to TypeScript's compiler API for performing type checking
 * and generating declaration files. It uses the language service API rather than the direct
 * compiler API for better performance with incremental compilation.
 *
 * @see ts.LanguageService
 * @see ts.createLanguageService
 *
 * @since 1.5.9
 */

export class TypescriptModule {
    /**
     * The root directory of the TypeScript project.
     * @since 1.5.9
     */

    readonly root: string;

    /**
     * Parsed TypeScript configuration from tsconfig.
     * @since 1.5.9
     */

    readonly config: ParsedCommandLine;

    /**
     * TypeScript language service instance for compiler operations.
     * @since 1.5.9
     */

    private readonly languageService: LanguageService;

    /**
     * Language service host that provides file system access to the language service.
     * @since 1.5.9
     */

    private readonly languageServiceHost: LanguageHostService;

    /**
     * Service for bundling TypeScript declaration files
     *
     * @remarks
     * This service instance handles the bundling of TypeScript declaration files (.d.ts)
     * by traversing the dependency graph starting from entry points, collecting exports,
     * and generating single bundled declaration files.
     *
     * @see DeclarationBundlerService
     *
     * @since 1.5.9
     */

    private readonly declarationBundlerService: DeclarationBundlerService;

    /**
     * Creates a new TypeScript module with the specified configuration.
     *
     * @param tsconfigPath - Path to the tsconfig.json file
     * @param outDir - Optional output directory to override the one in tsconfig
     * @param fallbackOutDir - Optional fallback output directory to use if outDir is not specified in tsconfig or outDir
     *
     * @throws Error - If the TypeScript configuration cannot be parsed
     *
     * @since 1.5.9
     */

    constructor(tsconfigPath: string, outDir?: string, fallbackOutDir: string = 'dist') {
        this.root = dirname(tsconfigPath);
        this.config = this.parseConfig(tsconfigPath, outDir, fallbackOutDir);
        this.languageServiceHost = new LanguageHostService(this.config.options);
        this.languageService = this.createLanguageService();
        this.declarationBundlerService = new DeclarationBundlerService(this.config, this.languageService);

        this.initializeDiagnostics();
        this.updateFiles(this.config.fileNames);
    }

    /**
     * Updates the version of one or more files to indicate they have changed.
     *
     * @param touchFiles - Path or array of paths to files that have been modified
     *
     * @since 1.5.9
     */

    updateFiles(touchFiles: string | Array<string>): void {
        const files = Array.isArray(touchFiles) ? touchFiles : [ touchFiles ];
        for (const file of files) {
            this.languageServiceHost.touchFiles(file);
        }
    }

    /**
     * Performs type checking on all source files in the project.
     *
     * @returns Array of diagnostic
     *
     * @since 1.5.9
     */

    check(): Array<Diagnostic> {
        const diagnostics: Array<Diagnostic> = [];
        const sourceFiles = this.languageService.getProgram()?.getSourceFiles() ?? [];

        for (const sourceFile of sourceFiles) {
            const fileName = sourceFile.fileName;
            if (!fileName.includes('/node_modules/') && !fileName.endsWith('.d.ts')) {
                diagnostics.push(...this.getDiagnostics(fileName));
            }
        }

        return diagnostics;
    }

    /**
     * Generates TypeScript declaration (.d.ts) files for all source files.
     *
     * @throws Error - If outDir is not specified in the compiler options
     *
     * @since 1.5.9
     */

    emitDeclarations(): void {
        const program = this.languageService.getProgram();
        if (!program) return;

        for (const sourceFile of program.getSourceFiles()) {
            const fileName = sourceFile.fileName;
            if (fileName.includes('/node_modules/') || fileName.endsWith('.d.ts')) continue;

            const output = this.getEmitOutput(fileName);
            if (!output.emitSkipped) {
                const file = output.outputFile;

                if (file && file.name.endsWith('.d.ts')) {
                    const targetDir = dirname(file.name);
                    mkdirSync(targetDir, { recursive: true });
                    writeFileSync(file.name, file.text);
                }
            }
        }
    }

    /**
     * Generates and writes bundled declaration files for specified entry points
     *
     * @param entryPoints - Record mapping output filenames to source file paths
     *
     * @throws Error - If the language service program is not available
     * @throws Error - If file system operations fail during writing
     *
     * @remarks
     * This method generates bundled declaration files from the provided entry points
     * and writes them to the configured output directory. The input is a record where:
     * - Keys represent the output filenames (with or without .d.ts extension)
     * - Values represent the source file paths to use as entry points
     *
     * The method handles directory creation, ensuring all necessary parent directories
     * exist before writing the output files. If the output filename doesn't end with
     * '.d.ts', the extension will be appended automatically.
     *
     * @example
     * ```ts
     * // Generate bundled declarations for multiple entry points
     * typescriptModule.emitBundleDeclarations({
     *   'index': 'src/index.ts',
     *   'components/index': 'src/components/index.ts'
     * });
     * ```
     *
     * @see DeclarationBundlerService.emitBundledDeclarations
     *
     * @since 1.5.9
     */

    emitBundleDeclarations(entryPoints: Record<string, string>): void {
        const program = this.languageService.getProgram();
        if (!program) return;

        const entryKeys = Object.keys(entryPoints);
        const entryValues = Object.values(entryPoints);
        const dtsResults = this.declarationBundlerService.emitBundledDeclarations(entryValues);

        entryKeys.forEach((key, index) => {
            const dtsContent = dtsResults[index];
            const fileName = key.endsWith('.d.ts') ? key : `${ key }.d.ts`;

            const file = join(this.config.options.outDir!, fileName);
            const targetDir = dirname(file);
            mkdirSync(targetDir, { recursive: true });
            writeFileSync(file, dtsContent);
        });
    }

    /**
     * Formats TypeScript diagnostic messages into human-readable, colored strings.
     *
     * @param diagnostics - Array of TypeScript diagnostic objects to format
     * @returns Array of formatted diagnostic messages with location and error information
     *
     * @remarks
     * This method transforms raw TypeScript diagnostic objects into user-friendly
     * colored console output strings. For each diagnostic, it:
     * - Extracts file path, line, and character position information
     * - Formats error messages with proper indentation and coloring
     * - Includes error codes and prefixes with consistent styling
     *
     * For diagnostics with file information, the output format is:
     * `[TS] filename:line:column - error TS1234: Error message`
     *
     * For diagnostics without file information, only the flattened message text is returned.
     *
     * @example
     * ```ts
     * const ts = new TypescriptModule('tsconfig.json');
     * const diagnostics = ts.check();
     * const formattedMessages = ts.formatDiagnostics(diagnostics);
     * console.log(formattedMessages.join('\n'));
     * ```
     *
     * @since 1.5.9
     */

    formatDiagnostics(diagnostics: readonly Diagnostic[]): Array<string> {
        if (!diagnostics.length) return [];

        return diagnostics.map(diagnostic => {
            if (diagnostic.file && diagnostic.start !== undefined) {
                const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
                const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                const filePath = relative(this.root, diagnostic.file.fileName);

                // Format the diagnostic message with colored output
                return [
                    xterm.deepOrange('[TS]'),
                    `${ xterm.hex('#5fd7ff')(filePath) }:${ xterm.lightYellow(`${ line + 1 }:${ character + 1 }`) }`,
                    '-',
                    `${ xterm.lightCoral('error') } ${ xterm.gray(`TS${ diagnostic.code }`) }:`,
                    message
                ].join(' ');
            }

            return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        });
    }

    /**
     * Generates TypeScript declaration file output for a specified file
     *
     * @param fileName - The path to the TypeScript file for which to generate declaration output
     * @returns The result of the emit operation, including the declaration file content or an indication that emit was skipped
     *
     * @throws Error - When the language service fails to generate valid output
     *
     * @see ts.transform
     * @see ts.LanguageService.getEmitOutput
     *
     * @since 1.5.9
     */

    private getEmitOutput(fileName: string): EmitOutputInterface {
        const emit = this.languageService.getEmitOutput(fileName, true);
        const dtsOutput = emit.outputFiles.find(f => f.name.endsWith('.d.ts'));

        if (emit.emitSkipped || !dtsOutput) {
            return { emitSkipped: true, outputFile: undefined };
        }

        const sourceFile = ts.createSourceFile(
            dtsOutput.name, dtsOutput.text, ts.ScriptTarget.Latest, true
        );

        const result = ts.transform(sourceFile, [
            (context): ts.Transformer<ts.SourceFile> => {
                return this.createVisitor(dtsOutput.name, context);
            }
        ]);

        const printer = ts.createPrinter();
        const transformed = result.transformed[0];
        const newText = printer.printFile(transformed);
        result.dispose();

        return {
            emitSkipped: false,
            outputFile: {
                name: dtsOutput.name,
                text: newText,
                writeByteOrderMark: false
            }
        };
    }

    /**
     * Resolves a module specifier to its file path relative to the root directory
     *
     * @param specifier - The module specifier string to resolve
     * @returns The resolved file path relative to the root directory, or undefined if resolution fails
     *
     * @remarks
     * This private method uses TypeScript's module resolution system to convert an import specifier
     * into an actual file path. It specifically filters out node_modules dependencies and ensures
     * paths are relative to the project's root directory.
     *
     * When rootDir is set to 'src' and baseUrl is set to the project root:
     * - The method will only resolve files contained within the 'src' directory
     * - All paths will be calculated relative to 'src', not the project root
     * - For example, with project structure:
     * ```text
     *   /project-root/
     *     ├── src/
     *     │   ├── components/
     *     │   │   └── button.ts
     *     │   └── utils/
     *     │       └── helpers.ts
     *     └── tsconfig.json
     * ```
     * - A resolved path might be 'components/button.ts' relative to 'src'
     * - This maintains proper path structure for TypeScript's internal module resolution
     *
     * @example
     * ```ts
     * // For a specifier like '@components/button' with rootDir='src'
     * const relativePath = this.resolveModuleFileName('@components/button');
     * // Might return 'components/button.ts' (relative to src/)
     * ```
     *
     * @see ts.resolveModuleName
     *
     * @since 1.5.9
     */

    private resolveModuleFileName(specifier: string): string | undefined {
        const options = this.config.options;
        if (!options.rootDir) return;

        const resolved = ts.resolveModuleName(specifier, options.rootDir, options, ts.sys).resolvedModule;
        if (!resolved || resolved.resolvedFileName.includes('node_modules')) return;

        return relative(resolve(options.rootDir), resolved.resolvedFileName);
    }

    /**
     * Calculates the relative path from a source file to a target file in the output directory
     *
     * @param fromFile - The source file path from which the relative path is calculated
     * @param toFile - The target file path in the output directory
     * @returns A properly formatted relative path string that can be used in import statements
     *
     * @remarks
     * This private method computes a relative path from one file to another in the output directory,
     * ensuring the path is properly formatted for JavaScript module imports.
     *
     * This is particularly useful when generating import statements in emitted files that
     * need to reference other modules in the output directory structure.
     *
     * @example
     * ```ts
     * // If fromFile is '/project/dist/components/button.js'
     * // toFile is 'utils/helpers.js'
     * // outDir is '/project/dist'
     * this.getRelativePathToOutDir(fromFile, toFile);
     * // Returns '../utils/helpers'
     * ```
     *
     * @since 1.5.9
     */

    private getRelativePathToOutDir(fromFile: string, toFile: string): string {
        const from = dirname(fromFile);
        const to = resolve(this.config.options.outDir!, toFile);
        let relativePath = relative(from, to).replace(/\\/g, '/');

        relativePath = relativePath.replace(/\.[jt]s$/, '');
        if (!relativePath.startsWith('.')) {
            relativePath = './' + relativePath;
        }

        return relativePath;
    }

    /**
     * Creates a TypeScript transformer visitor that updates import and export paths
     *
     * @param fileName - The current file being transformed
     * @param context - The TypeScript transformation context
     * @returns A transformer function that processes a source file
     *
     * @remarks
     * This private method creates a visitor function that transforms import and export declarations
     * in TypeScript source files. The main purpose is to rewrite module specifiers to ensure they
     * correctly point to the compiled output files.
     *
     * This is crucial for maintaining correct module references when TypeScript files are compiled
     * and moved to an output directory with potentially different structure.
     *
     * When rootDir is set to 'src' and baseUrl is the project root:
     * - Module paths are resolved within the 'src' directory
     * - The new paths will be calculated relative to each file's position in the output structure
     * - This ensures imports continue to work correctly after compilation
     *
     * @since 1.5.9
     */

    private createVisitor(fileName: string, context: ts.TransformationContext): ts.Transformer<ts.SourceFile> {
        return (sourceFile: ts.SourceFile): ts.SourceFile => {
            const visit: ts.Visitor = (node) => {
                if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
                    node.moduleSpecifier &&
                    ts.isStringLiteral(node.moduleSpecifier)) {

                    const specifier = node.moduleSpecifier.text;
                    const resolvedPath = this.resolveModuleFileName(specifier);

                    if (resolvedPath) {
                        const newPath = this.getRelativePathToOutDir(fileName, resolvedPath);
                        const newModuleSpecifier = ts.factory.createStringLiteral(newPath);

                        if (ts.isImportDeclaration(node)) {
                            return ts.factory.updateImportDeclaration(
                                node,
                                node.modifiers,
                                node.importClause,
                                newModuleSpecifier,
                                undefined // assertClause
                            );
                        }

                        return ts.factory.updateExportDeclaration(
                            node,
                            node.modifiers,
                            node.isTypeOnly ?? false,
                            node.exportClause,
                            newModuleSpecifier,
                            undefined // assertClause
                        );
                    }
                }

                return ts.visitEachChild(node, visit, context);
            };

            return ts.visitNode(sourceFile, visit) as ts.SourceFile;
        };
    }

    /**
     * Parses the TypeScript configuration file.
     *
     * @param tsconfigPath - Path to the tsconfig.json file
     * @param outDir - Optional output directory to override the one in tsconfig
     * @param fallbackOutDir - Optional fallback output directory to use if outDir is not specified in tsconfig or outDir
     *
     * @returns Parsed command line object containing compiler options
     *
     * @throws Error - If the TypeScript configuration cannot be parsed
     *
     * @since 1.5.9
     */

    private parseConfig(tsconfigPath: string, outDir?: string, fallbackOutDir?: string): ParsedCommandLine {
        // Todo - default configuration if not set tsconfig.json
        const config = ts.getParsedCommandLineOfConfigFile(
            tsconfigPath,
            { stripInternal: true, skipLibCheck: true },
            {
                ...ts.sys,
                onUnRecoverableConfigFileDiagnostic: (d) => {
                    throw new Error(ts.formatDiagnostic(d, formatHost));
                }
            }
        );

        if (!config) throw new Error(`Unable to parse TypeScript configuration: ${ tsconfigPath }`);
        config.options = {
            ...config.options,
            baseUrl: config.options.baseUrl || this.root,
            rootDir: config.options.rootDir || this.root,
            outDir: outDir || config.options.outDir || fallbackOutDir
        };

        return config;
    }

    /**
     * Creates a TypeScript language service.
     *
     * @returns Language service instance
     *
     * @see ts.createLanguageService
     * @since 1.5.9
     */

    private createLanguageService(): LanguageService {
        return ts.createLanguageService(
            this.languageServiceHost,
            ts.createDocumentRegistry()
        );
    }

    /**
     * Initializes diagnostic plugins for macro supports
     * @since 1.5.9
     */

    private initializeDiagnostics(): void {
        // todo
        // getSemanticDiagnostics(this.languageService, ts, this.languageServiceHost);
        // getSyntacticDiagnostics(this.languageService, ts, this.languageServiceHost);
    }

    /**
     * Retrieves all diagnostics for a specified file.
     *
     * @param fileName - Path to the TypeScript file to analyze
     * @returns Combined array of semantic, syntactic, and suggestion diagnostics
     *
     * @remarks
     * This method aggregates all three types of TypeScript diagnostics:
     * - Semantic diagnostics (type errors, etc.)
     * - Syntactic diagnostics (parsing errors)
     * - Suggestion diagnostics (code improvement hints)
     *
     * @see ts.LanguageService.getSemanticDiagnostics
     * @see ts.LanguageService.getSyntacticDiagnostics
     * @see ts.LanguageService.getSuggestionDiagnostics
     *
     * @since 1.5.9
     */

    private getDiagnostics(fileName: string): Array<Diagnostic> {
        return [
            ...this.languageService.getSemanticDiagnostics(fileName),
            ...this.languageService.getSyntacticDiagnostics(fileName)
            // todo good but slow as hell
            // ...this.languageService.getSuggestionDiagnostics(fileName)
        ];
    }
}
