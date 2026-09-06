/**
 * A message worked out into the three parts a report line is laid out from.
 *
 * @remarks
 * Everything a message costs to work out is worked out once, into this,
 * since the columns cannot be sized until every message has been seen and the lines cannot be written until they are.
 *
 * @example
 * ```ts
 * { id: 'TS2304', location: 'src/index.ts:12:8', detail: [ '  11 | x();' ] }
 * ```
 *
 * @since 3.0.0
 */

export interface MessageRowInterface {
    /**
     * What the message is filed under, its TypeScript code or the id the plugin gave it, empty when it has neither.
     *
     * @example
     * ```ts
     * row.id; // 'TS2304'
     * ```
     *
     * @since 3.0.0
     */

    id: string;

    /**
     * Where the message points, colored, empty when it points nowhere.
     *
     * @example
     * ```ts
     * row.location; // 'src/index.ts:12:8'
     * ```
     *
     * @since 3.0.0
     */

    location: string;

    /**
     * The code window and trace printed under the line, empty when the caller asked for neither.
     *
     * @example
     * ```ts
     * row.detail.length; // 6 - a code window and four frames
     * ```
     *
     * @since 3.0.0
     */

    detail: Array<string>;
}
