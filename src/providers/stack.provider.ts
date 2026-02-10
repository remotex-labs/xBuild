/**
 * Import will remove at compile time
 */

import type { PartialMessage } from 'esbuild';
import type { SourceService } from '@remotex-labs/xmap';
import type { StackTraceInterface } from '@providers/interfaces/stack-provider.interface';
import type { ParsedStackTraceInterface, StackFrameInterface } from '@remotex-labs/xmap/parser.component';
import type { StackInterface, StackContextInterface } from '@providers/interfaces/stack-provider.interface';

/**
 * Imports
 */

import { inject } from '@symlinks/symlinks.module';
import { xterm } from '@remotex-labs/xansi/xterm.component';
import { FilesModel } from '@typescript/models/files.model';
import { FrameworkService } from '@services/framework.service';
import { relative, dirname, join } from '@components/path.component';
import { parseErrorStack } from '@remotex-labs/xmap/parser.component';
import { ConfigurationService } from '@services/configuration.service';
import { highlightCode } from '@remotex-labs/xmap/highlighter.component';
import { type PositionWithCodeInterface, Bias } from '@remotex-labs/xmap';
import { type SourceOptionsInterface, formatErrorCode } from '@remotex-labs/xmap/formatter.component';

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
 * Regular expression to detect file:// protocol URLs.
 *
 * @remarks
 * Used to identify and strip file protocol prefixes from file paths.
 *
 * @since 2.0.0
 */

const FILE_PROTOCOL = /^file:\/\//;

/**
 * Extracts a parsed stack trace from either an Error object or an esbuild PartialMessage.
 *
 * @param raw - Either an {@link Error} object or an esbuild {@link PartialMessage}
 * @returns A {@link ParsedStackTraceInterface} containing structured stack frame data
 *
 * @remarks
 * - If `raw` is an Error instance, parses it directly using {@link parseErrorStack}.
 * - If `raw.detail` is an Error, parses that instead.
 * - For esbuild messages without location info, returns a minimal parsed stack.
 * - For esbuild messages with location, creates a single-frame stack from the location data.
 *
 * @example
 * ```ts
 * const error = new Error("Something went wrong");
 * const parsed = getErrorStack(error);
 * console.log(parsed.stack); // Array of stack frames
 * ```
 *
 * @see parseErrorStack
 * @see ParsedStackTraceInterface
 *
 * @since 2.0.0
 */

export function getErrorStack(raw: Partial<PartialMessage> | Error): ParsedStackTraceInterface {
    if (raw instanceof Error) return parseErrorStack(raw);
    if (raw.detail instanceof Error) return parseErrorStack(raw.detail);

    if (!raw.location) {
        return { stack: [], name: 'esBuildMessage', message: raw.text ?? '', rawStack: '' };
    }

    return {
        name: 'esBuildMessage',
        message: raw.text ?? '',
        rawStack: '',
        stack: [
            {
                source: `@${ raw.location.file }`,
                line: raw.location.line,
                column: raw.location.column,
                fileName: raw.location.file,
                eval: false,
                async: false,
                native: false,
                constructor: false
            }
        ]
    };
}

/**
 * Retrieves a source service for a given stack frame, either from source maps or file snapshots.
 *
 * @param frame - The stack frame containing file information
 * @returns A {@link SourceService} if the source can be resolved, otherwise null
 *
 * @remarks
 * - First attempts to retrieve a mapped source using {@link FrameworkService.getSourceMap}.
 * - Falls back to file snapshots via {@link FilesModel.getSnapshot} if no source map exists.
 * - Creates a minimal {@link SourceService} implementation for snapshot-based sources.
 * - Returns null if neither a source map nor snapshot is available.
 * - The created service implements `getPositionWithCode` to extract code snippets with context lines.
 *
 * @example
 * ```ts
 * const source = getSource.call(context, frame);
 * if (source) {
 *   const position = source.getPositionWithCode(10, 5, Bias.LOWER_BOUND);
 * }
 * ```
 *
 * @see SourceService
 * @see StackFrameInterface
 * @see StackContextInterface
 * @see FilesModel.getSnapshot
 * @see FrameworkService.getSourceMap
 *
 * @since 2.0.0
 */

export function getSource(this: StackContextInterface, frame: StackFrameInterface): SourceService | null {
    const fileName = frame.fileName ?? '';
    const mapped = this.framework.getSourceMap(fileName);
    if (mapped) return mapped;

    const snapshot = this.files.getOrTouchFile(fileName);
    const code = snapshot?.contentSnapshot?.text;

    if (!snapshot || !code) return null;
    const lines = code.split('\n');

    return {
        getPositionWithCode: (line, column, _bias, options) => {
            const before = options?.linesBefore ?? 3;
            const after = options?.linesAfter ?? 3;

            const startLine = Math.max(line - before, 0);
            const endLine = Math.min(line + after, lines.length);

            return {
                line,
                column: column + 1,
                code: lines.slice(startLine, endLine).join('\n'),
                source: fileName,
                name: null,
                startLine,
                endLine,
                sourceRoot: null,
                sourceIndex: -1,
                generatedLine: -1,
                generatedColumn: -1
            };
        }
    } as SourceService;
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
 * Formats a stack frame into a human-readable string with colorized output.
 *
 * @param frame - The stack frame to format
 * @returns A formatted string representation of the stack frame
 *
 * @remarks
 * - Converts absolute file paths to relative paths based on {@link FrameworkService.rootPath}.
 * - Displays function name, file name, line number, and column number.
 * - Uses {@link xterm} color utilities for enhanced readability.
 * - Normalizes multiple consecutive spaces using {@link MULTIPLE_SPACES} regex.
 * - Falls back to `frame.source` if no file name is available.
 *
 * @example
 * ```ts
 * const formatted = formatStackFrame.call(context, frame);
 * console.log(formatted); // "at myFunction src/utils.ts [10:5]"
 * ```
 *
 * @see xterm
 * @see StackFrameInterface
 * @see StackContextInterface
 *
 * @since 2.0.0
 */

export function formatStackFrame(this: StackContextInterface, frame: StackFrameInterface): string {
    let fileName = frame.fileName;
    if (fileName?.includes(this.framework.rootPath)) {
        fileName = relative(this.framework.rootPath, fileName);
    }

    if (!fileName) return frame.source ?? '';

    const position =
        frame.line && frame.column
            ? xterm.gray(`[${ frame.line }:${ frame.column }]`)
            : '';

    return `at ${ frame.functionName ?? '' } ${ xterm.darkGray(fileName) } ${ position }`
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
 * - Handles HTTP/HTTPS URLs by appending `#L` line number format.
 * - Searches for embedded HTTP/HTTPS URLs within the source path.
 * - Prepends the source root if available and normalizes path separators.
 * - Appends the line number using `#L` format for all location strings.
 * - Falls back to the frame's fileName if no source is provided, stripping `file://` prefixes.
 *
 * @example
 * ```ts
 * const location = getSourceLocation.call(context, frame, position);
 * console.log(location); // "src/utils/file.js#L12"
 * ```
 *
 * @see URL_PATTERN
 * @see FILE_PROTOCOL
 * @see StackFrameInterface
 * @see PositionWithCodeInterface
 *
 * @since 2.0.0
 */

export function getSourceLocation(this: StackContextInterface, frame: StackFrameInterface, position: Required<PositionWithCodeInterface>): string {
    const { source, sourceRoot, line } = position;

    if (!source) {
        return frame.fileName ? frame.fileName.replace(FILE_PROTOCOL, '') : '';
    }

    const httpIndex = Math.max(source.lastIndexOf('http://'), source.lastIndexOf('https://'));
    if (httpIndex > 0) return `${ source.substring(httpIndex) }#L${ line }`;
    if (URL_PATTERN.test(source)) return `${ source }#L${ line }`;

    if (sourceRoot) {
        const path = relative(dirname(this.framework.distPath), join(this.framework.distPath, source));

        return `${ sourceRoot }${ path }#L${ line }`;
    }

    return `${ source }#L${ line }`;
}

/**
 * Formats a stack frame with enhanced position information from source maps.
 *
 * @param frame - The original stack frame
 * @param position - The resolved source position with code context
 * @returns A formatted string representing the enhanced stack frame
 *
 * @remarks
 * - Caches the first encountered code snippet in the context for later display.
 * - Stores highlighted code in {@link StackContextInterface.formatCode} on first call.
 * - Uses {@link highlightPositionCode} to generate syntax-highlighted code snippets.
 * - Delegates to {@link formatStackFrame} with updated position and location information.
 * - Updates frame properties with mapped source location via {@link getSourceLocation}.
 *
 * @example
 * ```ts
 * const formatted = formatFrameWithPosition.call(context, frame, position);
 * console.log(formatted); // Enhanced stack frame with source-mapped location
 * ```
 *
 * @see formatStackFrame
 * @see getSourceLocation
 * @see StackFrameInterface
 * @see StackContextInterface
 * @see highlightPositionCode
 * @see PositionWithCodeInterface
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
 * - Skips frames without any location information (line, column, fileName, or functionName).
 * - Attempts to resolve source positions using {@link getSource} and {@link SourceService.getPositionWithCode}.
 * - Filters out framework files if {@link StackContextInterface.withFrameworkFrames} is false.
 * - Applies line offset adjustments if {@link StackContextInterface.lineOffset} is set.
 * - Stores the resolved line and column in the context for reference.
 * - Delegates formatting to {@link formatFrameWithPosition} or {@link formatStackFrame} based on position availability.
 *
 * @example
 * ```ts
 * const formatted = stackEntry.call(context, frame, { linesBefore: 3, linesAfter: 3 });
 * console.log(formatted);
 * ```
 *
 * @see getSource
 * @see formatStackFrame
 * @see StackContextInterface
 * @see formatFrameWithPosition
 * @see SourceService.getPositionWithCode
 *
 * @since 2.0.0
 */

export function stackEntry(this: StackContextInterface, frame: StackFrameInterface, options?: SourceOptionsInterface): string {
    if (!this.withNativeFrames && frame.native) return '';
    if (!frame.line && !frame.column && !frame.fileName && !frame.functionName) return '';

    const source = getSource.call(this, frame);
    if (!source) return formatStackFrame.call(this, frame);

    const position = source.getPositionWithCode(
        frame.line ?? 0,
        frame.column ?? 0,
        Bias.LOWER_BOUND,
        options
    );

    if (!position) return formatStackFrame.call(this, frame);
    if (!this.withFrameworkFrames && this.framework.isFrameworkFile(position)) return '';
    if (this.lineOffset) {
        position.line += this.lineOffset;
        position.startLine += this.lineOffset;
        position.endLine += this.lineOffset;
    }

    this.line = position.line;
    this.column = position.column;

    return formatFrameWithPosition.call(this, frame, position);
}


/**
 * Parses error metadata into a structured stack representation with enhanced source information.
 *
 * @param raw - Either an esbuild {@link PartialMessage} or an {@link Error} object
 * @param options - Optional {@link StackTraceInterface} configuration for controlling stack parsing
 * @param lineOffset - Optional line number offset to apply to all positions (default: 0)
 * @returns A {@link StackInterface} object containing formatted stack frames and code context
 *
 * @remarks
 * - Creates a {@link StackContextInterface} using injected services for file and framework resolution.
 * - Respects the `verbose` configuration setting to control native and framework frame visibility.
 * - Uses {@link getErrorStack} to parse the raw error into stack frames.
 * - Processes each frame via {@link stackEntry}, filtering out empty results.
 * - Returns structured metadata including formatted code, line/column positions, and stack traces.
 * - Line offsets are applied to all resolved positions for alignment with external systems.
 *
 * @example
 * ```ts
 * try {
 *   throw new Error("Something went wrong");
 * } catch (error) {
 *   const metadata = getErrorMetadata(error, { linesBefore: 5, linesAfter: 5 });
 *   console.log(metadata.stacks); // Array of formatted stack lines
 *   console.log(metadata.formatCode); // Highlighted code snippet
 * }
 * ```
 *
 * @see stackEntry
 * @see getErrorStack
 * @see StackInterface
 * @see StackTraceInterface
 * @see StackContextInterface
 * @see ConfigurationService
 *
 * @since 2.0.0
 */

export function getErrorMetadata(raw: PartialMessage | Error, options?: StackTraceInterface, lineOffset: number = 0): StackInterface {
    const verbose = inject(ConfigurationService).getValue(c => c.verbose) ?? false;
    const context: StackContextInterface = {
        code: '',
        line: 0,
        column: 0,
        source: '',
        formatCode: '',
        lineOffset,
        files: inject(FilesModel),
        framework: inject(FrameworkService),
        withNativeFrames: verbose,
        withFrameworkFrames: verbose,
        ...options
    };

    const parsed = getErrorStack(raw);
    const stacks = parsed.stack
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
 * Formats error metadata into a human-readable string with enhanced styling.
 *
 * @param metadata - The {@link StackInterface} object containing parsed stack trace information
 * @param name - The error name (e.g., "TypeError", "ReferenceError")
 * @param message - The error message describing what went wrong
 * @param notes - Optional array of esbuild {@link PartialMessage} notes to display
 * @returns A string containing the formatted error output with colorized text, code snippet, and stack trace
 *
 * @remarks
 * - Constructs a formatted error output from pre-parsed stack metadata.
 * - Displays the error name and message at the top with {@link xterm.lightCoral} highlighting.
 * - Includes any additional notes in gray text below the error message.
 * - Appends syntax-highlighted code snippet if available in metadata.
 * - Appends formatted stack trace frames with proper indentation under "Enhanced Stack Trace".
 * - All formatting and syntax highlighting should be pre-applied in the metadata.
 *
 * @example
 * ```ts
 * const metadata: StackInterface = {
 *   code: "const x = undefined;\nx.toString();",
 *   line: 2,
 *   column: 1,
 *   source: "/path/to/file.ts",
 *   stacks: ["at Object.<anonymous> (/path/to/file.ts:2:1)"],
 *   formatCode: "1 | const x = undefined;\n2 | x.toString();\n    ^"
 * };
 *
 * const notes = [{ text: "Did you forget to check for null?" }];
 * console.log(formatStack(metadata, "TypeError", "Cannot read property 'toString' of undefined", notes));
 * ```
 *
 * @see xterm
 * @see PartialMessage
 * @see StackInterface
 * @see getErrorMetadata
 *
 * @since 2.0.0
 */

export function formatStack(metadata: StackInterface, name: string, message: string, notes: PartialMessage['notes'] = []): string {
    const parts = [ `\n${ name }: ${ xterm.lightCoral(message) }` ];
    for (const note of notes ?? []) {
        if(note.text) parts.push('\n ' + xterm.gray(note.text));
    }

    if (metadata.formatCode) parts.push(`\n\n${ metadata.formatCode }`);
    if (metadata.stacks.length) {
        parts.push(`\n\nEnhanced Stack Trace:\n    ${ metadata.stacks.join('\n    ') }\n`);
    }

    return parts.join('');
}
