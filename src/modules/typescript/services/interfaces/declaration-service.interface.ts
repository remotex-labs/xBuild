/**
 * Represents collected namespace exports and their generated declarations.
 *
 * @remarks
 * This interface encapsulates the result of recursively collecting namespace exports
 * from a module and its transitive dependencies. It's used during declaration bundling
 * to generate object literal declarations that group exported members under namespace identifiers.
 *
 * The interface separates the collected export names from their declarations because
 * exports may need to be referenced in multiple places (export statements, namespace objects),
 * while declarations are only generated once and placed in the declaration section.
 *
 * **Generation process**:
 * - Traverses the module dependency graph starting from a file
 * - Collects all names exported from the module and its transitive dependencies
 * - Generates intermediate object literal declarations for namespace grouping
 * - Returns both the final export names and their supporting declarations
 *
 * **Usage context**:
 * Used by {@link DeclarationService} when processing `export * as Name from 'module'`
 * statements to:
 * - Create namespace object declarations like `const Utils = { fn1, fn2 };`
 * - Collect all exported names to include in the final export statement
 * - Handle circular dependencies via visited set tracking
 *
 * @example
 * ```ts
 * // For a module with:
 * // export * as utils from './utils';
 * // ./utils.ts has: export { helper, map, filter }
 *
 * const result: NamespaceExportsResultInterface = {
 *   exports: ['helper', 'map', 'filter'],
 *   declarations: [
 *     'const utils = { helper, map, filter };'
 *   ]
 * };
 *
 * // Used in the final declaration:
 * // const utils = { helper, map, filter };
 * // export { utils };
 * ```
 *
 * @see DeclarationService.collectNamespaceExports
 * @see BundleExportsResultInterface
 *
 * @since 2.0.0
 */

export interface NamespaceExportsResultInterface {
    /**
     * Array of exported names from the namespace module.
     *
     * @remarks
     * Contains all names that should be grouped into a namespace object. Includes:
     * - Direct exports from the module
     * - Transitive exports from re-exported modules
     * - Nested namespace exports (recursively collected)
     *
     * Names are stored as they appear in declarations without modification.
     * May include aliased names if the source uses `export { foo as bar }` syntax.
     *
     * @example
     * ```ts
     * exports: ['Component', 'helper', 'Config', 'MyType']
     * ```
     *
     * @since 2.0.0
     */

    exports: Array<string>;

    /**
     * Generated TypeScript declaration statements for the namespace.
     *
     * @remarks
     * Contains variable declarations that create namespace objects. Primarily used for
     * `export * as Name` patterns where an object literal needs to be created to group
     * exported members under a single namespace identifier.
     *
     * Declaration strings are complete, valid TypeScript statements ready to be inserted
     * into the bundled declaration file. They may reference names that will be imported
     * or collected from other modules.
     *
     * May also contain nested namespace declarations if the original module had nested
     * `export * as` statements.
     *
     * @example
     * ```ts
     * declarations: [
     *   'const utils = { helper, map, filter };',
     *   'const types = { Config, MyType };',
     *   'const nested = { utils, types };'
     * ]
     * ```
     *
     * @since 2.0.0
     */

    declarations: Array<string>;
}

/**
 * Represents collected imports from external modules for bundling.
 *
 * @remarks
 * This interface aggregates imports from a single external module, consolidating
 * multiple import statements into structured metadata. It's used during declaration
 * bundling to generate unified import statements for external packages.
 *
 * The structure separates import types (default, named, namespace) because they
 * require different TypeScript syntax when generating import statements:
 * - Default and named imports can be combined: `import Default, { named } from 'pkg'`
 * - Namespace imports require separate statements: `import * as Name from 'pkg'`
 *
 * **Deduplication**:
 * Multiple declarations may import from the same module. This interface merges
 * them by collecting named imports in a Set (automatic deduplication) and preferring
 * the first default import encountered.
 *
 * **Usage context**:
 * Used by {@link DeclarationService} during bundle generation to:
 * - Consolidate imports across all bundled declarations
 * - Avoid duplicate import statements in output
 * - Generate optimal import syntax
 * - Track what needs to be imported before using exported names
 *
 * @example
 * ```ts
 * // From multiple declarations importing 'react':
 * // Declaration 1: import React, { useState } from 'react'
 * // Declaration 2: import { useEffect } from 'react'
 * // Declaration 3: import * as ReactNamespace from 'react'
 *
 * const result: ModuleImportsInterface = {
 *   named: Set(['useState', 'useEffect']),
 *   default: 'React',
 *   namespace: Map([['ReactNamespace', 'react']])
 * };
 *
 * // Generated import statements:
 * // import React, { useState, useEffect } from 'react';
 * // import * as ReactNamespace from 'react';
 * ```
 *
 * @see DeclarationService.collectExternalImports
 * @see DeclarationService.generateImportStatements
 * @see BundleExportsResultInterface
 *
 * @since 2.0.0
 */

export interface ModuleImportsInterface {
    /**
     * Set of named imports from the module.
     *
     * @remarks
     * Collects all names imported via named import syntax: `import { a, b } from 'module'`.
     * Uses a Set for automatic deduplication when the same name is imported by multiple
     * declarations being bundled.
     *
     * Names are stored as they appear in the source code, potentially including
     * aliases in `original as alias` format if that syntax is preserved through processing.
     *
     * The Set is typically sorted alphabetically when generating import statements
     * for consistent, reproducible output.
     *
     * @example
     * ```ts
     * named: Set([
     *   'Component',
     *   'useCallback',
     *   'ReactNode',
     *   'useState'
     * ])
     * // Generates: import { Component, ReactNode, useCallback, useState } from 'react';
     * ```
     *
     * @since 2.0.0
     */

    named: Set<string>;

    /**
     * The default import from the module, if present.
     *
     * @remarks
     * Stores the identifier from a default import statement: `import Identifier from 'module'`.
     * Optional because not all modules have default exports. When multiple declarations
     * import different default exports from the same module, the first one is retained.
     *
     * This is typically the name used to reference the module's default export.
     *
     * @example
     * ```ts
     * default: 'React' // from: import React from 'react'
     * default: 'express' // from: import express from 'express'
     * default: undefined // no default import
     * ```
     *
     * @since 2.0.0
     */

    default?: string;

    /**
     * Map of namespace imports from the module.
     *
     * @remarks
     * Maps namespace identifiers to the module path for `import * as Name from 'module'`
     * statements. The key is the local identifier, the value is the module specifier.
     *
     * Uses a Map to allow multiple namespace imports from the same module under different
     * identifiers, though this is uncommon. Each namespace import requires its own
     * separate import statement in the generated code.
     *
     * @example
     * ```ts
     * namespace: Map([
     *   ['React', 'react'],
     *   ['lodash', 'lodash'],
     *   ['path', 'path']
     * ])
     * // Generates:
     * // import * as React from 'react';
     * // import * as lodash from 'lodash';
     * // import * as path from 'path';
     * ```
     *
     * @since 2.0.0
     */

    namespace: Map<string, string>;
}

/**
 * Represents collected exports and supporting declarations for a bundle.
 *
 * @remarks
 * This interface aggregates all exports from a set of declarations being bundled,
 * along with generated intermediate declarations needed to support those exports.
 * It's the final result of processing exports from all modules in a bundle.
 *
 * The interface separates exports into three categories:
 * - **Internal exports**: Direct exports and namespace objects created during bundling
 * - **Declarations**: Supporting code that must appear before exports (namespace objects, imports)
 * - **External exports**: Re-exports from external packages that must be preserved as-is
 *
 * This distinction is necessary because:
 * - Internal exports can be deduplicated and combined
 * - External exports must be preserved verbatim to maintain API surface
 * - Declarations have specific ordering requirements (must appear before use)
 *
 * **Usage context**:
 * Used by {@link DeclarationService} during the final bundling phase to:
 * - Generate the final `export { ... }` statement
 * - Include necessary supporting declarations
 * - Preserve re-exports to external packages
 * - Assemble the complete declaration file output
 *
 * @example
 * ```ts
 * // From bundling multiple declarations with:
 * // Direct exports: Component, helper
 * // Namespace: export * as utils from './utils'
 * // External: export { useState } from 'react'
 * // External namespace: export * as React from 'react'
 *
 * const result: BundleExportsResultInterface = {
 *   exports: ['Component', 'helper', 'utils', 'abc'],
 *   declarations: [
 *     'const utils = { utilFn1, utilFn2 };',
 *     'import * as abc from "react";'
 *   ],
 *   externalExports: [
 *     'export { useState } from "react";',
 *     'export * as React from "react";'
 *   ]
 * };
 *
 * // Generated bundle declaration:
 * // const utils = { utilFn1, utilFn2 };
 * // import * as abc from "react";
 * // [bundled content...]
 * // export { Component, helper, utils, abc };
 * // export { useState } from "react";
 * // export * as React from "react";
 * ```
 *
 * @see ModuleImportsInterface
 * @see NamespaceExportsResultInterface
 * @see DeclarationService.collectBundleExports
 *
 * @since 2.0.0
 */

export interface BundleExportsResultInterface {
    /**
     * Array of export names to include in the final export statement.
     *
     * @remarks
     * Contains all names that should be exported from the bundled declaration file.
     * Includes:
     * - Direct exports from declarations
     * - Namespace identifiers for grouped exports
     * - Generated temporary identifiers for external star exports
     *
     * These names should be deduplicated (converted to Set and back to Array) before
     * generating the final export statement to avoid duplicate exports.
     *
     * The names are not necessarily unique across all bundled modules, so deduplication
     * at the point of export statement generation is essential.
     *
     * @example
     * ```ts
     * exports: [
     *   'Component',
     *   'helper',
     *   'utils', // from: export * as utils from './utils'
     *   'xyz' // random name for: export * from 'react'
     * ]
     * ```
     *
     * @since 2.0.0
     */

    exports: Array<string>;

    /**
     * Generated TypeScript declaration statements needed to support exports.
     *
     * @remarks
     * Contains complete, valid TypeScript statements that must be included in the
     * bundled declaration file before the export statement. Includes:
     * - Object literals for namespace grouping: `const utils = { fn1, fn2 };`
     * - Import statements for external star exports: `import * as xyz from "react";`
     * - Nested declarations for complex export hierarchies
     *
     * These declarations reference names that are either imported or collected from
     * bundled declarations, establishing the complete export chain.
     *
     * Order matters: declarations must appear before they're used in export statements.
     *
     * @example
     * ```ts
     * declarations: [
     *   'const utils = { helper, map, filter };',
     *   'const types = { Config, MyType };',
     *   'import * as reactExports from "react";'
     * ]
     * ```
     *
     * @since 2.0.0
     */

    declarations: Array<string>;

    /**
     * Re-export statements for external package modules.
     *
     * @remarks
     * Contains complete re-export statements that must be preserved verbatim in the
     * bundled declaration file. These maintain the module's API surface for exports
     * from external packages:
     * - Named re-exports: `export { useState } from "react";`
     * - Namespace re-exports: `export * as React from "react";`
     * - Star re-exports: `export * from "react";`
     *
     * These are output after the main export statement and cannot be combined or
     * deduplicated since they maintain the explicit re-export structure from the
     * original source files.
     *
     * @example
     * ```ts
     * externalExports: [
     *   'export { useState, useEffect } from "react";',
     *   'export * as React from "react";',
     *   'export { map, filter } from "lodash";'
     * ]
     * ```
     *
     * @since 2.0.0
     */

    externalExports: Array<string>;
}
