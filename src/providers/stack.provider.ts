/**
 * Import will remove at compile time
 */

import type { PartialMessage } from 'esbuild';
import type { SourceService } from '@remotex-labs/xmap';
import type { ParsedStackTraceInterface } from '@remotex-labs/xmap/parser.component';
import type { StackTraceInterface, ResolveMetadataInterface } from '@providers/interfaces/stack-provider.interface';

/**
 * Imports
 */

import { resolveError } from '@remotex-labs/xmap';
import { inject } from '@symlinks/symlinks.module';
import { xterm } from '@remotex-labs/xansi/xterm.component';
import { FilesModel } from '@typescript/models/files.model';
import { FrameworkService } from '@services/framework.service';
import { parseErrorStack } from '@remotex-labs/xmap/parser.component';
import { ConfigurationService } from '@services/configuration.service';
import { formatErrorCode } from '@remotex-labs/xmap/formatter.component';
import { highlightCode } from '@remotex-labs/xmap/highlighter.component';

/**
 * Retrieves a source service for a given stack frame, either from source maps or file snapshots.
 *
 * @param fileName - The source filename
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
 * @see StackContextInterface
 * @see FilesModel.getSnapshot
 * @see FrameworkService.getSourceMap
 *
 * @since 2.0.0
 */

export function getSource(fileName: string = ''): SourceService | null {
    const framework = inject(FrameworkService);
    const mapped = framework.getSourceMap(fileName);
    if (mapped) return mapped;

    const snapshot = inject(FilesModel).getOrTouchFile(fileName);
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
 * Parses error metadata into a structured stack representation with enhanced source information.
 *
 * @param raw - Either an esbuild {@link PartialMessage} or an {@link Error} object
 * @param options - Optional {@link StackTraceInterface} configuration for controlling stack parsing
 * @returns A {@link ResolveMetadataInterface} object containing formatted stack frames and code context
 *
 * @remarks
 * - Creates a {@link ResolveMetadataInterface} using injected services for file and framework resolution.
 * - Respects the `verbose` configuration setting to control native and framework frame visibility.
 * - Uses {@link getErrorStack} to parse the raw error into stack frames.
 * - Processes each frame via {@link resolveError}, filtering out empty results.
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

export function getErrorMetadata(raw: PartialMessage | Error, options?: StackTraceInterface): ResolveMetadataInterface {
    const framework = inject(FrameworkService);
    const verbose = inject(ConfigurationService).getValue(c => c.verbose) ?? false;
    const parsed = getErrorStack(raw);
    const resolved: ResolveMetadataInterface = resolveError(parsed, {
        ...options,
        withNativeFrames: verbose || (options?.withFrameworkFrames ?? false),
        getSource(path: string): SourceService | null {
            return getSource(path);
        }
    });

    resolved.stack.filter(frame => {
        if (!(options?.withFrameworkFrames ?? false) && framework.isFrameworkFile(frame)) return false;
        if(!resolved.formatCode && frame.code) {
            resolved.formatCode = formatErrorCode(
                {
                    code: highlightCode(frame.code),
                    line: frame.line ?? 0,
                    column: frame.column ?? 0,
                    startLine: frame.stratLine ?? 0
                },
                { color: xterm.brightPink }
            );
        }
    });

    return resolved;
}

/**
 * Formats error metadata into a human-readable string with enhanced styling.
 *
 * @param metadata - The {@link ResolveMetadataInterface} object containing parsed stack trace information
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

export function formatStack(metadata: ResolveMetadataInterface, name: string, message: string, notes: PartialMessage['notes'] = []): string {
    const parts = [ `\n${ name }: ${ xterm.lightCoral(message) }` ];
    for (const note of notes ?? []) {
        if(note.text) parts.push('\n ' + xterm.gray(note.text));
    }

    if (metadata.formatCode) parts.push(`\n\n${ metadata.formatCode }`);
    if (metadata.stack.length) {
        parts.push(`\n\nEnhanced Stack Trace:\n    ${ metadata.stack.map(stack => stack.format).join('\n    ') }\n`);
    }

    return parts.join('');
}
