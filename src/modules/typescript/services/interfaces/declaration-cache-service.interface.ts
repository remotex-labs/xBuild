/**
 * Represents the imports of a TypeScript module from external packages and local modules.
 *
 * @remarks
 * This interface categorizes imports into three types based on how they're declared
 * in the source code. Each category uses a different data structure optimized for
 * how imports are typically used:
 *
 * - **Named imports** (`import { a, b } from 'module'`): Stored in a record keyed by
 *   module name, with arrays of imported names as values. This supports multiple
 *   imports from the same module.
 *
 * - **Default imports** (`import Foo from 'module'`): Stored in a record keyed by module
 *   name, with the single imported identifier as value. Only one default export per module.
 *
 * - **Namespace imports** (`import * as Foo from 'module'`): Stored in a record keyed by
 *   module name, with the namespace identifier as value. Creates a namespace object
 *   containing all module exports.
 *
 * This structure enables efficient:
 * - Import deduplication when bundling declarations
 * - Resolving import paths during declaration generation
 * - Tracking external module dependencies
 * - Generating consolidated import statements in bundled files
 *
 * @example
 * ```ts
 * // For source code:
 * // import React, { useState, useEffect } from 'react';
 * // import * as utils from './utils';
 * // import lodash from 'lodash';
 *
 * const imports: ImportsInterface = {
 *   named: {
 *     'react': ['useState', 'useEffect'],
 *     './utils': []  // Namespace imports don't appear here
 *   },
 *   default: {
 *     'react': 'React',
 *     'lodash': 'lodash'
 *   },
 *   namespace: {
 *     'utils': './utils' // Maps identifier to a module path
 *   }
 * };
 * ```
 *
 * @see DeclarationInterface
 * @see ExportsInterface
 *
 * @since 2.0.0
 */

export interface ImportsInterface {
    /**
     * Named imports from modules.
     *
     * @remarks
     * Maps module paths to arrays of imported names. Supports multiple named imports
     * from a single module:
     * - Simple names: `'useState'`
     * - Aliased names: `'foo as bar'`
     *
     * The array can contain both original and aliased names. Consumers should
     * parse the name to detect the `as` keyword for alias detection.
     *
     * @example
     * ```ts
     * named: {
     *   'react': ['useState', 'useEffect', 'useContext as ctx'],
     *   '@utils/helpers': ['map', 'filter', 'reduce']
     * }
     * ```
     *
     * @since 2.0.0
     */

    named: Record<string, Array<string>>;

    /**
     * Default imports from modules.
     *
     * @remarks
     * Maps module paths to their default import identifiers. Each module can have
     * at most one default import, so the value is a single string rather than an array.
     *
     * @example
     * ```ts
     * default: {
     *   'react': 'React',
     *   'express': 'express',
     *   './config': 'config'
     * }
     * ```
     *
     * @since 2.0.0
     */

    default: Record<string, string>;

    /**
     * Namespace imports from modules.
     *
     * @remarks
     * Maps namespace identifiers to their source module paths. When a module is
     * imported as a namespace, all its exports become properties of the namespace object.
     *
     * Note: The key is the identifier name (`* as Name`), value is the module path.
     *
     * @example
     * ```ts
     * namespace: {
     *   'React': 'react', // import * as React from 'react'
     *   'lodash': 'lodash',
     *   'utils': './utils/index'
     * }
     * ```
     *
     * @since 2.0.0
     */

    namespace: Record<string, string>;
}

/**
 * Represents the exports of a TypeScript module, including internal re-exports.
 *
 * @remarks
 * This interface categorizes exports within a module, distinguishing between:
 *
 * - **Star exports** (`export * from './local'`): Complete module re-exports that expose
 *   all public members from a source file
 *
 * - **Named exports** (`export { a, b } from './local'`): Selective re-exports of specific
 *   members from a source file. Includes direct exports and re-exports.
 *
 * - **Namespace exports** (`export * as Foo from './local'`): Named namespace re-exports
 *   that group all members under a namespace identifier
 *
 * Used during declaration bundling to:
 * - Determine what to re-export in bundled files
 * - Track export chains across multiple files
 * - Preserve export relationships in declaration output
 * - Generate consolidated export statements
 *
 * @example
 * ```ts
 * // For source file with:
 * // export { Component, helper } from './component';
 * // export * from './types';
 * // export * as utils from './utils';
 * // export class MyClass { }
 *
 * const exports: ExportsInterface = {
 *   star: ['./types'],
 *   exports: ['Component', 'helper', 'MyClass'],
 *   namespace: {
 *     'utils': './utils'
 *   }
 * };
 * ```
 *
 * @see DeclarationInterface
 * @see ImportsInterface
 * @see ExternalExportsInterface
 *
 * @since 2.0.0
 */

export interface ExportsInterface {
    /**
     * Star exports from local modules.
     *
     * @remarks
     * Array of relative paths for modules whose exports are completely re-exported
     * via `export *` statements. Used to determine which modules' exports should be
     * included in the re-export chain.
     *
     * @example
     * ```ts
     * star: ['./types', './constants', './utils/helpers']
     * ```
     *
     * @since 2.0.0
     */

    star: Array<string>;

    /**
     * Named exports from this module.
     *
     * @remarks
     * Array of exported names including:
     * - Direct exports: `export const foo = 1;`
     * - Named re-exports: `export { foo } from './module'`
     * - Aliased exports: `export { foo as bar }`
     * - Class/interface/type exports: `export class MyClass {}`
     *
     * Names are stored as declared (e.g., `'foo as bar'` for aliased exports).
     *
     * @example
     * ```ts
     * exports: [
     *   'Component',
     *   'helper',
     *   'foo as bar',
     *   'Config',
     *   'MyType'
     * ]
     * ```
     *
     * @since 2.0.0
     */

    exports: Array<string>;

    /**
     * Namespace exports mapping for local modules.
     *
     * @remarks
     * Maps namespace identifiers to the modules they re-export via `export * as Name`
     * statements. Enables tracking of grouped exports.
     *
     * @example
     * ```ts
     * namespace: {
     *   'utils': './utils',
     *   'types': './types/index'
     * }
     * // Corresponds to:
     * // export * as utils from './utils';
     * // export * as types from './types/index';
     * ```
     *
     * @since 2.0.0
     */

    namespace: Record<string, string>;
}

/**
 * Represents re-exports from external packages (node_modules).
 *
 * @remarks
 * This interface categorizes re-exports from external modules in a way that preserves
 * the re-export relationships as they appear in the source code. Unlike {@link ExportsInterface},
 * which handles local re-exports, this focuses on what's re-exported from external packages.
 *
 * This distinction is important because:
 * - Local re-exports can be bundled (declarations inlined)
 * - External re-exports must be preserved (cannot inline external package types)
 * - Different generation strategies are needed for each type
 *
 * Used during bundling to:
 * - Identify which external modules need re-export statements
 * - Preserve external API surface in bundled declarations
 * - Generate consolidated external re-export statements
 *
 * @example
 * ```ts
 * // For source file with:
 * // export * from 'react';
 * // export { Component } from 'my-ui-lib';
 * // export * as utils from 'lodash';
 *
 * const externalExports: ExternalExportsInterface = {
 *   star: ['react'],
 *   exports: {
 *     'my-ui-lib': ['Component']
 *   },
 *   namespace: {
 *     'utils': 'lodash'
 *   }
 * };
 * ```
 *
 * @see DeclarationInterface
 * @see ExportsInterface
 *
 * @since 2.0.0
 */

export interface ExternalExportsInterface {
    /**
     * Complete re-exports from external packages.
     *
     * @remarks
     * Array of external package names that are completely re-exported via `export *`
     * statements. All public exports from these packages become available to consumers
     * of this module.
     *
     * @example
     * ```ts
     * star: ['react', 'react-dom']
     * // Corresponds to:
     * // export * from 'react';
     * // export * from 'react-dom';
     * ```
     *
     * @since 2.0.0
     */

    star: Array<string>;

    /**
     * Selective named re-exports from external packages.
     *
     * @remarks
     * Maps external package names to arrays of specific exports being re-exported.
     * Enables selective re-export of specific members from external packages while
     * hiding others.
     *
     * @example
     * ```ts
     * exports: {
     *   'react': ['ReactNode', 'FC', 'useCallback'],
     *   'lodash': ['map', 'filter']
     * }
     * // Corresponds to:
     * // export { ReactNode, FC, useCallback } from 'react';
     * // export { map, filter } from 'lodash';
     * ```
     *
     * @since 2.0.0
     */

    exports: Record<string, Array<string>>;

    /**
     * Namespace re-exports from external packages.
     *
     * @remarks
     * Maps namespace identifiers to external package names for `export * as Name`
     * statements. Makes all package exports available under the namespace.
     *
     * @example
     * ```ts
     * namespace: {
     *   'React': 'react',
     *   'lodash': 'lodash'
     * }
     * // Corresponds to:
     * // export * as React from 'react';
     * // export * as lodash from 'lodash';
     * ```
     *
     * @since 2.0.0
     */

    namespace: Record<string, string>;
}

/**
 * Represents a complete processed TypeScript declaration with metadata and dependencies.
 *
 * @remarks
 * This interface encapsulates a TypeScript declaration file after being processed by the
 * {@link DeclarationCache}. It includes not just the declaration content, but also
 * comprehensive metadata about imports, exports, and dependencies used for bundling
 * and declaration generation.
 *
 * **Content processing**:
 * - All import statements are removed and categorized in {@link imports}
 * - All export modifiers and re-exports are analyzed and stored in {@link exports} and {@link externalExports}
 * - The content is cleaned and ready for inclusion in bundled declarations
 *
 * **Dependency tracking**:
 * - {@link dependency} tracks all internal module dependencies for bundling order
 * - Used to perform depth-first traversal during bundle generation
 * - Ensures all required types are included when bundling
 *
 * **Version management**:
 * - {@link version} enables cache validation without re-reading files
 * - Allows incremental updates by comparing versions
 * - Critical for watch-mode performance
 *
 * @example
 * ```ts
 * // For source file 'src/index.ts':
 * // import { helper } from './utils';
 * // import React from 'react';
 * // export { Component } from './component';
 * // export * as types from './types';
 * // export class MyClass { }
 *
 * const declaration: DeclarationInterface = {
 *   fileName: 'src/index.ts',
 *   content: 'declare class MyClass { }',
 *   version: '2',
 *   dependency: Set(['./utils', './component', './types']),
 *   imports: {
 *     named: {},
 *     default: { 'react': 'React' },
 *     namespace: {}
 *   },
 *   exports: {
 *     star: [],
 *     exports: ['MyClass'],
 *     namespace: { 'types': './types' }
 *   },
 *   externalExports: {
 *     star: [],
 *     exports: {},
 *     namespace: {}
 *   }
 * };
 * ```
 *
 * @see ImportsInterface
 * @see ExportsInterface
 * @see ExternalExportsInterface
 * @see DeclarationCache
 *
 * @since 2.0.0
 */

export interface DeclarationInterface {
    /**
     * The source file name that this declaration was generated from.
     *
     * @remarks
     * Typically, an absolute file path to the source TypeScript file (e.g., `.ts`, `.tsx`).
     * Used as a cache key and for dependency resolution.
     *
     * @example
     * ```ts
     * fileName: '/home/user/project/src/index.ts'
     * ```
     *
     * @since 2.0.0
     */

    fileName: string;

    /**
     * The processed declaration file content.
     *
     * @remarks
     * TypeScript declaration content with all import and export statements removed.
     * Ready for bundling into larger declaration files or output individually.
     * Content is cleaned to remove unnecessary formatting and export modifiers.
     *
     * @example
     * ```ts
     * content: `
     *   declare class MyClass {
     *       method(): void;
     *   }
     *   declare interface Config {
     *       name: string;
     *   }
     * `
     * ```
     *
     * @since 2.0.0
     */

    content: string;

    /**
     * The version string of the source file when this declaration was generated.
     *
     * @remarks
     * Used to validate cache freshness. When the language host reports a new version
     * for the source file, this cached declaration is invalidated and regenerated.
     * Enables efficient incremental processing.
     *
     * @example
     * ```ts
     * version: '3' // File has been modified 3 times
     * ```
     *
     * @since 2.0.0
     */

    version: string;

    /**
     * Set of internal module dependencies required by this declaration.
     *
     * @remarks
     * Contains absolute paths to all local modules that are imported or re-exported
     * by this file. Used to determine:
     * - Module bundling order via topological sorting
     * - Which files to include in bundle declarations
     * - Transitive dependencies when traversing the dependency graph
     *
     * Does not include external package dependencies (those are in {@link imports}).
     *
     * @example
     * ```ts
     * dependency: Set([
     *   '/home/user/project/src/utils.ts',
     *   '/home/user/project/src/types/index.ts',
     *   '/home/user/project/src/components/index.ts'
     * ])
     * ```
     *
     * @since 2.0.0
     */

    dependency: Set<string>;

    /**
     * Categorized imports from external packages and local modules.
     *
     * @remarks
     * Tracks all import statements in the original source file, organized by
     * import type (default, named, namespace). Used during bundling to:
     * - Determine external package dependencies
     * - Generate consolidated import statements
     * - Detect and resolve import conflicts
     * - Create proper import/export chains
     *
     * @see ImportsInterface
     * @since 2.0.0
     */

    imports: ImportsInterface;

    /**
     * Internal module exports and re-exports.
     *
     * @remarks
     * Tracks what this module exports from its own declarations and from internal
     * module re-exports. Used during bundling to determine the final export surface
     * when combining multiple declarations.
     *
     * @see ExportsInterface
     * @since 2.0.0
     */

    exports: ExportsInterface;

    /**
     * External package exports and re-exports.
     *
     * @remarks
     * Tracks what this module re-exports from external packages. These re-exports
     * must be preserved in bundled declarations since external package types cannot
     * be inlined.
     *
     * @see ExternalExportsInterface
     * @since 2.0.0
     */

    externalExports: ExternalExportsInterface;
}

/**
 * Represents information about a resolved module for dependency tracking.
 *
 * @remarks
 * Lightweight interface used during declaration processing to track whether a
 * resolved module is part of the project (internal) or from node_modules (external).
 * This distinction is crucial for determining how imports and exports should be
 * handled during declaration bundling.
 *
 * **Usage context**:
 * - **Internal modules** (`isExternal: false`): Can be inlined during bundling,
 *   declarations merged, imports eliminated
 * - **External modules** (`isExternal: true`): Must preserve re-exports as-is,
 *   cannot inline, handled as opaque dependencies
 *
 * @example
 * ```ts
 * // Internal module
 * const moduleInfo: ModuleInfoInterface = {
 *   fileName: '/home/user/project/src/utils.ts',
 *   isExternal: false
 * };
 *
 * // External module from node_modules
 * const moduleInfo: ModuleInfoInterface = {
 *   fileName: 'react',
 *   isExternal: true
 * };
 * ```
 *
 * @see DeclarationInterface
 * @see DeclarationCache
 *
 * @since 2.0.0
 */

export interface ModuleInfoInterface {
    /**
     * The resolved file name or module specifier.
     *
     * @remarks
     * For internal modules: Absolute path to the TypeScript source file.
     * For external modules: Package name or module specifier as it appears in imports.
     *
     * @example
     * ```ts
     * // Internal: absolute path
     * fileName: '/home/user/project/src/components/Button.ts'
     *
     * // External: package name
     * fileName: 'react'
     * fileName: '@types/node'
     * ```
     *
     * @since 2.0.0
     */

    fileName: string;

    /**
     * Whether this module is from an external package (node_modules).
     *
     * @remarks
     * - `true`: Module is from node_modules or an external package
     * - `false`: Module is part of the current project
     *
     * This determines how the module should be treated during bundling:
     * - Internal modules can have their declarations inlined
     * - External modules must be preserved as opaque dependencies
     *
     * @since 2.0.0
     */

    isExternal: boolean;
}
