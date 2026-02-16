/**
 * Import will remove at compile time
 */

import type { ParseGlobInterface } from '@components/interfaces/glob-component.interface';

/**
 * Imports
 */

import { cwd } from 'process';
import { readdirSync } from 'fs';
import { matchesGlob } from 'path';
import { join } from '@components/path.component';

/**
 * Separates glob patterns into include and exclude arrays.
 *
 * @param globs - Array of glob patterns (patterns starting with '!' are treated as excludes)
 * @returns Object containing separate include and exclude pattern arrays
 *
 * @example
 * ```ts
 * const { include, exclude } = parseGlobs([
 *   '**\/*.ts',
 *   '!**\/*.test.ts',
 *   '**\/*.js',
 *   '!node_modules/**'
 * ]);
 * // include: ['**\/*.ts', '**\/*.js']
 * // exclude: ['**\/*.test.ts', 'node_modules/**']
 * ```
 *
 * @since 2.0.0
 */

export function parseGlobs(globs: Array<string>): ParseGlobInterface {
    const include: Array<string> = [];
    const exclude: Array<string> = [];

    for (const g of globs) {
        if (g.startsWith('!')) {
            exclude.push(g.slice(1));
        } else {
            include.push(g);
        }
    }

    return { include, exclude };
}

/**
 * Checks if a path matches any pattern in the provided array.
 *
 * @param p - Path to test against patterns
 * @param patterns - Array of glob patterns to match against
 * @returns True if a path matches at least one pattern, false otherwise
 *
 * @remarks
 * Uses early exit optimization - stops checking as soon as a match is found.
 *
 * @example
 * ```ts
 * matchesAny('src/app.ts', ['**\/*.ts', '**\/*.js']); // true
 * matchesAny('README.md', ['**\/*.ts', '**\/*.js']); // false
 * ```
 *
 * @see matchesGlob
 * @since 2.0.0
 */

export function matchesAny(p: string, patterns: Array<string>): boolean {
    for (const pattern of patterns) {
        if (matchesGlob(p, pattern)) return true;
    }

    return false;
}

/**
 * Determines if a directory should be excluded from traversal.
 *
 * @param relativePath - Relative path of the directory to check
 * @param exclude - Array of glob patterns for exclusion
 * @returns True if directory matches any exclude pattern, false otherwise
 *
 * @remarks
 * Checks both the directory path itself and the directory with `/**` appended
 * to properly handle patterns like `node_modules/**`.
 *
 * @example
 * ```ts
 * isDirectoryExcluded('node_modules', ['node_modules/**']); // true
 * isDirectoryExcluded('src', ['node_modules/**']); // false
 * ```
 *
 * @see matchesGlob
 * @since 2.0.0
 */

export function isDirectoryExcluded(relativePath: string, exclude: Array<string>): boolean {
    const dirWithGlob = relativePath + '/**';

    for (const pattern of exclude) {
        if (matchesGlob(relativePath, pattern) || matchesGlob(dirWithGlob, pattern)) {
            return true;
        }
    }

    return false;
}


/**
 * Determines if a file should be included based on include and exclude patterns.
 *
 * @param relativePath - Relative path of the file to check
 * @param include - Array of glob patterns for inclusion
 * @param exclude - Array of glob patterns for exclusion
 * @returns True if file matches include patterns and not exclude patterns, false otherwise
 *
 * @remarks
 * A file must match at least one include pattern AND not match any exclude pattern
 * to be considered for inclusion.
 *
 * @example
 * ```ts
 * shouldIncludeFile('src/app.ts', ['**\/*.ts'], ['**\/*.test.ts']); // true
 * shouldIncludeFile('src/app.test.ts', ['**\/*.ts'], ['**\/*.test.ts']); // false
 * ```
 *
 * @see matchesAny
 * @since 2.0.0
 */

export function shouldIncludeFile(relativePath: string, include: Array<string>, exclude: Array<string>): boolean {
    // Must match at least one an include pattern
    if (!matchesAny(relativePath, include)) return false;

    // Must NOT match any exclude pattern
    return !matchesAny(relativePath, exclude);
}

/**
 * Collects files matching glob patterns from a directory tree.
 *
 * @param baseDir - Base directory to start searching from
 * @param globs - Array of glob patterns (use '!' prefix to exclude)
 * @returns Record mapping file paths without extension to full file paths
 *
 * @remarks
 * This function performs a depth-first traversal with several optimizations:
 * - Separates include/exclude patterns once upfront
 * - Early exits on excluded directories to avoid unnecessary traversal
 * - Returns Record instead of Array for O(1) lookups
 * - Keys are relative to baseDir (without extension)
 * - Values are relative to process.cwd() (with extension)
 * - Optimized with cached length calculations and index-based loops
 * - Avoids unnecessary string allocations
 *
 * @example
 * ```ts
 * // If baseDir is 'src' and file is at <cwd>/src/errors/uncaught-error.spec.ts
 * const files = collectFilesFromGlob('src', ['**\/*.ts']);
 * // Returns: { 'errors/uncaught-error.spec': 'src/errors/uncaught-error.spec.ts' }
 * ```
 *
 * @since 2.0.0
 */

export function collectFilesFromGlob(baseDir: string, globs: Array<string>): Record<string, string> {
    const { include, exclude } = parseGlobs(globs);
    const collected: Record<string, string> = Object.create(null);
    const cwdPath = cwd();
    const rootDirLength = cwdPath.length + 1; // +1 for trailing slash
    const baseDirLength = baseDir.length + 1; // +1 for trailing slash
    const hasExcludes = exclude.length > 0;

    function walk(dir: string): void {
        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }

        const len = entries.length;
        for (let i = 0; i < len; i++) {
            const entry = entries[i];
            const fullPath = join(dir, entry.name);
            const relativeFromBase = fullPath.slice(baseDirLength);

            if (entry.isDirectory()) {
                if (!hasExcludes || !isDirectoryExcluded(relativeFromBase, exclude)) walk(fullPath);
                continue;
            }

            if (hasExcludes && matchesAny(relativeFromBase, exclude)) continue;
            if (matchesAny(relativeFromBase, include)) {
                const relativeFromRoot = fullPath.slice(rootDirLength);
                const lastDotIndex = relativeFromBase.lastIndexOf('.');
                const keyPath = lastDotIndex > 0 ? relativeFromBase.slice(0, lastDotIndex) : relativeFromBase;

                collected[keyPath] = relativeFromRoot;
            }
        }
    }

    walk(baseDir);

    return collected;
}
