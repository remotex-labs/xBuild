/**
 * The configuration blocks a build injects into its esbuild options as text.
 *
 * @remarks
 * The three settings a configuration states as a table of names to code rather than as a plain option,
 * so one pass over this list injects all of them instead of naming each at its own call site.
 * A value written as a function is called for the variant being built and its result injected,
 * which is what makes the three interchangeable here.
 *
 * @example
 * ```ts
 * for (const block of TextBlocks) injectTextBlock(options, block); // banner, then footer, then define
 * ```
 *
 * @see VariantService
 * @since 3.0.0
 */

export const TextBlocks = [ 'banner', 'footer', 'define' ] as const;

/**
 * The reporting level each TypeScript diagnostic category maps to.
 *
 * @remarks
 * Indexed by `ts.DiagnosticCategory`, which counts `Warning` as `0`, `Error` as `1`, and `Suggestion` as `2`,
 * so the order of the entries is the mapping itself rather than a preference.
 * `Message` counts as `3` and falls off the end,
 * so whatever reads the table settles that one for itself.
 *
 * @example
 * ```ts
 * DiagnosticLevels[1]; // 'error' - ts.DiagnosticCategory.Error
 * DiagnosticLevels[3]; // undefined - a plain message, left to the reader
 * ```
 *
 * @see LogLevelType
 * @see VariantService
 *
 * @since 3.0.0
 */

export const DiagnosticLevels = [ 'warning', 'error', 'info' ];
