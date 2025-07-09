/**
 * Import will remove at compile time
 */

import type { ParsedCommandLine, Diagnostic, LanguageService } from 'typescript';

/**
 * Imports
 */

import ts from 'typescript';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join, relative } from 'path';
import { xterm } from '@remotex-labs/xansi/xterm.component';
import { formatHost } from '@typescript/constants/typescript.constant';
import { LanguageHostService } from '@typescript/services/language-host.service';

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
 * @since 2.0.0
 */

export class TypescriptModule {
    /**
     * The root directory of the TypeScript project.
     * @since 2.0.0
     */

    private readonly root: string;

    /**
     * Parsed TypeScript configuration from tsconfig.
     * @since 2.0.0
     */

    private readonly config: ParsedCommandLine;

    /**
     * TypeScript language service instance for compiler operations.
     * @since 2.0.0
     */

    private readonly languageService: LanguageService;

    /**
     * Language service host that provides file system access to the language service.
     * @since 2.0.0
     */

    private readonly languageServiceHost: LanguageHostService;

    /**
     * Creates a new TypeScript module with the specified configuration.
     *
     * @param tsconfigPath - Path to the tsconfig.json file
     * @param outDir - Optional output directory to override the one in tsconfig
     *
     * @throws Error - If the TypeScript configuration cannot be parsed
     *
     * @since 2.0.0
     */

    constructor(tsconfigPath: string, outDir?: string) {
        this.root = dirname(tsconfigPath);
        this.config = this.parseConfig(tsconfigPath, outDir);
        this.languageServiceHost = new LanguageHostService(this.config.options);
        this.languageService = this.createLanguageService();

        this.initializeDiagnostics();
        this.updateFile(this.config.fileNames);
    }

    /**
     * Updates the version of one or more files to indicate they have changed.
     *
     * @param touchFiles - Path or array of paths to files that have been modified
     *
     * @since 2.0.0
     */

    updateFile(touchFiles: string | Array<string>): void {
        const files = Array.isArray(touchFiles) ? touchFiles : [ touchFiles ];
        for (const file of files) {
            this.languageServiceHost.touchFiles(file);
        }
    }

    /**
     * Performs type checking on all source files in the project.
     *
     * @returns Array of formatted diagnostic messages
     *
     * @since 2.0.0
     */

    check(): Array<string> {
        const diagnostics: Array<Diagnostic> = [];
        const sourceFiles = this.languageService.getProgram()?.getSourceFiles() ?? [];

        for (const sourceFile of sourceFiles) {
            const fileName = sourceFile.fileName;

            if (!fileName.includes('/node_modules/') && !fileName.endsWith('.d.ts')) {
                diagnostics.push(
                    ...this.languageService.getSemanticDiagnostics(fileName),
                    ...this.languageService.getSyntacticDiagnostics(fileName)
                );
            }
        }

        return this.handleDiagnostics(diagnostics);
    }

    /**
     * Generates TypeScript declaration (.d.ts) files for all source files.
     *
     * @throws Error - If outDir is not specified in the compiler options
     *
     * @since 2.0.0
     */

    emitDeclarations(): void {
        const program = this.languageService.getProgram();
        if (!program) return;

        for (const sourceFile of program.getSourceFiles()) {
            const fileName = sourceFile.fileName;
            if (fileName.includes('/node_modules/') || fileName.endsWith('.d.ts')) continue;

            const output = this.languageService.getEmitOutput(fileName, true);
            if (!output.emitSkipped) {
                for (const file of output.outputFiles) {
                    if (file.name.endsWith('.d.ts')) {
                        const targetDir = dirname(file.name);
                        mkdirSync(targetDir, { recursive: true });
                        writeFileSync(file.name, file.text);
                    }
                }
            }
        }
    }

    emitBundleDeclarations(entrypoints: string[]): void {
    }

    /**
     * Parses the TypeScript configuration file.
     *
     * @param tsconfigPath - Path to the tsconfig.json file
     * @param outDir - Optional output directory to override the one in tsconfig
     * @returns Parsed command line object containing compiler options
     *
     * @throws Error - If the TypeScript configuration cannot be parsed
     *
     * @since 2.0.0
     */

    private parseConfig(tsconfigPath: string, outDir?: string): ParsedCommandLine {
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
        if (outDir) config.options.outDir = outDir;

        return config;
    }

    /**
     * Creates a TypeScript language service.
     *
     * @returns Language service instance
     *
     * @see ts.createLanguageService
     * @since 2.0.0
     */

    private createLanguageService(): LanguageService {
        return ts.createLanguageService(
            this.languageServiceHost,
            ts.createDocumentRegistry()
        );
    }

    /**
     * Initializes diagnostic plugins for macro supports
     * @since 2.0.0
     */

    private initializeDiagnostics(): void {
        // todo
        // getSemanticDiagnostics(this.languageService, ts, this.languageServiceHost);
        // getSyntacticDiagnostics(this.languageService, ts, this.languageServiceHost);
    }

    /**
     * Formats diagnostic messages for output.
     *
     * @param diagnostics - Array of TypeScript diagnostic objects
     * @returns Formatted diagnostic messages with file locations and error codes
     *
     * @since 2.0.0
     */

    private handleDiagnostics(diagnostics: readonly Diagnostic[]): Array<string> {
        if (!diagnostics.length) return [];

        return diagnostics.map(diagnostic => {
            if (diagnostic.file && diagnostic.start !== undefined) {
                const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
                const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                const filePath = relative(this.root, diagnostic.file.fileName);

                // Format the diagnostic message with colored output
                return [
                    xterm.deepOrange('[TS]'),
                    `${ xterm.cyan(filePath) }:${ xterm.lightYellow(`${ line + 1 }:${ character + 1 }`) }`,
                    '-',
                    `${ xterm.lightCoral('error') } ${ xterm.gray(`TS${ diagnostic.code }`) }:`,
                    message
                ].join(' ');
            }

            return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        });
    }
}
