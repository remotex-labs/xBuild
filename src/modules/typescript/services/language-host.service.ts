/**
 * Import will remove at compile time
 */

import type { CompilerOptions, IScriptSnapshot } from 'typescript';

/**
 * Imports
 */

import ts from 'typescript';
import { resolve } from 'path';

/**
 * Service that implements TypeScript's language service host interfaces required for compiler operations.
 * This class provides the necessary methods for the TypeScript language service to interact with the
 * file system and manage compilation resources.
 *
 * @remarks
 * This service implements the TypeScript LanguageServiceHost interface, which is required
 * for creating a TypeScript language service using ts.createLanguageService().
 *
 * @see ts.LanguageServiceHost
 * @see ts.createLanguageService
 *
 * @since 1.5.9
 */

export class LanguageHostService {
    /**
     * Map to track file versions for detecting changes in source files.
     * Keys are absolute file paths and values are incrementing version numbers.
     *
     * @since 1.5.9
     */

    private readonly fileVersions = new Map<string, number>();

    /**
     * Creates a new language host service with TypeScript compiler options.
     *
     * @param options - Compiler options to use for TypeScript operations
     *
     * @since 1.5.9
     */

    constructor(private readonly options: CompilerOptions) {
    }

    /**
     * Increments the version number of a file to indicate it has changed.
     * Used to signal to the language service that a file needs to be reprocessed.
     *
     * @param touchFiles - Path to the file that has been modified
     *
     * @since 1.5.9
     */

    touchFiles(touchFiles: string): void {
        const abs = resolve(touchFiles);
        const current = this.fileVersions.get(abs) ?? 0;

        this.fileVersions.set(abs, current + 1);
    }

    /**
     * Checks if a file exists at the specified path.
     * Required by the LanguageServiceHost interface.
     *
     * @param path - Path to check for file existence
     * @returns True if the file exists, false otherwise
     *
     * @see ts.LanguageServiceHost.fileExists
     * @since 1.5.9
     */

    fileExists(path: string): boolean {
        return ts.sys.fileExists(path);
    }

    /**
     * Reads the content of a file at the specified path.
     * Required by the LanguageServiceHost interface.
     *
     * @param path - Path to the file to read
     * @param encoding - Optional encoding to use when reading the file
     * @returns The content of the file as a string, or undefined if the file cannot be read
     *
     * @see ts.LanguageServiceHost.readFile
     * @since 1.5.9
     */

    readFile(path: string, encoding?: string): string | undefined {
        return ts.sys.readFile(path, encoding);
    }

    /**
     * Reads the contents of a directory with filtering options.
     * Required by the LanguageServiceHost interface.
     *
     * @param path - Path to the directory to read
     * @param extensions - Optional array of file extensions to filter by
     * @param exclude - Optional array of glob patterns to exclude
     * @param include - Optional array of glob patterns to include
     * @param depth - Optional maximum depth to search
     * @returns Array of file paths found in the directory
     *
     * @see ts.LanguageServiceHost.readDirectory
     * @since 1.5.9
     */

    readDirectory(path: string, extensions?: Array<string>, exclude?: Array<string>, include?: Array<string>, depth?: number): Array<string> {
        return ts.sys.readDirectory(path, extensions, exclude, include, depth);
    }

    /**
     * Gets all subdirectories within a directory.
     * Required by the LanguageServiceHost interface.
     *
     * @param path - Path to the directory to search
     * @returns Array of directory paths found
     *
     * @see ts.LanguageServiceHost.getDirectories
     * @since 1.5.9
     */

    getDirectories(path: string): Array<string> {
        return ts.sys.getDirectories(path);
    }

    /**
     * Checks if a directory exists at the specified path.
     *
     * @param path - Path to check for directory existence
     * @returns True if the directory exists, false otherwise
     *
     * @since 1.5.9
     */

    directoryExists(path: string): boolean {
        return ts.sys.directoryExists(path);
    }

    /**
     * Gets the current working directory.
     * Required by the LanguageServiceHost interface.
     *
     * @returns The current working directory path
     *
     * @see ts.LanguageServiceHost.getCurrentDirectory
     * @since 1.5.9
     */

    getCurrentDirectory(): string {
        return ts.sys.getCurrentDirectory();
    }

    /**
     * Gets all script file names tracked by this language host.
     * Required by the LanguageServiceHost interface to identify the set of source files.
     *
     * @returns Array of script file paths that should be included in the program
     *
     * @see ts.LanguageServiceHost.getScriptFileNames
     * @since 1.5.9
     */

    getScriptFileNames(): Array<string> {
        // return this.fileVersions.keys().toArray(); not supported in node 18
        return Array.from(this.fileVersions.keys());
    }

    /**
     * Gets the compiler options used by this language host.
     * Required by the LanguageServiceHost interface to configure the TypeScript compiler.
     *
     * @returns The compiler options for program creation
     *
     * @see ts.LanguageServiceHost.getCompilationSettings
     * @since 1.5.9
     */

    getCompilationSettings(): CompilerOptions {
        return this.options;
    }

    /**
     * Gets the default library file name for TypeScript compilation.
     * Required by the LanguageServiceHost interface to include standard TypeScript definitions.
     *
     * @param options - Compiler options to use for determining the default library
     * @returns Path to the default library file
     *
     * @see ts.LanguageServiceHost.getDefaultLibFileName
     * @since 1.5.9
     */

    getDefaultLibFileName(options: CompilerOptions): string {
        return ts.getDefaultLibFilePath(options);
    }

    /**
     * Gets the current version of a script file.
     * Required by the LanguageServiceHost interface to determine if a file has changed.
     *
     * @param fileName - Path to the script file
     * @returns The version of the file as a string
     *
     * @see ts.LanguageServiceHost.getScriptVersion
     * @since 1.5.9
     */

    getScriptVersion(fileName: string): string {
        return this.fileVersions.get(
            resolve(fileName)
        )?.toString() ?? '0';
    }

    /**
     * Gets a script snapshot for a file which represents its content.
     * Required by the LanguageServiceHost interface to provide file content to the language service.
     *
     * @param fileName - Path to the script file
     * @returns A script snapshot object or undefined if the file doesn't exist or can't be read
     *
     * @see ts.LanguageServiceHost.getScriptSnapshot
     * @see ts.IScriptSnapshot
     * @since 1.5.9
     */

    getScriptSnapshot(fileName: string): IScriptSnapshot | undefined {
        if (!this.fileExists(fileName)) return undefined;
        const content = this.readFile(fileName);

        return content != null ? ts.ScriptSnapshot.fromString(content) : undefined;
    }
}
