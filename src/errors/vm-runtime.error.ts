/**
 * Import will remove at compile time
 */

import type { StackTraceInterface } from '@providers/interfaces/stack-provider.interface';

/**
 * Imports
 */

import { xBuildBaseError } from '@errors/base.error';

/**
 * Represents an error that occurs during VM runtime execution.
 *
 * Extends {@link xBuildBaseError} and adds support for wrapping native errors,
 * handling `AggregateError` instances, and preserving nested errors.
 *
 * @remarks
 * This class is designed to encapsulate runtime errors in a virtual machine context.
 * If the original error is already a `xJetBaseError`, it is returned as-is.
 * AggregateErrors are flattened into an array of `VMRuntimeError` instances.
 *
 * The formatted stack trace is automatically generated for both single and nested errors.
 *
 * @example
 * ```ts
 * try {
 *   // Some VM execution code that throws
 * } catch (err) {
 *   const vmError = new VMRuntimeError(err, { withFrameworkFrames: true });
 *   console.error(vmError.formattedStack);
 * }
 * ```
 *
 * @since 2.0.0
 */

export class VMRuntimeError extends xBuildBaseError {
    /**
     * If the original error is an AggregateError, contains nested VMRuntimeError instances.
     *
     * @since 2.0.0
     */

    errors?: Array<VMRuntimeError> = [];

    /**
     * Creates a new `VMRuntimeError` instance from a native or xJetBaseError.
     *
     * @param originalError - The original error object thrown during execution.
     * @param options - Optional stack trace formatting options.
     *
     * @remarks
     * - If `originalError` is already an instance of `xJetBaseError`, it is returned as-is.
     * - If `originalError` is an `AggregateError`, each nested error is converted into a `VMRuntimeError`.
     * - The message and stack of the original error are preserved.
     * - The formatted stack trace is generated via {@link xBuildBaseError.reformatStack}.
     *
     * @since 2.0.0
     */

    constructor(private originalError: Error, options?: StackTraceInterface) {
        if (originalError instanceof xBuildBaseError) {
            return <VMRuntimeError> originalError;
        }

        // Pass the message to the base class Error
        super(originalError.message, 'VMRuntimeError');

        // Handle AggregateError
        if (this.originalError instanceof AggregateError && Array.isArray(this.originalError.errors)) {
            // Process nested errors
            this.errors = this.originalError.errors.map(error =>
                new VMRuntimeError(error, options)
            );
        }

        this.stack = this.originalError.stack;
        this.message = this.originalError.message;
        this.reformatStack(this.originalError, options);
    }

    /**
     * Custom Node.js inspect method for displaying the error in the console.
     *
     * @returns A string representation of the formatted stack trace, or
     *          a concatenated list of nested errors if present.
     *
     * @remarks
     * Overrides the Node.js default inspection behavior.
     * If this instance contains nested errors, they are listed with their formatted stacks.
     *
     * @since 2.0.0
     */

    [Symbol.for('nodejs.util.inspect.custom')](): string | undefined {
        if (this.errors && this.errors.length > 0) {
            const errorList = this.errors.map(
                (error) => `${ error.formattedStack ?? error.stack }`
            ).join('');

            return `VMRuntimeError Contains ${ this.errors.length } nested errors:\n${ errorList }\n`;
        }

        return this.formattedStack || this.stack;
    }
}
