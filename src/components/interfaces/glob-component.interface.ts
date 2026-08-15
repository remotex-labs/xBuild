/**
 * A single regular-expression flag accepted when compiling a glob.
 *
 * @remarks
 * - `i` - case-insensitive matching.
 * - `u` - Unicode mode.
 * - `s` - dot-all mode, letting `.` match line terminators.
 *
 * @example
 * ```ts
 * const flag: RegexFlagType = 'i';
 * globToRegExp('SRC/*.TS', { flags: flag }); // matches 'src/app.ts'
 * ```
 *
 * @see GlobFlagsType
 * @since 3.0.0
 */

export type RegexFlagType = 'i' | 'u' | 's';

/**
 * One to three regular-expression flags combined into a single string.
 *
 * @remarks
 * Enumerates every combination of one, two, or three {@link RegexFlagType} values.
 * The type does not forbid repeating the same flag, so callers are expected to pass distinct flags.
 * Passed through unchanged to the {@link RegExp} constructor by {@link globToRegExp}.
 *
 * @example
 * ```ts
 * const flags: GlobFlagsType = 'iu';
 * globToRegExp('src/*.TS', { flags }); // case-insensitive, Unicode mode
 * ```
 *
 * @see RegexFlagType
 * @since 3.0.0
 */

export type GlobFlagsType =
    | `${ RegexFlagType }`
    | `${ RegexFlagType }${ RegexFlagType }`
    | `${ RegexFlagType }${ RegexFlagType }${ RegexFlagType }`;

/**
 * Options controlling how a glob is compiled into a regular expression.
 *
 * @remarks
 * A single bag of settings shared by the compiler entry points so the same object can be threaded
 * through {@link createMatcher}, {@link globToRegExp}, and the recursive core unchanged.
 * Both fields are optional: omitting `flags` compiles a flagless expression,
 * and omitting `dot` keeps the leading-dot guard in force.
 *
 * @example
 * ```ts
 * globToRegExp('src/*.ts', { flags: 'i', dot: true });
 * ```
 *
 * @see globToRegExp
 * @see createMatcher
 * @see GlobFlagsType
 *
 * @since 3.0.0
 */

export interface GlobOptionsInterface {
    /**
     * Regular-expression flags passed through unchanged to the {@link RegExp} constructor.
     *
     * @remarks
     * Omitting them compiles a flagless expression, which matches case-sensitively.
     *
     * @example
     * ```ts
     * globToRegExp('src/*.ts', { flags: 'i' }).test('SRC/APP.TS'); // true
     * globToRegExp('src/*.ts').test('SRC/APP.TS');                 // false
     * ```
     *
     * @see GlobFlagsType
     * @since 3.0.0
     */

    flags?: GlobFlagsType;

    /**
     * When `true`, wildcards match dotfiles and `**` descends into dot directories, disabling the dotfile guard.
     *
     * @remarks
     * Lifts the guard for the whole pattern, so a pattern needs no explicit dot to reach a dotfile.
     * Omitting it keeps the guard in force, where `*` matches `env` but not `.env`.
     *
     * @example
     * ```ts
     * globToRegExp('src/*', { dot: true }).test('src/.env'); // true
     * globToRegExp('src/*').test('src/.env');                // false - guarded
     * ```
     *
     * @since 3.0.0
     */

    dot?: boolean;
}
