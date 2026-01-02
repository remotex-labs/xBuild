/**
 * Import will remove at compile time
 */

import type { FrameworkService } from '@services/framework.service';

/**
 * Options for parsing a stack trace.
 *
 * @remarks
 * These options allow you to customize how stack traces are parsed,
 * such as including native frames, filtering framework frames, or
 * adding surrounding code lines.
 *
 * @since 2.0.0
 */

export interface StackTraceInterface {
    /**
     * Number of lines of source code to include after the error line.
     * @since 2.0.0
     */

    linesAfter?: number;

    /**
     * Number of lines of source code to include before the error line.
     * @since 2.0.0
     */

    linesBefore?: number;

    /**
     * Whether to include native (built-in) frames in the parsed stack trace.
     * @since 2.0.0
     */

    withNativeFrames?: boolean;

    /**
     * Whether to include frames from the framework itself in the parsed stack trace.
     * @since 2.0.0
     */

    withFrameworkFrames?: boolean;
}

/**
 * Internal parsing context for a stack trace.
 *
 * @remarks
 * This context extends {@link StackTraceInterface} with additional
 * runtime state required during stack trace parsing.
 *
 * @see StackTraceInterface
 * @since 2.0.0
 */

export interface StackContextInterface extends StackTraceInterface {
    /**
     * Extracted source code related to the current stack frame.
     * @since 2.0.0
     */

    code: string;

    /**
     * Line number of the error within the source file.
     * @since 2.0.0
     */

    line?: number;

    /**
     * Column number of the error within the source file.
     * @since 2.0.0
     */

    column?: number;

    /**
     * Original source file path, if available.
     * @since 2.0.0
     */

    source?: string;

    /**
     * Reference to the {@link FrameworkService} for resolving framework files and source maps.
     * @since 2.0.0
     */

    framework: FrameworkService;

    /**
     * Formatted version of the source code with syntax highlighting.
     * @since 2.0.0
     */

    formatCode: string;
}

/**
 * Structured result of a parsed stack trace.
 *
 * @remarks
 * This represents the finalized parsed output of a stack trace,
 * suitable for use in logging or reporting.
 *
 * @since 2.0.0
 */

export interface StackInterface {
    /**
     * Extracted source code related to the error.
     * @since 2.0.0
     */

    code: string;

    /**
     * Line number of the error within the source file.
     * @since 2.0.0
     */

    line: number;

    /**
     * Column number of the error within the source file.
     * @since 2.0.0
     */

    column: number;

    /**
     * Original source file path, if available.
     * @since 2.0.0
     */

    source?: string;

    /**
     * Formatted stack trace entries.
     * @since 2.0.0
     */

    stacks: string[];

    /**
     * Formatted version of the source code with syntax highlighting.
     * @since 2.0.0
     */

    formatCode: string;
}

/**
 * Metadata-friendly representation of a parsed stack trace.
 *
 * @remarks
 * This interface is optimized for reporting or serialization,
 * where stack entries are joined into a single string instead
 * of an array.
 *
 * @see StackInterface
 * @since 2.0.0
 */

export interface StackMetadataInterface extends Omit<StackInterface, 'stacks'> {
    /**
     * Concatenated stack trace entries, formatted as a single string.
     * @since 2.0.0
     */

    stacks: string;
}
