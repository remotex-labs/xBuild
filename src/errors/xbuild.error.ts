/**
 * Import will remove at compile time
 */

import type { StackTraceInterface } from '@providers/interfaces/stack-provider.interface';

/**
 * Imports
 */

import { xBuildBaseError } from '@errors/base.error';

/**
 * Represents a generic xBuild framework error.
 *
 * Extends {@link xBuildBaseError} and automatically formats the stack trace
 * according to the provided options.
 *
 * @remarks
 * This class is intended for general-purpose errors within the xBuild framework.
 * The stack trace is formatted automatically during construction, with
 * framework-specific frames included by default.
 *
 * @example
 * ```ts
 * throw new xBuildError('An unexpected error occurred');
 * ```
 *
 * @since 1.0.0
 */

export class xBuildError extends xBuildBaseError {

    /**
     * Creates a new instance of `xBuildError`.
     *
     * @param message - The error message to display
     * @param options - Optional stack trace formatting options (default includes framework frames)
     *
     * @remarks
     * The constructor passes the message to the base `xBuildBaseError` class,
     * then reformats the stack trace using {@link xBuildBaseError.reformatStack}.
     *
     * @since 1.0.0
     */

    constructor(message: string, options: StackTraceInterface = { withFrameworkFrames: true }) {
        super(message);
        this.reformatStack(this, options);
    }
}
