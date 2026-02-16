/**
 * Result of parsing glob patterns into include and exclude arrays.
 *
 * @remarks
 * This interface is returned by the {@link parseGlobs} function to separate
 * glob patterns based on their prefix. Patterns without a prefix are included,
 * while patterns starting with '!' are excluded (with the '!' removed).
 *
 * @example
 * ```ts
 * const result: ParseGlobInterface = {
 *   include: ['**\/*.ts', '**\/*.js'],
 *   exclude: ['**\/*.test.ts', 'node_modules/**']
 * };
 * ```
 *
 * @see {@link parseGlobs}
 *
 * @since 2.0.0
 */
export interface ParseGlobInterface {
    /**
     * Array of glob patterns for files to include.
     *
     * @remarks
     * These patterns do not have the '!' prefix and represent
     * files that should be matched and included in results.
     *
     * @since 2.0.0
     */

    include: Array<string>;

    /**
     * Array of glob patterns for files to exclude.
     *
     * @remarks
     * These patterns originally had the '!' prefix (which is removed)
     * and represent files that should be excluded from results.
     *
     * @since 2.0.0
     */

    exclude: Array<string>;
}
