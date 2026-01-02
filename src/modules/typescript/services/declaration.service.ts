/**
 * Import will remove at compile time
 */

import type { LanguageService, Program, SourceFile } from 'typescript';
import type { LanguageHostService } from '@typescript/services/language-host.service';
import type { ModuleImportsInterface } from '@typescript/services/interfaces/declaration-service.interface';
import type { DeclarationInterface } from '@typescript/services/interfaces/declaration-cache-service.interface';
import type { BundleExportsResultInterface } from '@typescript/services/interfaces/declaration-service.interface';
import type { NamespaceExportsResultInterface } from '@typescript/services/interfaces/declaration-service.interface';

/**
 * Imports
 */

import { dirname, join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { xterm } from '@remotex-labs/xansi/xterm.component';
import { inject, Injectable } from '@symlinks/symlinks.module';
import { DeclarationCache } from '@typescript/services/declaration-cache.service';
import { HeaderDeclarationBundle } from '@typescript/constants/typescript.constant';
import { emitSingleDeclaration, shouldEmitFile } from '@typescript/components/emit.component';

/**
 * Manages TypeScript declaration file emission and bundling.
 *
 * @remarks
 * The {@link DeclarationService} handles the complete lifecycle of TypeScript declaration
 * (`.d.ts`) files, including individual file emission and bundled declaration generation.
 * It uses {@link DeclarationCache} to track and manage declarations efficiently.
 *
 * Key responsibilities include:
 * - Emitting individual declaration files for source files
 * - Bundling multiple declarations into single output files
 * - Managing import/export relationships and dependencies
 * - Handling path alias resolution in declarations
 * - Generating optimized bundled declaration content
 *
 * The service distinguishes between:
 * - **Individual emission**: Direct `.d.ts` output for each source file
 * - **Bundle emission**: Combined declarations from multiple files with optimized imports/exports
 *
 * @example
 * ```ts
 * const service = new DeclarationService(languageService, languageHost);
 *
 * // Emit individual declarations
 * await service.emitDeclarations(false);
 *
 * // Or emit bundled declarations
 * await service.emitBundleDeclarations({
 *   'dist/index': 'src/index.ts',
 *   'dist/utils': 'src/utils/index.ts'
 * });
 * ```
 *
 * @see LanguageService
 * @see DeclarationCache
 * @see LanguageHostService
 *
 * @since 2.0.0
 */

@Injectable({
    scope: 'singleton'
})
export class DeclarationService {
    /**
     * Reference to the TypeScript language service for compilation operations.
     *
     * @remarks
     * Used for accessing the program, emitting declarations, and type checking.
     *
     * @see LanguageService
     * @since 2.0.0
     */

    readonly languageService: LanguageService;

    /**
     * Reference to the language service host for configuration and file operations.
     *
     * @remarks
     * Provides access to compilation settings, file paths, and version tracking.
     *
     * @see LanguageHostService
     * @since 2.0.0
     */

    readonly languageServiceHost: LanguageHostService;

    /**
     * Regular expression pattern for matching TypeScript path aliases in declarations.
     *
     * @remarks
     * Dynamically generated from the ` tsconfig.json ` compiler options' `paths` field.
     * Used to identify and replace path aliases during declaration bundling.
     * Lazily initialized via {@link parseAliasRegex}.
     *
     * @see parseAliasRegex
     * @since 2.0.0
     */

    private aliasRegex?: RegExp;

    /**
     * Cache service for storing and retrieving processed declarations.
     *
     * @remarks
     * Manages declaration caching with version-based invalidation.
     * Tracks imports, exports, and dependencies for efficient bundling.
     *
     * @see DeclarationCache
     * @since 2.0.0
     */

    private readonly declarationCache: DeclarationCache;

    /**
     * Initializes a new {@link DeclarationService} instance.
     *
     * @param languageService - TypeScript language service for emissions.
     * @param languageServiceHost - Language service host for configuration and file operations.
     *
     * @remarks
     * Initializes the declaration cache and builds the alias regex from compiler options.
     * The service is injectable as a singleton and shares state across the application.
     *
     * @see parseAliasRegex
     * @see DeclarationCache
     *
     * @since 2.0.0
     */

    constructor(languageService: LanguageService, languageServiceHost: LanguageHostService) {
        this.languageService = languageService;
        this.languageServiceHost = languageServiceHost;
        this.declarationCache = inject(DeclarationCache, languageService, languageServiceHost);

        /**
         * Build alias regex
         */

        this.aliasRegex = this.parseAliasRegex();
    }

    /**
     * Reloads the alias regex pattern from updated compiler options.
     *
     * @remarks
     * This method should be called when the TypeScript configuration changes,
     * particularly when path aliases in `tsconfig.json` are modified.
     * Regenerates the {@link aliasRegex} for updated path alias matching.
     *
     * @see aliasRegex
     * @see parseAliasRegex
     *
     * @since 2.0.0
     */

    reload(): void {
        this.aliasRegex = this.parseAliasRegex();
    }

    /**
     * Emits individual declaration files for source files.
     *
     * @param force - If `true`, emits all eligible files. If `false`, only emits changed files.
     * @param outdir - Override output directory for generated files.
     *
     * @returns A promise that resolves when all declarations have been emitted.
     *
     * @throws Error if the language service program is not available.
     *
     * @remarks
     * This method processes all source files and determines which ones should be emitted
     * based on {@link shouldEmitFile} criteria. For each eligible file, it generates
     * a corresponding `.d.ts` file using {@link emitSingleDeclaration}.
     *
     * The `force` parameter enables:
     * - `false`: Incremental emission (skip unchanged files)
     * - `true`: Full rebuild (emit all files)
     *
     * @example
     * ```ts
     * // Incremental emission
     * await service.emitDeclarations(false);
     *
     * // Full rebuild
     * await service.emitDeclarations(true);
     * ```
     *
     * @see shouldEmitFile
     * @see emitSingleDeclaration
     *
     * @since 2.0.0
     */

    async emitDeclarations(force: boolean, outdir?: string): Promise<void> {
        console.log(`${ xterm.deepOrange('[TS]') } emit declarations`);
        const program = this.languageService.getProgram();
        if (!program) {
            throw new Error(`${ xterm.deepOrange('[TS]') } Language service program is not available`);
        }

        const filesToEmit: Array<SourceFile> = [];
        const sourceFiles = program.getSourceFiles();
        let config = this.languageServiceHost.getCompilationSettings();

        for (let i = 0; i < sourceFiles.length; i++) {
            const file = sourceFiles[i];
            if (shouldEmitFile.call(this.languageServiceHost, file, program, force)) {
                filesToEmit.push(file);
            }
        }

        if (filesToEmit.length === 0) return;
        if(outdir) config = { ...config, outDir: outdir };

        await Promise.all(filesToEmit.map(
            source => emitSingleDeclaration.call(this.languageService, source, config, this.aliasRegex)
        ));
    }

    /**
     * Emits bundled declaration files from multiple source files.
     *
     * @param entryPoints - A record mapping output paths to entry file paths.
     * @param outdir - Override output directory for generated files.
     *
     * @returns A promise that resolves when all bundle declarations have been emitted.
     *
     * @throws Error if the language service program is not available.
     *
     * @remarks
     * This method creates combined declaration files by:
     * 1. Collecting all dependencies from entry points
     * 2. Merging import/export statements
     * 3. Combining declaration content
     * 4. Writing optimized bundled declarations to output files
     *
     * Each entry point generates a single bundled `.d.ts` file containing:
     * - All transitive dependencies' declarations
     * - Consolidated imports from external modules
     * - Combined exports
     * - Entry point declarations
     *
     * @example
     * ```ts
     * await service.emitBundleDeclarations({
     *   'dist/index': 'src/index.ts',
     *   'dist/react': 'src/react.ts'
     * });
     * // Generates:
     * // - dist/index.d.ts (bundled from src/index.ts and its dependencies)
     * // - dist/react.d.ts (bundled from src/react.ts and its dependencies)
     * ```
     *
     * @see getBundleContent
     * @see bundleCollectDeclarations
     *
     * @since 2.0.0
     */

    async emitBundleDeclarations(entryPoints: Record<string, string>, outdir?: string): Promise<void> {
        console.log(`${ xterm.deepOrange('[TS]') } emit bundle declarations`);
        const program = this.languageService.getProgram();
        if (!program) {
            throw new Error(`${ xterm.deepOrange('[TS]') } Language service program is not available`);
        }

        const promiseEvents = [];
        for (const [ outputPath, entryFile ] of Object.entries(entryPoints)) {
            const sourceFile = program.getSourceFile(entryFile);
            if (!sourceFile) continue;

            const outputFile = join(
                outdir || this.languageServiceHost.getCompilationSettings().outDir!, `${ outputPath }.d.ts`
            );

            promiseEvents.push(this.bundleCollectDeclarations(sourceFile, program, outputFile));
        }

        await Promise.all(promiseEvents);
    }

    /**
     * Generates a unique random identifier not present in an existing set.
     *
     * @param existingNames - Set of names already in use.
     * @returns A unique 3-letter random identifier.
     *
     * @remarks
     * This method generates random 3-letter identifiers and ensures they don't
     * conflict with names already present in the provided set. Used for creating
     * temporary import bindings during bundle generation.
     *
     * @example
     * ```ts
     * const used = new Set(['foo', 'bar']);
     * const name = this.generateRandomName(used); // e.g., 'xyz'
     * console.log(used.has(name)); // true (now added to the set)
     * ```
     *
     * @since 2.0.0
     */

    private generateRandomName(existingNames: Set<string>): string {
        const letters = 'abcdefghijklmnopqrstuvwxyz';
        let name: string;

        do {
            name = Array.from({ length: 3 }, () =>
                letters[Math.floor(Math.random() * letters.length)]
            ).join('');
        } while (existingNames.has(name));

        existingNames.add(name);

        return name;
    }

    /**
     * Recursively collects exported names from namespace exports and star exports.
     *
     * @param fileName - Path to the file to collect exports from.
     * @param visited - Set of already processed files (prevents infinite recursion).
     * @returns A {@link NamespaceExportsResultInterface} with collected exports and declarations.
     *
     * @remarks
     * This method handles complex export patterns:
     * - `export * from 'module'` - Collects all exports from the module
     * - `export * as Foo from 'module'` - Creates a namespace object with module exports
     *
     * Maintains a visited set to prevent infinite loops in circular dependencies.
     * Generates object literal declarations for namespace exports.
     *
     * @example
     * ```ts
     * // For a file with: export * as Utils from './utils'
     * const result = this.collectNamespaceExports('src/index.ts');
     * // Returns:
     * // {
     * //   exports: ['Utils'],
     * //   declarations: ['const Utils = { helper, other };']
     * // }
     * ```
     *
     * @see NamespaceExportsResultInterface
     * @since 2.0.0
     */

    private collectNamespaceExports(fileName: string, visited = new Set<string>()): NamespaceExportsResultInterface {
        if (visited.has(fileName)) {
            return { exports: [], declarations: [] };
        }
        visited.add(fileName);

        const declaration = this.declarationCache.get(fileName);
        if (!declaration) {
            return { exports: [], declarations: [] };
        }

        const exports: Array<string> = [ ...declaration.exports.exports ];
        const declarations: Array<string> = [];

        // Handle namespace exports: export * as Foo from './module'
        for (const [ namespaceName, targetModule ] of Object.entries(declaration.exports.namespace)) {
            const nested = this.collectNamespaceExports(targetModule, visited);

            if (nested.exports.length > 0) {
                declarations.push(...nested.declarations);
                declarations.push(`const ${ namespaceName } = { ${ nested.exports.join(', ') } };`);
                exports.push(namespaceName);
            }
        }

        // Handle star exports: export * from './module'
        for (const starModule of declaration.exports.star) {
            const nested = this.collectNamespaceExports(starModule, visited);
            exports.push(...nested.exports);
            declarations.push(...nested.declarations);
        }

        return { exports, declarations };
    }

    /**
     * Collects all external module imports from a set of declarations.
     *
     * @param declarations - Set of {@link DeclarationInterface} objects to process.
     * @returns A map of module names to their {@link ModuleImportsInterface} metadata.
     *
     * @remarks
     * This method aggregates imports across multiple declarations, consolidating them
     * by module name. It handles three import styles:
     *
     * - **Default imports**: `import Foo from 'module'` → stored in `default`
     * - **Named imports**: `import { a, b } from 'module'` → collected in `named` set
     * - **Namespace imports**: `import * as Foo from 'module'` → stored in `namespace` map
     *
     * When multiple declarations import from the same module, their imports are merged:
     * - First default import wins (no duplicates)
     * - Named imports are deduplicated via a Set
     * - Namespace imports are combined in the namespace map
     *
     * @example
     * ```ts
     * // Given two declarations:
     * // Declaration 1: import React, { useState } from 'react'
     * // Declaration 2: import { useEffect } from 'react'
     *
     * const imports = this.collectExternalImports(declarations);
     * // Results in:
     * // {
     * //   'react': {
     * //     default: 'React',
     * //     named: Set(['useState', 'useEffect']),
     * //     namespace: Map()
     * //   }
     * // }
     * ```
     *
     * @see DeclarationInterface
     * @see ModuleImportsInterface
     *
     * @since 2.0.0
     */

    private collectExternalImports(declarations: Set<DeclarationInterface>): Map<string, ModuleImportsInterface> {
        const imports = new Map<string, ModuleImportsInterface>();
        for (const declaration of declarations) {
            // Default imports: import Foo from 'module'
            for (const [ module, name ] of Object.entries(declaration.imports.default)) {
                if (!imports.has(module)) {
                    imports.set(module, { named: new Set(), namespace: new Map() });
                }
                const moduleImports = imports.get(module)!;
                if (!moduleImports.default) {
                    moduleImports.default = name;
                }
            }

            // Named imports: import { a, b } from 'module'
            for (const [ module, names ] of Object.entries(declaration.imports.named)) {
                if (!imports.has(module)) {
                    imports.set(module, { named: new Set(), namespace: new Map() });
                }
                for (const name of names) {
                    imports.get(module)!.named.add(name);
                }
            }

            // Namespace imports: import * as Foo from 'module'
            for (const [ name, module ] of Object.entries(declaration.imports.namespace)) {
                if (!imports.has(module)) {
                    imports.set(module, { named: new Set(), namespace: new Map() });
                }
                imports.get(module)!.namespace.set(name, module);
            }
        }

        return imports;
    }

    /**
     * Generates TypeScript import statements from collected external imports.
     *
     * @param imports - A map of module names to {@link ModuleImportsInterface} metadata.
     * @returns An array of import statement strings ready for output.
     *
     * @remarks
     * This method converts structured import metadata into valid TypeScript import statements.
     * It handles deduplication and combines related imports from the same module:
     *
     * - Default and named imports are merged into a single statement
     * - Namespace imports generate separate statements
     * - Named imports are sorted alphabetically for consistent output
     *
     * Generated statements follow this pattern:
     * ```ts
     * import DefaultName, { named1, named2 } from 'module';
     * import * as namespace from 'module';
     * ```
     *
     * @example
     * ```ts
     * const imports = new Map([
     *   ['react', {
     *     default: 'React',
     *     named: Set(['useState', 'useEffect']),
     *     namespace: Map()
     *   }],
     *   ['lodash', {
     *     named: Set(['map', 'filter']),
     *     namespace: Map()
     *   }]
     * ]);
     *
     * const statements = this.generateImportStatements(imports);
     * // Results in:
     * // [
     * //   "import React, { useEffect, useState } from 'react';",
     * //   "import { filter, map } from 'lodash';"
     * // ]
     * ```
     *
     * @see ModuleImportsInterface
     * @since 2.0.0
     */

    private generateImportStatements(imports: Map<string, ModuleImportsInterface>): Array<string> {
        const statements: Array<string> = [];
        for (const [ module, { default: defaultImport, named, namespace }] of imports) {
            const parts: Array<string> = [];

            if (defaultImport) {
                parts.push(defaultImport);
            }

            if (named.size > 0) {
                parts.push(`{ ${ Array.from(named).sort().join(', ') } }`);
            }

            if (namespace.size > 0) {
                for (const [ name ] of namespace) {
                    statements.push(`import * as ${ name } from '${ module }';`);
                }
            }

            if (parts.length > 0) {
                statements.push(`import ${ parts.join(', ') } from '${ module }';`);
            }
        }

        return statements;
    }

    /**
     * Collects and generates export statements from a set of declaration files.
     *
     * @param exportList - Set of {@link DeclarationInterface} objects containing exports.
     * @param randomNames - Set of random names already in use (to avoid conflicts).
     * @returns A {@link BundleExportsResultInterface} with exports, declarations, and external exports.
     *
     * @remarks
     * This method processes all export types from multiple declarations:
     *
     * - **Direct exports**: `export { a, b }` → collected in exports array
     * - **Namespace exports**: `export * as Foo from './module'` → generates object literals
     * - **Star exports**: `export * from 'external'` → generates temporary imports
     * - **External re-exports**: `export { ... } from 'external'` → preserved as-is
     *
     * For external star exports, generates unique temporary import names to avoid conflicts.
     * Namespace exports create intermediate object literal declarations combining exports.
     *
     * @example
     * ```ts
     * // Given declarations with:
     * // - Direct exports: Component, Helper
     * // - Namespace export: export * as utils from './utils'
     * // - External star: export * from 'react'
     *
     * const result = this.collectBundleExports(exportList, new Set());
     * // Results in:
     * // {
     * //   exports: ['Component', 'Helper', 'utils', 'abc'],
     * //   declarations: [
     * //     'const utils = { utilFn1, utilFn2 };',
     * //     'import * as abc from "react";'
     * //   ],
     * //   externalExports: []
     * // }
     * ```
     *
     * @see generateRandomName
     * @see DeclarationInterface
     * @see BundleExportsResultInterface
     *
     * @since 2.0.0
     */

    private collectBundleExports(exportList: Set<DeclarationInterface>, randomNames: Set<string>): BundleExportsResultInterface {
        const exports: Array<string> = [];
        const declarations: Array<string> = [];
        const externalExports: Array<string> = [];

        for (const declaration of exportList) {
            // Direct exports: export { a, b }
            exports.push(...declaration.exports.exports);

            // Namespace exports: export * as Foo from './module'
            for (const [ namespaceName, targetModule ] of Object.entries(declaration.exports.namespace)) {
                const nested = this.collectNamespaceExports(targetModule);

                if (nested.exports.length > 0) {
                    declarations.push(...nested.declarations);
                    declarations.push(`const ${ namespaceName } = { ${ nested.exports.join(', ') } };`);
                    exports.push(namespaceName);
                }
            }

            // External star exports: export * from 'external-module'
            for (const module of declaration.externalExports.star) {
                const randomName = this.generateRandomName(randomNames);
                declarations.push(`import * as ${ randomName } from '${ module }';`);
                exports.push(randomName);
            }

            // External namespace exports: export * as Foo from 'external-module'
            for (const [ namespaceName, module ] of Object.entries(declaration.externalExports.namespace)) {
                externalExports.push(`export * as ${ namespaceName } from '${ module }';`);
            }

            // External named exports: export { a, b } from 'external-module'
            for (const [ module, names ] of Object.entries(declaration.externalExports.exports)) {
                externalExports.push(`export { ${ names.join(',\n') } } from '${ module }';`);
            }
        }

        return { exports, declarations, externalExports };
    }

    /**
     * Assembles the complete bundled declaration content with imports and exports.
     *
     * @param content - The merged declaration file content.
     * @param dependencyList - Set of all declarations included as dependencies.
     * @param exportList - Set of declarations whose exports should be re-exported.
     * @returns The assembled bundled declaration file content as a string.
     *
     * @remarks
     * This method orchestrates the final output structure:
     *
     * 1. Adds the standard header comment (via {@link HeaderDeclarationBundle})
     * 2. Collects and generates import statements for external modules
     * 3. Generates internal declarations (namespace objects, etc.)
     * 4. Includes the merged declaration content
     * 5. Generates the final export list
     * 6. Adds re-exports for external modules
     *
     * The result is a complete, self-contained declaration file ready for distribution.
     * Includes proper formatting with blank lines between sections.
     *
     * @example
     * ```ts
     * const content = 'class MyClass { }';
     * const result = this.parseContent(content, dependencyList, exportList);
     *
     * // Output:
     * // /**
     * //  * This file was automatically generated by xBuild.
     * //  * DO NOT EDIT MANUALLY.
     * //  * /
     * // import { useState } from 'react';
     * //
     * // class MyClass { }
     * // export { MyClass };
     * ```
     *
     * @see collectBundleExports
     * @see collectExternalImports
     * @see HeaderDeclarationBundle
     *
     * @since 2.0.0
     */

    private parseContent(
        content: string, dependencyList: Set<DeclarationInterface>, exportList: Set<DeclarationInterface>
    ): string {
        const parts: Array<string> = [ HeaderDeclarationBundle ];
        const imports = this.collectExternalImports(dependencyList);
        const randomNames = new Set<string>();
        const importStatements = this.generateImportStatements(imports);
        parts.push(...importStatements);

        if (importStatements.length > 0) parts.push(''); // Empty line after imports
        const { exports, declarations, externalExports } = this.collectBundleExports(exportList, randomNames);
        if (declarations.length > 0) {
            parts.push(...declarations);
            parts.push(''); // Empty line after declarations
        }

        parts.push(content);
        if (exports.length > 0) {
            const uniqueExports = Array.from(new Set(exports)).sort();
            parts.push(`export { ${ uniqueExports.join(',\n') } };`);
        }

        if (externalExports.length > 0) {
            parts.push(...externalExports);
        }

        return parts.join('\n');
    }

    /**
     * Collects all dependencies and generates bundled declaration content.
     *
     * @param entryPoint - The entry {@link DeclarationInterface} to start bundling from.
     * @param program - The TypeScript program for resolving source files.
     * @returns A promise that resolves to the complete bundled declaration content.
     *
     * @remarks
     * This method performs a depth-first traversal of the dependency graph:
     *
     * 1. Starts from the entry point declaration
     * 2. Recursively collects all internal dependencies
     * 3. Tracks star exports to determine which modules to re-export
     * 4. Merges all declaration content
     * 5. Generates optimized import/export statements
     * 6. Assembles the final bundle via {@link parseContent}
     *
     * Handles circular dependencies via the visited set. Preserves declaration
     * order based on dependency relationships.
     *
     * @example
     * ```ts
     * // For entry point 'src/index.ts' that imports from './utils' and './types'
     * const content = await this.getBundleContent(entryPoint, program);
     *
     * // Result includes:
     * // - All transitive dependencies' declarations
     * // - External imports from `react`, `lodash`, etc.
     * // - Combined content from index, utils, and types
     * // - Consolidated exports
     * ```
     *
     * @see parseContent
     * @see DeclarationInterface
     *
     * @since 2.0.0
     */

    private async getBundleContent(entryPoint: DeclarationInterface, program: Program): Promise<string> {
        const visited = new Set<string>();
        const exportList = new Set([ entryPoint ]);
        const dependencyList = new Set([ entryPoint ]);
        const dependencyQueue = [ ...entryPoint.dependency ];
        const starExportModules = new Set(entryPoint.exports.star);

        let content = '';
        while (dependencyQueue.length > 0) {
            const currentFile = dependencyQueue.pop()!;
            if (visited.has(currentFile)) continue;
            visited.add(currentFile);

            const sourceFile = program.getSourceFile(currentFile);
            if (!sourceFile) continue;
            const declaration = this.declarationCache.getOrUpdate(
                sourceFile,
                this.languageServiceHost.getScriptVersion(currentFile)
            );

            dependencyList.add(declaration);
            if (starExportModules.has(currentFile)) {
                exportList.add(declaration);
                for (const starModule of declaration.exports.star) {
                    starExportModules.add(starModule);
                }
            }

            for (const dep of declaration.dependency) {
                if (!visited.has(dep)) {
                    dependencyQueue.push(dep);
                }
            }

            content += declaration.content;
        }

        // Add entry point content
        content += entryPoint.content;

        return this.parseContent(content, dependencyList, exportList);
    }

    /**
     * Bundles declarations and writes the result to an output file.
     *
     * @param source - The entry {@link SourceFile} to bundle from.
     * @param program - The TypeScript program for resolving dependencies.
     * @param output - Path where the bundled declaration file should be written.
     * @returns A promise that resolves when the file has been written.
     *
     * @remarks
     * This is the main orchestration method that:
     *
     * 1. Gets or updates the entry point declaration from cache
     * 2. Collects all dependencies and generates bundle content via {@link getBundleContent}
     * 3. Ensures the output directory exists
     * 4. Writes the complete bundled content to the output file
     *
     * Creates parent directories as needed if they don't exist.
     *
     * @example
     * ```ts
     * const program = languageService.getProgram();
     * const sourceFile = program.getSourceFile('src/index.ts');
     *
     * await this.bundleCollectDeclarations(
     *   sourceFile,
     *   program,
     *   'dist/index.d.ts'
     * );
     * ```
     *
     * @see getBundleContent
     * @see DeclarationCache
     *
     * @since 2.0.0
     */

    private async bundleCollectDeclarations(source: SourceFile, program: Program, output: string): Promise<void> {
        const entryDeclaration = this.declarationCache.getOrUpdate(
            source,
            this.languageServiceHost.getScriptVersion(source.fileName)
        );

        const content = await this.getBundleContent(entryDeclaration, program);
        await mkdir(dirname(output), { recursive: true });
        await writeFile(output, content, 'utf-8');
    }

    /**
     * Generates a regular expression pattern for matching TypeScript path aliases.
     *
     * @returns A {@link RegExp} pattern matching import/export statements with path aliases, or `undefined` if no aliases are configured.
     *
     * @remarks
     * This method creates a regex from the `paths` field in `tsconfig.json` compiler options.
     * The generated pattern matches:
     *
     * - Import and export statements
     * - Optional `type` keyword for type-only imports
     * - String literals (quoted module paths)
     * - Path aliases as specified in TypeScript configuration
     *
     * Example for aliases like:
     * ```JSON
     * {
     *   "paths": {
     *     "@utils/*": ["src/utils/*"],
     *     "@components/*": ["src/components/*"]
     *   }
     * }
     * ```
     *
     * The generated regex matches statements like:
     * - `import { helper } from '@utils/index';`
     * - `export * from '@components/Button';`
     *
     * @example
     * ```ts
     * const regex = this.parseAliasRegex();
     * // Matches: import x from '@utils/helper'
     * if (regex?.test("import { foo } from '@utils/index';")) {
     *   console.log('Path alias detected');
     * }
     * ```
     *
     * @see aliasRegex
     * @since 2.0.0
     */

    private parseAliasRegex(): RegExp | undefined {
        const config = this.languageServiceHost.getCompilationSettings();
        const paths = config.paths;
        if (!paths) return;

        const aliases = Object.keys(paths)
            .map(alias => alias.replace('/*', '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('|');

        return new RegExp(
            '(?:^|\\s)(?:import|export)\\s+' +  // import or export keyword
            '(?:type\\s+)?' +                   // optional 'type' keyword
            '(?:[^\'"]*from\\s+)?' +            // optional '... from' (non-greedy)
            `['"]((${ aliases })[^'"]*)['"]` +  // capture the quoted path with alias
            ';?',                               // optional semicolon
            'gm'
        );
    }
}
