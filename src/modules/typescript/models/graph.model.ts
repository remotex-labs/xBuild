/**
 * Import will remove at compile time
 */

import type { LanguageService, SourceFile } from 'typescript';
import type { LanguageHostService } from '@typescript/services/hosts.service';
import type { FileNodeInterface, ModuleInfoInterface } from '@typescript/models/interfaces/graph-model.interface';

/**
 * Imports
 */

import ts from 'typescript';
import { FilesModel } from '@typescript/models/files.model';
import { inject, Injectable } from '@symlinks/symlinks.module';
import { cleanContent, removeExportModifiers } from '@typescript/components/transformer.component';

/**
 * Builds a simplified, declaration-only dependency graph for TypeScript files.
 *
 * Analyzes source files to extract internal dependencies, named/default/namespace imports & exports,
 * and produces cleaned `.d.ts`-like content with imports and export keywords removed.
 *
 * Primarily used for module federation analysis, tree-shaking verification, public API extraction,
 * or generating documentation / type-only bundles.
 *
 * @since 2.0.0
 */

@Injectable({
    scope: 'singleton'
})
export class GraphModel {
    /**
     * Active TypeScript language service instance used to emit declaration files.
     *
     * Set temporarily during the ` scan () ` call via `Object.assign` trick
     * because we want to avoid passing it through every private method signature.
     *
     * @remarks
     * The `!` assertion is safe because `scan()` always assigns both services
     * before any method that uses them is called.
     *
     * @since 2.0.0
     */

    private languageService!: LanguageService;

    /**
     * Language host providing module resolution, file system access, and version tracking.
     *
     * Like `languageService`, it is temporarily attached during `scan()` execution.
     *
     * @remarks
     * The definite assignment assertion (`!`) is valid only because `scan()`
     * guarantees both fields are set before private methods are invoked.
     *
     * @since 2.0.0
     */

    private languageHostService!: LanguageHostService;

    /**
     * Printer used to serialize cleaned AST nodes back to text
     * @since 2.0.0
     */

    private readonly printer: ts.Printer;

    /**
     * Cache of already analyzed files → their dependency and export graph nodes
     * @since 2.0.0
     */

    private readonly nodesCache: Map<string, FileNodeInterface> = new Map();

    /**
     * Injected singleton instance of the file snapshot cache.
     *
     * Provides fast access to file versions, resolved paths, and content snapshots
     * without repeated disk I/O.
     *
     * @see {@link FilesModel}
     * @since 2.0.0
     */

    private readonly filesCache = inject(FilesModel);

    /**
     * Initializes a new {@link GraphModel} instance.
     *
     * @remarks
     * Creates a TypeScript printer configured for consistent line ending formatting.
     * The printer is reused across all analysis operations for efficiency.
     *
     * @since 2.0.0
     */

    constructor() {
        this.printer = ts.createPrinter({
            newLine: ts.NewLineKind.LineFeed
        });
    }

    /**
     * Clears all cached file analysis results.
     * @since 2.0.0
     */

    clear(): void {
        this.nodesCache.clear();
    }

    /**
     * Retrieves a previously analyzed graph node for a file if it exists.
     *
     * @param path - file path (relative or absolute)
     * @returns cached node or `undefined` if not yet scanned or invalidated
     *
     * @since 2.0.0
     */

    get(path: string): FileNodeInterface | undefined {
        const resolvedPath = this.filesCache.resolve(path);

        return this.nodesCache.get(resolvedPath);
    }

    /**
     * Scans a source file, emits its declaration file, analyzes imports/exports,
     * and returns a dependency & export graph node.
     *
     * @param source - already parsed TypeScript source file
     * @param languageService - active TS language service (used for emitting)
     * @param languageHostService - host providing resolution and file system access
     * @returns graph node containing version, cleaned content, internal deps, and import/export maps
     *
     * @remarks
     * Re-uses a cached result if a file version hasn't changed.
     *
     * Temporarily attaches `languageService` and `languageHostService` to `this` for private method calls.
     *
     * @example
     * ```ts
     * const sourceFile = program.getSourceFile(fileName, ts.ScriptTarget.Latest)!;
     * const node = graphModel.scan(sourceFile, languageService, hostService);
     *
     * console.log(node.internalDeps.size, 'internal dependencies');
     * console.log(Object.keys(node.externalImports.named), 'external named imports');
     * ```
     *
     * @see {@link FilesModel}
     * @see {@link FileNodeInterface}
     *
     * @since 2.0.0
     */

    scan(source: SourceFile, languageService: LanguageService, languageHostService: LanguageHostService): FileNodeInterface {
        const self = Object.assign(Object.create(Object.getPrototypeOf(this)), this, {
            languageService,
            languageHostService
        });

        const version = this.filesCache.getSnapshot(source.fileName)!.version.toString();
        const cached = this.nodesCache.get(source.fileName);
        if (cached?.version === version) return cached;

        const node = this.initDeclaration(source.fileName, version);
        const declarationSource = this.emitDeclaration.call(self, source);

        node.content = this.stripImportsExports.call(self, declarationSource, node);
        this.nodesCache.set(source.fileName, node);

        return node;
    }

    /**
     * Creates empty graph node skeleton with given file name and version.
     *
     * @param fileName - resolved absolute file path
     * @param version - snapshot version string
     * @returns initialized node structure
     *
     * @since 2.0.0
     */

    private initDeclaration(fileName: string, version: string): FileNodeInterface {
        return {
            version,
            fileName,
            content: '',
            internalDeps: new Set(),
            externalImports: {
                named: Object.create(null),
                default: Object.create(null),
                namespace: Object.create(null)
            },
            internalExports: {
                star: [],
                exports: [],
                namespace: Object.create(null)
            },
            externalExports: {
                star: [],
                exports: Object.create(null),
                namespace: Object.create(null)
            }
        };
    }

    /**
     * Resolves a module specifier to either an internal file path or external module name.
     *
     * @param moduleSpecifier - string literal from import/export declaration
     * @param currentFile - path of the file containing the import/export
     * @returns module info or `null` if resolution fails
     *
     * @since 2.0.0
     */

    private resolveModule(moduleSpecifier: ts.Expression, currentFile: string): ModuleInfoInterface | null {
        if (!ts.isStringLiteral(moduleSpecifier)) return null;

        const modulePath = moduleSpecifier.text;
        const resolvedFileName = this.languageHostService.resolveModuleName(modulePath, currentFile)
            .resolvedModule?.resolvedFileName;

        if (!resolvedFileName || resolvedFileName.includes('node_modules')) {
            return { fileName: modulePath, isExternal: true };
        }

        return { fileName: resolvedFileName, isExternal: false };
    }

    /**
     * Appends named import/export specifiers (with optional `as` aliases) to the target array.
     *
     * @param target - array to push names into
     * @param elements - import/export specifiers
     *
     * @since 2.0.0
     */

    private addNamedElements(target: Array<string>, elements: ts.NodeArray<ts.ImportSpecifier | ts.ExportSpecifier>): void {
        for (const element of elements) {
            const name = element.propertyName
                ? `${ element.propertyName.text } as ${ element.name.text }`
                : element.name.text;
            target.push(name);
        }
    }

    /**
     * Checks whether a statement has an `export` modifier.
     *
     * @param stmt - any statement node
     * @returns `true` if statement is exported
     *
     * @since 2.0.0
     */

    private hasExportModifier(stmt: ts.Statement): boolean {
        if (!ts.canHaveModifiers(stmt)) return false;
        const modifiers = ts.getModifiers(stmt);

        return modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    }

    /**
     * Emits a declaration file (.d.ts content) for a given source file using language service.
     *
     * @param source - source file to emit declarations from
     * @returns parsed declaration source file
     *
     * @throws Error when emit output is empty or missing
     *
     * @since 2.0.0
     */

    private emitDeclaration(source: SourceFile): SourceFile {
        const output = this.languageService.getEmitOutput(
            source.fileName,
            true,
            true
        );

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
     * Removes imports, exports, and export modifiers from a declaration file,
     * collects dependency/export information, and cleans alias references.
     *
     * @param sourceFile - emitted declaration source file
     * @param node - graph node being populated
     * @returns final cleaned declaration text (no imports/exports)
     *
     * @since 2.0.0
     */

    private stripImportsExports(sourceFile: SourceFile, node: FileNodeInterface): string {
        const aliasStatements: Array<string> = [];
        const keptStatements: Array<ts.Statement> = [];

        for (const stmt of sourceFile.statements) {
            if (ts.isImportDeclaration(stmt)) {
                this.handleImport(stmt, node, aliasStatements);
                continue;
            }

            if (ts.isExportDeclaration(stmt)) {
                this.handleExport(stmt, node);
                continue;
            }

            if (this.hasExportModifier(stmt)) {
                this.extractExportName(stmt, node);
            }

            keptStatements.push(stmt);
        }

        const nodeArray = ts.factory.createNodeArray(keptStatements);
        const printed = this.printer.printList(
            ts.ListFormat.MultiLine,
            nodeArray,
            sourceFile
        );

        let content = removeExportModifiers(cleanContent(printed));
        for (const alias of aliasStatements) {
            if(alias.includes(' as ')) {
                const [ aliasName, aliasType ] = alias.split(' as ');
                content = content.replace(new RegExp(`\\b${ aliasType }\\b`, 'g'), aliasName);
            } else {
                content = content.replace(new RegExp(`\\b${ alias }\\.`, 'g'), '');
            }
        }

        return content;
    }

    /**
     * Processes import declaration → tracks dependencies and collects imported names.
     *
     * @param stmt - import declaration AST node
     * @param node - graph node to update
     * @param aliasStatements - mutable list of local alias names to clean later
     *
     * @since 2.0.0
     */

    private handleImport(stmt: ts.ImportDeclaration, node: FileNodeInterface, aliasStatements: Array<string>): void {
        const { importClause, moduleSpecifier } = stmt;
        if (!importClause || !moduleSpecifier) return;

        const moduleInfo = this.resolveModule(moduleSpecifier, node.fileName);
        if (!moduleInfo) return;

        const { fileName, isExternal } = moduleInfo;

        if (!isExternal) {
            node.internalDeps.add(fileName);

            const { namedBindings } = importClause;
            if(!namedBindings) return;

            if (ts.isNamespaceImport(namedBindings)) {
                aliasStatements.push(namedBindings.name.text);
            } else if (ts.isNamedImports(namedBindings)) {
                this.addNamedElements(aliasStatements, namedBindings.elements);
            }

            return;
        }

        if (!importClause) {
            // Side-effect import: import 'module'
            node.externalImports.namespace[fileName] = '';

            return;
        }

        // Default import: import Foo from 'module'
        if (importClause.name) {
            node.externalImports.default[fileName] = importClause.name.text;
        }

        const { namedBindings } = importClause;
        if (!namedBindings) return;

        if (ts.isNamespaceImport(namedBindings)) {
            // import * as Foo from 'module'
            node.externalImports.namespace[namedBindings.name.text] = fileName;
        } else if (ts.isNamedImports(namedBindings)) {
            // import { a, b as c } from 'module'
            this.addNamedElements(
                node.externalImports.named[fileName] ??= [],
                namedBindings.elements
            );
        }
    }

    /**
     * Processes re-export declaration (`export … from …`).
     *
     * @param stmt - export declaration AST node
     * @param node - graph node to update
     *
     * @since 2.0.0
     */

    private handleExport(stmt: ts.ExportDeclaration, node: FileNodeInterface): void {
        const { moduleSpecifier, exportClause } = stmt;
        if (!moduleSpecifier) return;

        const moduleInfo = this.resolveModule(moduleSpecifier, node.fileName);
        if (!moduleInfo) return;

        const { fileName, isExternal } = moduleInfo;

        // Track internal dependencies
        if (!isExternal) {
            node.internalDeps.add(fileName);
        }

        // export * from 'module'
        if (!exportClause) {
            if (isExternal) {
                node.externalExports.star.push(fileName);
            } else {
                node.internalExports.star.push(fileName);
            }

            return;
        }

        // export * as Foo from 'module'
        if (ts.isNamespaceExport(exportClause)) {
            if (isExternal) {
                node.externalExports.namespace[exportClause.name.text] = fileName;
            } else {
                node.internalExports.namespace[exportClause.name.text] = fileName;
            }

            return;
        }

        if (ts.isNamedExports(exportClause)) {
            // export { a, b as c } from 'module'
            if (isExternal) {
                this.addNamedElements(
                    node.externalExports.exports[fileName] ??= [],
                    exportClause.elements
                );
            } else {
                this.addNamedElements(
                    node.internalExports.exports,
                    exportClause.elements
                );
            }
        }
    }

    /**
     * Extracts locally declared export names from statements with the ` export ` modifier.
     *
     * @param stmt - statement with export modifier
     * @param node - graph node to update
     *
     * @since 2.0.0
     */

    private extractExportName(stmt: ts.Statement, node: FileNodeInterface): void {
        if (ts.isVariableStatement(stmt)) {
            for (const decl of stmt.declarationList.declarations) {
                if (ts.isIdentifier(decl.name)) {
                    node.internalExports.exports.push(decl.name.text);
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
                node.internalExports.exports.push(stmt.name.text);
            }
        }
    }
}
