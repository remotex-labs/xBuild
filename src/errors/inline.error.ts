/**
 * Imports
 */

import { xBuildBaseError } from '@errors/base.error';
import { getErrorMetadata, formatStack } from '@providers/stack.provider';

/**
 * Custom error class for inline errors with enhanced formatting and source code context.
 *
 * @remarks
 * The `InlineError` class extends {@link xBuildBaseError} to provide specialized handling for
 * JavaScript/TypeScript errors with optional line offset adjustment. It automatically:
 * - Extracts and formats error metadata using {@link getErrorMetadata}
 * - Applies syntax highlighting to code context
 * - Generates enhanced stack traces with file locations
 * - Supports line offset adjustment for accurate error positioning
 * - Stores structured metadata in {@link StackInterface} format
 *
 * This class is designed to transform standard Error objects into human-readable, visually enhanced
 * output suitable for terminal display, making it easier to identify and fix errors in source code.
 *
 * **Key features:**
 * - Automatic error metadata extraction and formatting
 * - Contextual code display with configurable line offset
 * - Syntax highlighting with color-coded error indicators
 * - Enhanced stack trace generation
 * - Structured error metadata for programmatic access
 *
 * @example
 * ```ts
 * import { InlineError } from './inline.error';
 *
 * try {
 *   // Some code that might throw an error
 *   throw new Error('Unexpected token');
 * } catch (err) {
 *   throw new InlineError(err as Error);
 * }
 * ```
 *
 * @example
 * ```ts
 * // Error with line offset adjustment
 * try {
 *   // Code execution
 * } catch (err) {
 *   // Adjust error line number by 2 lines
 *   const error = new InlineError(err as Error, 2);
 *   console.error(error); // Displays formatted error with adjusted line context
 * }
 * ```
 *
 * @see {@link StackInterface} for metadata structure
 * @see {@link xBuildBaseError} for base error functionality
 * @see {@link getErrorMetadata} for metadata extraction logic
 * @see {@link formatStack} for stack formatting logic
 *
 * @since 2.0.0
 */

export class InlineError extends xBuildBaseError {
    /**
     * Creates a new inline error with formatted output and metadata.
     *
     * @param error - The base Error object containing error details
     * @param lineOffset - Optional line number offset for adjusting error position (default: 0)
     *
     * @remarks
     * The constructor processes the error to:
     * 1. Extract the error message for the base Error
     * 2. Generate error metadata using {@link getErrorMetadata} with optional line offset
     * 3. Format the stack trace using {@link formatStack}
     * 4. Store structured metadata in {@link errorMetadata}
     *
     * The `lineOffset` parameter allows you to adjust the reported line number in the error output.
     * This is useful when the actual error location differs from the reported location due to
     * transpilation, code generation, or other transformations:
     * - Positive values shift the line number down
     * - Negative values shift the line number up
     * - Zero (default) uses the original line number
     *
     * The error name is always set to `'InlineError'` and the stack is replaced
     * with a custom formatted version that includes:
     * - Error name and message with color coding
     * - Highlighted code snippet showing the error location
     * - Enhanced stack trace with file path and position
     *
     * @example
     * ```ts
     * const error = new Error('Syntax error in file');
     * const inlineError = new InlineError(error);
     * // inlineError.stack contains formatted output with code context
     * // inlineError.metadata contains structured location data
     * ```
     *
     * @example
     * ```ts
     * // Adjust error line by -3 to account for wrapper code
     * const error = new Error('Type mismatch');
     * const inlineError = new InlineError(error, -3);
     * // Error will be displayed 3 lines higher than originally reported
     * ```
     *
     * @see {@link getErrorMetadata} for metadata extraction and formatting
     * @see {@link formatStack} for stack trace formatting
     *
     * @since 2.0.0
     */

    constructor(error: Error, lineOffset: number = 0) {
        super(error.message, 'InlineError');

        this.errorMetadata = getErrorMetadata(error, {}, lineOffset);
        this.stack = formatStack(this.errorMetadata, this.name, this.message);
    }
}
