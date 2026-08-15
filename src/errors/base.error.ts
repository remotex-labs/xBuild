/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { StackTraceInterface, ResolveMetadataInterface } from '@providers/interfaces/stack-provider.interface';

/**
 * Imports
 */

import { formatStack, getErrorMetadata } from '@providers/stack.provider';

/**
 * Base class for errors that print as authored code rather than as the stack of the emitted bundle.
 *
 * @remarks
 * A subclass gets nothing extra until it calls {@link reformatStack}, which resolves the captured stack through the
 * source maps and keeps both the frames as data and the block to print.
 * Node writes that block whenever the error reaches the console, so a caught error names the original file and line
 * and carries a highlighted snippet of the surrounding code.
 * Extend this class when callers need an error type of their own to branch on.
 * Throw {@link xBuildError} when a general framework error will do.
 *
 * @example
 * ```ts
 * class ValidationError extends xBuildBaseError {
 *     constructor(message: string) {
 *         super(message, 'ValidationError');
 *         this.reformatStack(this, { withFrameworkFrames: false });
 *     }
 * }
 *
 * const error = new ValidationError('email is not an address');
 * error.metadata?.stack[0].format; // 'at validate src/validator.ts:15:3'
 * console.error(error);            // the heading, the snippet, and the resolved trace
 * ```
 *
 * @see formatStack
 * @see xBuildError
 * @see getErrorMetadata
 * @see StackTraceInterface
 * @see ResolveMetadataInterface
 *
 * @since 2.0.0
 */

export abstract class xBuildBaseError extends Error {
    /**
     * Resolved stack metadata, as {@link getErrorMetadata} produced it.
     *
     * @remarks
     * Undefined until {@link reformatStack} runs, and replaced whole by every later call.
     * Reachable read-only through {@link metadata} for callers that want the frames as data rather than as text.
     *
     * @see ResolveMetadataInterface
     * @since 2.0.0
     */

    protected errorMetadata: ResolveMetadataInterface | undefined;

    /**
     * The block to print for this error, as {@link formatStack} produced it.
     *
     * @remarks
     * Undefined until {@link reformatStack} runs, which leaves the native stack as the only thing to print.
     * Coloring and highlighting are already applied, so the string is written out as it stands.
     *
     * @see formatStack
     * @since 2.0.0
     */

    protected formattedStack: string | undefined;

    /**
     * Creates the error and captures its raw stack, leaving the resolving to the subclass.
     *
     * @param message - Message describing what went wrong
     * @param name - Name the error reports itself under
     *
     * @remarks
     * The prototype is restored from `new.target`, so `instanceof` answers for the subclass and not only for `Error`,
     * which a transpiled subclass would otherwise lose.
     * The captured stack starts at the caller rather than inside this constructor, and stays the raw one until the
     * subclass calls {@link reformatStack} - passing a name here only heads the block, it resolves nothing.
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
     * The resolved stack metadata of this error.
     *
     * @returns The metadata, or `undefined` when {@link reformatStack} has not run
     *
     * @remarks
     * The frames as data, for a logger or a reporting service that renders them itself instead of printing the block.
     *
     * @example
     * ```ts
     * error.metadata;               // undefined - the subclass never reformatted
     * error.metadata?.stack.length; // 4 - after reformatStack
     * error.metadata?.formatCode;   // the highlighted snippet, when a frame carried code
     * ```
     *
     * @see ResolveMetadataInterface
     * @since 2.0.0
     */

    get metadata(): ResolveMetadataInterface | undefined {
        return this.errorMetadata;
    }

    /**
     * Renders the error for `console.log`, `console.error` and `util.inspect`.
     *
     * @returns The resolved block when there is one, and the native stack otherwise
     *
     * @remarks
     * Node calls this in place of printing the error's own fields, which is what puts the resolved trace on the
     * terminal without the caller having to format anything.
     * An empty block counts as no block, so an error whose sources could not be resolved still prints its native
     * stack rather than nothing.
     *
     * @example
     * ```ts
     * console.error(error); // 'ValidationError: email is not an address', the snippet, and the resolved trace
     * ```
     *
     * @see {@link https://nodejs.org/api/util.html#custom-inspection-functions-on-objects | Custom inspection}
     * @since 2.0.0
     */

    [Symbol.for('nodejs.util.inspect.custom')](): string | undefined {
        return this.formattedStack || this.stack;
    }

    /**
     * Resolves an error's stack against its sources and keeps both the metadata and the block to print.
     *
     * @param error - Error to resolve, usually `this`
     * @param options - Frame selection and code window size
     *
     * @remarks
     * Call it from the subclass constructor, after the name and the message are in place, since both are read off
     * the error to head the block with.
     * The error need not be `this` - a wrapper passes the cause it carries to report the trace of the failure that
     * actually happened.
     * Calling it again replaces both fields, so resolving a second time under different options is safe.
     *
     * @see formatStack
     * @see getErrorMetadata
     * @see StackTraceInterface
     *
     * @since 2.0.0
     */

    protected reformatStack(error: Error, options?: StackTraceInterface): void {
        this.errorMetadata = getErrorMetadata(error, options);
        this.formattedStack = formatStack(this.errorMetadata, error.name, error.message);
    }
}
