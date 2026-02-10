/**
 * Consolidated representation of all external (third-party) imports found across a bundle.
 *
 * Aggregates default, named, and namespace imports from multiple files into a deduplicated,
 * bundle-friendly structure that can be used to generate clean top-level import statements.
 *
 * Used by bundlers to produce portable declaration bundles with minimal, correctly ordered imports.
 *
 * @since 2.0.0
 */

export interface ModuleImportsInterface {
    /**
     * Set of all named import specifiers (including aliases with `as`) used from this module.
     *
     * @remarks
     * Deduplicated across the entire bundle — contains strings like `"debounce"`, `"pick as _pick"`.
     *
     * @example
     * ```ts
     * named: new Set(["Component", "useEffect", "memo as React.memo"])
     * ```
     *
     * @since 2.0.0
     */

    named: Set<string>;

    /**
     * Name of the default import binding, if any exists in the bundle.
     *
     * @remarks
     * Only one default import per module is kept (the first encountered wins in the current implementation).
     * Remains `undefined` if no default import is present.
     *
     * @since 2.0.0
     */

    default?: string;

    /**
     * Maps local namespace alias → module specifier for `* as` imports.
     *
     * @remarks
     * Key = local binding name (e.g. `"theme"`)
     * Value = module path (e.g. `"@company/design-system"`)
     *
     * @example
     * ```ts
     * namespace: new Map([
     *   ["utils", "lodash"],
     *   ["icons", "@heroicons/react/24/solid"]
     * ])
     * ```
     *
     * @since 2.0.0
     */

    namespace: Map<string, string>;
}

/**
 * Final structured result containing all export-related information for a declaration bundle.
 *
 * Separates locally re-exported symbols, supporting const declarations (for namespace flattening),
 * and external re-export statements that should be preserved at the top level.
 *
 * Used as the intermediate shape when constructing the final bundled `.d.ts` content.
 *
 * @see {@link NamespaceExportsInterface}
 * @since 2.0.0
 */

export interface BundleExportsInterface {
    /**
     * Flat list of all symbols that should appear in the final `export { … }` clause.
     *
     * @remarks
     * Contains both direct exports and flattened namespace members.
     * Deduplicated and sorted before emission.
     *
     * @example
     * ```ts
     * exports: ["Button", "useTheme", "ThemeProvider", "colors"]
     * ```
     *
     * @since 2.0.0
     */

    exports: Array<string>;

    /**
     * Array of supporting declaration statements needed for flattened namespaces.
     *
     * @remarks
     * Typically, it contains `const Ns = { … };` lines created during a recursive namespace collection.
     * These must appear before the final export block.
     *
     * @since 2.0.0
     */

    declarations: Array<string>;

    /**
     * Array of complete external re-export statements (`export * from …`, `export { … } from …`, etc.).
     *
     * @remarks
     * These are emitted verbatim at the end of the bundle to preserve passthrough re-exports.
     *
     * @example
     * ```ts
     * externalExports: [
     *   "export * from 'react';",
     *   "export { default as clsx } from 'clsx';"
     * ]
     * ```
     *
     * @since 2.0.0
     */

    externalExports: Array<string>;
}

/**
 * The result shape returned when recursively collecting exports from a namespace-exported module.
 *
 * Used during flattening of `export * as Foo from './module'` and transitive star exports.
 *
 * @since 2.0.0
 */

export interface NamespaceExportsInterface {
    /**
     * List of exported symbol names collected from the namespace target (and its transitive dependencies).
     *
     * @remarks
     * These names are used to construct object literals like `const Foo = { a, b, c };`.
     *
     * @since 2.0.0
     */

    exports: Array<string>;

    /**
     * Supporting declarations required to define the namespace object.
     *
     * @remarks
     * Usually contains `const … = { … };` statements for nested namespaces.
     *
     * @since 2.0.0
     */

    declarations: Array<string>;
}
