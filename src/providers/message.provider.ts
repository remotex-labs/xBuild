/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { PartialMessage, Message, OnStartResult } from 'esbuild';

/**
 * Imports
 */

import { parseErrorStack } from '@remotex-labs/xmap/parser.component';

/**
 * Reports whether a caught value carries esbuild's own messages rather than being an ordinary error.
 *
 * @param error - Value caught from a build, of unknown shape
 * @returns `true` when the value holds esbuild messages, which narrows it to {@link OnStartResult}
 *
 * @remarks
 * The test is a non-null object whose `errors` array holds at least one entry,
 * and whose first entry is an object carrying a `detail` key.
 * esbuild puts `detail` on every message it produces, so the key is there even where it holds nothing,
 * and the guard reads whether the key is present rather than what it holds.
 * That is what separates a nested build that failed from an error a hook threw:
 * the first already carries messages a reporter files as they stand,
 * while the second reaches {@link errorToMessage} to become one.
 * A result assembled by hand goes unrecognized, since a message written as `{ text }` carries no `detail` key.
 *
 * @example
 * ```ts
 * isEsbuildError(buildFailure);                     // true  - errors[0] came from esbuild
 * isEsbuildError(new Error('boom'));                // false - no errors
 * isEsbuildError({ errors: [] });                   // false - nothing to report
 * isEsbuildError({ errors: [ { text: 'oops' } ] }); // false - no detail key
 * ```
 *
 * @see errorToMessage
 * @since 3.0.0
 */

export function isEsbuildError(error: unknown): error is OnStartResult {
    if (error === null || typeof error !== 'object') return false;

    const errors = (error as { errors?: unknown }).errors;
    if (!Array.isArray(errors) || errors.length === 0) return false;
    const first = errors[0];

    return first !== null && typeof first === 'object' && 'detail' in first;
}

/**
 * Converts a thrown error into an esbuild message.
 *
 * @param error - Error to convert, kept whole on the message's `detail`
 * @param id - Message id to file the diagnostic under, empty when the caller names none
 * @param name - Plugin name to credit the message to, empty when the caller names none
 * @returns The message, carrying a location when the error's first frame named one
 *
 * @remarks
 * The error travels on `detail` rather than flattened into the text,
 * so {@link getErrorStack} unwraps it later and resolves the whole trace instead of the summary line alone.
 * `text` is the message the stack parsed out, and `location` comes from the first frame,
 * set only when that frame names a file, a line, and a column.
 * A frame of the three leaves the message without a location,
 * which leaves a reader with the text alone.
 * The location is filed under the `file` namespace, since a parsed frame points at a path on disk
 * rather than at something a plugin serves itself.
 *
 * @example
 * ```ts
 * const message = errorToMessage(new Error('boom'), 'macro-failed', 'xbuild');
 * message.text;            // 'boom'
 * message.id;              // 'macro-failed'
 * message.location?.line;  // 19 - the line the first frame points at
 * ```
 *
 * @see getErrorStack
 * @see parseErrorStack
 *
 * @since 3.0.0
 */

export function errorToMessage(error: Error, id: string = '', name: string = ''): Message {
    const message = { detail: error, id, pluginName: name } as PartialMessage;

    const parsedStack = parseErrorStack(error);
    const frame = parsedStack.stack[0];

    message.text = parsedStack.message;
    if (frame?.fileName && frame.line && frame.column) {
        message.location = {
            line: frame.line,
            file: frame.fileName,
            column: frame.column,
            namespace: 'file'
        };
    }

    return message as Message;
}
