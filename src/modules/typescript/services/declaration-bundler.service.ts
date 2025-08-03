/**
 * Import will remove at compile time
 */

import type { ParsedCommandLine, LanguageService, SourceFile, Program, TypeChecker, Symbol } from 'typescript';

/**
 * Imports
 */

import ts from 'typescript';
import { HeaderDeclarationBundle } from '@typescript/constants/typescript.constant';

/**
 * Service responsible for bundling TypeScript declaration files by collecting
 * all exports from entry points and generating a single declaration bundle
 *
 * @throws Error - If the language service program is not available
 * @throws Error - If a source file cannot be found
 *
 * @remarks
 * This service handles the process of bundling TypeScript declaration files (.d.ts)
 * by traversing the dependency graph starting from specified entry points.
 * It collects all necessary files and symbols, processes their declarations,
 * and generates a single bundled declaration file that can be used in place
 * of multiple individual declaration files.
 *
 * The service maintains a cache of processed files to improve performance
 * when processing multiple entry points or when called multiple times.
 *
 * @example
 * ```ts
 * const bundler = new DeclarationBundlerService(config, languageService);
 * const bundledDeclarations = bundler.emitBundledDeclarations(['src/index.ts']);
 * writeFileSync('dist/index.d.ts', bundledDeclarations[0]);
 * ```
 *
 * @see ts.LanguageService
 * @see ts.ParsedCommandLine
 *
 * @since 1.5.9
 */

export class DeclarationBundlerService {
    /**
     * Creates a new DeclarationBundlerService instance
     *
     * @param config - TypeScript configuration with compiler options
     * @param languageService - TypeScript language service for compilation
     *
     * @since 1.5.9
     */

    constructor(private readonly config: ParsedCommandLine, private readonly languageService: LanguageService) {
    }

    /**
     * Generates bundled declaration files for the provided entry points
     *
     * @param entryPoints - Array of file paths to use as entry points
     * @returns Array of bundled declaration content strings
     *
     * @remarks
     * This method clears any existing cache and processes each entry point
     * to generate bundled declarations. Entry points should be absolute paths
     * to TypeScript source files.
     *
     * @since 1.5.9
     */

    emitBundledDeclarations(entryPoints: Array<string>): Array<string> {
        const results: Array<string> = [];

        for (const entry of entryPoints) {
            const bundledDeclaration = this.generateBundledDeclaration(entry);
            if (bundledDeclaration) {
                results.push(bundledDeclaration);
            }
        }

        return results;
    }

    /**
     * Generates a bundled declaration for a single entry point
     *
     * @param entryPath - Path to the entry point file
     * @returns Bundled declaration content or undefined if generation fails
     *
     * @throws EntryPointError - When the specified entry point file cannot be found
     * @throws CompilationError - When the TypeScript program cannot be accessed
     *
     * @remarks
     * This method processes a single entry point to generate a bundled declaration file.
     * It collects all necessary files and exported symbols, processes them, and
     * combines them into a single declaration output.
     *
     * The method requires that the entry point file exists and is included in the
     * TypeScript project configuration.
     *
     * @since 1.5.9
     */

    private generateBundledDeclaration(entryPath: string): string | undefined {
        const program = this.languageService.getProgram();
        if (!program) return;

        const checker = program.getTypeChecker();
        const entryFile = program.getSourceFile(entryPath);
        if(!entryFile) {
            throw new Error(
                `Entry point not found: ${ entryPath }\n` +
                'Please verify that:\n' +
                '1. The file exists at the specified path\n' +
                '2. The file is included in the "include" section of your tsconfig.json\n' +
                '3. The file path is correctly specified in your bundle configuration'
            );
        }

        const collectedFiles = new Set<string>();
        const collectedSymbols = new Set<string>();

        // Process entry file first
        this.collectFilesRecursive(entryFile, program, collectedFiles);
        this.collectExportsFromSourceFile(entryFile, checker, collectedSymbols);

        const { bundledContent, externalImports } = this.processDeclaredFiles(
            collectedFiles,
            collectedSymbols
        );

        return this.createFinalBundleContent(externalImports, bundledContent);
    }

    /**
     * Resolves a module name to its file path
     *
     * @param moduleName - The module name to resolve
     * @param containingFile - The file containing the import
     * @param program - The TypeScript program
     *
     * @returns The resolved file path or undefined if resolution fails
     *
     * @since 1.5.9
     */

    private resolveModule(moduleName: string, containingFile: string, program: Program): string | undefined {
        const resolvedModule = ts.resolveModuleName(
            moduleName,
            containingFile,
            program.getCompilerOptions(),
            ts.sys
        ).resolvedModule;

        return resolvedModule?.resolvedFileName;
    }

    /**
     * Recursively collects all files by following imports and exports
     *
     * @param sourceFile - The source file to process
     * @param program - The TypeScript program
     * @param collectedFiles - Set of collected file paths
     *
     * @remarks
     * This method traverses the dependency graph starting from the provided source file
     * and collects all files that contribute to the final bundle, excluding node_modules.
     *
     * @since 1.5.9
     */

    private collectFilesRecursive(sourceFile: SourceFile, program: Program, collectedFiles: Set<string>): void {
        if (collectedFiles.has(sourceFile.fileName)) return;
        collectedFiles.add(sourceFile.fileName);

        // Process import and export declarations
        for (const stmt of sourceFile.statements) {
            if (
                (ts.isImportDeclaration(stmt) || ts.isExportDeclaration(stmt)) &&
                stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)
            ) {
                const moduleName = stmt.moduleSpecifier.text;
                const resolvedModule = this.resolveModule(moduleName, sourceFile.fileName, program);

                if (resolvedModule && !resolvedModule.includes('node_modules')) {
                    const importedSourceFile = program.getSourceFile(resolvedModule);
                    if (importedSourceFile) {
                        this.collectFilesRecursive(importedSourceFile, program, collectedFiles);
                    }
                }
            }
        }
    }

    /**
     * Recursively collects exports from a module symbol
     *
     * @param symbol - The module symbol to process
     * @param checker - The TypeScript type checker
     * @param collectedSymbols - Set of collected symbol names
     *
     * @remarks
     * This method collects all exported symbols from a module, including
     * nested module exports for namespace declarations.
     *
     * @since 1.5.9
     */

    private collectExportsRecursive(symbol: Symbol, checker: TypeChecker, collectedSymbols: Set<string>): void {
        for (const exportSymbol of checker.getExportsOfModule(symbol)) {
            const name = exportSymbol.getName();
            collectedSymbols.add(name);

            // Handle nested module exports
            const declaration = exportSymbol.getDeclarations()?.[0];
            if (declaration && ts.isModuleDeclaration(declaration)) {
                this.collectExportsRecursive(exportSymbol, checker, collectedSymbols);
            }
        }
    }

    /**
     * Processes all collected files and extracts their declarations
     *
     * @param collectedFiles - Set of file paths to process
     * @param collectedSymbols - Set of exported symbol names
     * @returns Object containing bundled content and external imports
     *
     * @since 1.5.9
     */

    private processDeclaredFiles(collectedFiles: Set<string>, collectedSymbols: Set<string>): {
        bundledContent: string[], externalImports: Set<string>
    } {
        const externalImports = new Set<string>();
        const bundledContent: string[] = [];

        // Process each collected file
        for (const fileName of collectedFiles) {
            const processedContent = this.processDeclarationFile(
                fileName,
                collectedSymbols,
                externalImports
            );

            if (processedContent) {
                bundledContent.push(processedContent);
            }
        }

        return { bundledContent, externalImports };
    }

    /**
     * Collects all exported symbols from a source file
     *
     * @param sourceFile - The source file to process
     * @param checker - The TypeScript type checker
     * @param collectedSymbols - Set to store collected symbol names
     *
     * @since 1.5.9
     */

    private collectExportsFromSourceFile(sourceFile: SourceFile, checker: TypeChecker, collectedSymbols: Set<string>): void {
        const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
        if (!moduleSymbol) return;

        this.collectExportsRecursive(moduleSymbol, checker, collectedSymbols);
    }

    /**
     * Processes a declaration file to extract its content
     *
     * @param fileName - Path to the declaration file
     * @param collectedSymbols - Set of exported symbol names
     * @param externalImports - Set to store external import statements
     * @returns Processed declaration content or undefined if processing fails
     *
     * @remarks
     * This method processes a single declaration file, filtering its content
     * to include only relevant declarations and collecting external imports.
     * It uses a cache to avoid reprocessing the same file multiple times.
     *
     * @since 1.5.9
     */

    private processDeclarationFile(fileName: string, collectedSymbols: Set<string>, externalImports: Set<string>): string | undefined {
        // Todo more smart cache system
        // if (this.processedFiles.has(fileName)) {
        //     return this.processedFiles.get(fileName);
        // }

        const emitOutput = this.languageService.getEmitOutput(fileName, true);
        if (emitOutput.emitSkipped) {
            return;
        }

        // Find declaration file output
        const dtsOutputFile = emitOutput.outputFiles.find(f => f.name.endsWith('.d.ts'));
        if (!dtsOutputFile) return undefined;

        const lines = dtsOutputFile.text.split('\n');
        const filteredLines: string[] = [];

        for (let line of lines) {
            line = line.trimEnd();
            if (!line) continue;

            // Handle imports and exports with from clauses
            if (this.isImportOrExportWithFrom(line)) {
                const modulePath = this.extractModulePath(line);
                if (modulePath) {
                    if (this.isExternalModule(modulePath, fileName)) {
                        externalImports.add(line);
                        continue;
                    } else {
                        // Skip local imports/exports as they'll be bundled
                        continue;
                    }
                }
            }

            // Process export declarations
            if (line.startsWith('export ')) {
                line = this.processExportLine(line, collectedSymbols);
            }

            if (line) {
                filteredLines.push(line);
            }
        }

        return filteredLines.join('\n');
    }

    /**
     * Checks if a line is an import or export statement with a from clause
     *
     * @param line - The line to check
     * @returns True if the line is an import or export with from clause
     *
     * @since 1.5.9
     */

    private isImportOrExportWithFrom(line: string): boolean {
        return (
            line.startsWith('import ') ||
            (line.startsWith('export ') && (line.includes(' from ') || line.startsWith('export *')))
        );
    }

    /**
     * Extracts the module path from an import or export statement
     *
     * @param line - The import or export statement
     * @returns The extracted module path or undefined if not found
     *
     * @since 1.5.9
     */

    private extractModulePath(line: string): string | undefined {
        const match = line.match(/from\s+["'](.+)["']/);

        return match?.[1];
    }

    /**
     * Determines if a module is external (from node_modules)
     *
     * @param modulePath - The module path to check
     * @param fileName - The file containing the import
     * @returns True if the module is external
     *
     * @remarks
     * This method determines if a module is external by checking if it's a relative
     * or absolute path, and by resolving the module to see if it's in node_modules.
     *
     * @since 1.5.9
     */

    private isExternalModule(modulePath: string, fileName: string): boolean {
        // Quick check for absolute or relative paths
        if (modulePath.startsWith('.') || modulePath.startsWith('/')) {
            return false;
        }

        const resolved = ts.resolveModuleName(
            modulePath,
            fileName,
            this.config.options,
            ts.sys
        );

        if (resolved.resolvedModule) {
            return resolved.resolvedModule.resolvedFileName.includes('node_modules');
        }

        // If resolution fails, assume it's external
        return true;
    }

    /**
     * Processes an export line, removing 'export' if needed
     *
     * @param line - The export statement to process
     * @param collectedSymbols - Set of exported symbol names
     * @returns The processed line
     *
     * @remarks
     * This method processes an export declaration line, removing the 'export'
     * keyword if the symbol is not in the collected exports.
     *
     * @since 1.5.9
     */

    private processExportLine(line: string, collectedSymbols: Set<string>): string {
        const exportNameMatch = line.match(/export\s+(?:declare\s+)?(?:class|interface|function|const|let|var|type|enum)\s+(\w+)/);
        if (exportNameMatch) {
            const exportName = exportNameMatch[1];
            if (!collectedSymbols.has(exportName)) {
                // Remove 'export' keyword if not in collectedSymbols
                return line.replace('export ', '');
            }
        }

        return line;
    }

    /**
     * Creates the final bundled declaration content
     *
     * @param externalImports - Set of external import statements
     * @param bundledContent - Array of processed declaration content
     * @returns The final bundled declaration content
     *
     * @since 1.5.9
     */

    private createFinalBundleContent(externalImports: Set<string>, bundledContent: Array<string>): string {
        const imports = Array.from(externalImports).join('\n');
        const content = bundledContent.join('\n\n');

        return imports ? `${ HeaderDeclarationBundle }${ imports }\n\n${ content }` : `${ HeaderDeclarationBundle }${ content }`;
    }
}
