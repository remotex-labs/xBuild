/**
 * Imports
 */

import process from 'node:process';
import { xBuildBaseError } from '@errors/base.error';
import { formatStack, getErrorMetadata } from '@providers/stack.provider';

/**
 * Prints whatever reached a global handler the way the framework prints its own errors.
 *
 * @param reason - Error, aggregate error, or any other value that escaped
 *
 * @remarks
 * An {@link xBuildBaseError} already carries its resolved block, so it goes to the console untouched rather than
 * being resolved a second time.
 * Any other `Error` is resolved here with the framework and native frames kept,
 * since a value that got this far offers no other clue about where it came from.
 * An {@link AggregateError} is announced once and then unwrapped, each of its errors going through the same choice.
 * A value that is not an error is printed as it stands.
 *
 * @example
 * ```ts
 * formatErrors(new Error('connect ECONNREFUSED')); // heading, snippet and resolved trace
 * formatErrors(new xBuildError('bad config'));     // the block the error already carries
 * formatErrors('not an error at all');             // 'not an error at all'
 * ```
 *
 * @see formatStack
 * @see xBuildBaseError
 * @see getErrorMetadata
 *
 * @since 2.0.0
 */

export function formatErrors(reason: unknown): void {
    if (reason instanceof AggregateError) {
        console.error('AggregateError:', reason.message);
        for (const err of reason.errors) {
            if (err instanceof Error && !(err instanceof xBuildBaseError)) {
                const metadata = getErrorMetadata(err, { withFrameworkFrames: true, withNativeFrames: true });
                console.error(formatStack(metadata, err.name, err.message));
            } else {
                console.error(err);
            }
        }

        return;
    }

    if (reason instanceof Error && !(reason instanceof xBuildBaseError)) {
        const metadata = getErrorMetadata(reason, { withFrameworkFrames: true, withNativeFrames: true });
        console.error(formatStack(metadata, reason.name, reason.message));
    } else {
        console.error(reason);
    }
}

/**
 * Prints an exception that escaped every `try` and leaves the process with exit code `2`.
 *
 * @remarks
 * Registered as a side effect of importing this file, which is why the CLI entry point imports it on its first line -
 * anything thrown while the later imports evaluate is already covered.
 * Node leaves the process in an undefined state once an exception gets this far, so the handler prints and exits
 * instead of letting the build carry on.
 *
 * @example
 * ```ts
 * import '@errors/uncaught.error';
 * throw new Error('unreachable state'); // the resolved block, then exit code 2
 * ```
 *
 * @see formatErrors
 * @see {@link https://nodejs.org/api/process.html#event-uncaughtexception | process 'uncaughtException'}
 *
 * @since 2.0.0
 */

process.on('uncaughtException', (reason: unknown) => {
    formatErrors(reason);
    process.exit(2);
});

/**
 * Prints a rejection nobody awaited and leaves the process with exit code `2`.
 *
 * @remarks
 * Registered alongside the exception handler, since an unawaited rejection ends the build just as surely and would
 * otherwise print Node's own warning without any source resolution.
 * The exit code matches the one used for uncaught exceptions: both mean the build died on an unhandled failure, and
 * nothing downstream needs to tell them apart.
 *
 * @example
 * ```ts
 * import '@errors/uncaught.error';
 * Promise.reject(new Error('write after end')); // the resolved block, then exit code 2
 * ```
 *
 * @see formatErrors
 * @see {@link https://nodejs.org/api/process.html#event-unhandledrejection | process 'unhandledRejection'}
 *
 * @since 2.0.0
 */

process.on('unhandledRejection', (reason: unknown) => {
    formatErrors(reason);
    process.exit(3);
});
