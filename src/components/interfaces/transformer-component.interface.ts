/**
 * A replacement of one span of the source text.
 *
 * @remarks
 * Edits are collected against the original text and carry absolute offsets into it,
 * so a transform can record them in any order without tracking how earlier edits shifted the source.
 * {@link applyEdits} is what turns a set of them back into text.
 *
 * @example
 * ```ts
 * const edits: Array<SourceEditInterface> = [ { start: 0, end: 5, text: 'let' } ];
 * applyEdits('const a = 1;', edits); // 'let a = 1;'
 * ```
 *
 * @see applyEdits
 * @since 3.0.0
 */

export interface SourceEditInterface {
    /**
     * Offset just past the last replaced character.
     *
     * @remarks
     * Exclusive, matching the `end` of an oxc `Span`, so a node's span can be used as an edit range unchanged.
     *
     * @example
     * ```ts
     * applyEdits('const a = 1;', [ { start: 0, end: 5, text: 'let' } ]); // 'let a = 1;'
     * ```
     *
     * @since 3.0.0
     */

    end: number;

    /**
     * Text written in place of the replaced span, defaulting to nothing when omitted.
     *
     * @remarks
     * Leaving it out deletes the span, which is what a removal records, and an empty string does the same.
     * Give it a value only when the span is being rewritten rather than dropped.
     *
     * @example
     * ```ts
     * applyEdits('const a = 1;', [ { start: 0, end: 6 } ]);               // 'a = 1;'
     * applyEdits('const a = 1;', [ { start: 0, end: 6, text: '' } ]);     // 'a = 1;' - the same deletion
     * applyEdits('const a = 1;', [ { start: 0, end: 5, text: 'let' } ]);  // 'let a = 1;'
     * ```
     *
     * @since 3.0.0
     */

    text?: string;

    /**
     * Offset of the first replaced character.
     *
     * @remarks
     * Inclusive, and what {@link applyEdits} sorts the edits by before applying them.
     *
     * @example
     * ```ts
     * applyEdits('const a = 1;', [ { start: 6, end: 7, text: 'b' } ]); // 'const b = 1;'
     * ```
     *
     * @since 3.0.0
     */

    start: number;
}
