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
 * @since 2.0.0
 */

export const formatHost: FormatDiagnosticsHost = {
    getNewLine: () => sys.newLine,
    getCurrentDirectory: sys.getCurrentDirectory,
    getCanonicalFileName: (fileName) => fileName
} as const;
