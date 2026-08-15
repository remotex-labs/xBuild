/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { ParseResult } from 'oxc-parser';
import type { SourceEditInterface } from '@components/interfaces/transformer-component.interface';

/**
 * Local name paired with the original name it binds to, when the two differ.
 *
 * @remarks
 * Used everywhere an import or export clause can rename a binding, as in `{ a as b }`.
 * `alias` is present only when the source wrote a rename, a bare `{ a }` carrying `name` alone, so a renderer can
 * distinguish the two without comparing `name` to `alias` itself.
 *
 * @example
 * ```ts
 * // import { a, b as c } from 'module';
 * [ { name: 'a' }, { name: 'b', alias: 'c' } ]
 * ```
 *
 * @since 3.0.0
 */

export interface NamedBindingInterface {
    /**
     * Name as it exists on the module being imported or exported.
     *
     * @since 3.0.0
     */

    name: string;

    /**
     * Local name the binding is renamed to, present only when the clause renamed it.
     *
     * @since 3.0.0
     */

    alias?: string;
}

/**
 * Bindings a single package contributes to a file through `import` statements.
 *
 * @remarks
 * One record per module specifier, accumulated while walking a file's statements, so merging the imports of many
 * files is a single pass over `specifier -> bindings` pairs rather than one pass per clause kind.
 * Only modules that resolve outside the project are recorded.
 * An import of another project file is tracked through {@link DeclarationRecordInterface.projectDependencies}
 * instead.
 * Every field is optional and present only when the module was imported that way.
 *
 * @example
 * ```ts
 * // import 'reflect-metadata';
 * // import ts, { CompilerOptions } from 'typescript';
 * // import * as path from 'node:path';
 * packageImports['reflect-metadata']; // { side: true }
 * packageImports['typescript'];       // { default: 'ts', named: [ { name: 'CompilerOptions' } ] }
 * packageImports['node:path'];        // { namespaces: [ 'path' ] }
 * ```
 *
 * @see NamedBindingInterface
 * @since 3.0.0
 */

export interface ModuleImportInterface {
    /**
     * Whether the module was imported for its side effects only, as in `import 'module'`.
     *
     * @since 3.0.0
     */

    side?: boolean;

    /**
     * Local name the module's default export was bound to, as in `import Name from 'module'`.
     *
     * @remarks
     * The first binding seen wins, so a module default-imported under different names in different statements
     * within the same file keeps the name of the statement that recorded it first.
     *
     * @since 3.0.0
     */

    default?: string;

    /**
     * Local names the module was namespace-imported under, as in `import * as Name from 'module'`.
     *
     * @remarks
     * An array rather than a single name, since the same module can be namespace-imported under several names.
     * `import Name = require('module')` is recorded here as well, being the type-space equivalent.
     *
     * @since 3.0.0
     */

    namespaces?: Array<string>;

    /**
     * Named bindings taken from the module, as in `import { a, b as c } from 'module'`.
     *
     * @since 3.0.0
     */

    named?: Array<NamedBindingInterface>;
}

/**
 * Bindings a single package contributes to a file through re-`export` statements.
 *
 * @remarks
 * The export-side counterpart of {@link ModuleImportInterface}, keyed the same way and recorded only for modules
 * that resolve outside the project.
 * A re-export of another project file surfaces through {@link ProjectExportInterface} instead.
 *
 * @example
 * ```ts
 * // export * from 'rxjs';
 * // export * as fs from 'node:fs';
 * // export { Plugin } from 'esbuild';
 * packageExports['rxjs'];    // { star: true }
 * packageExports['node:fs']; // { namespaces: [ 'fs' ] }
 * packageExports['esbuild']; // { named: [ { name: 'Plugin' } ] }
 * ```
 *
 * @see NamedBindingInterface
 * @since 3.0.0
 */

export interface ModuleExportInterface {
    /**
     * Whether the module is re-exported wholesale, as in `export * from 'module'`.
     *
     * @since 3.0.0
     */

    star?: boolean;

    /**
     * Names the module is re-exported under as a namespace, as in `export * as Name from 'module'`.
     *
     * @since 3.0.0
     */

    namespaces?: Array<string>;

    /**
     * Names re-exported from the module, as in `export { a, b as c } from 'module'`.
     *
     * @since 3.0.0
     */

    named?: Array<NamedBindingInterface>;
}

/**
 * Public surface a file contributes from declarations that are inlined rather than re-exported.
 *
 * @remarks
 * Covers everything a file exports that is not backed by a package: its own declarations, names re-exported from
 * another project file, and star re-exports of project files.
 * The three fields are disjoint - a name appears in exactly the one that matches how it was exported.
 *
 * @example
 * ```ts
 * // export declare function build(): void;
 * // export { parse as read } from './parser';
 * // export * from './types';
 * // export * as errors from './errors';
 * projectExports.exports;   // [ { name: 'build' }, { name: 'parse', alias: 'read' } ]
 * projectExports.star;      // Set { 'D:/app/src/types.ts' }
 * projectExports.namespace; // { errors: 'D:/app/src/errors.ts' }
 * ```
 *
 * @see NamedBindingInterface
 * @since 3.0.0
 */

export interface ProjectExportInterface {
    /**
     * Resolved paths of project files re-exported wholesale, as in `export * from './module'`.
     *
     * @remarks
     * A `Set` rather than an array, since a star re-export is followed transitively when the bundle's public
     * surface is collected and needs deduplication to terminate on a cycle.
     *
     * @since 3.0.0
     */

    star: Set<string>;

    /**
     * Names this file exports directly, either declared locally or re-exported from another project file.
     *
     * @remarks
     * A default export of a named declaration is recorded as `{ name, alias: 'default' }`.
     * An anonymous default export contributes nothing, having no local binding to record.
     *
     * @since 3.0.0
     */

    exports: Array<NamedBindingInterface>;

    /**
     * Namespace re-exports of project files, mapping the exposed name to the resolved path of its target.
     *
     * @remarks
     * Captured for completeness but left unconsumed by bundling: flattening it would mean synthesizing a
     * `declare namespace` around the target's exports, which the inlined fragments do not carry enough
     * information to build.
     *
     * @since 3.0.0
     */

    namespace: Record<string, string>;
}

/**
 * Module graph a single file contributes, independent of the text it was read from.
 *
 * @remarks
 * Accumulated while the file's statements are walked and carried unchanged into its cache entry, so a bundler reads
 * the same four records whether it is collecting dependencies, merging package imports, or building an export clause.
 *
 * @see ParseContextInterface
 * @see DeclarationEntryInterface
 * @since 3.0.0
 */

export interface DeclarationRecordInterface {
    /**
     * Resolved paths of the project files this file depends on.
     *
     * @remarks
     * Filled from every import, export-from, and `import =` statement that resolves inside the project, and keyed
     * the way {@link DeclarationEntryInterface} entries are, so a path taken from here can be looked up directly.
     *
     * @since 3.0.0
     */

    projectDependencies: Set<string>;

    /**
     * Package imports keyed by module specifier, as written in the source.
     *
     * @see ModuleImportInterface
     * @since 3.0.0
     */

    packageImports: Record<string, ModuleImportInterface>;

    /**
     * Package re-exports keyed by module specifier, as written in the source.
     *
     * @see ModuleExportInterface
     * @since 3.0.0
     */

    packageExports: Record<string, ModuleExportInterface>;

    /**
     * Names and project files this file exports from declarations that are inlined rather than re-exported.
     *
     * @see ProjectExportInterface
     * @since 3.0.0
     */

    projectExports: ProjectExportInterface;
}

/**
 * Context threaded through the statement walk of a single file.
 *
 * @remarks
 * Built once per file from its isolated-declaration output,
 * then passed by reference into every strip and record method so a file's bindings are read from its AST exactly once.
 * `parsed`, `target`, and `content` describe what is being walked,
 * while the two edit lists and the inherited records accumulate as each statement is visited.
 * Both edit lists are collected against `content` and applied to it separately, which is what lets one walk produce
 * the standalone declaration and the bundle fragment from a single parse.
 *
 * @example
 * ```ts
 * const context: ParseContextInterface = {
 *     edits: [],
 *     target: path,
 *     parsed: parseSync(path, declaration, { sourceType: 'module' }),
 *     content: declaration,
 *     bundleEdits: [],
 *     packageImports: {},
 *     packageExports: {},
 *     projectExports: { star: new Set(), exports: [], namespace: {} },
 *     projectDependencies: new Set()
 * };
 * ```
 *
 * @see DeclarationRecordInterface
 * @since 3.0.0
 */

export interface ParseContextInterface extends DeclarationRecordInterface {
    /**
     * Rewrites turning the file's project specifiers into relative paths naming the declaration they resolve to.
     *
     * @remarks
     * Applied on their own to produce the standalone declaration, which stays a module and only loses its `paths`
     * aliases.
     *
     * @see SourceEditInterface
     * @since 3.0.0
     */

    edits: Array<SourceEditInterface>;

    /**
     * Parse tree of the isolated declaration output, walked to find statements to strip or rewrite.
     *
     * @since 3.0.0
     */

    parsed: ParseResult;

    /**
     * Resolved absolute path of the file being parsed, used to resolve its specifiers against.
     *
     * @since 3.0.0
     */

    target: string;

    /**
     * Isolated declaration text the parse tree was produced from, which both edit lists index into.
     *
     * @since 3.0.0
     */

    content: string;

    /**
     * Deletions removing every module statement and the doc comments they leave orphaned.
     *
     * @remarks
     * Applied on their own to produce the bundle fragment, which carries declarations alone and can be concatenated
     * with the fragments of the surrounding files.
     *
     * @see SourceEditInterface
     * @since 3.0.0
     */

    bundleEdits: Array<SourceEditInterface>;
}

/**
 * Cached declaration of one file, in both the forms a build consumes.
 *
 * @remarks
 * Held against the snapshot version of the file it was built from, so it stands until that file is observed to change.
 * The two texts come out of the same parse and differ only in what was done to the module statements.
 * `declaration` keeps them with their specifiers rewritten,
 * while `content` has them removed and their bindings recorded in the inherited graph records.
 *
 * @example
 * ```ts
 * const entry = declarations.touch('src/index.ts');
 *
 * entry.declaration;          // "import { A } from './models/a.d.ts';\nexport declare class B {}\n"
 * entry.content;              // 'declare class B {}\n'
 * entry.projectDependencies;  // Set { 'D:/app/src/models/a.ts' }
 * entry.projectExports.exports; // [ { name: 'B' } ]
 * ```
 *
 * @see DeclarationRecordInterface
 * @since 3.0.0
 */

export interface DeclarationEntryInterface extends DeclarationRecordInterface {
    /**
     * Snapshot version of the file this entry was built from.
     *
     * @remarks
     * Compared against the file model's current version on every lookup, which is the whole of the staleness check.
     *
     * @since 3.0.0
     */

    version: number;

    /**
     * Declaration text stripped of module syntax, ready to be inlined into a bundle.
     *
     * @remarks
     * Imports, re-exports, and export prefixes are gone, along with the doc comments removing them orphaned, so what
     * remains is a run of ambient declarations that can sit beside those of any other file.
     *
     * @since 3.0.0
     */

    content: string;

    /**
     * Standalone declaration text, still a module, with its project specifiers resolved.
     *
     * @remarks
     * Every specifier that resolves inside the project is rewritten to a relative path carrying the `.d.ts` extension.
     * The emitted file therefore needs no `paths` table,
     * and it points at the declaration emitted beside it rather than at a source that was never shipped.
     * Package specifiers are left exactly as written.
     *
     * @since 3.0.0
     */

    declaration: string;
}

/**
 * Public surface of a bundle, as the text that renders it.
 *
 * @remarks
 * Collected from the entry point and every project file it star re-exports, with both fields held as sets of rendered
 * clauses so the same name reached through two paths is written once.
 *
 * @example
 * ```ts
 * surface.exports;    // Set { 'build', 'parse as read' }
 * surface.statements; // Set { "export * from 'rxjs';" }
 * ```
 *
 * @since 3.0.0
 */

export interface BundleSurfaceInterface {
    /**
     * Names the bundle exposes from the declarations it inlines, each written the way an export clause spells it.
     *
     * @since 3.0.0
     */

    exports: Set<string>;

    /**
     * Complete re-export statements the bundle passes through, one per package clause it carries.
     *
     * @remarks
     * Kept as whole statements rather than names, the declarations behind them living in a package the bundle does not
     * inline.
     *
     * @since 3.0.0
     */

    statements: Set<string>;
}

/**
 * Bindings one package contributes to a bundle, merged over every file the bundle inlines.
 *
 * @remarks
 * The bundle-wide counterpart of {@link ModuleImportInterface}: the same module imported by several inlined files
 * yields one record, which is what lets the bundle reissue a single import statement per module.
 *
 * @example
 * ```ts
 * merged.get('typescript'); // { side: false, default: 'ts', namespaces: Set {}, named: Set { 'CompilerOptions' } }
 * ```
 *
 * @see ModuleImportInterface
 * @since 3.0.0
 */

export interface MergedImportInterface {
    /**
     * Whether any inlined file imported the module for its side effects only.
     *
     * @since 3.0.0
     */

    side: boolean;

    /**
     * Local name the module's default export is bound to across the bundle.
     *
     * @remarks
     * The first binding seen wins, so files disagreeing on the name keep the one the closure reached first.
     *
     * @since 3.0.0
     */

    default?: string;

    /**
     * Local names the module is namespace-imported under.
     *
     * @since 3.0.0
     */

    namespaces: Set<string>;

    /**
     * Named bindings taken from the module, each written the way an import clause spells it.
     *
     * @since 3.0.0
     */

    named: Set<string>;
}
