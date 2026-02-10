/**
 * Import will remove at compile time
 */

import type { LanguageHostService } from '@typescript/services/hosts.service';
import type { CompilerOptions, Program, SourceFile, LanguageService } from 'typescript';

/**
 * Imports
 */

import { mkdir, writeFile } from 'fs/promises';
import { dirname } from '@components/path.component';
import { xterm } from '@remotex-labs/xansi/xterm.component';
import { calculateOutputPath, cleanContent } from '@typescript/components/transformer.component';

/**
 * Incremental declaration emitter that writes cleaned `.d.ts` files to disk.
 *
 * Uses the TypeScript language service to emit declaration files only for changed
 * project files (skipping external libraries and unchanged versions), applies alias
 * path resolution, cleans unnecessary content, and writes files to the configured `outDir`.
 *
 * Designed for build tools, watch-mode compilers, module federation setups, or
 * public API packaging workflows that need fresh, minimal type declarations.
 *
 * @since 2.0.0
 */

export class EmitterService {
    /**
     * Maps output declaration path → last emitted version string.
     *
     * Used to skip redundant emits when file content/version has not changed.
     *
     * @remarks
     * Static, so the cache survives across service instances (useful in long-running processes).
     *
     * @since 2.0.0
     */

    private static emittedVersions: Map<string, string> = new Map();

    /**
     * Creates emitter bound to a specific language service and host.
     *
     * @param languageService - active TS language service instance
     * @param languageHostService - host with compiler options and resolution capabilities
     *
     * @since 2.0.0
     */

    constructor(private languageService: LanguageService, private languageHostService: LanguageHostService) {
    }

    /**
     * Clears the static version cache used for incremental emit decisions.
     * @since 2.0.0
     */

    static clearCache(): void {
        this.emittedVersions.clear();
    }

    /**
     * Emits cleaned declaration files for all changed project source files.
     *
     * @param outdir - optional override for output directory (overrides `outDir` in config)
     * @returns promise that resolves when all writes are complete
     *
     * @throws Error when language service program is unavailable
     *
     * @example
     * ```ts
     * // One-time full emit to custom directory
     * await emitter.emit('./dist/types');
     *
     * // Incremental emit on watch change
     * emitter.emit(); // uses original compilerOptions.outDir
     * ```
     *
     * @see {@link shouldEmitFile}
     * @see {@link emitSingleDeclaration}
     *
     * @since 2.0.0
     */

    async emit(outdir?: string): Promise<void> {
        const program = this.languageService.getProgram();
        if (!program) {
            throw new Error(`${ xterm.deepOrange('[TS]') } Language service program is not available`);
        }

        let config = this.languageHostService.getCompilationSettings();
        if (outdir) config = { ...config, outDir: outdir };

        const filesToEmit: Array<SourceFile> = [];
        const sourceFiles = program.getSourceFiles();
        for (let i = 0; i < sourceFiles.length; i++) {
            const file = sourceFiles[i];
            if (this.shouldEmitFile(file, program, config)) {
                filesToEmit.push(file);
            }
        }

        if (filesToEmit.length === 0) return;
        await Promise.all(filesToEmit.map(
            source => this.emitSingleDeclaration(source, config)
        ));
    }

    /**
     * Determines whether a source file should be (re-)emitted based on version and type.
     *
     * @param file - candidate source file
     * @param program - current program (for external library check)
     * @param config - effective compiler options (with possible outDir override)
     * @returns `true` if a file needs emission
     *
     * @remarks
     * Skips:
     * - `.d.ts` files
     * - files from external libraries (node_modules)
     * - files whose version matches the last emitted version
     *
     * Updates cache when emission is needed.
     *
     * @since 2.0.0
     */

    private shouldEmitFile(file: SourceFile, program: Program, config: CompilerOptions): boolean {
        if (file.isDeclarationFile || program.isSourceFileFromExternalLibrary(file))
            return false;

        const outputPath = calculateOutputPath(file.fileName, config);
        const version = EmitterService.emittedVersions.get(outputPath);
        const currentVersion = this.languageHostService.getScriptVersion(file.fileName);

        if (!version) {
            EmitterService.emittedVersions.set(
                outputPath, currentVersion
            );

            return true;
        }

        if (version !== currentVersion) {
            EmitterService.emittedVersions.set(outputPath, currentVersion);

            return true;
        }

        return false;
    }

    /**
     * Emits and writes a single cleaned declaration file to disk.
     *
     * @param sourceFile - file to emit
     * @param options - compiler options (including outDir)
     * @returns promise that resolves when write completes
     *
     * @remarks
     * - Uses `emitOnlyDtsFiles: true`
     * - Applies `cleanContent` and alias resolution (if aliases are configured)
     * - Creates directories recursively if needed
     *
     * @example
     * ```ts
     * // Internal usage pattern
     * const output = languageService.getEmitOutput(file.fileName, true);
     * let text = output.outputFiles[0].text;
     * text = cleanContent(text);
     * if (aliasRegex) text = this.resolveAliases(aliasRegex, text, sourceFile);
     * await writeFile(calculatedPath, text, 'utf8');
     * ```
     *
     * @since 2.0.0
     */

    private async emitSingleDeclaration(sourceFile: SourceFile, options: CompilerOptions): Promise<void> {
        const output = this.languageService.getEmitOutput(sourceFile.fileName, true);
        if (output.emitSkipped) return;

        let content = output.outputFiles[0].text;
        const fileName = calculateOutputPath(sourceFile.fileName, options);

        content = cleanContent(content);
        content = this.languageHostService.resolveAliases(content, sourceFile.fileName, '.d.ts');

        await mkdir(dirname(fileName), { recursive: true });
        await writeFile(fileName, content, 'utf8');
    }
}
