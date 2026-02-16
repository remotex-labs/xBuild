/**
 * Imports
 */

import process from 'node:process';
import { xBuildBaseError } from '@errors/base.error';
import { formatStack, getErrorMetadata } from '@providers/stack.provider';

/**
 * Formats and logs error output in a standardized way.
 *
 * @remarks
 * This utility is designed for use in global error handlers such as
 * `uncaughtException` and `unhandledRejection`.
 * - If the error is an {@link AggregateError}, all individual errors are iterated and logged.
 * - Errors extending {@link xBuildBaseError} are logged directly without stack formatting.
 * - Standard {@link Error} instances are logged using {@link formatStack}, with both
 *   framework and native frames included.
 * - Non-error values are logged as-is.
 *
 * @param reason - The error, aggregate error, or arbitrary value to log.
 *
 * @example
 * ```ts
 * formatErrors(new Error("Something went wrong"));
 * ```
 *
 * @see formatStack
 * @see xJetBaseError
 * @see AggregateError
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
 * Global handler for uncaught exceptions in Node.js.
 *
 * @param reason - The value or error object representing the uncaught exception
 *
 * @throws This handler does not throw, but catches uncaught exceptions
 *
 * @remarks
 * When an uncaught exception occurs, this handler logs the error using {@link formatStack}
 * with both framework and native frames included, and then terminates the process
 * with exit code `2`, signaling failure.
 *
 * @example
 * ```ts
 * // Automatically registered when this file is loaded,
 * throw new Error('This error will be logged and exit the process');
 * ```
 *
 * @see formatStack
 * @see process.exit
 * @see {@link https://nodejs.org/api/process.html#event-uncaughtexception | Node.js documentation on 'uncaughtException'}
 *
 * @since 2.0.0
 */

process.on('uncaughtException', (reason: unknown) => {
    formatErrors(reason);
    process.exit(2);
});

/**
 * Global handler for unhandled promise rejections in Node.js.
 *
 * @param reason - The value or error object representing the reason for the unhandled promise rejection
 *
 * @throws This handler does not throw, but catches unhandled promise rejections
 *
 * @remarks
 * When an unhandled promise rejection occurs, this handler logs the error using {@link formatStack}
 * with both framework and native frames included, and then terminates the process
 * with exit code `2`. Using a distinct exit code allows differentiating between uncaught exceptions
 * and unhandled promise rejections.
 *
 * @example
 * ```ts
 * // Automatically registered when this file is loaded
 * Promise.reject(new Error('This rejection will be logged and exit the process'));
 * ```
 *
 * @see formatStack
 * @see process.exit
 * @see {@link https://nodejs.org/api/process.html#process_event_unhandledrejection | Node.js documentation on 'unhandledRejection'}
 *
 * @since 2.0.0
 */

process.on('unhandledRejection', (reason: unknown) => {
    formatErrors(reason);
    process.exit(2);
});
