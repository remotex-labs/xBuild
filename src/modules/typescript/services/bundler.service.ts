/**
 * Import will remove at compile time
 */

import type { LanguageService, Program, SourceFile } from 'typescript';
import type { LanguageHostService } from '@typescript/services/hosts.service';
import type { FileNodeInterface } from '@typescript/models/interfaces/graph-model.interface';
import type { BundleExportsInterface } from '@typescript/services/interfaces/bundler-serrvice.interface';
import type { ModuleImportsInterface } from '@typescript/services/interfaces/bundler-serrvice.interface';
import type { NamespaceExportsInterface } from '@typescript/services/interfaces/bundler-serrvice.interface';

/**
 * Imports
 */

import { mkdir, writeFile } from 'fs/promises';
import { inject } from '@symlinks/symlinks.module';
import { join, dirname } from '@components/path.component';
import { GraphModel } from '@typescript/models/graph.model';
import { HeaderDeclarationBundle } from '@typescript/constants/typescript.constant';

/**
 * Bundles multiple internal TypeScript files into consolidated, cleaned declaration files (.d.ts bundles).
 *
 * Starting from one or more entry points, traverses the internal dependency graph, collects all
 * relevant declarations, flattens namespaces, deduplicates exports, gathers external imports,
 * and writes a single portable declaration file per entry point.
 *
 * Primarily used for module federation, library publishing, public API bundling, or
 * creating type-only entry points that hide implementation details.
 *
 * @since 2.0.0
 */

export class BundlerService {
    /**
     * Injected singleton instance of the dependency graph builder.
     *
     * Provides scanned file nodes with cleaned content, internal dependencies,
     * and detailed import/export information.
     *
     * @remarks
     * Resolved via the framework's `inject()` helper — always returns the shared singleton.
     *
     * @see {@link GraphModel}
     * @since 2.0.0
     */

    private readonly graphModel = inject(GraphModel);

    /**
     * Creates bundler bound to a specific language service and host.
     *
     * @param languageService - active TS language service
     * @param languageHostService - host with compiler options and resolution
     *
     * @since 2.0.0
     */

    constructor(private languageService: LanguageService, private languageHostService: LanguageHostService) {
    }

    /**
     * Bundles declarations for each entry point and writes consolidated .d.ts files.
     *
     * @param entryPoints - map of output filename (without extension) → entry file path
     * @param outdir - optional override for output directory
     * @returns promise that resolves when all bundles are written
     *
     * @throws Error when language service program is unavailable
     *
     * @example
     * ```ts
     * await bundler.emit({
     *   index:      './src/index.ts',
     *   components: './src/components/index.ts',
     *   utils:      './src/utils/index.ts'
     * }, './dist/types');
     *
     * // Results in:
     * // dist/types/index.d.ts
     * // dist/types/components.d.ts
     * // dist/types/utils.d.ts
     * ```
     *
     * @see {@link bundleCollectDeclarations}
     * @since 2.0.0
     */

    async emit(entryPoints: Record<string, string>, outdir?: string): Promise<void> {
        const program = this.languageService?.getProgram();
        if (!program) throw new Error('Language service program not available');

        let config = this.languageHostService.getCompilationSettings();
        if (outdir) config = { ...config, outDir: outdir };

        await Promise.all(
            Object.entries(entryPoints).map(async ([ outputPath, entryFile ]) => {
                const sourceFile = program.getSourceFile(entryFile);
                if (!sourceFile) return;

                const outputFile = join(config.outDir!, `${ outputPath }.d.ts`);
                await this.bundleCollectDeclarations(sourceFile, program, outputFile);
            })
        );
    }

    /**
     * Scans entry point, collects transitive declarations, and writes a bundled file.
     *
     * @param source - entry source file
     * @param program - current program (for source file lookup)
     * @param output - target output file path
     * @returns promise that resolves when write completes
     *
     * @since 2.0.0
     */

    private async bundleCollectDeclarations(source: SourceFile, program: Program, output: string): Promise<void> {
        const entryDeclaration = this.graphModel.scan(
            source, this.languageService, this.languageHostService
        );

        const content = await this.getBundleContent(entryDeclaration, program);
        await mkdir(dirname(output), { recursive: true });
        await writeFile(output, content, 'utf-8');
    }

    /**
     * Performs DFS traversal of internal dependencies, collects all relevant content,
     * and prepares it for final bundling.
     *
     * @param entryPoint - scanned entry file node
     * @param program - program for source file lookup
     * @returns concatenated and processed bundle content
     *
     * @remarks
     * Handles transitive star exports by propagating them during traversal.
     *
     * @since 2.0.0
     */

    private async getBundleContent(entryPoint: FileNodeInterface, program: Program): Promise<string> {
        const visited = new Set<string>();
        const exportList = new Set([ entryPoint ]);
        const dependencyList = new Set([ entryPoint ]);
        const dependencyQueue = [ ...entryPoint.internalDeps ];
        const starExportModules = new Set(entryPoint.internalExports.star);

        let content = '';
        while (dependencyQueue.length > 0) {
            const currentFile = dependencyQueue.pop()!;
            if (visited.has(currentFile)) continue;
            visited.add(currentFile);

            const sourceFile = program.getSourceFile(currentFile);
            if (!sourceFile) continue;

            const declaration = this.graphModel.scan(sourceFile, this.languageService, this.languageHostService);
            dependencyList.add(declaration);

            if (starExportModules.has(currentFile)) {
                exportList.add(declaration);
                for (const starModule of declaration.internalExports.star) starExportModules.add(starModule);
            }

            for (const dep of declaration.internalDeps) {
                if (!visited.has(dep)) dependencyQueue.push(dep);
            }

            content += declaration.content;
        }

        content += entryPoint.content;

        return this.parseContent(content, dependencyList, exportList);
    }

    /**
     * Aggregates all external imports across the bundle into a deduplicated map.
     *
     * @param declarations - set of scanned file nodes in the bundle
     * @returns map of module → consolidated imports (default, named, namespace)
     *
     * @since 2.0.0
     */

    private collectExternalImports(declarations: Set<FileNodeInterface>): Map<string, ModuleImportsInterface> {
        const imports = new Map<string, ModuleImportsInterface>();
        for (const declaration of declarations) {
            // Default imports: import Foo from 'module'
            for (const [ module, name ] of Object.entries(declaration.externalImports.default)) {
                if (!imports.has(module)) {
                    imports.set(module, { named: new Set(), namespace: new Map() });
                }
                const moduleImports = imports.get(module)!;
                if (!moduleImports.default) {
                    moduleImports.default = name;
                }
            }

            // Named imports: import { a, b } from 'module'
            for (const [ module, names ] of Object.entries(declaration.externalImports.named)) {
                if (!imports.has(module)) {
                    imports.set(module, { named: new Set(), namespace: new Map() });
                }
                for (const name of names) {
                    imports.get(module)!.named.add(name);
                }
            }

            // Namespace imports: import * as Foo from 'module'
            for (const [ name, module ] of Object.entries(declaration.externalImports.namespace)) {
                if (!imports.has(module)) {
                    imports.set(module, { named: new Set(), namespace: new Map() });
                }
                imports.get(module)!.namespace.set(name, module);
            }
        }

        return imports;
    }

    /**
     * Converts collected external imports into sorted import statements.
     *
     * @param imports - deduplicated imports map
     * @returns array of `import … from …` statements
     *
     * @remarks
     * Namespace imports are emitted separately to preserve `* as` semantics.
     *
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
     * Recursively collects exports from a namespace-exported module.
     *
     * @param fileName - file to start recursion from
     * @param visited - prevents cycles
     * @returns collected exports and supporting declarations
     *
     * @since 2.0.0
     */

    private collectNamespaceExports(fileName: string, visited = new Set<string>()): NamespaceExportsInterface {
        if (visited.has(fileName)) {
            return { exports: [], declarations: [] };
        }
        visited.add(fileName);

        const declaration = this.graphModel.get(fileName);
        if (!declaration) {
            return { exports: [], declarations: [] };
        }

        const exports: Array<string> = [ ...declaration.internalExports.exports ];
        const declarations: Array<string> = [];

        // Handle namespace exports: export * as Foo from './module'
        for (const [ namespaceName, targetModule ] of Object.entries(declaration.internalExports.namespace)) {
            const nested = this.collectNamespaceExports(targetModule, visited);

            if (nested.exports.length > 0) {
                declarations.push(...nested.declarations);
                declarations.push(`const ${ namespaceName } = { ${ nested.exports.join(', ') } };`);
                exports.push(namespaceName);
            }
        }

        // Handle star exports: export * from './module'
        for (const starModule of declaration.externalExports.star) {
            const nested = this.collectNamespaceExports(starModule, visited);
            exports.push(...nested.exports);
            declarations.push(...nested.declarations);
        }

        return { exports, declarations };
    }

    /**
     * Gathers all exports and supporting declarations for the bundle entry points.
     *
     * @param exportList - set of files that should be re-exported
     * @returns structured bundle exports
     *
     * @since 2.0.0
     */

    private collectBundleExports(exportList: Set<FileNodeInterface>): BundleExportsInterface {
        const exports: Array<string> = [];
        const declarations: Array<string> = [];
        const externalExports: Array<string> = [];

        for (const declaration of exportList) {
            exports.push(...declaration.internalExports.exports);

            // Namespace exports: export * as Foo from './module'
            for (const [ namespaceName, targetModule ] of Object.entries(declaration.internalExports.namespace)) {
                const nested = this.collectNamespaceExports(targetModule);

                if (nested.exports.length > 0) {
                    declarations.push(...nested.declarations);
                    declarations.push(`const ${ namespaceName } = { ${ nested.exports.join(', ') } };`);
                    exports.push(namespaceName);
                }
            }

            // External star exports: export * from 'external-module'
            for (const module of declaration.externalExports.star) {
                declarations.push(`export * from '${ module }';`);
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
     * Combines all parts into final bundle content with header, imports, declarations, content, and exports.
     *
     * @param content - concatenated cleaned declaration text
     * @param dependencyList - all files in dependency closure
     * @param exportList - files whose exports should be re-exported
     * @returns final bundled declaration text
     *
     * @since 2.0.0
     */

    private parseContent(content: string, dependencyList: Set<FileNodeInterface>, exportList: Set<FileNodeInterface>): string {
        const parts: Array<string> = [ HeaderDeclarationBundle ];
        const imports = this.collectExternalImports(dependencyList);
        const importStatements = this.generateImportStatements(imports);
        parts.push(...importStatements);

        if (importStatements.length > 0) parts.push(''); // Empty line after imports
        const { exports, declarations, externalExports } = this.collectBundleExports(exportList);
        if (declarations.length > 0) {
            parts.push(...declarations);
            parts.push('');
        }

        parts.push(content);
        if (exports.length > 0) {
            const uniqueExports = Array.from(new Set(exports)).sort();
            parts.push(`export {\n\t${ uniqueExports.join(',\n\t') }\n};`);
        }

        if (externalExports.length > 0) {
            parts.push(...externalExports);
        }

        return parts.join('\n');
    }
}
