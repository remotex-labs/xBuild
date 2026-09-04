/**
 * The prefix every macro name is expected to open with.
 *
 * @remarks
 * Keeps a macro apart from an ordinary binding and doubles as the cheapest test that a source holds one at all,
 * since a file without it carries nothing to expand.
 * A declared macro named without it still expands and draws a `macro-prefix` warning.
 *
 * @example
 * ```ts
 * '$$ifdef'.startsWith(MacroPrefix); // true
 * ```
 *
 * @see Macros
 * @see MacroScanHint
 *
 * @since 3.0.0
 */

export const MacroPrefix = '$$';

/**
 * The prefix the two conditional macros share.
 *
 * @remarks
 * What `$$ifdef` and `$$ifndef` both open with, so a source without it declares neither of them,
 * and the walk looking for one is skipped.
 * {@link Macros.inline} does not carry it and is reached through {@link MacroPrefix} instead.
 *
 * @example
 * ```ts
 * MacroScanHint;                                              // '$$if'
 * 'const $$dev = $$ifdef("DEV", 1);'.includes(MacroScanHint); // true
 * ```
 *
 * @see Macros
 * @see MacroPrefix
 *
 * @since 3.0.0
 */

export const MacroScanHint = `${ MacroPrefix }if`;

/**
 * The three names that mark a call as a macro.
 *
 * @remarks
 * The callee of the call names the macro, and the shape of the call has to match the name:
 * the two conditional macros take a flag as a string literal and the value that flag guards,
 * while `inline` takes the value alone.
 * A call that matches neither shape is left as it stands rather than reported.
 *
 * @example
 * ```ts
 * export const $$dev = $$ifdef('DEV', () => console.log('dev')); // kept while DEV is set
 * export const $$prod = $$ifndef('DEV', () => 0);                // kept while DEV is not set
 * export const $$stamp = $$inline(() => 2 + 2);                  // becomes 4 in the output
 * ```
 *
 * @see MacroPrefix
 * @see transformMacros
 *
 * @since 3.0.0
 */

export const enum Macros {
    /**
     * Keeps its value while the flag is set.
     *
     * @remarks
     * The flag is read from the definition table, and the declaration is dropped when the flag is not set,
     * along with every reference to the name that it bound.
     *
     * @example
     * ```ts
     * export const $$dev = $$ifdef('DEV', () => log()); // dropped while DEV is 'false'
     * ```
     *
     * @since 3.0.0
     */

    ifdef = `${ MacroPrefix }ifdef`,

    /**
     * Keeps its value while the flag is not set.
     *
     * @remarks
     * The counterpart of `ifdef`, reading the same definitions and dropped on the opposite answer,
     * which is what a fallback for an absent flag is written as.
     *
     * @example
     * ```ts
     * export const $$prod = $$ifndef('DEV', () => 0); // dropped while DEV is set
     * ```
     *
     * @since 3.0.0
     */

    ifndef = `${ MacroPrefix }ifndef`,

    /**
     * Replaces the call with what its value evaluates to.
     *
     * @remarks
     * Evaluated while the build runs, so the output carries the result rather than the call.
     * A failure is reported as a `macro-inline` error and leaves `undefined` behind.
     *
     * @example
     * ```ts
     * export const $$stamp = $$inline(() => 2 + 2); // export const $$stamp = 4;
     * ```
     *
     * @since 3.0.0
     */

    inline = `${ MacroPrefix }inline`
}

/**
 * The definition values that leave a flag unset.
 *
 * @remarks
 * A definition holds source text rather than a value, so `false` reaches the build as the string `'false'`.
 * These three leave the flag unset, and every other text sets it, `'0'` and the empty string among them.
 * A flag that the definition table does not name is not set either, which {@link isDefined} tests on its own.
 * The text is trimmed before the lookup.
 *
 * @example
 * ```ts
 * MacroFalsyDefines.has('false'); // true
 * MacroFalsyDefines.has('0');     // false - '0' sets the flag
 * ```
 *
 * @see Macros
 * @see isDefined
 *
 * @since 3.0.0
 */

export const MacroFalsyDefines = new Set([ 'false', 'null', 'undefined' ]);

/**
 * The parent properties under which an identifier names something rather than reads it.
 *
 * @remarks
 * A dropped macro's identifier becomes `undefined` wherever it is read, and is left alone where it is only a name -
 * the `id` of a declaration, a label, an import or export binding, or a parameter.
 * An object key and a member property are decided by the parent's `computed` flag instead of by this set.
 *
 * @example
 * ```ts
 * MacroNameKeys.has('id');     // true - `const $$dev = ...` keeps the name it declares
 * MacroNameKeys.has('object'); // false - `$$dev.run()` has the reference replaced
 * ```
 *
 * @see transformMacros
 * @since 3.0.0
 */

export const MacroNameKeys = new Set([ 'id', 'label', 'local', 'params', 'exported', 'imported' ]);
