/**
 * Import will remove at compile time
 */

import type { BuildResult, Message } from 'esbuild';
import type { BuildResultInterface } from './interfaces/esbuild-messages-provider.interface';

/**
 * Imports
 */

import { TypesError } from '@errors/types.error';
import { xBuildBaseError } from '@errors/base.error';
import { esBuildError } from '@errors/esbuild.error';
import { VMRuntimeError } from '@errors/vm-runtime.error';

/**
 * Converts an esbuild message to a normalized Error instance.
 *
 * @param msg - The esbuild message object containing error or warning details
 * @returns A normalized Error instance appropriate for the message type
 *
 * @remarks
 * This function handles different types of esbuild messages and converts them to the appropriate
 * error classes used throughout the xBuild system. It prioritizes preserving existing error
 * instances while wrapping raw messages in appropriate error types.
 *
 * **Conversion priority**:
 * 1. If `msg.detail` is already an `xBuildBaseError` or `TypesError`, return it unchanged
 * 2. If `msg.detail` is any other Error, wrap it in `VMRuntimeError` with framework frames
 * 3. If `msg.location` exists, create an `esBuildError` with a formatted code snippet
 * 4. Otherwise, wrap the message text in a `VMRuntimeError`
 *
 * This normalization ensures consistent error handling and reporting throughout the build
 * pipeline, with appropriate context and formatting for each error type.
 *
 * @example
 * ```ts
 * // Message with location information
 * const msg: Message = {
 *   text: 'Unexpected token',
 *   location: { file: 'src/index.ts', line: 10, column: 5 }
 * };
 * const error = normalizeMessageToError(msg);
 * // Returns esBuildError with formatted code snippet
 *
 * // Message with existing error detail
 * const msgWithError: Message = {
 *   text: 'Build failed',
 *   detail: new TypesError('Type checking failed', [])
 * };
 * const error2 = normalizeMessageToError(msgWithError);
 * // Returns the TypesError unchanged
 * ```
 *
 * @see {@link TypesError}
 * @see {@link esBuildError}
 * @see {@link VMRuntimeError}
 * @see {@link xBuildBaseError}
 *
 * @since 2.0.0
 */

export function normalizeMessageToError(msg: Message | esBuildError): Error | undefined {
    if (msg instanceof xBuildBaseError)
        return msg;

    if (msg.detail instanceof xBuildBaseError || msg.detail instanceof TypesError)
        return msg.detail;

    if (msg.detail instanceof Error)
        return new VMRuntimeError(msg.detail, { withFrameworkFrames: true });

    if (msg.location)
        return new esBuildError(msg);

    if(msg.text)
        return new VMRuntimeError(new Error(msg.text));
}

/**
 * Processes an array of esbuild messages and converts them to normalized errors.
 *
 * @param messages - Array of esbuild message objects to process
 * @param target - Array to populate with normalized error instances
 *
 * @remarks
 * This function iterates through esbuild messages and converts each one to a normalized
 * Error instance using {@link normalizeMessageToError}, appending the results to the
 * target array.
 *
 * The target array is modified in place, allowing errors and warnings from different
 * sources to be aggregated into the same collection.
 *
 * **Processing behavior**:
 * - Each message is converted independently
 * - Conversion failures do not stop processing of remaining messages
 * - a Target array is modified in place (no return value)
 * - Empty message arrays are handled gracefully
 *
 * Common use cases:
 * - Converting esbuild error arrays to normalized errors
 * - Converting esbuild warning arrays to normalized errors
 * - Aggregating messages from multiple build results
 *
 * @example
 * ```ts
 * const buildResult: BuildResult = await build({ ... });
 * const errors: Array<Error> = [];
 * const warnings: Array<Error> = [];
 *
 * // Process errors and warnings
 * processEsbuildMessages(buildResult.errors, errors);
 * processEsbuildMessages(buildResult.warnings, warnings);
 *
 * console.log(`Build completed with ${errors.length} errors and ${warnings.length} warnings`);
 * ```
 *
 * @see {@link enhancedBuildResult}
 * @see {@link normalizeMessageToError}
 *
 * @since 2.0.0
 */

export function processEsbuildMessages(messages: Array<Message> = [], target: Array<Error>): void {
    for (const msg of messages) {
        const error = normalizeMessageToError(msg);
        if(error) target.push(error);
    }
}

/**
 * Converts esbuild's BuildResult into xBuild's BuildResultInterface with normalized errors.
 *
 * @param source - Partial esbuild BuildResult containing build artifacts and messages
 * @returns A BuildResultInterface with normalized errors and warnings
 *
 * @remarks
 * This function transforms esbuild's build result into the xBuild-specific result interface,
 * converting all error and warning messages to normalized Error instances while preserving
 * build artifacts like metafiles, output files, and mangle cache.
 *
 * **Transformation process**:
 * 1. Creates a new BuildResultInterface with empty error/warning arrays
 * 2. Copies build artifacts (metafile, outputFiles, mangleCache) directly
 * 3. Processes errors array through {@link processEsbuildMessages}
 * 4. Processes warnings array through {@link processEsbuildMessages}
 * 5. Returns the fully populated result object
 *
 * **Preserved artifacts**:
 * - `metafile`: Build metadata including inputs, outputs, and dependencies
 * - `outputFiles`: Generated file contents when `write: false`
 * - `mangleCache`: Identifier mangling cache for consistent minification
 *
 * All esbuild Message objects are converted to Error instances, providing consistent
 * error handling throughout the xBuild system with proper stack traces, formatting,
 * and error classification.
 *
 * @example
 * ```ts
 * const esbuildResult = await build({
 *   entryPoints: ['src/index.ts'],
 *   write: false,
 *   metafile: true
 * });
 *
 * const result = enhancedBuildResult(esbuildResult);
 * // result.errors: Array<Error> (normalized)
 * // result.warnings: Array<Error> (normalized)
 * // result.metafile: Metafile (preserved)
 * // result.outputFiles: OutputFile[] (preserved)
 *
 * console.log(`Build produced ${result.errors.length} errors`);
 * ```
 *
 * @see {@link BuildResultInterface}
 * @see {@link processEsbuildMessages}
 * @see {@link normalizeMessageToError}
 *
 * @since 2.0.0
 */

export function enhancedBuildResult(source: Partial<BuildResult>): BuildResultInterface {
    const target: BuildResultInterface = {
        errors: [],
        warnings: [],
        metafile: source.metafile,
        outputFiles: source.outputFiles,
        mangleCache: source.mangleCache
    };

    processEsbuildMessages(source.errors, target.errors);
    processEsbuildMessages(source.warnings, target.warnings);

    return target;
}

/**
 * Type guard that checks if an unknown value is an esbuild BuildResult error object.
 *
 * @param error - The value to check, typically from a catch block
 * @returns `true` if the value is a BuildResult with errors property, `false` otherwise
 *
 * @remarks
 * This type guard validates that an error object follows the esbuild BuildResult structure,
 * which includes an `errors` property. It's useful for distinguishing between esbuild-specific
 * errors and other error types during error handling.
 *
 * The function performs two checks:
 * 1. Verifies the value is an object (not null)
 * 2. Checks for the presence of an `errors` property
 *
 * When the function returns `true`, TypeScript will narrow the type of the parameter to
 * `BuildResult`, allowing type-safe access to BuildResult properties like `errors`,
 * `warnings`, `metafile`, etc.
 *
 * Common use cases:
 * - Catch block error type discrimination
 * - Conditional error handling based on an error source
 * - Type narrowing for BuildResult-specific error processing
 *
 * @example
 * ```ts
 * try {
 *   await build({ entryPoints: ['src/index.ts'] });
 * } catch (error) {
 *   if (isBuildResultError(error)) {
 *     // TypeScript knows error is BuildResult here
 *     console.error(`Build failed with ${error.errors.length} errors`);
 *     processEsbuildMessages(error.errors, errorList);
 *   } else if (error instanceof Error) {
 *     // Handle generic errors
 *     console.error(error.message);
 *   }
 * }
 * ```
 *
 * @example
 * ```ts
 * // In error aggregation
 * const errors: Array<Error> = [];
 *
 * if (isBuildResultError(caughtError)) {
 *   const result = enhancedBuildResult(caughtError);
 *   errors.push(...result.errors);
 * } else {
 *   errors.push(new Error(String(caughtError)));
 * }
 * ```
 *
 * @see {@link BuildResult}
 * @see {@link enhancedBuildResult}
 * @see {@link processEsbuildMessages}
 *
 * @since 2.0.0
 */

export function isBuildResultError(error: unknown): error is BuildResult {
    return typeof error === 'object' && error !== null && 'errors' in error;
}
