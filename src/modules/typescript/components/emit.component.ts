/**
 * Import will remove at compile time
 */

import type { LanguageHostService } from '@typescript/services/language-host.service';
import type { CompilerOptions, LanguageService, Program, SourceFile } from 'typescript';

/**
 * Imports
 */

import ts from 'typescript';
import { dirname } from 'path';
import { relative } from 'path/posix';
import { mkdir, writeFile } from 'fs/promises';

/**
 * Constants
 */

export const SHEBANG_REGEX = /^#!.*(\r?\n)?/;
export const EMPTY_EXPORT_REGEX = /export {};\n?/g;
export const ORPHAN_COMMENT_REGEX = /(?:\/\*\*[\s\S]*?\*\/\s*)+(\/\*\*[\s\S]*?\*\/)/g;
export const EXPORT_MODIFIER_REGEX = /^export\s+(?:default\s+)?/gm;
export const TRAILING_COMMENT_REGEX = /\s*\/\*\*[\s\S]*?\*\/\s*$/g;

/**
 * Removes shebang lines from file content.
 *
 * @param content - The file content to process.
 * @returns The content with shebang removed, or the original content if no shebang is present.
 *
 * @remarks
 * A shebang is a special comment line that starts with `#!` and appears at the
 * beginning of executable scripts to indicate which interpreter should be used.
 * Common in Node.js CLI tools (e.g., `#!/usr/bin/env node`).
 *
 * This function performs a fast check by examining the first two characters:
 * - Character code 35 = `#`
 * - Character code 33 = `!`
 *
 * If a shebang is detected, it's removed using {@link SHEBANG_REGEX}. Otherwise,
 * the original content is returned unchanged, avoiding unnecessary regex operations.
 *
 * Shebangs must be removed from declaration files since:
 * - They are not valid TypeScript syntax in `.d.ts` files
 * - They serve no purpose in type definitions
 * - They can cause parsing errors in some tools
 *
 * @example
 * ```ts
 * const content1 = '#!/usr/bin/env node\nexport const x = 1;';
 * console.log(removeShebang(content1));
 * // Output: 'export const x = 1;'
 *
 * const content2 = 'export const x = 1;';
 * console.log(removeShebang(content2));
 * // Output: 'export const x = 1;' (unchanged)
 * ```
 *
 * @see SHEBANG_REGEX
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
 * @param content - The file content to process.
 * @returns The content with empty exports removed, or the original content if none are present.
 *
 * @remarks
 * TypeScript sometimes generates `export {}` statements to ensure a file is treated
 * as a module (rather than a script). These empty exports serve no purpose in
 * declaration files and can be safely removed to produce cleaner output.
 *
 * This function performs a fast string check using `includes()` before applying
 * the regex, avoiding unnecessary regex operations when no empty exports exist.
 *
 * Empty exports are typically generated when:
 * - A file has only type declarations without exports
 * - TypeScript needs to mark a file as a module for isolation
 * - A file uses `import` but doesn't export anything
 *
 * @example
 * ```ts
 * const content1 = 'interface User {}\nexport {}';
 * console.log(removeEmptyExports(content1));
 * // Output: 'interface User {}'
 *
 * const content2 = 'export const x = 1;';
 * console.log(removeEmptyExports(content2));
 * // Output: 'export const x = 1;' (unchanged)
 * ```
 *
 * @see EMPTY_EXPORT_REGEX
 *
 * @since 2.0.0
 */

export function removeEmptyExports(content: string): string {
    return content.includes('export {}')
        ? content.replace(EMPTY_EXPORT_REGEX, '')
        : content;
}

/**
 * Removes orphaned and trailing JSDoc comments from file content.
 *
 * @param content - The file content to process.
 * @returns The content with orphaned comments removed.
 *
 * @remarks
 * This function cleans up documentation comments that have become disconnected
 * from their associated declarations, typically occurring when:
 * - Import/export statements are removed
 * - Code is restructured during bundling
 * - Declarations are filtered out, but their comments remain
 *
 * The function performs two cleanup operations:
 * 1. Removes trailing comments at the end of the file
 * 2. Removes orphaned comments that appear between other elements
 *
 * Orphaned comments create visual clutter and can be misleading since they
 * no longer document anything. This is especially important in bundled
 * declaration files where multiple sources are combined.
 *
 * @example
 * ```ts
 * const content = `
 * /**
 *  * This function was removed
 *  *\/
 *
 * /**
 *  * This interface exists
 *  *\/
 * interface User {}
 *
 * /**
 *  * Trailing orphan comment
 *  *\/
 * `;
 *
 * console.log(removeOrphanComments(content));
 * // Output: Only the User interface with its comment remains
 * ```
 *
 * @see TRAILING_COMMENT_REGEX
 * @see ORPHAN_COMMENT_REGEX
 *
 * @since 2.0.0
 */

export function removeOrphanComments(content: string): string {
    content = content.replace(TRAILING_COMMENT_REGEX, '');

    return content.replace(ORPHAN_COMMENT_REGEX, '$1');
}

/**
 * Removes export modifiers from declarations while preserving the declarations themselves.
 *
 * @param content - The file content to process.
 * @returns The content with export keywords removed from declarations.
 *
 * @remarks
 * This function strips the `export` keyword from TypeScript declarations, converting
 * them to internal (non-exported) declarations. This is useful when:
 * - Creating bundled declaration files where exports are consolidated
 * - Internalizing declarations that will be re-exported elsewhere
 * - Building a single namespace where internal visibility is desired
 *
 * The function handles various export patterns:
 * - `export interface User {}` → `interface User {}`
 * - `export class Service {}` → `class Service {}`
 * - `export type ID = string` → `type ID = string`
 * - `export const x = 1` → `const x = 1`
 * - `export declare const x: number` → `declare const x: number`
 *
 * After removing export modifiers, declarations remain valid TypeScript but are
 * no longer part of the public API. A separate export statement can then be added
 * to selectively re-export only the desired symbols.
 *
 * @example
 * ```ts
 * const content = `
 * export interface User {
 *   id: string;
 * }
 * export class Service {}
 * export type ID = string;
 * `;
 *
 * console.log(removeExportModifiers(content));
 * // Output:
 * // interface User {
 * //   id: string;
 * // }
 * // class Service {}
 * // type ID = string;
 * ```
 *
 * @see EXPORT_MODIFIER_REGEX
 *
 * @since 2.0.0
 */

export function removeExportModifiers(content: string): string {
    return content.replace(EXPORT_MODIFIER_REGEX, '');
}

/**
 * Resolves a module name to its absolute file path using TypeScript's module resolution.
 *
 * @param options - TypeScript compiler options that affect module resolution.
 * @param moduleName - The module name to resolve (e.g., './utils', '\@types/node', 'lodash').
 * @param containingFile - The absolute path of the file containing the import statement.
 * @returns The resolved absolute file path, or `undefined` if the module cannot be resolved.
 *
 * @remarks
 * This function delegates to TypeScript's built-in module resolution algorithm, which:
 * - Resolves relative imports (e.g., `./module`, `../utils`)
 * - Resolves node_modules packages (e.g., `react`, `lodash`)
 * - Handles path mappings from tsconfig.json (e.g., `@/*` → `src/*`)
 * - Applies module resolution strategy (Node, Classic, Node16, etc.)
 * - Respects compiler options like `baseUrl`, `paths`, and `moduleResolution`
 *
 * The resolution process considers:
 * - File extensions (.ts, .tsx, .d.ts, .js, .jsx)
 * - Index files (index.ts, index.d.ts)
 * - Package.json exports and types fields
 * - TypeScript's configured module resolution strategy
 *
 * @example
 * ```ts
 * // Resolve a relative import
 * const path1 = resolveModuleName(
 *   compilerOptions,
 *   './utils/helper',
 *   '/project/src/index.ts'
 * );
 * // Returns: '/project/src/utils/helper.ts'
 *
 * // Resolve a package import
 * const path2 = resolveModuleName(
 *   compilerOptions,
 *   'lodash',
 *   '/project/src/index.ts'
 * );
 * // Returns: '/project/node_modules/lodash/lodash.d.ts'
 *
 * // Resolve with path mapping
 * const path3 = resolveModuleName(
 *   compilerOptions,
 *   '@/components/Button',
 *   '/project/src/index.ts'
 * );
 * // Returns: '/project/src/components/Button.ts'
 *
 * // Failed resolution
 * const path4 = resolveModuleName(
 *   compilerOptions,
 *   './non-existent',
 *   '/project/src/index.ts'
 * );
 * // Returns: undefined
 * ```
 *
 * @see CompilerOptions
 * @see ts.resolveModuleName
 *
 * @since 2.0.0
 */

export function resolveModuleName(options: CompilerOptions, moduleName: string, containingFile: string): string | undefined {
    const resolved = ts.resolveModuleName(
        moduleName, containingFile, options, ts.sys
    );

    return resolved.resolvedModule?.resolvedFileName;
}

/**
 * Determines whether a source file should be emitted based on its state and type.
 * The {@link LanguageHostService} instance providing file tracking capabilities.

 * @param file - The source file to check for emission eligibility.
 * @param program - The TypeScript program containing the source file.
 * @param force - If `true`, bypasses the touch check and forces emission regardless of file state.
 * @returns `true` if the file should be emitted, otherwise `false`.
 *
 * @remarks
 * This function implements a three-tier filtering strategy to determine if a file
 * needs compilation output. A file is eligible for emission only if it passes all
 * the following criteria:
 *
 * 1. **Not a Declaration File**: Excludes `.d.ts` files since they are already type declarations
 * 2. **Not External**: Excludes files from external libraries (node_modules, etc.)
 * 3. **Touched or Forced**: Either the file has been modified since the last analysis, or force mode is enabled
 *
 * The touch check uses {@link LanguageHostService.isTouched} to determine if the file
 * has changed since its last analysis. This enables efficient incremental compilation
 * by only emitting files that have actually been modified.
 *
 * @example
 * ```ts
 * const languageHost = new LanguageHostService(compilerOptions);
 * const program = languageService.getProgram();
 *
 * // Incremental compilation - only changed files
 * for (const file of program.getSourceFiles()) {
 *   if (shouldEmitFile.call(languageHost, file, program, false)) {
 *     // Emit this file
 *     program.emit(file);
 *   }
 * }
 *
 * // Force full rebuild - all source files
 * for (const file of program.getSourceFiles()) {
 *   if (shouldEmitFile.call(languageHost, file, program, true)) {
 *     // Emit this file regardless of touch state
 *     program.emit(file);
 *   }
 * }
 *
 * // Check specific file
 * const file = program.getSourceFile('src/index.ts');
 * if (file && shouldEmitFile.call(languageHost, file, program, false)) {
 *   console.log('File needs emission');
 * }
 * ```
 *
 * @see Program
 * @see SourceFile
 * @see LanguageHostService
 * @see LanguageHostService.isTouched
 *
 * @since 2.0.0
 */

export function shouldEmitFile(this: LanguageHostService, file: SourceFile, program: Program, force: boolean): boolean {
    return !file.isDeclarationFile &&
        !program.isSourceFileFromExternalLibrary(file) &&
        (force || this.isTouched(file.fileName));
}

/**
 * Performs a fast check to determine if content requires cleaning operations.
 *
 * @param content - The file content to check.
 * @returns `true` if the content contains elements that need cleaning, otherwise `false`.
 *
 * @remarks
 * This function provides a performance optimization by quickly detecting whether
 * content requires any cleaning operations before applying expensive regex transformations.
 * It checks for three common patterns that indicate cleaning is needed:
 *
 * 1. **Shebang**: Character code 35 (`#`) at position 0 indicates a shebang line
 * 2. **Empty Exports**: Presence of `export {}` statements
 * 3. **JSDoc Comments**: Presence of `/**` which may include orphaned comments
 *
 * By using fast string operations (`charCodeAt`, `includes`) instead of regex,
 * this function can quickly filter out content that doesn't need processing,
 * improving overall performance in scenarios where most files are already clean.
 *
 * Use this function as a gate before applying cleaning operations:
 * - If it returns `false`, skip all cleaning operations
 * - If it returns `true`, proceed with appropriate cleaning functions
 *
 * @example
 * ```ts
 * const content1 = '#!/usr/bin/env node\nexport const x = 1;';
 * console.log(needsCleaning(content1)); // true (has shebang)
 *
 * const content2 = 'interface User {}\nexport {}';
 * console.log(needsCleaning(content2)); // true (has empty export)
 *
 * const content3 = '/** JSDoc *\/\nexport const x = 1;';
 * console.log(needsCleaning(content3)); // true (has JSDoc)
 *
 * const content4 = 'export const x = 1;';
 * console.log(needsCleaning(content4)); // false (no cleaning needed)
 *
 * // Efficient cleaning workflow
 * if (needsCleaning(content)) {
 *   content = removeShebang(content);
 *   content = removeEmptyExports(content);
 *   content = removeOrphanComments(content);
 * }
 * ```
 *
 * @see removeShebang
 * @see removeEmptyExports
 * @see removeOrphanComments
 *
 * @since 2.0.0
 */

export function needsCleaning(content: string): boolean {
    return content.charCodeAt(0) === 35 || // '#' for shebang
        content.includes('export {}') ||
        content.includes('/**');
}

/**
 * Cleans declaration file content by removing unnecessary elements.
 *
 * @param content - The file contents to clean.
 * @returns The cleaned content with shebang, empty exports, and orphaned comments removed.
 *
 * @remarks
 * This function provides a convenient, optimized pipeline for cleaning declaration
 * file content. It performs a fast pre-check using {@link needsCleaning} to avoid
 * unnecessary processing when the content is already clean.
 *
 * The cleaning process applies the following transformations in order:
 * 1. **Shebang Removal**: Strips `#!/usr/bin/env node` and similar lines
 * 2. **Empty Export Removal**: Removes `export {}` statements
 * 3. **Orphan Comment Removal**: Cleans up disconnected JSDoc comments
 *
 * The order of operations is important:
 * - Shebang must be removed first (can only appear at the start of a file)
 * - Empty exports are removed to clean up module markers
 * - Orphan comments are removed last to catch comments orphaned by previous steps
 *
 * Performance optimization:
 * - If {@link needsCleaning} returns `false`, the original content is returned immediately
 * - This avoids three regex operations when no cleaning is needed
 * - Significantly improves performance when processing many already-clean files
 *
 * Use cases:
 * - Cleaning generated declaration files before bundling
 * - Post-processing TypeScript compiler output
 * - Preparing declaration files for distribution
 * - Normalizing declaration content across multiple sources
 *
 * @example
 * ```ts
 * const dirtyContent = `#!/usr/bin/env node
 *
 * /**
 *  * Orphaned comment
 *  *\/
 *
 * /**
 *  * Valid interface documentation
 *  *\/
 * export interface User {
 *   id: string;
 * }
 *
 * export {}
 * `;
 *
 * const clean = cleanContent(dirtyContent);
 * // Output:
 * // /**
 * //  * Valid interface documentation
 * //  *\/
 * // export interface User {
 * //   id: string;
 * // }
 *
 * // Already clean content (fast path)
 * const cleanContent2 = 'export interface User { id: string; }';
 * const result = cleanContent(cleanContent2);
 * // Returns immediately without regex operations
 * ```
 *
 * @see needsCleaning
 * @see removeShebang
 * @see removeEmptyExports
 * @see removeOrphanComments
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
 * Resolves path aliases in import/export statements to relative file paths.
 *
 * @param aliasRegex - Regular expression that matches import/export statements with aliased paths.
 * @param content - The file content containing import/export statements to resolve.
 * @param sourceFile - The source file being processed (provides context for relative path resolution).
 * @param options - TypeScript compiler options containing path mapping configuration.
 * @returns The content with all aliased paths replaced by relative paths.
 *
 * @remarks
 * This function transforms path aliases defined in `tsconfig.json` (via the `paths` option)
 * into relative file paths suitable for declaration files. This is necessary because:
 * - Declaration files should use relative imports for portability
 * - Path aliases are resolved at compile time and won't work for consumers
 * - Type definitions need to reference actual file locations
 *
 * The resolution process:
 * 1. Finds all import/export statements matching the alias pattern
 * 2. Resolves each aliased path to its absolute file location
 * 3. Converts `.ts`/`.tsx` extensions to `.d.ts`
 * 4. Calculates the relative path from the source file to the target
 * 5. Ensures relative paths start with `./` or `../`
 *
 * Common path alias patterns:
 * - `@/*` → `src/*` (common root alias)
 * - `@components/*` → `src/components/*` (scoped alias)
 * - `@utils/*` → `src/utils/*` (utility alias)
 *
 * If a path cannot be resolved (module not found), the original import is preserved unchanged.
 *
 * @example
 * ```ts
 * // tsconfig.json has: { "paths": { "@/*": ["src/*"] } }
 * const aliasRegex = /from\s+['"](@\/[^'"]*)['"]/g;
 * const content = `
 * import { User } from '@/types/user';
 * export { Service } from '@/services/api';
 * `;
 *
 * const sourceFile = program.getSourceFile('src/controllers/auth.ts');
 * const resolved = resolveAliases(aliasRegex, content, sourceFile, options);
 *
 * // Output:
 * // import { User } from '../types/user';
 * // export { Service } from '../services/api';
 *
 * // Path that can't be resolved remains unchanged
 * const content2 = `import { X } from '@/nonexistent';`;
 * const result = resolveAliases(aliasRegex, content2, sourceFile, options);
 * // Output: import { X } from '@/nonexistent'; (unchanged)
 * ```
 *
 * @see SourceFile
 * @see CompilerOptions
 * @see resolveModuleName
 *
 * @since 2.0.0
 */

export function resolveAliases(aliasRegex: RegExp, content: string, sourceFile: SourceFile, options: CompilerOptions): string {
    return content.replace(aliasRegex, (match, importPath) => {
        const resolve = resolveModuleName(options, importPath, sourceFile.fileName);
        if (!resolve) return match;

        const targetFile = resolve.replace(/\.tsx?$/, '.d.ts');
        const relativePath = relative(dirname(sourceFile.fileName), targetFile);

        return match.replace(importPath, relativePath.startsWith('.') ? relativePath : './' + relativePath);
    });
}

/**
 * Emits a cleaned and resolved declaration file for a single source file.
 * The {@link LanguageService} instance used to generate declaration output.

 * @param sourceFile - The source file to emit declarations for.
 * @param options - TypeScript compiler options used for module resolution.
 * @param aliasRegex - Regular expression for matching and resolving path aliases.
 * @returns A promise that resolves when the declaration file has been written to disk.
 *
 * @remarks
 * This function provides a complete pipeline for generating, cleaning, and writing
 * a single declaration file. It leverages the TypeScript language service to generate
 * the initial `.d.ts` output, then applies post-processing transformations before
 * writing to disk.
 *
 * The emission process follows these steps:
 * 1. **Generate**: Uses {@link LanguageService.getEmitOutput} to generate declaration content
 * 2. **Validate**: Checks if `emission` was skipped (e.g., due to errors or configuration)
 * 3. **Clean**: Removes shebang, empty exports, and orphaned comments via {@link cleanContent}
 * 4. **Resolve**: Converts path aliases to relative paths via {@link resolveAliases}
 * 5. **Write**: Creates output directory and writes the final declaration file
 *
 * The function silently returns if:
 * - Emission was skipped by TypeScript (compilation errors, excluded files, etc.)
 * - No output files were generated
 *
 * File system operations:
 * - Output directory is created recursively if it doesn't exist
 * - Content is written with UTF-8 encoding
 * - Existing files are overwritten
 *
 * This function is designed to work with `LanguageService` as the `this` context,
 * allowing it to access the language service's `emit` capabilities.
 *
 * @example
 * ```ts
 * const languageService = ts.createLanguageService(host);
 * const program = languageService.getProgram();
 * const aliasRegex = /from\s+['"](@\/[^'"]*)['"]/g;
 *
 * // Emit declaration for a single file
 * const sourceFile = program.getSourceFile('src/index.ts');
 * if (sourceFile) {
 *   await emitSingleDeclaration.call(
 *     languageService,
 *     sourceFile,
 *     compilerOptions,
 *     aliasRegex
 *   );
 *   // Output: dist/index.d.ts (cleaned and resolved)
 * }
 *
 * // Emit declarations for all source files
 * const files = program.getSourceFiles()
 *   .filter(f => !f.isDeclarationFile);
 *
 * await Promise.all(
 *   files.map(file =>
 *     emitSingleDeclaration.call(
 *       languageService,
 *       file,
 *       compilerOptions,
 *       aliasRegex
 *     )
 *   )
 * );
 * ```
 *
 * @see SourceFile
 * @see cleanContent
 * @see resolveAliases
 * @see CompilerOptions
 * @see LanguageService
 *
 * @since 2.0.0
 */

export async function emitSingleDeclaration(this: LanguageService, sourceFile: SourceFile, options: CompilerOptions, aliasRegex?: RegExp): Promise<void> {
    const output = this.getEmitOutput(sourceFile.fileName, true, true);
    if (output.emitSkipped) return;

    let content = output.outputFiles[0].text;
    const fileName = output.outputFiles[0].name;

    content = cleanContent(content);
    if(aliasRegex) content = resolveAliases(aliasRegex, content, sourceFile, options);

    await mkdir(dirname(fileName), { recursive: true });
    await writeFile(fileName, content, 'utf8');
}
