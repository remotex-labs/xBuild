/**
 * Import will remove at compile time
 */

import type { StackTraceInterface } from '@providers/interfaces/stack-provider.interface';

/**
 * Imports
 */

import { formatStack } from '@providers/stack.provider';

/**
 * A base class for custom errors with enhanced stack trace formatting and source code information.
 *
 * The `BaseError` class extends the native `Error` class, adding functionality to format the error stack
 * trace and include details from a source map service. This is useful for debugging errors in compiled
 * or transpiled code by providing clearer information about the source of the error.
 */

export abstract class xBuildBaseError extends Error {
    /**
     * Stores a pre-formatted stack trace for the error.
     * @since 2.0.0
     */

    protected formattedStack: string | undefined;

    /**
     * Creates a new instance of the base error class.
     *
     * @param message - The error message describing the problem.
     * @param name - Optional error name; defaults to `'xBuildBaseError'`.
     *
     * @remarks
     * Properly sets up the prototype chain to ensure `instanceof` works for derived classes.
     * Captures the stack trace if supported by the runtime environment.
     *
     * @example
     * ```ts
     * class MyError extends xJetBaseError {}
     * throw new MyError('Something went wrong');
     * ```
     *
     * @since 2.0.0
     */

    protected constructor(message: string, name: string = 'xBuildBaseError') {
        super(message);

        // Ensure a correct prototype chain (important for `instanceof`)
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = name;

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /**
     * Custom inspect behavior for Node.js console output.
     *
     * @returns The formatted stack trace if available, otherwise the raw stack trace.
     *
     * @since 1.0.0
     */

    [Symbol.for('nodejs.util.inspect.custom')](): string | undefined {
        return this.formattedStack || this.stack;
    }

    /**
     * Generates a formatted stack trace using provided options and stores it in `formattedStack`.
     *
     * @param error - The error object to format.
     * @param options - Options controlling stack trace formatting.
     *
     * @remarks
     * This method is intended to be called by derived classes or internal code
     * to prepare a styled or enhanced stack trace for logging or display.
     *
     * @example
     * ```ts
     * class ValidationError extends xBuildBaseError {
     *   constructor(message: string) {
     *     super(message);
     *     this.reformatStack(this, { withFrameworkFrames: true });
     *   }
     * }
     * ```
     *
     * @since 2.0.0
     */

    protected reformatStack(error: Error, options?: StackTraceInterface): void {
        this.formattedStack = formatStack(error, options);
    }
}
