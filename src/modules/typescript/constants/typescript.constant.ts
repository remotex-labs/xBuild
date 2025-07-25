/**
 * Import will remove at compile time
 */

import type { FormatDiagnosticsHost } from 'typescript';

/**
 * Imports
 */

import { sys } from 'typescript';

/**
 * A host object that provides formatting functionality for typescript diagnostic messages
 *
 * @remarks
 * This constant implements the FormatDiagnosticsHost interface from TypeScript,
 * providing methods needed for proper diagnostic message formatting.
 *
 * @default Uses TypeScript's system utilities for line breaks and directory information
 *
 * @see FormatDiagnosticsHost - The TypeScript interface this implements
 *
 * @since 1.5.9
 */

export const formatHost: FormatDiagnosticsHost = {
    getNewLine: () => sys.newLine,
    getCurrentDirectory: sys.getCurrentDirectory,
    getCanonicalFileName: (fileName) => sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase()
} as const;

/**
 * Header text included at the top of generated declaration bundle files
 *
 * @remarks
 * This constant provides a standardized header comment that prepended to all
 * declaration bundle files generated by the DeclarationBundlerService. The header
 * clearly indicates that the file was automatically generated and should not be
 * edited manually.
 *
 * @example
 * ```ts
 * const bundledContent = `${HeaderDeclarationBundle}${actualContent}`;
 * writeFileSync('dist/index.d.ts', bundledContent);
 * ```
 *
 * @since 1.5.9
 */

export const HeaderDeclarationBundle = `
/**
 * This file was automatically generated by xBuild.
 * DO NOT EDIT MANUALLY.
 */
 `;
