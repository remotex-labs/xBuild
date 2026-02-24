/**
 * Import will remove at compile time
 */

import type { CompilerOptions } from 'typescript';

/**
 * Imports
 */

import ts from 'typescript';
import { dirname, relative, toPosix } from '@components/path.component';

/**
 * Matches Unix shebang lines at the beginning of files for removal during compilation.
 *
 * @remarks
 * Matches shebang lines (e.g., `#!/usr/bin/env node`) at the start of files,
 * including optional carriage return and line feed characters for cross-platform compatibility.
 *
 * Pattern breakdown:
 * - `^#!` - Start of line with `#!`
 * - `.*` - Any characters until the end of line
 * - `(\r?\n)?` - Optional CR+LF or LF line ending
 *
 * @example
 * ```ts
 * const content = '#!/usr/bin/env node\nconsole.log("hello");';
 * SHEBANG_REGEX.test(content); // true
 * ```
 *
 * @see {@link removeShebang}
 *
 * @since 2.0.0
 */

export const SHEBANG_REGEX = /^#!.*(\r?\n)?/;

/**
 * Matches empty export statements that should be removed from declaration files.
 *
 * @remarks
 * Matches TypeScript empty export statements (`export {};`) which are often
 * generated during compilation but are invalid in final declaration files.
 *
 * Pattern breakdown:
 * - `export {};` - Literal empty export statement
 * - `\n?` - Optional trailing newline
 *
 * The global flag ensures all occurrences are matched throughout the content.
 *
 * @example
 * ```ts
 * const content = 'export {};\nexport const x = 1;';
 * EMPTY_EXPORT_REGEX.test(content); // true
 * ```
 *
 * @see {@link removeEmptyExports}
 *
 * @since 2.0.0
 */

export const EMPTY_EXPORT_REGEX = /export {};\n?/g;

/**
 * Matches orphaned JSDoc comment blocks that are not associated with any declaration.
 *
 * @remarks
 * Matches consecutive JSDoc comment blocks that appear without associated declarations.
 * These orphaned comments commonly appear in bundled files where comments are preserved
 * during bundling but lose their associated declarations.
 *
 * Pattern breakdown:
 * - `(?:\/\*\*[\s\S]*?\*\/\s*)+` - One or more JSDoc blocks with the following whitespace (non-capturing)
 * - `(\/\*\*[\s\S]*?\*\/)` - Final JSDoc block (captured for potential reuse)
 *
 * The captured group allows preserving the last comment if needed during replacement.
 *
 * @example
 * ```ts
 * const content = '/** Comment 1 *\/\n/** Comment 2 *\/\nexport const x = 1;';
 * ORPHAN_COMMENT_REGEX.test(content); // true
 * ```
 *
 * @see {@link removeOrphanComments}
 *
 * @since 2.0.0
 */

export const ORPHAN_COMMENT_REGEX = /(?:\/\*\*[\s\S]*?\*\/\s*)+(\/\*\*[\s\S]*?\*\/)/g;

/**
 * Matches export modifiers on declarations for removal while preserving the declarations themselves.
 *
 * @remarks
 * Matches the `export` keyword (and optional `default`) at the start of lines
 * in declaration files. Used to strip export modifiers while preserving the
 * declaration itself when consolidating exports.
 *
 * Pattern breakdown:
 * - `^export` - Export keyword at line start (multiline mode)
 * - `\s+` - Required whitespace after export
 * - `(?:default\s+)?` - Optional default keyword with whitespace
 *
 * The multiline flag (`m`) ensures `^` matches line starts throughout the content.
 *
 * @example
 * ```ts
 * const content = 'export interface Config { x: number; }';
 * content.replace(EXPORT_MODIFIER_REGEX, ''); // 'interface Config { x: number; }'
 * ```
 *
 * @see {@link removeExportModifiers}
 *
 * @since 2.0.0
 */

export const EXPORT_MODIFIER_REGEX = /^export\s+(?:default\s+)?/gm;

/**
 * Matches single-line trailing JSDoc comment blocks at the end of lines for removal.
 *
 * @remarks
 * Matches JSDoc comment blocks that appear at the end of lines, including
 * surrounding whitespace. Used to clean up documentation comments that are
 * misplaced or unnecessary in bundled output.
 *
 * Pattern breakdown:
 * - `\s*` - Leading whitespace
 * - `\/\*\*[^\\r\\n]*?\*\/` - Single-line JSDoc comment block (no line breaks)
 * - `\s*$` - Trailing whitespace and end of line
 *
 * @example
 * ```ts
 * const content = 'const x = 1; /** Documentation *\/';
 * TRAILING_COMMENT_REGEX.test(content); // true
 * ```
 *
 * @see {@link removeOrphanComments}
 *
 * @since 2.0.0
 */

export const TRAILING_COMMENT_REGEX = /(?<=[:;,{}\[\]()\w"'`])[ \t]*\/\*\*[^\r\n]*?\*\/[ \t]*$/gm;

/**
 * Removes shebang line from the beginning of file content.
 *
 * @param content - The file content to process
 *
 * @returns Content with shebang line removed, or unchanged if no shebang present
 *
 * @remarks
 * Removes Unix shebang lines (e.g., `#!/usr/bin/env node`) from the start of files.
 * Uses character code checks for performance (35 = '#', 33 = '!'), avoiding regex
 * execution for files that don't have shebangs.
 *
 * Shebang lines are typically only present in executable scripts and are not valid
 * in declaration files or bundled TypeScript code.
 *
 * @example
 * ```ts
 * const withShebang = '#!/usr/bin/env node\nconsole.log("hello");';
 * const cleaned = removeShebang(withShebang);
 * // 'console.log("hello");'
 * ```
 *
 * @see {@link cleanContent}
 * @see {@link SHEBANG_REGEX}
 *
 * @since 2.0.0
 */

export function removeShebang(content: string): string {
    // 35 = '#', 33 = '!'
    return (content.charCodeAt(0) === 35 && content.charCodeAt(1) === 33)
        ? content.replace(SHEBANG_REGEX, '')
        : content;
}

/**
 * Removes empty export statements from file content.
 *
 * @param content - The file content to process
 *
 * @returns Content with all empty export statements removed
 *
 * @remarks
 * Removes `export {};` statements which TypeScript often generates to mark
 * a file as an ES module without exporting anything. These statements are invalid
 * in declaration files and should be removed during compilation.
 *
 * Performs a quick string check before applying the regex for performance optimization.
 *
 * @example
 * ```ts
 * const content = 'export {};\nexport const x = 1;';
 * const cleaned = removeEmptyExports(content);
 * // 'export const x = 1;'
 * ```
 *
 * @see {@link cleanContent}
 * @see {@link EMPTY_EXPORT_REGEX}
 *
 * @since 2.0.0
 */

export function removeEmptyExports(content: string): string {
    return content.includes('export {}')
        ? content.replace(EMPTY_EXPORT_REGEX, '')
        : content;
}

/**
 * Removes orphaned and trailing JSDoc comment blocks from file content.
 *
 * @param content - The file content to process
 *
 * @returns Content with orphaned and trailing comments removed
 *
 * @remarks
 * Performs two sequential cleaning operations:
 * 1. Removes trailing JSDoc comments at the end of lines
 * 2. Removes orphaned JSDoc blocks (comments not associated with declarations)
 *
 * Orphaned comments commonly appear in bundled files where comments are preserved
 * during bundling but lose their associated declarations due to tree shaking or
 * module consolidation.
 *
 * The replacement pattern `'$1'` preserves the last comment in a sequence of orphaned
 * comments if it might still be associated with a declaration.
 *
 * @example
 * ```ts
 * const content = '/** Orphan *\/\n/** Doc *\/\nexport const x = 1;';
 * const cleaned = removeOrphanComments(content);
 * // Removes orphaned comments while preserving declaration-associated ones
 * ```
 *
 * @see {@link cleanContent}
 * @see {@link ORPHAN_COMMENT_REGEX}
 * @see {@link TRAILING_COMMENT_REGEX}
 *
 * @since 2.0.0
 */

export function removeOrphanComments(content: string): string {
    content = content.replace(TRAILING_COMMENT_REGEX, '');

    return content.replace(ORPHAN_COMMENT_REGEX, '$1');
}

/**
 * Removes export modifiers from all declarations while preserving the declarations themselves.
 *
 * @param content - The file content to process
 *
 * @returns Content with export modifiers removed from all declarations
 *
 * @remarks
 * Strips `export` and `export default` keywords from declarations, transforming:
 * - `export const x = 1;` → `const x = 1;`
 * - `export default interface Config {}` → `interface Config {}`
 * - `export function foo() {}` → `function foo() {}`
 *
 * This transformation is used when bundling declarations to remove export modifiers
 * from internal declarations that will be consolidated into a single export list or
 * re-exported through a barrel file.
 *
 * @example
 * ```ts
 * const content = 'export const x = 1;\nexport function foo() {}';
 * const cleaned = removeExportModifiers(content);
 * // 'const x = 1;\nfunction foo() {}'
 * ```
 *
 * @see {@link cleanContent}
 * @see {@link EXPORT_MODIFIER_REGEX}
 *
 * @since 2.0.0
 */

export function removeExportModifiers(content: string): string {
    return content.replace(EXPORT_MODIFIER_REGEX, '');
}

/**
 * Checks whether file content contains elements that require cleaning.
 *
 * @param content - The file content to check
 *
 * @returns `true` if content requires cleaning operations, `false` otherwise
 *
 * @remarks
 * Performs quick checks to determine if cleaning operations are necessary:
 * - Checks for shebang (character code 35 = '#')
 * - Checks for empty export statements
 * - Checks for JSDoc comments
 *
 * Used to short-circuit expensive cleaning operations when content doesn't need
 * processing, improving performance on already-clean files.
 *
 * @example
 * ```ts
 * needsCleaning('export const x = 1;'); // false
 * needsCleaning('#!/bin/bash\nexport const x = 1;'); // true
 * needsCleaning('export {};\nexport const x = 1;'); // true
 * needsCleaning('/** Doc *\/\nexport const x = 1;'); // true
 * ```
 *
 * @see {@link cleanContent}
 *
 * @since 2.0.0
 */

export function needsCleaning(content: string): boolean {
    return content.charCodeAt(0) === 35 || // '#' for shebang
        content.includes('export {}') ||
        content.includes('/**');
}

/**
 * Applies all cleaning transformations to file content in sequence.
 *
 * @param content - The file content to clean
 *
 * @returns Cleaned content with all transformations applied
 *
 * @remarks
 * Applies cleaning operations in the following order:
 * 1. Short-circuit check using {@link needsCleaning} for performance
 * 2. Removes shebang lines
 * 3. Removes empty export statements
 * 4. Removes orphaned JSDoc comments
 *
 * Typically applied to declaration files during emission or bundling to remove
 * artifacts that are not valid in `.d.ts` files or that clutter bundled output.
 * The sequential application ensures all unwanted elements are removed while
 * preserving valid TypeScript declarations.
 *
 * @example
 * ```ts
 * const raw = `#!/usr/bin/env node
 * /**
 *  * Orphaned comment
 *  *\/
 * export {};
 * export const x = 1;`;
 *
 * const cleaned = cleanContent(raw);
 * // 'export const x = 1;'
 * ```
 *
 * @see {@link needsCleaning}
 * @see {@link removeShebang}
 * @see {@link removeEmptyExports}
 * @see {@link removeOrphanComments}
 *
 * @since 2.0.0
 */

export function cleanContent(content: string): string {
    if (!needsCleaning(content)) return content;

    content = removeShebang(content);
    content = removeEmptyExports(content);
    content = removeOrphanComments(content);

    return content;
}


/**
 * Calculates the output file path for a compiled TypeScript declaration file.
 *
 * @param sourcePath - The source TypeScript file path
 * @param options - TypeScript compiler options containing output directory settings
 *
 * @returns The normalized output path for the declaration file with forward slashes
 *
 * @remarks
 * Determines an output path using the following logic:
 * 1. Selects output base: `declarationDir` `>` `outDir` `>` source directory
 * 2. Selects root directory: `rootDir` `>` source directory
 * 3. Computes a relative path from root to a source file
 * 4. Changes file extension from `.ts`/`.tsx` to `.d.ts`
 * 5. Combines an output base path with the output file name
 * 6. Resolves a full path and normalizes to forward slashes
 *
 * Path resolution example:
 * - Source: `/project/src/components/Button.tsx`
 * - Root: `/project/src`
 * - Relative: `components/Button.tsx`
 * - Output file: `components/Button.d.ts`
 * - Final: `/project/dist/components/Button.d.ts`
 *
 * @example
 * ```ts
 * const sourcePath = '/project/src/index.ts';
 * const options: CompilerOptions = {
 *   outDir: 'dist',
 *   rootDir: 'src'
 * };
 *
 * const outputPath = calculateOutputPath(sourcePath, options);
 * // '/project/dist/index.d.ts'
 * ```
 *
 * @example
 * ```ts
 * // With declarationDir override
 * const options: CompilerOptions = {
 *   outDir: 'dist',
 *   declarationDir: 'types',
 *   rootDir: 'src'
 * };
 *
 * const outputPath = calculateOutputPath(sourcePath, options);
 * // '/project/types/index.d.ts'
 * ```
 *
 * @see {@link EmitterService}
 * @see {@link BundlerService}
 *
 * @since 2.0.0
 */

export function calculateOutputPath(sourcePath: string, options: CompilerOptions): string {
    const { outDir, rootDir, declarationDir } = options;

    const outputBase = declarationDir || outDir || dirname(sourcePath);
    const root = rootDir || dirname(sourcePath);

    const relativePath = relative(root, sourcePath);
    const outputFileName = relativePath.replace(/\.tsx?$/, '.d.ts');
    const fullPath = ts.sys.resolvePath(`${ outputBase }/${ outputFileName }`);

    return toPosix(fullPath);
}
