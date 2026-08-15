/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { StackTraceInterface } from '@providers/interfaces/stack-provider.interface';

/**
 * Imports
 */

import { xBuildBaseError } from '@errors/base.error';

/**
 * A general framework error, resolved against its sources as it is constructed.
 *
 * @remarks
 * Throw this when the failure needs no error type of its own.
 * Extend {@link xBuildBaseError} instead when callers have to branch on the type,
 * or when the error has to carry extra fields.
 * Framework frames stay eligible for the code window by default, since a failure raised here is usually raised
 * inside the build itself and the snippet would otherwise be dropped.
 *
 * @example
 * ```ts
 * throw new xBuildError('tsconfig.json was not found');
 * // xBuildBaseError: tsconfig.json was not found
 * //
 * // Enhanced Stack Trace:
 * //     at run src/bash.ts:41:11
 * ```
 *
 * @see xBuildBaseError
 * @see StackTraceInterface
 *
 * @since 1.0.0
 */

export class xBuildError extends xBuildBaseError {

    /**
     * Creates the error and resolves its stack right away.
     *
     * @param message - Message describing what went wrong
     * @param options - Frame selection and code window size, keeping framework frames by default
     *
     * @remarks
     * Resolution happens here rather than on first print, so the frames describe the throw site even when the error
     * travels before anything renders it.
     *
     * @example
     * ```ts
     * new xBuildError('entry point missing').metadata?.formatCode;               // the highlighted throw site
     * new xBuildError('entry point missing', { linesBefore: 1, linesAfter: 1 }); // a tighter code window
     * ```
     *
     * @see StackTraceInterface
     * @see xBuildBaseError.reformatStack
     *
     * @since 1.0.0
     */

    constructor(message: string, options: StackTraceInterface = { withFrameworkFrames: true }) {
        super(message);
        this.reformatStack(this, options);
    }
}
