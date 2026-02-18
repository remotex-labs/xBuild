/**
 * Import will remove at compile time
 */

import type { PartialMessage } from 'esbuild';

/**
 * Imports
 */

import { xBuildBaseError } from '@errors/base.error';
import { getErrorMetadata, formatStack } from '@providers/stack.provider';

/**
 * Custom error class for esbuild compilation errors with enhanced formatting and source code context.
 *
 * @remarks
 * The `esBuildError` class extends {@link xBuildBaseError} to provide specialized handling for esbuild
 * {@link Message} objects. It automatically:
 * - Extracts and formats source code snippets from the error location
 * - Applies syntax highlighting to code context
 * - Displays helpful notes and suggestions from esbuild
 * - Generates enhanced stack traces with file locations
 * - Stores structured metadata in {@link StackInterface} format
 *
 * This class is designed to transform esbuild's error messages into human-readable, visually enhanced
 * output suitable for terminal display, making it easier to identify and fix build errors.
 *
 * **Key features:**
 * - Automatic source code reading from file system
 * - Contextual code display (3 lines before and after error)
 * - Syntax highlighting with color-coded error indicators
 * - Integration with esbuild's location and notes system
 * - Structured error metadata for programmatic access
 *
 * @example
 * ```ts
 * import { build } from 'esbuild';
 * import { esBuildError } from './esbuild.error';
 *
 * try {
 *   await build({
 *     entryPoints: ['src/index.ts'],
 *     bundle: true,
 *     outdir: 'dist'
 *   });
 * } catch (buildError) {
 *   if (buildError.errors) {
 *     for (const message of buildError.errors) {
 *       throw new esBuildError(message);
 *     }
 *   }
 * }
 * ```
 *
 * @example
 * ```ts
 * // Error with location information
 * const message: Message = {
 *   text: "Cannot find module 'lodash'",
 *   location: {
 *     file: 'src/app.ts',
 *     line: 5,
 *     column: 19
 *   },
 *   notes: [
 *     { text: 'You can mark the path "lodash" as external to exclude it' }
 *   ]
 * };
 *
 * const error = new esBuildError(message);
 * console.error(error); // Displays formatted error with code context
 * ```
 *
 * @see {@link StackInterface} for metadata structure
 * @see {@link xBuildBaseError} for base error functionality
 * @see {@link https://esbuild.github.io/api/#message-object | esbuild Message documentation}
 *
 * @since 2.0.0
 */

export class esBuildError extends xBuildBaseError {
    /**
     * Creates a new esbuild error with formatted output and metadata.
     *
     * @param message - The esbuild {@link Message} object containing error details
     *
     * @remarks
     * The constructor processes the esbuild message to:
     * 1. Extract the error text for the base Error message
     * 2. Read source code from the file system if a location is provided
     * 3. Generate syntax-highlighted code snippets with context
     * 4. Format any additional notes from esbuild
     * 5. Create an enhanced stack trace
     * 6. Store structured metadata in {@link errorMetadata}
     *
     * The error name is always set to `'esBuildError'` and the stack is replaced
     * with a custom formatted version that includes:
     * - Error name and message with color coding
     * - Any diagnostic notes from esbuild
     * - Highlighted code snippet showing the error location
     * - Enhanced stack trace with file path and position
     *
     * @example
     * ```ts
     * const message: Message = {
     *   text: "Expected ';' but found '}'",
     *   location: {
     *     file: 'src/utils.ts',
     *     line: 42,
     *     column: 5
     *   }
     * };
     *
     * const error = new esBuildError(message);
     * // error.stack contains formatted output with code context
     * // error.metadata contains structured location data
     * ```
     *
     * @see {@link Message} for esbuild message structure
     * @see {@link getErrorMetadata} for formatting logic
     *
     * @since 2.0.0
     */

    constructor(message: PartialMessage) {
        super(message.text ?? '', 'esBuildError');

        this.errorMetadata = getErrorMetadata(message, { withFrameworkFrames: true });
        this.stack = formatStack(this.errorMetadata, this.name, this.message, message.notes);
    }
}
