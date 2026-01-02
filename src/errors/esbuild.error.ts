/**
 * Import will remove at compile time
 */

import type { ESBuildErrorInterface, ESBuildAggregateErrorInterface } from '@errors/interfaces/esbuild-error.interface';

/**
 * Imports
 */

import { xBuildBaseError } from '@errors/base.error';
import { xterm } from '@remotex-labs/xansi/xterm.component';
import { formatCode } from '@remotex-labs/xmap/formatter.component';
import { highlightCode } from '@remotex-labs/xmap/highlighter.component';

/**
 * Represents an error produced by ESBuild during the build process.
 *
 * Extends {@link xBuildBaseError} and provides formatted output for
 * individual or aggregated ESBuild errors.
 *
 * @remarks
 * If the error contains aggregate errors (`aggregateErrors`), each error
 * is formatted with colorized output, code highlighting, and positional
 * information. Otherwise, a standard stack trace is generated.
 *
 * @example
 * ```ts
 * import { esBuildError } from '@errors/esbuild.error';
 *
 * try {
 *   // some ESBuild operation
 * } catch (error) {
 *   throw new esBuildError(error as ESBuildErrorInterface);
 * }
 * ```
 *
 * @see xBuildBaseError
 * @see ESBuildErrorInterface
 * @see ESBuildAggregateErrorInterface
 *
 * @since 1.0.0
 */

export class esBuildError extends xBuildBaseError {
    /**
     * Creates a new `esBuildError` instance.
     *
     * @param error - The ESBuild error object to wrap
     *
     * @remarks
     * The constructor checks if the error contains `aggregateErrors` and
     * formats each entry with syntax highlighting and positional information.
     * If not, the error is reformatted using the base error's stack formatting.
     *
     * @since 1.0.0
     */

    constructor(error: ESBuildErrorInterface) {
        super('esBuildError build failed', 'esBuildError');

        if (error.errors) this.formatAggregateErrors(error.errors);
        else if (error.aggregateErrors) this.formatAggregateErrors(error.aggregateErrors);
        else this.reformatStack(error, { withFrameworkFrames: true });
    }

    /**
     * Formats a list of ESBuild aggregate errors into a single, colorized stack string.
     *
     * @param errors - Array of ESBuild aggregate errors
     *
     * @remarks
     * Each error is highlighted using {@link highlightCode} and {@link formatCode},
     * and includes file location, line, and column for easier debugging.
     *
     * @since 1.0.0
     */

    private formatAggregateErrors(errors: Array<ESBuildAggregateErrorInterface>): void {
        this.formattedStack = '';

        for (const error of errors) {
            this.formattedStack += `\n${ this.name }: \n${ xterm.lightCoral(`${ error.text }: ${ error.notes.pop()?.text }`) }\n\n`;
            this.formattedStack += formatCode(highlightCode(error.location.lineText.trim()), {
                startLine: error.location.line
            });

            this.formattedStack += '\n\n';
            this.formattedStack += `at ${ xterm.dim(error.location.file) } ${
                xterm.gray(`[${ error.location.line }:${ error.location.column }]`)
            }\n\n`;
        }
    }
}
