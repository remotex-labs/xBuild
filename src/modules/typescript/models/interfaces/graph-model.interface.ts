/**
 * Describes the shape of imports coming from external modules (node_modules or other non-project files).
 *
 * Used within file dependency graphs to track how a module consumes symbols from third-party libraries
 * or other external dependencies, enabling accurate public API surface analysis and federation planning.
 *
 * @since 2.0.0
 */

export interface ExternalImportInterface {
    /**
     * Maps module specifier → list of named imports (including re-aliases with `as`).
     *
     * @remarks
     * Key = module path (e.g. "lodash", "react")
     * Value = array of strings like `"debounce"`, `"default as React"`, `"omit as _omit"`
     *
     * @example
     * ```ts
     * named: {
     *   "lodash": ["debounce", "throttle", "pick as _pick"],
     *   "@angular/core": ["Component", "Input as angularInput"]
     * }
     * ```
     *
     * @since 2.0.0
     */

    named: Record<string, Array<string>>;

    /**
     * Maps module specifier → name of the default import (if present).
     *
     * @remarks
     * Key = module path
     * Value = local binding name (e.g. `"React"` for `import React from 'react'`)
     *
     * @since 2.0.0
     */

    default: Record<string, string>;

    /**
     * Maps local namespace alias → module specifier for `* as` imports.
     *
     * @remarks
     * Key = local name (e.g. `"utils"`)
     * Value = module path (e.g. `"@internal/utils"`)
     *
     * @example
     * ```ts
     * namespace: {
     *   "utils": "./utils",
     *   "theme": "@company/design-system"
     * }
     * ```
     *
     * @since 2.0.0
     */

    namespace: Record<string, string>;
}

/**
 * Represents re-exports and side effect re-exports originating from external modules.
 *
 * Tracks `export * from …`, `export { … } from …` and `export * as … from …` statements
 * that point to third-party or non-project modules.
 *
 * @since 2.0.0
 */

export interface ExternalExportInterface {
    /**
     * List of module specifiers re-exported via `export * from 'module'`.
     *
     * @remarks
     * All symbols from these modules become part of the public API surface.
     *
     * @since 2.0.0
     */

    star: Array<string>;

    /**
     * Maps module specifier → list of specifically re-exported named bindings (with optional `as`).
     *
     * @remarks
     * Key = module path
     * Value = array like `["Button", "Dialog as Modal"]`
     *
     * @since 2.0.0
     */

    exports: Record<string, Array<string>>;

    /**
     * Maps local namespace alias → module specifier for `export * as Foo from 'module'`.
     *
     * @remarks
     * Key = exported namespace name
     * Value = source module path
     *
     * @since 2.0.0
     */

    namespace: Record<string, string>;
}

/**
 * Captures local (project-internal) exports and re-exports.
 *
 * Used to understand what symbols a file exposes to other files within the same project.
 *
 * @since 2.0.0
 */

export interface InternalExportInterface {
    /**
     * List of module specifiers re-exported via `export * from './local'`.
     *
     * @remarks
     * Indicates transitive re-exports within the project.
     *
     * @since 2.0.0
     */

    star: Array<string>;

    /**
     * List of locally declared names that are exported (via `export` modifier or declaration).
     *
     * @remarks
     * Contains plain identifiers only (no `as` aliases here — aliases are resolved at import sites).
     *
     * @example
     * ```ts
     * exports: ["useTheme", "Button", "ThemeProvider", "colors"]
     * ```
     *
     * @since 2.0.0
     */

    exports: Array<string>;

    /**
     * Maps exported namespace alias → source module for `export * as Ns from './module'`.
     *
     * @remarks
     * Key = exported name
     * Value = relative or absolute source path
     *
     * @since 2.0.0
     */

    namespace: Record<string, string>;
}

/**
 * Represents the complete analyzed shape of a single TypeScript file for dependency and API purposes.
 *
 * Contains versioned metadata, cleaned declaration content, internal dependency graph,
 * and detailed import/export maps separated by internal vs. external scope.
 *
 * @remarks
 * The `content` field holds declaration text with all import/export keywords removed,
 * making it suitable for public API extraction or type-only bundling.
 *
 * @see {@link ExternalImportInterface}
 * @see {@link InternalExportInterface}
 * @see {@link ExternalExportInterface}
 *
 * @since 2.0.0
 */

export interface FileNodeInterface {
    /**
     * String version identifier coming from the snapshot cache.
     *
     * Used to determine whether re-analysis is necessary.
     *
     * @since 2.0.0
     */

    version: string;

    /**
     * Normalized absolute path to the source file.
     *
     * Serves as the canonical key in most caches.
     *
     * @since 2.0.0
     */

    fileName: string;

    /**
     * Cleaned declaration content (`.d.ts`-like) with imports, exports, and modifiers stripped.
     *
     * @remarks
     * Produced after `emitDeclaration` and `stripImportsExports` steps.
     * Intended for consumption by bundlers, documentation generators, or API extractors.
     *
     * @since 2.0.0
     */

    content: string;

    /**
     * Set of resolved absolute paths to other project files this file depends.
     *
     * @remarks
     * Only includes internal (non-node_modules) dependencies.
     *
     * @since 2.0.0
     */

    internalDeps: Set<string>;

    /**
     * All imports from external modules (node_modules or resolved external paths).
     * @since 2.0.0
     */

    externalImports: ExternalImportInterface;

    /**
     * Symbols and re-exports this file exposes to other files in the project.
     * @since 2.0.0
     */

    internalExports: InternalExportInterface;

    /**
     * Re-exports that point to external modules.
     *
     * @remarks
     * Important for detecting public API leakage or facade modules.
     *
     * @since 2.0.0
     */

    externalExports: ExternalExportInterface;
}

/**
 * Simple result shape returned when resolving a module specifier during graph analysis.
 *
 * Distinguishes between project-internal files and external dependencies.
 *
 * @since 2.0.0
 */

export interface ModuleInfoInterface {
    /**
     * Resolved file path (for internal modules) or original module specifier (for external).
     *
     * @since 2.0.0
     */

    fileName: string;

    /**
     * `true` when the module is external (node_modules, remote, etc.).
     *
     * @since 2.0.0
     */

    isExternal: boolean;
}
