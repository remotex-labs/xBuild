/**
 * Imports
 */

import { join, relative } from 'path/posix';
import { existsSync, readdirSync } from 'fs';
import { inject } from '@symlinks/symlinks.module';
import { FrameworkService } from '@services/framework.service';

/**
 * Matches a single-character glob symbol (`?`).
 *
 * @remarks
 * In glob patterns, `?` matches exactly one character.
 *
 * @since 1.0.0
 */

const QUESTION_MARK = /\?/g;

/**
 * Matches brace expansion groups in glob patterns (e.g. `{a,b,c}`).
 *
 * @remarks
 * Brace groups expand into multiple alternatives separated by commas.
 *
 * @since 1.0.0
 */

const BRACE_PATTERN = /\{([^}]+)\}/g;

/**
 * Matches double asterisks (`**`) used in glob patterns.
 *
 * @remarks
 * `**` typically represents recursive directory matching.
 *
 * @since 1.0.0
 */

const DOUBLE_ASTERISK = /(?:\/|^)\*{2}(?:\/|$)/g;

/**
 * Matches a single asterisk (`*`) in glob patterns.
 *
 * @remarks
 * `*` matches zero or more characters within a single directory segment.
 *
 * @since 1.0.0
 */

const SINGLE_ASTERISK = /(?<!\.)\*/g;

/**
 * Matches escaped character classes in glob patterns (e.g. `[abc]`).
 *
 * @remarks
 * Used to translate character class expressions into regex equivalents.
 *
 * @since 1.0.0
 */

const CHARACTER_CLASS = /\\\[([^\]]+)\\\]/g;

/**
 * Matches special regex characters that need escaping.
 *
 * @remarks
 * Ensures that characters like `.`, `+`, `$`, `|`, `[]`, `\`
 * are properly escaped when compiling glob patterns.
 *
 * @since 1.0.0
 */

const REGEX_SPECIAL_CHARS = /[.+$|[\]\\]/g;

/**
 * Computes the relative path of a file from the project root.
 *
 * @param path - The full absolute path of the file.
 * @returns The file path relative to the root.
 *
 * @since 1.0.0
 */

export function getRelativePath(path: string): string {
    return relative(inject(FrameworkService).rootPath, path);
}

/**
 * Compiles a glob pattern into a corresponding regular expression.
 *
 * @param globPattern - The glob pattern string to convert.
 * @returns A `RegExp` instance that matches the given glob pattern.
 *
 * @remarks
 * This function converts common glob syntax into equivalent
 * regular expression syntax. It supports:
 * - `*` to match zero or more characters (excluding `/`)
 * - `**` to match across directories
 * - `?` to match exactly one character
 * - Character classes like `[abc]`
 * - Brace expansions like `{a,b,c}`
 *
 * Escapes regex-special characters before applying glob conversions
 * to ensure the resulting expression is valid.
 *
 * @example
 * ```ts
 * const regex = compileGlobPattern("src/**\/*.ts");
 * console.log(regex.test("src/utils/helpers.ts")); // true
 * console.log(regex.test("dist/index.js"));        // false
 * ```
 *
 * @since 1.0.0
 */

export function compileGlobPattern(globPattern: string): RegExp {
    const escapeRegexChars = (pattern: string): string =>
        pattern.replace(REGEX_SPECIAL_CHARS, '\\$&');

    const convertGlobToRegex = (pattern: string): string => {
        return pattern
            .replace('.*', '\.[^\/]+')
            .replace(QUESTION_MARK, '.')
            .replace(DOUBLE_ASTERISK, (match) => {
                if (match.endsWith('/')) {
                    return '(?:.*\/)?';
                } else if (match.startsWith('/')) {
                    return '(?:\/.*)?';
                } else {
                    return '.*';
                }
            })
            .replace(SINGLE_ASTERISK, '[^/]+')
            .replace(CHARACTER_CLASS, (_, chars) => `[${ chars }]`)
            .replace(BRACE_PATTERN, (_, choices) =>
                `(${ choices.split(',').join('|') })`);
    };

    return new RegExp(`^${ convertGlobToRegex(escapeRegexChars(globPattern)) }$`);
}

/**
 * Determines whether a given string is a glob pattern.
 *
 * @param str - The string to test.
 * @returns `true` if the string contains glob-like syntax, otherwise `false`.
 *
 * @remarks
 * This function checks for the presence of common glob syntax
 * characters (`*`, `?`, `[]`, `{}`, `!`, `@`, `+`, `()`, `|`),
 * brace expressions (e.g. `{a,b}`), and extglob patterns
 * (e.g. `@(pattern)`).
 *
 * It is useful for distinguishing between literal file paths
 * and glob patterns when working with file matching or build
 * tools.
 *
 * @example
 * ```ts
 * isGlob("src/**\/*.ts");    // true
 * isGlob("file.txt");       // false
 * isGlob("lib/@(a|b).js");  // true
 * ```
 *
 * @since 1.0.0
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

export function matchesAny(path: string, patterns: Array<RegExp>): boolean {
    return patterns.some(regex => regex.test(path));
}

/**
 * Compiles an array of string/glob/regex patterns into {@link RegExp} objects.
 *
 * @remarks
 * - If an entry is already a `RegExp`, it is returned as-is.
 * - If an entry is a glob pattern (e.g. `src/**\/*.test.ts`), it is compiled into a regex
 *   using {@link compileGlobPattern}.
 * - Otherwise, literal file paths are converted into an exact-match regex,
 *   with regex metacharacters properly escaped.
 *
 * @param patterns - A list of strings (paths, globs) or regular expressions.
 * @returns An array of {@link RegExp} objects ready for matching.
 *
 * @example
 * ```ts
 * const regexes = compilePatterns([
 *   /\.test\.ts$/,             // already a regex
 *   "src/utils/helper.ts",     // literal file path
 *   "tests/**\/*.spec.ts"       // glob pattern
 * ]);
 *
 * matchesAnyRegex("src/utils/helper.ts", regexes); // true
 * ```
 *
 * @since 1.0.0
 */

export function compilePatterns(patterns: Array<string | RegExp>): Array<RegExp> {
    return patterns.map(pattern => {
        if (pattern instanceof RegExp) {
            return pattern;
        }

        // Check if pattern is negated
        const isNegated = typeof pattern === 'string' && pattern.startsWith('!');
        const cleanPattern = isNegated ? pattern.slice(1) : pattern;

        let regexPattern: string;

        if (isGlob(cleanPattern)) {
            const compiled = compileGlobPattern(cleanPattern);
            // Extract the pattern from the compiled regex (remove ^ and $)
            regexPattern = compiled.source.slice(1, -1);
        } else {
            regexPattern = getRelativePath(cleanPattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        // If negated, use negative lookahead to match anything that doesn't match the pattern
        if (isNegated) {
            return new RegExp(`^(?!${ regexPattern }$).*$`);
        }

        return new RegExp(`^${ regexPattern }$`);
    });
}

/**
 * Collects files from a directory tree that match include/exclude glob patterns.
 *
 * @param baseDir - The base directory to start collecting files from.
 * @param include - An array of glob patterns or file paths to include. Patterns starting
 *                  with `!` are treated as exclusions (equivalent to entries in the `exclude` array).
 * @param exclude - An array of glob patterns or file paths to exclude from the results.
 * @returns An array of relative file paths (relative to `baseDir`) that match the include
 *          patterns and do not match any exclude patterns.
 *
 * @remarks
 * This function recursively traverses the directory tree starting from `baseDir` and returns
 * only files that match the criteria. The matching process works as follows:
 *
 * - Files matching any exclude pattern are skipped entirely.
 * - Files matching at least one include pattern are collected.
 * - If no positive patterns are provided after filtering out negations, an empty array is returned.
 * - Inaccessible directories (permission errors) are silently skipped.
 *
 * **Pattern types supported:**
 * - **Literal paths**: `src/utils/helper.ts` - exact file path match
 * - **Glob patterns**: `src/**\/*.ts` - recursive directory and wildcard matching
 * - **Regular expressions**: `/\.ts$/` - regex-based pattern matching
 * - **Negation patterns**: `!dist/**` - exclude matching patterns (when prefixed with `!` in include array)
 *
 * All patterns are compiled using {@link compilePatterns} into regular expressions before matching.
 *
 * **Algorithm**:
 * 1. Validates that `baseDir` exists; returns empty array if it doesn't.
 * 2. Separates include patterns into positive and negative patterns (by checking for `!` prefix).
 * 3. Appends exclude array to negative patterns.
 * 4. Returns empty array if no positive patterns remain.
 * 5. Compiles both positive and negative patterns into regex objects.
 * 6. Recursively walks the directory tree:
 *    - Checks exclude patterns first; skips matching files/directories.
 *    - Descends into non-excluded directories.
 *    - Collects non-excluded files that match include patterns.
 * 7. Returns collected relative file paths.
 *
 * **Performance considerations**:
 * - Use exclude patterns to prevent traversing large irrelevant directories.
 * - More specific patterns (e.g., `src/**\/*.test.ts`) are more efficient than broad patterns.
 * - The function has a linear time complexity relative to the total number of files traversed.
 *
 * @example
 * ```ts
 * // Collect all TypeScript files except tests and build artifacts
 * const files = collectFilesFromGlob(
 *   '/project',
 *   ['src/**\/*.ts'],
 *   ['**\/*.test.ts', 'dist/**', 'node_modules/**']
 * );
 * // Returns: ['src/index.ts', 'src/utils/helper.ts', ...]
 *
 * // Using negation patterns in the include array
 * const files2 = collectFilesFromGlob(
 *   '/project',
 *   ['**\/*.ts', '!src/**\/*.spec.ts'],
 *   []
 * );
 * // Returns all TypeScript files except spec files
 *
 * // Collecting files from a non-existent directory
 * const files3 = collectFilesFromGlob('/nonexistent', ['*.ts'], []);
 * // Returns: []
 * ```
 *
 * @see {@link isGlob} for glob pattern detection
 * @see {@link matchesAny} for pattern matching logic
 * @see {@link compilePatterns} for pattern compilation details
 *
 * @since 1.0.0
 */

export function collectFilesFromGlob(baseDir: string, include: Array<string>, exclude: readonly string[]): Array<string> {
    if (!existsSync(baseDir)) return [];
    const positivePatterns: Array<string> = [];
    const negativePatterns: Array<string> = [];

    for (const pattern of include) {
        if (pattern.startsWith('!')) {
            negativePatterns.push(pattern.slice(1)); // Remove the '!' prefix
        } else {
            positivePatterns.push(pattern);
        }
    }

    negativePatterns.push(...exclude);
    if (positivePatterns.length === 0) return [];
    const includeRegex = compilePatterns(positivePatterns);
    const excludeRegex = negativePatterns.length > 0 ? compilePatterns(negativePatterns) : [];
    const collectedFiles: Array<string> = [];
    const hasExcludes = excludeRegex.length > 0;

    const walk = (dir: string): void => {
        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        } catch {
            return; // Skip inaccessible directories
        }

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const fullPath = join(dir, entry.name);
            const relativePath = relative(baseDir, fullPath);

            if (hasExcludes && matchesAny(relativePath, excludeRegex)) continue;
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
