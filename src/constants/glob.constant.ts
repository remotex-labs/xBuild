/**
 * Imports
 */

import { Char } from '@constants/char.constant';

/**
 * Regular-expression fragments emitted while compiling a glob into a {@link RegExp} source.
 *
 * @remarks
 * Each member is a reusable snippet of regex syntax with a fixed meaning in the compiled output,
 * so the compiler can assemble a pattern by concatenating members rather than repeating string literals.
 * Declared as a `const enum` so references inline to their literal value at compile time.
 *
 * @example
 * ```ts
 * RegexElement.NotDot + RegexElement.NotSlashRun; // '(?!\\.)[^/]*' - the source for a leading `*`
 * ```
 *
 * @see RegexCloser
 * @since 3.0.0
 */

export const enum RegexElement {
    /**
     * The alternation separator `|`.
     *
     * @since 3.0.0
     */

    Alt = '|',

    /**
     * The opening of a non-capturing group `(?:`.
     *
     * @since 3.0.0
     */

    Open = '(?:',

    /**
     * The literal path separator `/`.
     *
     * @since 3.0.0
     */

    Slash = '/',

    /**
     * A zero-width guard `(?!\.)` that forbids a leading dot at the start of a segment.
     *
     * @remarks
     * Prevents a wildcard from matching a dotfile unless the pattern names the dot explicitly.
     *
     * @since 3.0.0
     */

    NotDot = '(?!\\.)',

    /**
     * A single character class `[^/]` matching any one character except the path separator.
     *
     * @since 3.0.0
     */

    NotSlash = '[^/]',

    /**
     * A segment boundary `(?:$|/)` matching either the end of the string or a slash.
     *
     * @since 3.0.0
     */

    SegBreak = '(?:$|/)',

    /**
     * A greedy run `[^/]*` of characters that are not the path separator.
     *
     * @since 3.0.0
     */

    NotSlashRun = '[^/]*',

    /**
     * A single character class `[^./]` matching any one character except `.` or `/`.
     *
     * @remarks
     * Emitted for `?` at the start of a segment, where a leading dot must not match.
     *
     * @since 3.0.0
     */

    NotDotSlash = '[^./]',

    /**
     * A lazy run `[^/]*?` of characters that are not the path separator.
     *
     * @remarks
     * Used as the body of a negation so the negative lookahead governs how much the segment consumes.
     *
     * @since 3.0.0
     */

    NotSlashLazy = '[^/]*?',

    /**
     * An optional absolute-path root `(?:[A-Za-z]:)?/?` matching a Windows drive prefix and/or a leading slash.
     *
     * @remarks
     * Emitted before a leading globstar so a relative pattern such as `**\/*.ts` also matches an absolute path
     * like `/a/b/c.ts` or `C:/a/b/c.ts`.
     * Both parts are optional, so a purely relative path still matches.
     * Path separators are assumed to be forward slashes, so normalize Windows backslashes before testing.
     *
     * @since 3.0.0
     */

    AbsRoot = '(?:[A-Za-z]:)?/?',
}

/**
 * Maps an extglob prefix character to the regex closer that ends its non-capturing group.
 *
 * @remarks
 * Keyed by the {@link Char} code unit that precedes a `(` in an extglob construct,
 * the value carries the group-closing parenthesis together with the quantifier that reproduces the prefix semantics.
 * - `@( ... )` matches the group exactly once.
 * - `+( ... )` matches the group one or more times.
 * - `*( ... )` matches the group zero or more times.
 * - `?( ... )` matches the group zero or one time.
 * The presence of a key also signals that the prefix opens an extglob group,
 * so the compiler tests membership before treating the character as extglob syntax.
 *
 * @example
 * ```ts
 * RegexCloser[Char.Plus];     // ')+' - so `+(ab)` compiles to `(?:ab)+`
 * RegexCloser[Char.Bang];     // undefined - `!(` is a negation, handled apart
 * ```
 *
 * @see Char
 * @see RegexElement
 *
 * @since 3.0.0
 */

export const RegexCloser: Record<number, string> = {
    [Char.At]: ')',
    [Char.Plus]: ')+',
    [Char.Star]: ')*',
    [Char.Question]: ')?'
} as const;
