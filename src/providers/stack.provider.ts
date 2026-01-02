/**
 * Import will remove at compile time
 */

import type { SourceOptionsInterface } from '@remotex-labs/xmap';
import type { StackFrameInterface } from '@remotex-labs/xmap/parser.component';
import type { PositionWithCodeInterface } from '@remotex-labs/xmap/formatter.component';
import type { StackInterface, StackContextInterface } from '@providers/interfaces/stack-provider.interface';
import type { StackMetadataInterface, StackTraceInterface } from '@providers/interfaces/stack-provider.interface';

/**
 * Imports
 */

import { Bias } from '@remotex-labs/xmap';
import { inject } from '@symlinks/symlinks.module';
import { dirname, join, relative } from 'path/posix';
import { xterm } from '@remotex-labs/xansi/xterm.component';
import { FrameworkService } from '@services/framework.service';
import { parseErrorStack } from '@remotex-labs/xmap/parser.component';
import { ConfigurationService } from '@services/configuration.service';
import { formatErrorCode } from '@remotex-labs/xmap/formatter.component';
import { highlightCode } from '@remotex-labs/xmap/highlighter.component';

/**
 * Regular expression to match multiple consecutive spaces.
 *
 * @remarks
 * Used to normalize spacing in formatted strings by replacing sequences
 * of two or more spaces with a single space.
 *
 * @since 2.0.0
 */

const MULTIPLE_SPACES = /\s{2,}/g;

/**
 * Regular expression to detect HTTP or HTTPS URLs.
 *
 * @remarks
 * Used to identify URL-based source paths in stack traces or source maps.
 *
 * @since 2.0.0
 */

const URL_PATTERN = /^https?:\/\//;

/**
 * Regular expression to detect HTTP or HTTPS URLs.
 *
 * @remarks
 * Used to identify URL-based source paths in stack traces or source maps.
 *
 * @since 2.0.0
 */

const FILE_PROTOCOL = /^file:\/\//;

/**
 * Formats a single stack frame into a readable string.
 *
 * @param frame - The stack frame to format
 * @returns A string representing the formatted stack frame, including function name,
 *          file path, and optional line/column information
 *
 * @remarks
 * - Shortens paths inside the framework root.
 * - Adds line and column information in gray if available.
 * - Applies coloring to the file path using {@link xterm.darkGray}.
 * - Normalizes multiple spaces in the output.
 *
 * @example
 * ```ts
 * const line = formatStackFrame.call(context, frame);
 * console.log(line); // at myFunction file.js [10:5]
 * ```
 *
 * @see xterm
 * @see MULTIPLE_SPACES
 *
 * @since 2.0.0
 */

export function formatStackFrame(this: StackContextInterface, frame: StackFrameInterface): string {
    if (frame.fileName?.includes(this.framework.rootPath)) {
        frame.fileName = relative(this.framework.rootPath, frame.fileName);
    }

    if (!frame.fileName) {
        return frame.source ?? '';
    }

    const position = (frame.line && frame.column)
        ? xterm.gray(`[${ frame.line }:${ frame.column }]`)
        : '';

    return `at ${ frame.functionName ?? '' } ${ xterm.darkGray(frame.fileName) } ${ position }`
        .replace(MULTIPLE_SPACES, ' ')
        .trim();
}

/**
 * Constructs a location string for a stack frame, suitable for links or display.
 *
 * @param frame - The stack frame being processed
 * @param position - The resolved source position with code
 * @returns A string representing the source location, including line number
 *
 * @remarks
 * - Handles HTTP/HTTPS URLs and file paths.
 * - Prepends the source root if available and normalizes path separators.
 * - Appends the line number using `#L` format.
 * - Falls back to the frame's fileName if no source is provided, stripping `file://` prefixes.
 *
 * @example
 * ```ts
 * const location = getSourceLocation.call(context, frame, position);
 * console.log(location); // src/utils/file.js#L12
 * ```
 *
 * @see URL_PATTERN
 * @see FILE_PROTOCOL
 *
 * @since 2.0.0
 */

export function getSourceLocation(this: StackContextInterface, frame: StackFrameInterface, position: Required<PositionWithCodeInterface>): string {
    const { source, sourceRoot, line } = position;

    if (source) {
        const lastIndex = source.lastIndexOf('http://');
        const lastHttpsIndex = source.lastIndexOf('https://');

        if (Math.max(lastIndex, lastHttpsIndex) !== -1)
            return `${ source.substring(Math.max(lastIndex, lastHttpsIndex)) }#L${ line }`;

        if (URL_PATTERN.test(source))
            return `${ source }#L${ line }`;

        if (sourceRoot) {
            const path = relative(
                dirname(this.framework.distPath),
                join(this.framework.distPath, source)
            );

            return `${ sourceRoot }${ path }#L${ line }`;
        }

        return `${ source }#L${ line }`;
    }

    return frame.fileName ? frame.fileName.replace(FILE_PROTOCOL, '') : '';
}

/**
 * Highlights code at a specific position with syntax coloring.
 *
 * @param position - The position object containing the code to highlight
 * @returns The code string with applied syntax highlighting and formatting
 *
 * @remarks
 * - Uses {@link highlightCode} to apply syntax highlighting to the `position.code`.
 * - Wraps the highlighted code with {@link formatErrorCode} for additional formatting.
 * - Default highlight color is {@link xterm.brightPink}.
 *
 * @example
 * ```ts
 * const highlighted = highlightPositionCode({ code: 'const x = 1;', line: 1, column: 0 });
 * console.log(highlighted); // Outputs syntax-highlighted code string
 * ```
 *
 * @see highlightCode
 * @see formatErrorCode
 * @see xterm.brightPink
 *
 * @since 2.0.0
 */

export function highlightPositionCode(position: PositionWithCodeInterface): string {
    return formatErrorCode(
        { ...position, code: highlightCode(position.code) },
        { color: xterm.brightPink }
    );
}

/**
 * Formats a stack frame using position information and highlights the relevant code.
 *
 * @param frame - The stack frame to format
 * @param position - The resolved source position containing line, column, and code
 * @returns A formatted string representing the stack frame with function, file, and line information
 *
 * @remarks
 * - Caches the code and formatted code on the context for reuse.
 * - Uses {@link highlightPositionCode} to apply syntax highlighting.
 * - Builds the file location using {@link getSourceLocation}.
 * - Delegates final formatting to {@link formatStackFrame}.
 *
 * @example
 * ```ts
 * const formatted = formatFrameWithPosition.call(context, frame, position);
 * console.log(formatted); // at myFunction src/utils/file.js [10:5]
 * ```
 *
 * @see formatStackFrame
 * @see getSourceLocation
 * @see highlightPositionCode
 *
 * @since 2.0.0
 */

export function formatFrameWithPosition(this: StackContextInterface, frame: StackFrameInterface, position: Required<PositionWithCodeInterface>): string {
    if (!this.code) {
        this.code = position.code;
        this.source = position.source;
        this.formatCode = highlightPositionCode(position);
    }

    return formatStackFrame.call(this, {
        ...frame,
        line: position.line,
        column: position.column,
        functionName: position.name ?? frame.functionName,
        fileName: getSourceLocation.call(this, frame, position)
    });
}

/**
 * Processes a single stack frame and formats it for display, optionally including source map information.
 *
 * @param frame - The stack frame to process
 * @param options - Optional {@link SourceOptionsInterface} for retrieving source positions
 * @returns A formatted string representing the stack frame, or an empty string if filtered out
 *
 * @remarks
 * - Skips native frames if {@link StackContextInterface.withNativeFrames} is false.
 * - Skips framework files if {@link StackContextInterface.withFrameworkFrames} is false.
 * - Attempts to resolve source positions using {@link FrameworkService.getSourceMap} and
 *   {@link getPositionWithCode}.
 * - Delegates formatting to {@link formatFrameWithPosition} or {@link formatStackFrame} depending on availability of position information.
 *
 * @example
 * ```ts
 * const formatted = stackEntry.call(context, frame, { includeCode: true });
 * console.log(formatted);
 * ```
 *
 * @see formatStackFrame
 * @see StackContextInterface
 * @see formatFrameWithPosition
 * @see FrameworkService.getSourceMap
 * @see SourceService.getPositionWithCode
 *
 * @since 2.0.0
 */

export function stackEntry(this: StackContextInterface, frame: StackFrameInterface, options?: SourceOptionsInterface): string {
    if (!this.withNativeFrames && frame.native) return '';
    if (!frame.line && !frame.column && !frame.fileName && !frame.functionName) return '';

    const source = this.framework.getSourceMap(frame.fileName ?? '');
    if (!source) {
        return formatStackFrame.call(this, frame);
    }

    const position = source.getPositionWithCode(
        frame.line ?? 0,
        frame.column ?? 0,
        Bias.LOWER_BOUND,
        options
    );

    if (position && (!this.withFrameworkFrames && this.framework.isFrameworkFile(position)))
        return '';

    if (position) {
        this.line = position.line;
        this.column = position.column;

        return formatFrameWithPosition.call(this, frame, position);
    }

    return formatStackFrame.call(this, frame);
}

/**
 * Parses an error stack trace into a structured and formatted representation.
 *
 * @param error - The {@link Error} object to parse
 * @param options - Optional {@link StackTraceInterface} configuration for controlling stack parsing
 * @returns A {@link StackInterface} object containing structured stack frames and formatted code
 *
 * @remarks
 * - Creates a {@link StackContextInterface} using the {@link FrameworkService} for resolving source maps.
 * - Uses {@link parseErrorStack} to convert the error into individual stack frames.
 * - Each frame is processed via {@link stackEntry}, applying filtering for native and framework files.
 * - Returns the fully formatted stack with code snippets and line/column metadata.
 *
 * @example
 * ```ts
 * try {
 *   throw new Error("Something went wrong");
 * } catch (error) {
 *   const stackData = parseStackTrace(error);
 *   console.log(stackData.stacks); // Array of formatted stack lines
 *   console.log(stackData.formatCode); // Highlighted code snippet
 * }
 * ```
 *
 * @see stackEntry
 * @see StackInterface
 * @see parseErrorStack
 * @see StackTraceInterface
 * @see StackContextInterface
 *
 * @since 2.0.0
 */

export function parseStackTrace(error: Error, options: StackTraceInterface = {}): StackInterface {
    const verbose = inject(ConfigurationService).getValue(
        (config) => config.verbose
    ) ?? false;

    const context: StackContextInterface = {
        code: '',
        source: '',
        framework: inject(FrameworkService),
        formatCode: '',
        withNativeFrames: false,
        withFrameworkFrames: false,
        ...options,
        ...(verbose && {
            withNativeFrames: true,
            withFrameworkFrames: true
        })
    };

    const parsedStack = parseErrorStack(error);
    const stacks = parsedStack.stack
        .map(frame => stackEntry.call(context, frame, options))
        .filter(Boolean);

    return {
        stacks,
        code: context.code,
        line: context.line ?? 0,
        column: context.column ?? 0,
        source: context.source,
        formatCode: context.formatCode
    };
}

/**
 * Formats an error and its stack trace into a human-readable string with enhanced styling.
 *
 * @param error - The {@link Error} object to format
 * @param options - Optional {@link StackTraceInterface} configuration for stack parsing
 * @returns A string containing the formatted error message, highlighted code, and enhanced stack trace
 *
 * @remarks
 * - Parses the error stack using {@link parseStackTrace}.
 * - Applies syntax highlighting and formatting to the code snippet and stack frames.
 * - Prepends the error name and message, followed by highlighted code (if available) and formatted stack frames.
 *
 * @example
 * ```ts
 * try {
 *   throw new Error("Something went wrong");
 * } catch (error) {
 *   console.log(formatStack(error));
 * }
 * ```
 *
 * @see xterm
 * @see parseStackTrace
 * @see StackTraceInterface
 *
 * @since 2.0.0
 */

export function formatStack(error: Error, options: StackTraceInterface = {}): string {
    const metadata = parseStackTrace(error, options);
    const parts = [ `\n${ error.name }: ${ error.message }` ];
    if (metadata.formatCode) {
        parts.push(`\n\n${ metadata.formatCode }`);
    }

    if (metadata.stacks.length > 0) {
        parts.push(`\n\nEnhanced Stack Trace:\n    ${ metadata.stacks.join('\n    ') }\n`);
    }

    return parts.join('');
}

/**
 * Extracts structured metadata from an error's stack trace.
 *
 * @param error - The {@link Error} object to process
 * @param options - Optional {@link StackTraceInterface} configuration for parsing the stack
 * @returns A {@link StackMetadataInterface} object containing code, line/column positions, formatted code, and stack frames
 *
 * @remarks
 * - Internally calls {@link parseStackTrace} to generate a structured representation of the stack trace.
 * - Prepends each stack frame with indentation for better readability.
 * - Useful for logging, debugging, or programmatic analysis of error stacks.
 *
 * @example
 * ```ts
 * try {
 *   throw new Error("Unexpected error");
 * } catch (error) {
 *   const meta = stackMetadata(error);
 *   console.log(meta.stacks); // Indented stack frames
 *   console.log(meta.formatCode); // Highlighted code snippet
 * }
 * ```
 *
 * @see parseStackTrace
 * @see StackTraceInterface
 * @see StackMetadataInterface
 *
 * @since 2.0.0
 */

export function stackMetadata(error: Error, options: StackTraceInterface = {}): StackMetadataInterface {
    let metadata = parseStackTrace(error, options);
    if (metadata.stacks.length < 1) metadata = parseStackTrace(error, { withFrameworkFrames: true });

    return {
        code: metadata.code,
        line: metadata.line,
        column: metadata.column,
        source: metadata.source,
        stacks: '    ' + metadata.stacks.join('\n    '),
        formatCode: metadata.formatCode
    };
}
