/**
 * Import will remove at compile time
 */

import type { PartialMessage } from 'esbuild';
import type { StackTraceInterface } from '@providers/interfaces/stack-provider.interface';

/**
 * Imports
 */

import { xBuildBaseError } from '@errors/base.error';
import { getErrorMetadata, formatStack } from '@providers/stack.provider';

/**
 * Normalized runtime error wrapper for esbuild diagnostics.
 *
 * @remarks
 * `esBuildError` converts an esbuild {@link PartialMessage} into an {@link xBuildBaseError}
 * with framework-aware metadata and a formatted stack string.
 *
 * Construction behavior:
 * - Uses `message.text` as the runtime error message (defaults to empty string)
 * - Copies `message.id` to {@link id} (defaults to empty string)
 * - Builds structured metadata via {@link getErrorMetadata}
 * - Replaces `stack` using {@link formatStack}, including any diagnostic notes
 *
 * @example
 * ```ts
 * const message = {
 *   id: 'transform',
 *   text: 'Unexpected token',
 *   location: { file: 'src/index.ts', line: 1, column: 5 },
 *   notes: [{ text: 'Check syntax near this token' }]
 * };
 *
 * const error = new esBuildError(message);
 * console.error(error.id); // "transform"
 * console.error(error.stack);
 * ```
 *
 * @see {@link xBuildBaseError}
 * @see {@link getErrorMetadata}
 * @see {@link formatStack}
 *
 * @since 2.0.0
 */

export class esBuildError extends xBuildBaseError {
    /**
     * Optional esbuild diagnostic identifier copied from `PartialMessage.id`.
     *
     * @remarks
     * This value is useful for categorizing diagnostics by producer (for example,
     * plugin- or phase-specific IDs). When absent in the source message, it defaults
     * to an empty string.
     *
     * @since 2.0.0
     */

    readonly id: string;

    /**
     * Creates a new esbuild error with formatted output and metadata.
     *
     * @param message - The esbuild {@link PartialMessage} containing diagnostic details
     * @param options - Optional stack parsing/formatting options used when deriving metadata
     *
     * @remarks
     * The constructor:
     * 1. Initializes the base error with `message.text ?? ''`
     * 2. Persists `message.id ?? ''` on {@link id}
     * 3. If `message.detail` is an `Error`, uses its `message` and `stack` as runtime values
     * 4. Builds structured metadata from either the original message or `detail` error
     * 5. Produces formatted output (stack replacement for message-based diagnostics, or
     *    formatted inspector output for `detail`-based diagnostics)
     *
     * The error name is always set to `'esBuildError'`. Formatted output includes:
     * - Error name and message with color coding
     * - Any diagnostic notes from esbuild
     * - Highlighted code snippet showing the error location
     * - Enhanced stack trace with file path and position
     *
     * @see {@link getErrorMetadata} for formatting logic
     * @see {@link PartialMessage} for esbuild message structure
     *
     * @since 2.0.0
     */

    constructor(message: PartialMessage, options?: StackTraceInterface) {
        super(message.text ?? '', 'esBuildError');

        this.id = message.id ?? '';
        if(message.detail instanceof Error) {
            this.stack = message.detail.stack;
            this.message = message.detail.message;
            this.reformatStack(message.detail, options);
        } else {
            this.errorMetadata = getErrorMetadata(message, { withFrameworkFrames: true });
            this.stack = formatStack(this.errorMetadata, this.name, this.message, message.notes);
        }
    }
}
