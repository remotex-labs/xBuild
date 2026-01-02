/**
 * Import will remove at compile time
 */

import type { LanguageService, SourceFile } from 'typescript';
import type { LanguageHostService } from '@typescript/services/language-host.service';
import type { ModuleInfoInterface, DeclarationInterface } from '@typescript/services/interfaces/declaration-cache-service.interface';

/**
 * Imports
 */

import ts from 'typescript';
import { Injectable } from '@symlinks/symlinks.module';
import { cleanContent, removeExportModifiers, resolveModuleName } from '@typescript/components/emit.component';

/**
 * Manages caching and processing of TypeScript declaration files.
 *
 * @remarks
 * The {@link DeclarationCache} service provides efficient caching and processing of
 * TypeScript declaration (`.d.ts`) files for bundle generation. It analyzes source files,
 * emits their declarations, and extracts metadata about imports, exports, and dependencies.
 *
 * Key responsibilities include:
 * - Emitting and caching TypeScript declaration files
 * - Tracking module dependencies for bundling
 * - Extracting import and export information
 * - Managing version-based cache invalidation
 * - Processing and cleaning declaration content
 *
 * The service distinguishes between internal (project) and external (node_modules) modules,
 * enabling efficient declaration bundling and tree-shaking.
 *
 * @example
 * ```ts
 * const cache = new DeclarationCache(languageService, languageHost);
 *
 * // Process a source file
 * const sourceFile = program.getSourceFile('src/index.ts');
 * const declaration = cache.set(sourceFile);
 *
 * console.log(declaration.content); // Processed declaration content
 * console.log(declaration.dependency); // Set of internal dependencies
 * console.log(declaration.exports); // Export information
 * ```
 *
 * @see LanguageService
 * @see DeclarationInterface
 * @see LanguageHostService
 *
 * @since 2.0.0
 */

@Injectable({
    scope: 'singleton'
})
export class DeclarationCache {
    /**
     * Internal cache mapping file names to their processed declarations.
     *
     * @remarks
     * This map stores {@link DeclarationInterface} objects keyed by a file path.
     * Each entry contains the processed declaration content, version, dependencies,
     * and import/export metadata.
     *
     * @see get
     * @see set
     * @see DeclarationInterface
     *
     * @since 2.0.0
     */

    private readonly cache = new Map<string, DeclarationInterface>();

    /**
     * TypeScript printer instance for converting AST nodes to strings.
     *
     * @remarks
     * This printer is lazily initialized via {@link getPrinter} and reused for
     * all AST-to-string conversions. It's configured to use line feeds for
     * consistent output across platforms.
     *
     * @see getPrinter
     * @since 2.0.0
     */

    private printer?: ts.Printer;

    /**
     * Initializes a new {@link DeclarationCache} instance.
     *
     * @param languageService - TypeScript language service for emitting declarations.
     * @param languageServiceHost - Language service host for version tracking and file operations.
     *
     * @remarks
     * The language service is used to emit declaration files from source files,
     * while the language service host provides version information for cache invalidation.
     *
     * @see LanguageService
     * @see LanguageHostService
     *
     * @since 2.0.0
     */


    constructor(
        private readonly languageService: LanguageService,
        private readonly languageServiceHost: LanguageHostService
    ) {}

    /**
     * Retrieves a cached declaration for a given file.
     *
     * @param fileName - Path to the file (absolute or relative).
     * @returns The cached {@link DeclarationInterface} if found, otherwise `undefined`.
     *
     * @remarks
     * This method performs a simple cache lookup without checking if the cached
     * declaration is up to date. Use {@link getOrUpdate} for version-aware retrieval.
     *
     * @example
     * ```ts
     * const cached = cache.get('src/index.ts');
     * if (cached) {
     *   console.log(cached.content);
     * }
     * ```
     *
     * @see set
     * @see getOrUpdate
     * @see DeclarationInterface
     *
     * @since 2.0.0
     */


    get(fileName: string): DeclarationInterface | undefined {
        return this.cache.get(fileName);
    }

    /**
     * Processes and caches a declaration for the given source file.
     *
     * @param source - The TypeScript source file to process.
     * @returns The processed {@link DeclarationInterface}.
     *
     * @remarks
     * This method performs the following steps:
     * 1. Emits the declaration file using the language service
     * 2. Analyzes imports and exports
     * 3. Extracts dependencies and metadata
     * 4. Stores the result in the cache
     *
     * The processed declaration includes cleaned content with imports/exports removed,
     * along with metadata about dependencies and module relationships.
     *
     * @example
     * ```ts
     * const sourceFile = program.getSourceFile('src/utils.ts');
     * const declaration = cache.set(sourceFile);
     *
     * console.log(declaration.exports.exports); // ['helperFn', 'UtilClass']
     * console.log(declaration.dependency); // Set(['src/types.ts'])
     * ```
     *
     * @see processDeclaration
     * @see DeclarationInterface
     *
     * @since 2.0.0
     */

    set(source: SourceFile): DeclarationInterface {
        const processed = this.processDeclaration(source);
        this.cache.set(source.fileName, processed);

        return processed;
    }

    /**
     * Retrieves a cached declaration or updates it if the version has changed.
     *
     * @param source - The TypeScript source file.
     * @param version - The current version string from the language host.
     * @returns The cached or newly processed {@link DeclarationInterface}.
     *
     * @remarks
     * This method checks if the cached declaration's version matches the current version.
     * If versions match, returns the cached declaration. Otherwise, reprocesses the file
     * and updates the cache.
     *
     * This enables efficient incremental processing by avoiding redundant work on
     * unchanged files.
     *
     * @example
     * ```ts
     * const sourceFile = program.getSourceFile('src/index.ts');
     * const version = languageHost.getScriptVersion('src/index.ts');
     *
     * const declaration = cache.getOrUpdate(sourceFile, version);
     * // Returns cached declaration if a version matches, otherwise reprocesses
     * ```
     *
     * @see get
     * @see set
     * @see DeclarationInterface
     *
     * @since 2.0.0
     */

    getOrUpdate(source: SourceFile, version: string): DeclarationInterface {
        const cached = this.cache.get(source.fileName);

        return (cached?.version === version) ? cached : this.set(source);
    }

    /**
     * Checks if a declaration is cached for the given file.
     *
     * @param fileName - Path to the file to check.
     * @returns `true` if a cached declaration exists, otherwise `false`.
     *
     * @example
     * ```ts
     * if (cache.has('src/index.ts')) {
     *   console.log('Declaration is cached');
     * }
     * ```
     *
     * @see get
     * @since 2.0.0
     */

    has(fileName: string): boolean {
        return this.cache.has(fileName);
    }

    /**
     * Clears all cached declarations.
     *
     * @remarks
     * This method removes all entries from the cache. Useful when performing
     * a full rebuild or when the project configuration changes significantly.
     *
     * @example
     * ```ts
     * cache.clear();
     * console.log('All cached declarations cleared');
     * ```
     *
     * @since 2.0.0
     */

    clear(): void {
        this.cache.clear();
    }

    /**
     * Removes a specific declaration from the cache.
     *
     * @param fileName - Path to the file whose declaration should be removed.
     * @returns `true` if the entry was found and deleted, otherwise `false`.
     *
     * @example
     * ```ts
     * const deleted = cache.delete('src/old-module.ts');
     * if (deleted) {
     *   console.log('Declaration removed from cache');
     * }
     * ```
     *
     * @since 2.0.0
     */

    delete(fileName: string): boolean {
        return this.cache.delete(fileName);
    }

    /**
     * Returns the TypeScript printer instance, creating it if necessary.
     *
     * @returns A configured {@link ts.Printer} instance.
     *
     * @remarks
     * The printer is lazily initialized on first use and configured with
     * line feed characters for consistent cross-platform output.
     *
     * @see printer
     * @since 2.0.0
     */

    private getPrinter(): ts.Printer {
        return this.printer ??= ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    }

    /**
     * Initializes an empty declaration structure for a file.
     *
     * @param fileName - Path to the file.
     * @returns A new {@link DeclarationInterface} with empty metadata.
     *
     * @remarks
     * This method creates the initial structure that will be populated during
     * declaration processing. The version is retrieved from the language service host.
     *
     * @see DeclarationInterface
     * @since 2.0.0
     */

    private initDeclaration(fileName: string): DeclarationInterface {
        return {
            fileName,
            content: '',
            version: this.languageServiceHost.getScriptVersion(fileName),
            dependency: new Set(),
            imports: {
                named: {},
                default: {},
                namespace: {}
            },
            exports: {
                star: [],
                exports: [],
                namespace: {}
            },
            externalExports: {
                star: [],
                exports: {},
                namespace: {}
            }
        };
    }

    /**
     * Emits a declaration file for the given source file.
     *
     * @param source - The source file to emit declarations for.
     * @returns A {@link SourceFile} representing the emitted declaration.
     *
     * @throws Error if declaration emission fails.
     *
     * @remarks
     * This method uses the TypeScript language service to generate a `.d.ts` file
     * from the source code. The emitted declaration is then parsed back into a
     * SourceFile for further processing.
     *
     * @see LanguageService.getEmitOutput
     * @since 2.0.0
     */

    private emitDeclaration(source: SourceFile): SourceFile {
        const output = this.languageService.getEmitOutput(source.fileName, true, true);
        const declarationText = output.outputFiles[0]?.text;

        if (!declarationText) {
            throw new Error(`Failed to emit declaration: ${ source.fileName }`);
        }

        return ts.createSourceFile(
            source.fileName.replace(/\.tsx?$/, '.d.ts'),
            declarationText,
            ts.ScriptTarget.Latest,
            true
        );
    }

    /**
     * Resolves a module specifier to determine its file path and whether it's external.
     *
     * @param moduleSpecifier - The module specifier expression from an import/export statement.
     * @param declaration - The declaration context for resolving relative paths.
     * @returns A {@link ModuleInfoInterface} with resolved information, or `null` if resolution fails.
     *
     * @remarks
     * This method attempts to resolve module paths using TypeScript's module resolution.
     * Modules in `node_modules` or unresolved modules are marked as external.
     *
     * @see resolveModuleName
     * @see ModuleInfoInterface
     *
     * @since 2.0.0
     */

    private resolveModule(moduleSpecifier: ts.Expression, declaration: DeclarationInterface): ModuleInfoInterface | null {
        if (!ts.isStringLiteral(moduleSpecifier)) return null;

        const program = this.languageService.getProgram();
        if (!program) return null;

        const modulePath = moduleSpecifier.text;
        const resolvedFileName = resolveModuleName(
            program.getCompilerOptions(),
            modulePath,
            declaration.fileName
        );

        if (!resolvedFileName || resolvedFileName.includes('node_modules')) {
            return { fileName: modulePath, isExternal: true };
        }

        return { fileName: resolvedFileName, isExternal: false };
    }

    /**
     * Extracts and adds named import/export specifiers to a target array.
     *
     * @param target - The array to append extracted specifier names to.
     * @param elements - The node array of import or export specifiers to process.
     *
     * @remarks
     * This method processes TypeScript named import/export specifiers and converts them
     * into string representations that preserve aliasing. For each specifier:
     *
     * - If the specifier has a property name (aliased), formats as `"original as alias"`
     * - Otherwise, uses just the identifier name
     *
     * The method handles both import and export specifiers:
     * - Import: `import { a, b as c } from 'module'`
     * - Export: `export { a, b as c } from 'module'`
     *
     * The extracted names are appended to the provided target array, which can be
     * used for tracking dependencies or generating bundled declarations.
     *
     * @example
     * ```ts
     * // Given: import { foo, bar as baz } from 'module'
     * const target: string[] = [];
     * this.addNamedElements(target, namedImports.elements);
     *
     * console.log(target);
     * // Output: ['foo', 'bar as baz']
     * ```
     *
     * @example
     * ```ts
     * // Given: export { Component, default as Fallback } from 'react'
     * const exports: string[] = [];
     * this.addNamedElements(exports, namedExports.elements);
     *
     * console.log(exports);
     * // Output: ['Component', 'default as Fallback']
     * ```
     *
     * @see handleImport
     * @see handleExport
     * @since 2.0.0
     */

    private addNamedElements(
        target: string[],
        elements: ts.NodeArray<ts.ImportSpecifier | ts.ExportSpecifier>
    ): void {
        for (const element of elements) {
            const name = element.propertyName
                ? `${ element.propertyName.text } as ${ element.name.text }`
                : element.name.text;
            target.push(name);
        }
    }

    /**
     * Ensures an array exists at the specified key in a record, creating it if necessary.
     *
     * @param target - The record object to check.
     * @param key - The key to ensure has an array value.
     * @returns The array at the specified key (existing or newly created).
     *
     * @remarks
     * This utility method uses the nullish coalescing assignment operator (`??=`) to
     * lazily initialize array values in a record. If the key doesn't exist or is nullish,
     * a new empty array is created and assigned.
     *
     * This is useful for building up nested data structures without explicit null checks.
     *
     * @example
     * ```ts
     * const imports: Record<string, string[]> = {};
     *
     * // First call creates the array
     * const arr1 = this.ensureArray(imports, 'react');
     * arr1.push('useState');
     *
     * // Subsequent calls return the existing array
     * const arr2 = this.ensureArray(imports, 'react');
     * console.log(arr2); // ['useState']
     * ```
     *
     * @see handleImport
     * @see handleExport
     * @see addNamedElements
     *
     * @since 2.0.0
     */


    private ensureArray(target: Record<string, string[]>, key: string): string[] {
        return target[key] ??= [];
    }

    /**
     * Processes an import declaration and extracts import metadata.
     *
     * @param stmt - The TypeScript import declaration statement to process.
     * @param declaration - The declaration context to populate with import information.
     *
     * @remarks
     * This method analyzes import statements and categorizes them into:
     *
     * - **Internal dependencies**: Imports from project files (tracked in `dependency`)
     * - **External imports**: Imports from node_modules (tracked in `imports`)
     *
     * For external imports, it handles three import styles:
     * - Default imports: `import Foo from 'module'`
     * - Namespace imports: `import * as Foo from 'module'`
     * - Named imports: `import { a, b as c } from 'module'`
     *
     * Internal dependencies are only tracked in the dependency set and not stored
     * as imports, as they will be inlined during bundle generation.
     *
     * @example
     * ```ts
     * // Given: import React, { useState } from 'react'
     * this.handleImport(importStmt, declaration);
     *
     * // Results in:
     * // declaration.imports.default['react'] = 'React'
     * // declaration.imports.named['react'] = ['useState']
     * ```
     *
     * @example
     * ```ts
     * // Given: import { helper } from './utils'
     * this.handleImport(importStmt, declaration);
     *
     * // Results in:
     * // declaration.dependency has './utils' added
     * // No entry in declaration.imports (internal module)
     * ```
     *
     * @see resolveModule
     * @see addNamedElements
     * @see DeclarationInterface
     *
     * @since 2.0.0
     */

    private handleImport(stmt: ts.ImportDeclaration, declaration: DeclarationInterface): void {
        const { importClause, moduleSpecifier } = stmt;
        if (!importClause || !moduleSpecifier) return;

        const moduleInfo = this.resolveModule(moduleSpecifier, declaration);
        if (!moduleInfo) return;

        const { fileName, isExternal } = moduleInfo;

        // Track internal dependencies
        if (!isExternal) {
            declaration.dependency.add(fileName);

            return;
        }

        // Handle default import: import Foo from 'module'
        if (importClause.name) {
            declaration.imports.default[fileName] = importClause.name.text;
        }

        const { namedBindings } = importClause;
        if (!namedBindings) return;

        if (ts.isNamespaceImport(namedBindings)) {
            // import * as Foo from 'module'
            declaration.imports.namespace[namedBindings.name.text] = fileName;
        } else if (ts.isNamedImports(namedBindings)) {
            // import { a, b as c } from 'module'
            this.addNamedElements(
                this.ensureArray(declaration.imports.named, fileName),
                namedBindings.elements
            );
        }
    }

    /**
     * Processes an export declaration and extracts export metadata.
     *
     * @param stmt - The TypeScript export declaration statement to process.
     * @param declaration - The declaration context to populate with export information.
     *
     * @remarks
     * This method analyzes re-export statements (exports with `from` clauses) and
     * categorizes them based on whether they're internal or external modules:
     *
     * - **Internal re-exports**: Tracked in `exports` and `dependency`
     * - **External re-exports**: Tracked in `externalExports` only
     *
     * Handles three re-export styles:
     * - Star exports: `export * from 'module'`
     * - Namespace exports: `export * as Foo from 'module'`
     * - Named exports: `export { a, b as c } from 'module'`
     *
     * Internal dependencies are added to the dependency set for proper bundling order.
     *
     * @example
     * ```ts
     * // Given: export { useState } from 'react'
     * this.handleExport(exportStmt, declaration);
     *
     * // Results in:
     * // declaration.externalExports.exports['react'] = ['useState']
     * ```
     *
     * @example
     * ```ts
     * // Given: export * from './utils'
     * this.handleExport(exportStmt, declaration);
     *
     * // Results in:
     * // declaration.dependency has './utils' added
     * // declaration.exports.star = ['./utils']
     * ```
     *
     * @see resolveModule
     * @see addNamedElements
     * @see DeclarationInterface
     *
     * @since 2.0.0
     */

    private handleExport(stmt: ts.ExportDeclaration, declaration: DeclarationInterface): void {
        const { moduleSpecifier, exportClause } = stmt;
        if (!moduleSpecifier) return;

        const moduleInfo = this.resolveModule(moduleSpecifier, declaration);
        if (!moduleInfo) return;

        const { fileName, isExternal } = moduleInfo;
        const targetExports = isExternal ? declaration.externalExports : declaration.exports;

        // Track internal dependencies
        if (!isExternal) {
            declaration.dependency.add(fileName);
        }

        if (!exportClause) {
            // export * from 'module'
            targetExports.star.push(fileName);

            return;
        }

        if (ts.isNamespaceExport(exportClause)) {
            // export * as Foo from 'module'
            targetExports.namespace[exportClause.name.text] = fileName;

            return;
        }

        if (ts.isNamedExports(exportClause)) {
            // export { a, b as c } from 'module'
            if (isExternal) {
                this.addNamedElements(
                    this.ensureArray(declaration.externalExports.exports, fileName),
                    exportClause.elements
                );
            } else {
                this.addNamedElements(
                    declaration.exports.exports,
                    exportClause.elements
                );
            }
        }
    }

    /**
     * Extracts export names from statements with export modifiers.
     *
     * @param stmt - The TypeScript statement to extract export names from.
     * @param declaration - The declaration context to populate with export names.
     *
     * @remarks
     * This method handles direct exports (not re-exports) by extracting the names
     * of exported declarations. It supports:
     *
     * - Variable declarations: `export const foo = 1;`
     * - Enum declarations: `export enum Status { ... }`
     * - Class declarations: `export class MyClass { ... }`
     * - Function declarations: `export function helper() { ... }`
     * - Interface declarations: `export interface Config { ... }`
     * - Type alias declarations: `export type MyType = ...`
     *
     * For variable statements, it handles multiple declarations:
     * `export const a = 1, b = 2;` → extracts both 'a' and 'b'
     *
     * Extracted names are added to `declaration.exports.exports` array.
     *
     * @example
     * ```ts
     * // Given: export class MyClass { ... }
     * this.extractExportName(classStmt, declaration);
     *
     * // Results in:
     * // declaration.exports.exports.push('MyClass')
     * ```
     *
     * @example
     * ```ts
     * // Given: export const foo = 1, bar = 2;
     * this.extractExportName(varStmt, declaration);
     *
     * // Results in:
     * // declaration.exports.exports.push('foo', 'bar')
     * ```
     *
     * @see hasExportModifier
     * @see DeclarationInterface
     *
     * @since 2.0.0
     */

    private extractExportName(stmt: ts.Statement, declaration: DeclarationInterface): void {
        if (ts.isVariableStatement(stmt)) {
            for (const decl of stmt.declarationList.declarations) {
                if (ts.isIdentifier(decl.name)) {
                    declaration.exports.exports.push(decl.name.text);
                }
            }

            return;
        }

        // Handle other named declarations
        if (ts.isEnumDeclaration(stmt) ||
            ts.isClassDeclaration(stmt) ||
            ts.isFunctionDeclaration(stmt) ||
            ts.isInterfaceDeclaration(stmt) ||
            ts.isTypeAliasDeclaration(stmt)) {
            if (stmt.name && ts.isIdentifier(stmt.name)) {
                declaration.exports.exports.push(stmt.name.text);
            }
        }
    }

    /**
     * Checks if a statement has an export modifier.
     *
     * @param stmt - The TypeScript statement to check.
     * @returns `true` if the statement has an `export` keyword, otherwise `false`.
     *
     * @remarks
     * This method checks for the presence of the `export` modifier keyword in a statement.
     * It safely handles statements that cannot have modifiers by checking with
     * `ts.canHaveModifiers` first.
     *
     * Used to identify direct exports (e.g., `export class Foo`) vs. re-exports
     * (e.g., `export { Foo } from './bar'`).
     *
     * @example
     * ```ts
     * // Given: export class MyClass { }
     * const hasExport = this.hasExportModifier(classStmt); // true
     *
     * // Given: class MyClass { }
     * const hasExport = this.hasExportModifier(classStmt); // false
     * ```
     *
     * @see extractExportName
     * @since 2.0.0
     */

    private hasExportModifier(stmt: ts.Statement): boolean {
        if (!ts.canHaveModifiers(stmt)) return false;
        const modifiers = ts.getModifiers(stmt);

        return modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    }

    /**
     * Strips import and export statements from a declaration file and extracts metadata.
     *
     * @param sourceFile - The TypeScript source file to process.
     * @param declaration - The declaration context to populate with metadata.
     * @returns The cleaned declaration content with imports/exports removed.
     *
     * @remarks
     * This method processes all statements in a declaration file and:
     *
     * 1. Removes import declarations (via {@link handleImport})
     * 2. Removes re-export declarations (via {@link handleExport})
     * 3. Extracts export names from direct exports (via {@link extractExportName})
     * 4. Removes export modifiers from remaining statements
     * 5. Returns cleaned content ready for bundling
     *
     * The result is a declaration file with all imports/exports stripped but with
     * complete metadata about dependencies and module relationships preserved in
     * the declaration context.
     *
     * @example
     * ```ts
     * // Input declaration:
     * // import { Foo } from './foo';
     * // export class Bar extends Foo { }
     * // export { helper } from './utils';
     *
     * const content = this.stripImportsExports(declarationFile, declaration);
     *
     * // Output content:
     * // class Bar extends Foo { }
     *
     * // Metadata extracted:
     * // declaration.dependency = Set(['./foo', './utils'])
     * // declaration.exports.exports = ['Bar']
     * ```
     *
     * @see handleImport
     * @see handleExport
     * @see cleanContent
     * @see extractExportName
     * @see removeExportModifiers
     *
     * @since 2.0.0
     */

    private stripImportsExports(sourceFile: SourceFile, declaration: DeclarationInterface): string {
        const filteredStatements: ts.Statement[] = [];

        for (const stmt of sourceFile.statements) {
            if (ts.isImportDeclaration(stmt)) {
                this.handleImport(stmt, declaration);
                continue;
            }

            if (ts.isExportDeclaration(stmt)) {
                this.handleExport(stmt, declaration);
                continue;
            }

            if (this.hasExportModifier(stmt)) {
                this.extractExportName(stmt, declaration);
            }

            filteredStatements.push(stmt);
        }

        const nodeArray = ts.factory.createNodeArray(filteredStatements);
        const strippedText = this.getPrinter().printList(
            ts.ListFormat.MultiLine,
            nodeArray,
            sourceFile
        );

        return removeExportModifiers(cleanContent(strippedText));
    }

    /**
     * Processes a source file into a complete declaration with metadata.
     *
     * @param source - The TypeScript source file to process.
     * @returns A {@link DeclarationInterface} with content and extracted metadata.
     *
     * @remarks
     * This is the main processing pipeline that:
     *
     * 1. Initializes an empty declaration structure (via {@link initDeclaration})
     * 2. Emits the TypeScript declaration file (via {@link emitDeclaration})
     * 3. Strips imports/exports and extracts metadata (via {@link stripImportsExports})
     * 4. Returns the complete declaration ready for caching or bundling
     *
     * The resulting declaration contains:
     * - Cleaned declaration content without imports/exports
     * - Set of internal dependencies for ordering
     * - Categorized import/export metadata for re-generation
     * - Version information for cache invalidation
     *
     * @example
     * ```ts
     * const sourceFile = program.getSourceFile('src/index.ts');
     * const declaration = this.processDeclaration(sourceFile);
     *
     * console.log(declaration.content); // Clean declaration content
     * console.log(declaration.dependency); // Set of dependency file paths
     * console.log(declaration.exports); // Export metadata
     * ```
     *
     * @see initDeclaration
     * @see emitDeclaration
     * @see stripImportsExports
     * @see DeclarationInterface
     *
     * @since 2.0.0
     */

    private processDeclaration(source: SourceFile): DeclarationInterface {
        const declaration = this.initDeclaration(source.fileName);
        const declarationSource = this.emitDeclaration(source);
        declaration.content = this.stripImportsExports(declarationSource, declaration) || '';

        return declaration;
    }
}
