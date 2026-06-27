/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { ParseGlobInterface } from '@components/interfaces/glob-component.interface';

/**
 * Imports
 */

import { cwd } from 'process';
import { readdirSync } from 'fs';
import { matchesGlob } from 'path';

/**
 * Splits glob patterns into include and exclude groups.
 *
 * @param globs - Glob patterns; entries starting with `!` are excluded (with the `!` stripped).
 * @returns The separated `include` and `exclude` pattern arrays.
 *
 * @example
 * ```ts
 * const { include, exclude } = parseGlobs([ '**\/*.ts', '!**\/*.test.ts', '!node_modules/**' ]);
 * // include: [ '**\/*.ts' ]
 * // exclude: [ '**\/*.test.ts', 'node_modules/**' ]
 * ```
 *
 * @since 2.0.0
 */

export function parseGlobs(globs: Array<string>): ParseGlobInterface {
    const include: Array<string> = [];
    const exclude: Array<string> = [];

    for (const glob of globs) {
        if (glob.startsWith('!')) exclude.push(glob.slice(1));
        else include.push(glob);
    }

    return { include, exclude };
}

/**
 * Tests whether a path matches any of the given patterns.
 *
 * @param path - Path to test.
 * @param patterns - Glob patterns to match against.
 * @returns `true` as soon as one pattern matches; otherwise `false`.
 *
 * @remarks
 * Stops at the first match. A pattern matches when it either ends with `path` (a cheap suffix
 * check that lets a literal full path be supplied as a pattern) or satisfies `matchesGlob`.
 *
 * @example
 * ```ts
 * matchesAny('src/app.ts', [ '**\/*.ts' ]);        // true (glob)
 * matchesAny('src/app.ts', [ 'pkg/src/app.ts' ]);  // true (suffix)
 * matchesAny('README.md', [ '**\/*.ts' ]);         // false
 * ```
 *
 * @see matchesGlob
 * @since 2.0.0
 */

export function matchesAny(path: string, patterns: Array<string>): boolean {
    for (const pattern of patterns) {
        if (pattern.endsWith(path) || matchesGlob(path, pattern)) return true;
    }

    return false;
}

/**
 * Determines whether a directory should be skipped during traversal.
 *
 * @param relativePath - Directory path relative to the search base.
 * @param exclude - Exclude glob patterns.
 * @returns `true` if the directory matches any exclude pattern.
 *
 * @remarks
 * Matches both the directory path and the directory with `/**` appended, so a pattern such as
 * `node_modules/**` excludes the `node_modules` directory itself before it is walked.
 *
 * @example
 * ```ts
 * isDirectoryExcluded('node_modules', [ 'node_modules/**' ]); // true
 * isDirectoryExcluded('src', [ 'node_modules/**' ]);          // false
 * ```
 *
 * @see matchesGlob
 * @since 2.0.0
 */

export function isDirectoryExcluded(relativePath: string, exclude: Array<string>): boolean {
    const directoryGlob = `${ relativePath }/**`;

    for (const pattern of exclude) {
        if (matchesGlob(relativePath, pattern) || matchesGlob(directoryGlob, pattern)) return true;
    }

    return false;
}

/**
 * Determines whether a file should be collected.
 *
 * @param relativePath - File path relative to the search base.
 * @param include - Include glob patterns.
 * @param exclude - Exclude glob patterns.
 * @returns `true` when the file matches an include pattern and no exclude pattern.
 *
 * @example
 * ```ts
 * shouldIncludeFile('src/app.ts', [ '**\/*.ts' ], [ '**\/*.test.ts' ]);      // true
 * shouldIncludeFile('src/app.test.ts', [ '**\/*.ts' ], [ '**\/*.test.ts' ]); // false
 * ```
 *
 * @see matchesAny
 * @since 2.0.0
 */

export function shouldIncludeFile(relativePath: string, include: Array<string>, exclude: Array<string>): boolean {
    return matchesAny(relativePath, include) && !matchesAny(relativePath, exclude);
}

/**
 * Removes the extension from a path, considering only the final path segment.
 *
 * @param path - Path whose extension should be stripped.
 * @returns The path without its extension, unchanged when the basename has no extension.
 *
 * @remarks
 * Only a dot inside the basename (after the last `/`, and not its first character) is treated as
 * the extension separator. This preserves dots in directory names and leaves dotfiles intact.
 *
 * @example
 * ```ts
 * stripExtension('errors/uncaught.spec.ts'); // 'errors/uncaught.spec'
 * stripExtension('feature.v2/README');       // 'feature.v2/README' (no basename extension)
 * stripExtension('.gitignore');              // '.gitignore' (dotfile)
 * ```
 *
 * @since 2.6.0
 */

function stripExtension(path: string): string {
    const slashIndex = path.lastIndexOf('/');
    const dotIndex = path.lastIndexOf('.');

    return dotIndex > slashIndex + 1 ? path.slice(0, dotIndex) : path;
}

/**
 * Collects files matching glob patterns from a directory tree.
 *
 * @param baseDir - Directory to search from. Assumed to be the current working directory or a
 *                  descendant of it, so values can be made relative to `process.cwd()`.
 * @param globs - Glob patterns; prefix with `!` to exclude.
 * @returns A record mapping each file's base-relative path **without** extension to its
 *          cwd-relative path **with** extension.
 *
 * @remarks
 * Performs a depth-first walk that:
 * - parses include/exclude patterns once up front;
 * - prunes excluded directories before descending (skipped entirely when there are no excludes);
 * - returns a null-prototype record for O(1), prototype-safe lookups.
 *
 * @example
 * ```ts
 * // file at <cwd>/src/errors/uncaught.spec.ts, baseDir 'src'
 * collectFilesFromGlob('src', [ '**\/*.ts' ]);
 * // { 'errors/uncaught.spec': 'src/errors/uncaught.spec.ts' }
 * ```
 *
 * @see parseGlobs
 * @see shouldIncludeFile
 * @see isDirectoryExcluded
 *
 * @since 2.0.0
 */

export function collectFilesFromGlob(baseDir: string, globs: Array<string>): Record<string, string> {
    const { include, exclude } = parseGlobs(globs);
    const collected: Record<string, string> = Object.create(null);

    const hasExcludes = exclude.length > 0;
    const baseOffset = baseDir.length + 1; // strips "baseDir/"
    const rootOffset = cwd().length + 1;   // strips "<cwd>/"

    const walk = (dir: string): void => {
        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        } catch {
            return; // unreadable directory — skip
        }

        for (const entry of entries) {
            const fullPath = `${ dir }/${ entry.name }`;
            const relativePath = fullPath.slice(baseOffset);

            if (entry.isDirectory()) {
                if (!hasExcludes || !isDirectoryExcluded(relativePath, exclude)) walk(fullPath);
                continue;
            }

            if (shouldIncludeFile(relativePath, include, exclude)) {
                collected[stripExtension(relativePath)] = fullPath.slice(rootOffset);
            }
        }
    };

    walk(baseDir);

    return collected;
}
