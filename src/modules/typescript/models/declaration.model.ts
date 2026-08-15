/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { TypescriptService } from '@typescript/services/typescript.service';
import type { DeclarationEntryInterface } from './interfaces/declaration-model.interface';
import type { NamedBindingInterface, ParseContextInterface } from './interfaces/declaration-model.interface';
import type { Declaration, Directive, ModuleExportName, Statement, StringLiteral } from '@oxc-project/types';
import type { BundleSurfaceInterface, MergedImportInterface } from './interfaces/declaration-model.interface';
import type { ExportNamedDeclaration, ImportDeclaration, TSImportEqualsDeclaration } from '@oxc-project/types';
import type { ExportAllDeclaration, ExportDefaultDeclaration, ExportDefaultDeclarationKind } from '@oxc-project/types';

/**
 * Imports
 */

import { existsSync } from 'fs';
import { parseSync } from 'oxc-parser';
import { inject } from '@remotex-labs/xinject';
import { mkdir, writeFile } from 'fs/promises';
import { Char } from '@constants/char.constant';
import { FilesModel } from '@models/files.model';
import { isolatedDeclarationSync } from 'oxc-transform';
import { join, dirname, relative } from '@remotex-labs/xmap';
import { applyEdits, removeNode } from '@components/transformer.component';
import { HeaderDeclarationBundle } from '@typescript/constants/typescript.constant';

/**
 * Builds and caches the declaration of every file a build touches, in both the forms it needs.
 *
 * @remarks
 * Each file is reduced to a {@link DeclarationEntryInterface}: the standalone declaration with its project specifiers
 * resolved, the same text stripped down to inlinable declarations, and the dependency, import, and export records that
 * stripping produced.
 * Declarations are produced by oxc's isolated-declarations pass, which needs no type checker,
 * so an entry costs one such pass and one parse.
 * Both forms and every record come out of that single parse.
 * Entries are held against the snapshot version of their file,
 * so a file is rebuilt only once the file model has observed the change,
 * and {@link clear} drops the cache when the compiler options behind the entries move.
 * One instance owns one cache,
 * so a build that wants entries shared across its steps passes the model around rather than constructing a second one.
 *
 * @example
 * ```ts
 * const declarations = new DeclarationModel(inject(TypescriptService));
 * const entry = declarations.touch('src/index.ts');
 *
 * entry.content;                                // 'declare const version: string;\n'
 * entry.declaration;                            // the same text, prefixed with its imports
 * entry.projectDependencies;                    // Set { 'D:/app/src/builder.ts' }
 * declarations.touch('src/index.ts') === entry; // true - unchanged file, cached entry
 * ```
 *
 * @see DeclarationEntryInterface
 * @since 3.0.0
 */

export class DeclarationModel {
    /**
     * Entries keyed by the resolved absolute path of the file they describe.
     *
     * @remarks
     * Exposed for consumers that walk an already-built graph.
     * Use {@link touch} to build or refresh an entry.
     *
     * @example
     * ```ts
     * declarations.touch('src/index.ts');
     * declarations.cache.size; // 1
     * ```
     *
     * @see DeclarationEntryInterface
     * @since 3.0.0
     */

    readonly cache = new Map<string, DeclarationEntryInterface>();

    /**
     * Shared file snapshot cache the entries are versioned against.
     *
     * @since 3.0.0
     */

    private readonly filesCache = inject(FilesModel);

    /**
     * Entry version last written to each output path.
     *
     * @remarks
     * Keyed by output path rather than source path,
     * so emitting into a different directory writes every file again instead of reporting them as already current.
     * What it records is what was written rather than what is on disk,
     * so {@link emit} checks the file is still there before it passes over one,
     * which is what makes an output that something else removed come back on the next run.
     *
     * @since 3.0.0
     */

    private readonly emitted = new Map<string, number>();

    /**
     * Creates a declaration cache bound to one TypeScript service.
     *
     * @param ts - Service whose module resolution decides which specifiers are project files
     *
     * @example
     * ```ts
     * const declarations = new DeclarationModel(inject(TypescriptService));
     * declarations.cache.size; // 0
     * ```
     *
     * @see TypescriptService
     * @since 3.0.0
     */

    constructor(private readonly ts: TypescriptService) {}

    /**
     * Drops every cached entry.
     *
     * @remarks
     * Needed when something the declarations depend on has changed without the snapshot versions reflecting it -
     * the compiler options, or the resolution cache behind them.
     * A file whose content changed does not need this, since its entry is rebuilt on the next {@link touch}.
     * The record of what already reached the disk goes with them,
     * so the next call to {@link emit} writes every file again,
     * which is also what a cleaned output directory calls for.
     *
     * @example
     * ```ts
     * declarations.touch('src/index.ts');
     * declarations.clear();
     * declarations.cache.size; // 0
     * ```
     *
     * @see touch
     * @since 3.0.0
     */

    clear(): void {
        this.cache.clear();
        this.emitted.clear();
    }

    /**
     * Returns the declaration entry of a file, building it only when the cached one is stale.
     *
     * @param path - Filesystem path of the file, relative or absolute
     * @returns The entry describing the file's declarations, dependencies, and exports
     *
     * @remarks
     * The file is tracked through the file model, so a path never seen before is read from the disk once,
     * and a tracked path costs a map lookup.
     * The cached entry is returned whenever its version still matches the file's snapshot version, which only advances
     * when the file model observes a change on disk.
     * A file that is missing or unreadable yields an entry built from empty content rather than throwing.
     *
     * @example
     * ```ts
     * const entry = declarations.touch('src/index.ts');
     * entry.version;                                // 1
     * declarations.touch('src/index.ts') === entry; // true
     * ```
     *
     * @see clear
     * @see DeclarationEntryInterface
     *
     * @since 3.0.0
     */

    touch(path: string): DeclarationEntryInterface {
        const target = this.filesCache.resolve(path);
        const file = this.filesCache.touch(target);
        const cached = this.cache.get(target);

        if (cached?.version === file.version) return cached;

        const entry = this.build(target, file.snapshot?.text ?? '', file.version);
        this.cache.set(target, entry);

        return entry;
    }

    /**
     * Writes one declaration file per project file the entry points reach, skipping what has not changed.
     *
     * @param entryPoints - Entry files to walk, keyed by the output name each entry itself is written under
     * @param outdir - Directory to write into, overriding the configuration's `declarationDir` and `outDir`
     * @returns The output paths written by this call, empty when everything was already current
     *
     * @remarks
     * The walk follows the dependency edges out of each entry, so a project whose `tsconfig.json` lists only its entry
     * points still emits every file those entries reach.
     * Nothing outside the project is emitted, since only project files are edges,
     * and a `.d.ts` input is skipped along with everything only it reaches - it is already a declaration.
     * A key names the output of the entry it is keyed to and of nothing else.
     * The files reached through it keep mirroring the source tree the way `tsc` lays them out:
     * `declarationDir` wins over `outDir`, and the per-file path is taken relative to `rootDir`.
     * A file whose entry was written unchanged since the last call is left alone, so a watch cycle rewrites only what
     * moved.
     *
     * @example
     * ```ts
     * await declarations.emit({ main: 'src/index.ts' });            // [ 'dist/main.d.ts', 'dist/builder.d.ts' ]
     * await declarations.emit({ main: 'src/index.ts' });            // [] - nothing changed
     * await declarations.emit({ main: 'src/index.ts' }, './types'); // the same files, written under ./types
     * ```
     *
     * @see clear
     * @see emitBundle
     *
     * @since 3.0.0
     */

    async emit(entryPoints: Record<string, string>, outdir?: string): Promise<Array<string>> {
        const outputs: Array<string> = [];
        const contents: Array<string> = [];
        const visited = new Set<string>();
        const names = new Map<string, string>();

        for (const [ name, entry ] of Object.entries(entryPoints))
            names.set(this.filesCache.resolve(entry), name);

        const pending = [ ...names.keys() ];
        while (pending.length > 0) {
            const target = pending.pop()!;
            if (visited.has(target) || target.endsWith('.d.ts')) continue;
            visited.add(target);

            const entry = this.touch(target);
            for (const dependency of entry.projectDependencies)
                if (!visited.has(dependency)) pending.push(dependency);

            const output = this.outputPath(target, outdir, names.get(target));
            if (this.emitted.get(output) === entry.version && existsSync(output)) continue;

            this.emitted.set(output, entry.version);
            outputs.push(output);
            contents.push(entry.declaration);
        }

        return this.write(outputs, contents);
    }

    /**
     * Bundles every entry point and writes each one to a declaration file of its own.
     *
     * @param entryPoints - Entry files to bundle, keyed by the output name each is written under
     * @param outdir - Directory to write into, overriding the configuration's `declarationDir` and `outDir`
     * @returns The output paths written, in the order the entry points were given
     *
     * @remarks
     * The key names the output rather than the source doing so, `.d.ts` being appended to it, so two entries both
     * called `index.ts` are told apart by the names they were keyed under.
     * A key carrying a directory writes into it, and the directory is created if it is not there.
     * Bundles are always rebuilt, since assembling one from cached entries costs little,
     * and they open with {@link HeaderDeclarationBundle} so a generated file is recognizable as one.
     * With no output directory configured or passed, they land in the working directory.
     *
     * @example
     * ```ts
     * await declarations.emitBundle({ index: 'src/index.ts', 'utils/index': 'src/utils/index.ts' }, 'dist/types');
     * // [ 'D:/app/dist/types/index.d.ts', 'D:/app/dist/types/utils/index.d.ts' ]
     * ```
     *
     * @see emit
     * @since 3.0.0
     */

    async emitBundle(entryPoints: Record<string, string>, outdir?: string): Promise<Array<string>> {
        const options = this.ts.config.options;
        const base = this.filesCache.resolve(outdir ?? options.declarationDir ?? options.outDir ?? '.');

        return this.write(
            Object.keys(entryPoints).map(name => join(base, `${ name }.d.ts`)),
            Object.values(entryPoints).map(entry => this.bundle(entry))
        );
    }

    /**
     * Builds the bundled declaration text of one entry point.
     *
     * @param entry - Filesystem path of the entry file, relative or absolute
     * @returns The complete declaration file content, header included
     *
     * @remarks
     * Nothing is written and nothing is cached beyond the entries themselves, so the same entry can be bundled
     * repeatedly, and each call reflects the files as the cache currently sees them.
     * Declarations are inlined once per file even when several files depend on it, and a dependency cycle is walked
     * once rather than followed around.
     *
     * @see render
     * @since 3.0.0
     */

    private bundle(entry: string): string {
        const target = this.filesCache.resolve(entry);
        const node = this.touch(target);

        return this.render(this.collectClosure(target, node), this.collectSurface(target, node));
    }

    /**
     * Creates the directories of a batch and writes its files concurrently.
     *
     * @param outputs - Absolute output paths to write
     * @param contents - Content of each output, in the same order
     * @returns The written paths, for direct return by callers
     *
     * @remarks
     * Each directory is created once for the whole batch rather than once per file, and an empty batch touches the disk
     * not at all.
     *
     * @since 3.0.0
     */

    private async write(outputs: Array<string>, contents: Array<string>): Promise<Array<string>> {
        if (outputs.length < 1) return outputs;

        const directories = new Set(outputs.map(output => dirname(output)));
        await Promise.all([ ...directories ].map(directory => mkdir(directory, { recursive: true })));
        await Promise.all(outputs.map((output, index) => writeFile(output, contents[index], 'utf-8')));

        return outputs;
    }

    /**
     * Maps a source path to the declaration path it is written to.
     *
     * @param source - Resolved absolute path of the source file
     * @param outdir - Directory overriding both configured output directories
     * @param name - Output name to use instead of the one the source implies, carrying no extension
     * @returns The absolute output path
     *
     * @remarks
     * The directory is the first of `outdir`, `declarationDir`, and `outDir` that is set,
     * and the source's own directory only when none of them is.
     * A name replaces everything the source would have decided, `.d.ts` being appended to it, and a name carrying a
     * directory nests the output inside the base.
     * Without one the path mirrors the source tree relative to `rootDir` - the source directory standing in when no
     * `rootDir` is set, which flattens the output the way `tsc` does - and the extension follows the input, so `.ts`
     * and `.tsx` become `.d.ts` while `.mts` and `.cts` keep their module flavor as `.d.mts` and `.d.cts`.
     *
     * @since 3.0.0
     */

    private outputPath(source: string, outdir?: string, name?: string): string {
        const { declarationDir, outDir, rootDir } = this.ts.config.options;
        const base = outdir ?? declarationDir ?? outDir;
        const target = base ? this.filesCache.resolve(base) : dirname(source);
        if (name) return join(target, `${ name }.d.ts`);

        const root = rootDir ? this.filesCache.resolve(rootDir) : dirname(source);

        return join(target, relative(root, source).replace(/\.([cm]?)tsx?$/, '.d.$1ts'));
    }

    /**
     * Collects every project file the entry reaches, dependencies first.
     *
     * @param target - Resolved absolute path of the entry file
     * @param entry - Cache entry of the entry file
     * @returns The entries to inline, in the order their content is concatenated
     *
     * @remarks
     * A depth-first walk over the dependency edges with an explicit stack, so a deep dependency chain cannot overflow
     * the stack, and a visited set, so a cycle terminates, and a shared dependency is inlined once.
     * The entry counts as visited from the start, so a dependency cycling back to it does not inline it twice, and it
     * lands last regardless, which keeps the file the bundle describes at the bottom.
     *
     * @since 3.0.0
     */

    private collectClosure(target: string, entry: DeclarationEntryInterface): Array<DeclarationEntryInterface> {
        const visited = new Set<string>([ target ]);
        const closure: Array<DeclarationEntryInterface> = [];
        const pending = [ ...entry.projectDependencies ];

        while (pending.length > 0) {
            const dependency = pending.pop()!;
            if (visited.has(dependency)) continue;
            visited.add(dependency);

            const node = this.touch(dependency);
            closure.push(node);

            for (const nested of node.projectDependencies)
                if (!visited.has(nested)) pending.push(nested);
        }

        closure.push(entry);

        return closure;
    }

    /**
     * Collects the names and re-export statements the bundle exposes.
     *
     * @param target - Resolved absolute path of the entry file
     * @param entry - Cache entry of the entry file
     * @returns The entry's surface, merged with the surface of every project file it star re-exports
     *
     * @remarks
     * Star re-exports of project files are followed transitively, their names becoming the entry's own, while package
     * re-exports are kept as statements and passed straight through.
     * The entry counts as visited from the start, so a star re-export cycling back to it is not walked again.
     * Namespace re-exports of project files are left out: flattening one would mean synthesizing a `declare namespace`
     * around the target's exports, which the inlined fragments do not describe well enough.
     *
     * @see BundleSurfaceInterface
     * @since 3.0.0
     */

    private collectSurface(target: string, entry: DeclarationEntryInterface): BundleSurfaceInterface {
        const exports = new Set<string>();
        const statements = new Set<string>();
        const visited = new Set<string>([ target ]);
        const pending = [ entry ];

        while (pending.length > 0) {
            const node = pending.pop()!;
            for (const binding of node.projectExports.exports) exports.add(this.clause(binding));

            for (const [ module, bindings ] of Object.entries(node.packageExports)) {
                if (bindings.star) statements.add(`export * from '${ module }';`);
                if (bindings.named?.length)
                    statements.add(`export { ${ bindings.named.map(binding => this.clause(binding)).join(', ') } } from '${ module }';`);

                for (const name of bindings.namespaces ?? []) statements.add(`export * as ${ name } from '${ module }';`);
            }

            for (const star of node.projectExports.star) {
                if (visited.has(star)) continue;
                visited.add(star);
                pending.push(this.touch(star));
            }
        }

        return { exports, statements };
    }

    /**
     * Merges the package imports of every inlined file into one record per module.
     *
     * @param closure - Entries whose content the bundle carries
     * @returns The merged bindings, keyed by module specifier in first-seen order
     *
     * @remarks
     * One pass over the files and their modules folds each module's side effect flag, default binding, namespaces,
     * and named bindings into a single record the bundle can write back as statements.
     *
     * @see MergedImportInterface
     * @since 3.0.0
     */

    private mergeImports(closure: Array<DeclarationEntryInterface>): Map<string, MergedImportInterface> {
        const merged = new Map<string, MergedImportInterface>();

        for (const node of closure) {
            for (const [ module, bindings ] of Object.entries(node.packageImports)) {
                let entry = merged.get(module);
                if (!entry) merged.set(module, entry = { side: false, named: new Set(), namespaces: new Set() });

                if (bindings.side) entry.side = true;
                entry.default ??= bindings.default;
                for (const name of bindings.namespaces ?? []) entry.namespaces.add(name);
                for (const binding of bindings.named ?? []) entry.named.add(this.clause(binding));
            }
        }

        return merged;
    }

    /**
     * Writes the merged imports back out as import statements.
     *
     * @param merged - Bindings collected per module
     * @returns One statement per import form a module was used with
     *
     * @remarks
     * A module can need several statements: a side effect import, one for each namespace binding,
     * and one carrying its default and named bindings together.
     * Named bindings are sorted, so the same set of files always produces the same bundle.
     *
     * @since 3.0.0
     */

    private renderImports(merged: Map<string, MergedImportInterface>): Array<string> {
        const statements: Array<string> = [];

        for (const [ module, entry ] of merged) {
            if (entry.side) statements.push(`import '${ module }';`);
            for (const name of entry.namespaces) statements.push(`import * as ${ name } from '${ module }';`);

            const clauses: Array<string> = [];
            if (entry.default) clauses.push(entry.default);
            if (entry.named.size > 0) clauses.push(`{ ${ [ ...entry.named ].sort().join(', ') } }`);
            if (clauses.length > 0) statements.push(`import ${ clauses.join(', ') } from '${ module }';`);
        }

        return statements;
    }

    /**
     * Assembles the finished bundle from its header, imports, inlined content, and exports.
     *
     * @param closure - Entries to inline, dependencies first
     * @param surface - Names and statements the bundle exposes
     * @returns The complete declaration file content
     *
     * @remarks
     * Imports are merged over the whole closure rather than the surface, since every inlined declaration is free to
     * reference them, while the exports come from the surface alone.
     * A bundle that exposes nothing still closes with an empty export clause, without which its declarations would be
     * read as globals rather than as a module.
     *
     * @see HeaderDeclarationBundle
     * @since 3.0.0
     */

    private render(closure: Array<DeclarationEntryInterface>, surface: BundleSurfaceInterface): string {
        const parts: Array<string> = [ HeaderDeclarationBundle ];
        const imports = this.renderImports(this.mergeImports(closure));
        if (imports.length > 0) parts.push(...imports, '');

        for (const node of closure) {
            const content = node.content.trim();
            if (content) parts.push(content, '');
        }

        if (surface.exports.size > 0) parts.push(`export {\n\t${ [ ...surface.exports ].sort().join(',\n\t') }\n};`);
        parts.push(...surface.statements);
        if (surface.exports.size < 1 && surface.statements.size < 1) parts.push('export {};');

        return `${ parts.join('\n') }\n`;
    }

    /**
     * Writes a binding the way an import or export clause spells it.
     *
     * @param binding - Name and the alias it was renamed to, if any
     * @returns The bare name, or `name as alias` when the clause renamed it
     *
     * @see NamedBindingInterface
     * @since 3.0.0
     */

    private clause(binding: NamedBindingInterface): string {
        return binding.alias ? `${ binding.name } as ${ binding.alias }` : binding.name;
    }

    /**
     * Emits the declarations of one file and reduces them to a cache entry.
     *
     * @param target - Resolved absolute path of the file
     * @param source - Current text of the file
     * @param version - Snapshot version the entry is recorded against
     * @returns The freshly built entry
     *
     * @remarks
     * The emitted text is parsed once, and that parse drives everything: the statement walk queues both edit lists and
     * records the graph, and the comment walk that follows it queues the doc comments the stripping orphaned.
     * Emit diagnostics are not surfaced here - a declaration oxc cannot infer is reported by the type checker as an
     * isolated-declarations error against the source file itself.
     *
     * @see strip
     * @see pruneComments
     * @since 3.0.0
     */

    private build(target: string, source: string, version: number): DeclarationEntryInterface {
        const declaration = isolatedDeclarationSync(target, source, { stripInternal: true }).code;
        const context: ParseContextInterface = {
            edits: [],
            target,
            parsed: parseSync(target, declaration, { sourceType: 'module' }),
            content: declaration,
            bundleEdits: [],
            packageImports: Object.create(null),
            packageExports: Object.create(null),
            projectExports: { star: new Set(), exports: [], namespace: Object.create(null) },
            projectDependencies: new Set()
        };

        const kept: Array<number> = [];
        const { body } = context.parsed.program;

        for (const statement of body)
            if (this.strip(statement, context)) kept.push(statement.start);

        this.pruneComments(context, body, kept);

        return {
            version,
            content: applyEdits(declaration, context.bundleEdits),
            declaration: applyEdits(declaration, context.edits),
            packageImports: context.packageImports,
            packageExports: context.packageExports,
            projectExports: context.projectExports,
            projectDependencies: context.projectDependencies
        };
    }

    /**
     * Dispatches one top-level statement to the handler for its module syntax.
     *
     * @param statement - Statement to strip
     * @param context - Pass the edits are queued against and the bindings recorded on
     * @returns Whether the statement survives in the stripped content
     *
     * @remarks
     * Only top-level statements are visited, since only those can carry module syntax.
     * `export =` and `export as namespace` are dropped without a record: both describe how a module is consumed whole,
     * which a fragment inlined into a bundle can no longer express.
     * Anything that is not module syntax is kept untouched.
     *
     * @since 3.0.0
     */

    private strip(statement: Directive | Statement, context: ParseContextInterface): boolean {
        switch (statement.type) {
            case 'ImportDeclaration':
                this.stripImport(statement, context);

                return false;

            case 'ExportAllDeclaration':
                this.stripStarExport(statement, context);

                return false;

            case 'ExportNamedDeclaration':
                return this.stripNamedExport(statement, context);

            case 'ExportDefaultDeclaration':
                return this.stripDefaultExport(statement, context);

            case 'TSImportEqualsDeclaration':
                return this.stripImportEquals(statement, context);

            case 'TSExportAssignment':
            case 'TSNamespaceExportDeclaration':
                removeNode(statement, context.content, context.bundleEdits);

                return false;

            default:
                return true;
        }
    }

    /**
     * Removes an `import` statement, recording either a dependency or the package bindings it pulled in.
     *
     * @param statement - Import statement to strip
     * @param context - Pass the deletion is queued against
     *
     * @remarks
     * An import of a project file only contributes an edge, since the target's declarations are inlined,
     * and its bindings are already in scope in the bundle.
     * Everything else is recorded per module, so the bundle can reissue one import statement for it.
     *
     * @see link
     * @since 3.0.0
     */

    private stripImport(statement: ImportDeclaration, context: ParseContextInterface): void {
        removeNode(statement, context.content, context.bundleEdits);
        if (this.link(statement.source, context)) return;

        const module = context.packageImports[statement.source.value] ??= {};
        if (statement.specifiers.length < 1) {
            module.side = true;

            return;
        }

        for (const entry of statement.specifiers) {
            switch (entry.type) {
                case 'ImportDefaultSpecifier':
                    module.default ??= entry.local.name;
                    break;

                case 'ImportNamespaceSpecifier':
                    (module.namespaces ??= []).push(entry.local.name);
                    break;

                default:
                    (module.named ??= []).push(this.binding(this.nameOf(entry.imported), entry.local.name));
            }
        }
    }

    /**
     * Removes an `import x = require('module')` statement the way its ESM equivalent is removed.
     *
     * @param statement - Import-equals statement to strip
     * @param context - Pass the deletion is queued against
     * @returns Whether the statement survives in the stripped content
     *
     * @remarks
     * Only the external-module form names a module.
     * `import A = B.C` aliases a local name and is kept as it stands, since the namespace it reaches into is inlined
     * with the rest of the fragment.
     * A package binding is recorded as a namespace import, which is what `require` binds in type space.
     *
     * @see stripImport
     * @since 3.0.0
     */

    private stripImportEquals(statement: TSImportEqualsDeclaration, context: ParseContextInterface): boolean {
        const { moduleReference } = statement;
        if (moduleReference.type !== 'TSExternalModuleReference') return true;

        removeNode(statement, context.content, context.bundleEdits);
        const source = moduleReference.expression;

        if (!this.link(source, context))
            ((context.packageImports[source.value] ??= {}).namespaces ??= []).push(statement.id.name);

        return false;
    }

    /**
     * Strips an `export` that carries a declaration, a specifier list, or a re-export clause.
     *
     * @param statement - Named export statement to strip
     * @param context - Pass the edits are queued against
     * @returns Whether the statement survives in the stripped content
     *
     * @remarks
     * A declaration keeps its body and loses only the `export` keyword, so `export declare const x` becomes
     * `declare const x` and stays valid where the fragment lands.
     * A specifier list is removed outright: names re-exported from a project file, or from nothing at all, are recorded
     * as this file's own surface, since the declarations behind them are inlined.
     * Only a clause pointing at a package is recorded as a re-export the bundle has to emit again.
     *
     * @see collectDeclared
     * @since 3.0.0
     */

    private stripNamedExport(statement: ExportNamedDeclaration, context: ParseContextInterface): boolean {
        const { exports } = context.projectExports;

        if (statement.declaration) {
            this.collectDeclared(statement.declaration, exports);
            context.bundleEdits.push({ start: statement.start, end: statement.declaration.start });

            return true;
        }

        removeNode(statement, context.content, context.bundleEdits);
        const named = statement.source && !this.link(statement.source, context)
            ? (context.packageExports[statement.source.value] ??= {}).named ??= []
            : exports;

        for (const entry of statement.specifiers)
            named.push(this.binding(this.nameOf(entry.local), this.nameOf(entry.exported)));

        return false;
    }

    /**
     * Removes an `export *` statement, recording the module or project file behind it.
     *
     * @param statement - Star export statement to strip
     * @param context - Pass the deletion is queued against
     *
     * @remarks
     * A star export of a project file becomes an edge plus an entry the bundler follows to collect the names it
     * exposes, whereas a namespace form records the name it is exposed under instead.
     *
     * @see link
     * @since 3.0.0
     */

    private stripStarExport(statement: ExportAllDeclaration, context: ParseContextInterface): void {
        removeNode(statement, context.content, context.bundleEdits);

        const target = this.link(statement.source, context);
        const exposed = statement.exported ? this.nameOf(statement.exported) : null;

        if (target) {
            if (exposed) context.projectExports.namespace[exposed] = target;
            else context.projectExports.star.add(target);

            return;
        }

        const module = context.packageExports[statement.source.value] ??= {};
        if (exposed) (module.namespaces ??= []).push(exposed);
        else module.star = true;
    }

    /**
     * Strips an `export default`, keeping the declaration behind it whenever there is one to keep.
     *
     * @param statement - Default export statement to strip
     * @param context - Pass the edits are queued against
     * @returns Whether the statement survives in the stripped content
     *
     * @remarks
     * A named class, function, or interface keeps its body and is recorded as `Name as default`,
     * with `export default` rewritten to `declare` so the fragment stays a valid ambient declaration.
     * A default export of an identifier is dropped, since the declaration it names is a statement of its own that
     * the fragment already carries.
     * An anonymous default has no binding a bundle could re-export, so it is dropped without a record.
     *
     * @see defaultBinding
     * @since 3.0.0
     */

    private stripDefaultExport(statement: ExportDefaultDeclaration, context: ParseContextInterface): boolean {
        const { declaration } = statement;
        const local = this.defaultBinding(declaration);
        if (local) context.projectExports.exports.push({ name: local, alias: 'default' });

        if (local && declaration.type !== 'Identifier') {
            context.bundleEdits.push({ start: statement.start, end: declaration.start, text: 'declare ' });

            return true;
        }

        removeNode(statement, context.content, context.bundleEdits);

        return false;
    }

    /**
     * Queues the removal of every doc comment the stripping left attached to nothing.
     *
     * @param context - Pass the deletions are queued against
     * @param body - Top-level statements of the file, in source order
     * @param kept - Start offsets of the surviving statements, in source order
     *
     * @remarks
     * Only comments that sit between two top-level statements are judged, so the documentation a surviving declaration
     * carries on its own members is never touched.
     * Such a comment is kept when nothing but whitespace separates it from the next surviving statement.
     * Anything else - a stripped statement between the two, another comment, or a trailing position with no statement
     * after it at all - makes it an orphan.
     * Only `/**` comments are considered, so line comments and plain block comments stay put.
     * Comments and statements are both in source order, so all three are walked together in one pass,
     * and a file with many comments does not cost a scan per comment.
     *
     * @see build
     * @since 3.0.0
     */

    private pruneComments(context: ParseContextInterface, body: Array<Directive | Statement>, kept: Array<number>): void {
        const { content, bundleEdits } = context;
        let inner = 0;
        let index = 0;

        for (const comment of context.parsed.comments) {
            if (comment.type !== 'Block' || comment.value.charCodeAt(0) !== Char.Star) continue;

            while (inner < body.length && body[inner].end <= comment.start) inner++;
            if (inner < body.length && body[inner].start < comment.start) continue;

            while (index < kept.length && kept[index] < comment.end) index++;
            if (index < kept.length && this.blank(content, comment.end, kept[index])) continue;

            removeNode(comment, content, bundleEdits);
        }
    }

    /**
     * Resolves a specifier, recording it as a dependency and rewriting it when it names a project file.
     *
     * @param source - Specifier literal as written in the declaration
     * @param context - Pass the specifier was read from
     * @returns The resolved absolute path, or `null` when the specifier names a package or does not resolve
     *
     * @remarks
     * The one place a specifier is looked at, so the two outputs cannot disagree on which files are inlined.
     * An internal target leaves an edge behind for the bundle and a relative rewrite for the standalone declaration,
     * while a package leaves both untouched.
     * The rewrite names the declaration rather than the source, the resolved extension giving way to `.d.ts`, so an
     * emitted file points at the file emitted beside it rather than at a source that was never shipped.
     * Resolution goes through the TypeScript service, so aliases and `paths` mappings resolve the way the type checker
     * sees them rather than the way Node would, and the path it reports is normalized the way the file cache keys are.
     *
     * @since 3.0.0
     */

    private link(source: StringLiteral, context: ParseContextInterface): string | null {
        const resolved = this.ts.resolve(source.value, context.target);
        if (!resolved || resolved.isExternalLibraryImport) return null;

        const { extension, relativeFileName, resolvedFileName } = resolved;
        const target = this.filesCache.resolve(resolvedFileName);

        context.projectDependencies.add(target);
        context.edits.push({
            end: source.end,
            start: source.start,
            text: `'${ extension ? relativeFileName.slice(0, -extension.length) : relativeFileName }.d.ts'`
        });

        return target;
    }

    /**
     * Appends the names a declaration binds to the exported surface.
     *
     * @param declaration - Declaration carried by an `export` statement
     * @param names - Bindings the declared names are appended to
     *
     * @remarks
     * A variable statement can bind several names at once, while every other declaration binds at most one.
     * Bindings that are not plain identifiers - a destructured variable, or an ambient module declared by its quoted
     * path - contribute nothing, having no name a bundle could re-export.
     *
     * @since 3.0.0
     */

    private collectDeclared(declaration: Declaration, names: Array<NamedBindingInterface>): void {
        if (declaration.type === 'VariableDeclaration') {
            for (const entry of declaration.declarations)
                if (entry.id.type === 'Identifier') names.push({ name: entry.id.name });

            return;
        }

        if ('id' in declaration && declaration.id && 'name' in declaration.id) names.push({ name: declaration.id.name });
    }

    /**
     * Returns the local name a default export binds, when it binds one.
     *
     * @param declaration - Declaration or expression behind `export default`
     * @returns The bound name, or `undefined` for an anonymous or non-binding default
     *
     * @since 3.0.0
     */

    private defaultBinding(declaration: ExportDefaultDeclarationKind): string | undefined {
        if (declaration.type === 'Identifier') return declaration.name;

        return 'id' in declaration ? declaration.id?.name : undefined;
    }

    /**
     * Reads the name out of an import or export clause entry.
     *
     * @param name - Identifier or string literal naming a binding
     * @returns The identifier, or the literal re-quoted so it can be emitted back into a clause
     *
     * @since 3.0.0
     */

    private nameOf(name: ModuleExportName): string {
        return 'name' in name ? name.name : JSON.stringify(name.value);
    }

    /**
     * Pairs the name a binding carries on the module with its local name.
     *
     * @param name - Name the binding is known by on the other side of the clause
     * @param alias - Local name the clause binds it under
     * @returns The bare name when the two match, and the pair when the clause renamed it
     *
     * @see NamedBindingInterface
     * @since 3.0.0
     */

    private binding(name: string, alias: string): NamedBindingInterface {
        return name === alias ? { name } : { name, alias };
    }

    /**
     * Reports whether a range of the content holds nothing but whitespace.
     *
     * @param content - Text the range points into
     * @param start - Inclusive start offset of the range
     * @param end - Exclusive end offset of the range
     * @returns `true` when every character in the range is a space, tab, or line break
     *
     * @remarks
     * Scans in place and stops at the first other character, so it costs nothing on the long ranges left behind by
     * stripped statements and allocates no substring on the short ones.
     *
     * @since 3.0.0
     */

    private blank(content: string, start: number, end: number): boolean {
        for (let index = start; index < end; index++) {
            const code = content.charCodeAt(index);
            if (code !== Char.Space && code !== Char.Tab && code !== Char.Lf && code !== Char.Cr) return false;
        }

        return true;
    }
}
