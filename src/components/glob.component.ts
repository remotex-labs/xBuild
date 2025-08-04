/**
 * Imports
 */

import { join, relative } from 'path';
import { existsSync, readdirSync } from 'fs';

/**
 * Constants
 */

const QUESTION_MARK = /\?/g;
const BRACE_PATTERN = /\{([^}]+)\}/g;
const DOUBLE_ASTERISK = /(?:\/|^)\*{2}(?:\/|$)/g;
const SINGLE_ASTERISK = /\*/g;
const CHARACTER_CLASS = /\\\[([^\]]+)\\\]/g;
const REGEX_SPECIAL_CHARS = /[.+$|[\]\\]/g;

/**
 * Compiles a given glob pattern into a regular expression.
 *
 * @param globPattern - The glob pattern to be converted into a regular expression.
 * @return A regular expression derived from the provided glob pattern.
 *
 * @remarks This method processes a glob pattern by escaping special regex characters
 * and translating glob syntax such as wildcards (*, ?, **) and braces into equivalent
 * regex components.
 *
 * @since 1.6.0
 */

export function compileGlobPattern(globPattern: string): RegExp {
    const escapeRegexChars = (pattern: string): string =>
        pattern.replace(REGEX_SPECIAL_CHARS, '\\$&');

    const convertGlobToRegex = (pattern: string): string => {
        return pattern
            .replace(CHARACTER_CLASS, (_, chars) => `[${ chars }]`)
            .replace(DOUBLE_ASTERISK, '.*')
            .replace(SINGLE_ASTERISK, (match, offset, fullString): string => {
                const context = fullString.slice(Math.max(0, offset - 2), offset);
                if (context[0] === '\\')  return context[1] === '.' ? '.*' : '[^\\/]*';

                return context[1] === '.' ? '*' : '[^\\/]*';
            }).replace(QUESTION_MARK, '.')
            .replace(BRACE_PATTERN, (_, choices) =>
                `(${ choices.split(',').join('|') })`);
    };

    return new RegExp(`^${ convertGlobToRegex(escapeRegexChars(globPattern)) }$`);
}


/**
 * Determines whether a given string is a glob pattern.
 *
 * A glob pattern typically contains special characters or patterns used for
 * file matching, such as `*`, `?`, `[ ]`, `{ }`, `!`, `@`, `+`, `( )`, and `|`.
 * It also checks for brace expressions like `{a,b}` and extglob patterns like `@(pattern)`.
 *
 * @param str - The string to be evaluated.
 * @returns `true` if the input string is a glob pattern, otherwise `false`.
 *
 * @remarks This function checks for common globbing patterns and may not cover all edge cases.
 *
 * @since 1.6.0
 */

export function isGlob(str: string): boolean {
    // Checks for common glob patterns including:
    // * ? [ ] { } ! @ + ( ) |
    const globCharacters = /[*?[\]{}!@+()|\]]/.test(str);

    // Check for brace expressions like {a,b}
    const hasBraces = /{[^}]+}/.test(str);

    // Check for extglob patterns like @(pattern)
    const hasExtglob = /@\([^)]+\)/.test(str);

    return globCharacters || hasBraces || hasExtglob;
}

/**
 * Determines whether a given path matches any of the provided regular expression patterns.
 *
 * @param path - The string path to check against the patterns.
 * @param patterns - An array of RegExp objects to test the path against.
 * @returns A boolean indicating whether the path matches any of the patterns.
 *
 * @remarks This function is commonly used in file filtering operations like
 * in the `collectFilesFromDir` function to determine which files to include
 * or exclude based on pattern matching.
 *
 * @example
 * ```ts
 * const isMatch = matchesAny('src/file.ts', [/\.ts$/, /\.js$/]);
 * console.log(isMatch); // true
 * ```
 *
 * @since 1.6.0
 */

export function matchesAny(path: string, patterns: RegExp[]): boolean {
    return patterns.some(regex => regex.test(path));
}

/**
 * Converts an array of string patterns and RegExp objects into an array of compiled regular expressions.
 *
 * @param patterns - An array containing string glob patterns and/or RegExp objects to be compiled.
 * @returns An array of RegExp objects compiled from the input patterns.
 *
 * @remarks
 * This function processes each pattern in the input array:
 * - If the pattern is already a RegExp object, it's used as is
 * - If the pattern is a string, it's normalized by:
 *   1. Replacing all backslashes with forward slashes
 *   2. Removing leading negation (!) characters
 *   3. Converting the normalized glob pattern to a RegExp using `compileGlobPattern`
 *
 * @example
 * ```ts
 * // Compile a mix of glob patterns and RegExp objects
 * const patterns = compilePatterns([
 *   '**\/*.ts',
 *   /\.js$/,
 *   '!node_modules/**'
 * ]);
 *
 * // Result is an array of RegExp objects
 * console.log(patterns); // [/^.*\.ts$/, /\.js$/, /^node_modules\/.*$/]
 * ```
 *
 * @since 1.6.0
 */

function compilePatterns(patterns: (string | RegExp)[]): RegExp[] {
    return patterns.map(pattern =>
        pattern instanceof RegExp
            ? pattern
            : compileGlobPattern(pattern.replace(/\\/g, '/').replace(/^!/, ''))
    );
}

/**
 * Recursively collects files from a directory based on include and exclude patterns.
 *
 * @param baseDir - The base directory to start the file collection from.
 * @param include - An array of glob patterns specifying which files to include.
 *                  Patterns starting with '!' are treated as exclude patterns.
 * @param exclude - An array of glob patterns specifying which files to exclude.
 * @returns An array of file paths relative to the base directory that match the include
 *          patterns and don't match the exclude patterns.
 *
 * @remarks
 * This function:
 * - Returns an empty array if the base directory doesn't exist
 * - Processes negative patterns (starting with '!') from both include and exclude arrays
 * - Normalizes all paths to use forward slashes for consistent pattern matching
 * - Uses depth-first traversal to walk through the directory structure
 * - Performs pattern matching against paths relative to the base directory
 *
 * @example
 * ```ts
 * // Collect all TypeScript files except tests
 * const files = collectFilesFromDir(
 *   'src',
 *   ['**\/*.ts'],
 *   ['**\/*.spec.ts', '**\/*.test.ts']
 * );
 *
 * // With negated patterns in include
 * const files2 = collectFilesFromDir(
 *   'src',
 *   ['**\/*.ts', '!**\/*.d.ts'],
 *   ['node_modules/**']
 * );
 * ```
 *
 * @since 1.6.0
 */

export function collectFilesFromDir(baseDir: string, include: Array<string>, exclude: Array<string>): Array<string> {
    if (!existsSync(baseDir)) return [];

    const positivePatterns = include.filter(p => !p.startsWith('!'));
    const negativePatterns = [
        ...exclude,
        ...include.filter(p => p.startsWith('!'))
    ];

    const includeRegex = compilePatterns(positivePatterns);
    const excludeRegex = compilePatterns(negativePatterns);

    const collectedFiles: Array<string> = [];

    const walk = (dir: string): void => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const fullPath = join(dir, entry.name);
            const relativePath = relative(baseDir, fullPath).replace(/\\/g, '/');

            if (matchesAny(relativePath, excludeRegex)) continue;

            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (matchesAny(relativePath, includeRegex)) {
                collectedFiles.push(relativePath);
            }
        }
    };

    walk(baseDir);

    return collectedFiles;
}
