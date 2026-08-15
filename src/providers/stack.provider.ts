/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { PartialMessage } from 'esbuild';
import type { SourceService } from '@remotex-labs/xmap';
import type { ParsedStackTraceInterface } from '@remotex-labs/xmap/parser.component';
import type { StackTraceInterface, ResolveMetadataInterface } from '@providers/interfaces/stack-provider.interface';

/**
 * Imports
 */

import { inject } from '@remotex-labs/xinject';
import { FilesModel } from '@models/files.model';
import { resolveError } from '@remotex-labs/xmap';
import { xterm } from '@remotex-labs/xansi/xterm.component';
import { FrameworkService } from '@services/framework.service';
import { parseErrorStack } from '@remotex-labs/xmap/parser.component';
import { formatErrorCode } from '@remotex-labs/xmap/formatter.component';
import { highlightCode } from '@remotex-labs/xmap/highlighter.component';

/**
 * Returns a source resolver for a file, from its source map when one is registered and from its cached text otherwise.
 *
 * @param fileName - Path of the file a stack frame points at, relative or absolute
 * @returns The resolver for that file, or `null` when the file has neither a map nor cached text
 *
 * @remarks
 * A registered map wins since it resolves back to the authored file rather than to the emitted one.
 * Without a map the cached text stands in through a minimal resolver that slices the surrounding lines as its
 * code window, so an unmapped file still prints a snippet.
 * That window spans three lines either side unless the caller asks for a different span and is clamped to the
 * bounds of the file.
 * `startLine` and `endLine` come back as 1-based line numbers rather than as indexes into the text,
 * which is how {@link formatErrorCode} reads them, so a printed number labels the line it belongs to.
 * The line passes through as it arrived, while the column comes back one higher than it was given.
 *
 * @example
 * ```ts
 * getSource('dist/index.js');                            // SourceService - the registered map
 * getSource('src/index.ts')?.getPositionWithCode(10, 4); // line 10, column 5, lines 7-13 as code
 * getSource('missing.ts');                               // null
 * ```
 *
 * @see SourceService
 * @see FilesModel.touch
 * @see FrameworkService.getSourceMap
 *
 * @since 2.0.0
 */

export function getSource(fileName: string = ''): SourceService | null {
    const framework = inject(FrameworkService);
    const mapped = framework.getSourceMap(fileName);
    if (mapped) return mapped;

    const snapshot = inject(FilesModel).touch(fileName);
    const code = snapshot.snapshot?.text;

    if (!snapshot || !code) return null;
    const lines = code.split('\n');

    return {
        getPositionWithCode: (line, column, _bias, options) => {
            const after = options?.linesAfter ?? 3;
            const before = options?.linesBefore ?? 3;

            // both bounds are 1-based line numbers, so only the slice start converts to an index
            const startLine = Math.max(line - before, 1);
            const endLine = Math.min(line + after, lines.length);

            return {
                line,
                name: null,
                code: lines.slice(startLine - 1, endLine).join('\n'),
                source: fileName,
                column: column,
                endLine,
                startLine,
                sourceRoot: null,
                sourceIndex: -1,
                generatedLine: -1,
                generatedColumn: -1
            };
        }
    } as SourceService;
}

/**
 * Brings an error and an esbuild message to the same shape - a name, a message, and a list of frames.
 *
 * @param raw - Thrown error, or the message esbuild reported for a failed build
 * @returns The parsed trace, with an empty frame list when there is nothing to point at
 *
 * @remarks
 * An `Error` is parsed from its own stack text, whether it arrives on its own or wrapped as the `detail` of an
 * esbuild message.
 * A plain esbuild message carries no stack, so its location becomes the single frame of the trace, flagged as
 * ordinary code: not eval, not async, not native, and not a constructor call.
 * A message without a location resolves to no frames at all, which leaves the caller with the text alone.
 *
 * @example
 * ```ts
 * getErrorStack(new Error('boom')).stack.length; // 12 - frames parsed from error.stack
 *
 * getErrorStack({ text: 'Unexpected token', location: { file: 'src/index.ts', line: 4, column: 2 } }).stack;
 * // [ { source: '@src/index.ts', fileName: 'src/index.ts', line: 4, column: 2, ... } ]
 *
 * getErrorStack({ text: 'Could not resolve module' }).stack; // []
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
                column: raw.location.column || 1,
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
 * Resolves an error back to its authored sources and picks the code window to print with it.
 *
 * @param raw - Thrown error, or the message esbuild reported for a failed build
 * @param options - Frame selection and code window size, as {@link resolveError} takes them
 * @param verbose - Whether native frames stay in the resolved stack
 * @returns The resolved trace, carrying `formatCode` when a frame supplied a code window
 *
 * @remarks
 * Every frame resolves through {@link getSource}, so a mapped frame points at the authored file and an unmapped
 * one falls back to the cached text of the emitted file.
 * `verbose` and `withFrameworkFrames` each admit native frames to the stack, while `withFrameworkFrames` alone
 * decides whether a framework frame may supply the code window.
 * The window is taken from the first frame that carries code, highlighted and marked at that position, and is
 * left unset when no frame carries any - a resolve against sources that are gone prints as a bare trace.
 *
 * @example
 * ```ts
 * const metadata = getErrorMetadata(error, { linesBefore: 2, linesAfter: 2 });
 * metadata.stack[0].format; // 'at run src/index.ts:12:8'
 * metadata.formatCode;      // lines 10-14, highlighted, with column 8 marked in bright pink
 * ```
 *
 * @see resolveError
 * @see getErrorStack
 * @see StackTraceInterface
 * @see ResolveMetadataInterface
 *
 * @since 3.0.0
 */

export function getErrorMetadata(raw: PartialMessage | Error, options?: StackTraceInterface, verbose: boolean = false): ResolveMetadataInterface {
    const framework = inject(FrameworkService);
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
                    line: frame.line ?? 1,
                    column: frame.column ?? 1,
                    startLine: frame.stratLine ?? 1
                },
                { color: xterm.brightPink }
            );
        }
    });

    return resolved;
}

/**
 * Renders resolved metadata as the block that gets printed to the terminal.
 *
 * @param metadata - Resolved trace, as {@link getErrorMetadata} returns it
 * @param name - Name to head the block with, such as `TypeError` or `esBuildMessage`
 * @param message - Message to head the block with
 * @param notes - Extra lines esbuild attached to the message, printed in gray under the heading
 * @returns The block, ready to write as-is
 *
 * @remarks
 * The heading is always written, the code window and the trace only when the metadata holds them, so an error
 * resolved against missing sources still prints as a single readable line.
 * Coloring of the window and of each frame is left as {@link getErrorMetadata} produced it - nothing here is
 * highlighted a second time.
 *
 * @example
 * ```ts
 * formatStack(metadata, 'TypeError', 'x is not a function');
 * //
 * // TypeError: x is not a function
 * //
 * // 11 | x();
 * //    | ^
 * //
 * // Enhanced Stack Trace:
 * //     at run src/index.ts:11:2
 * ```
 *
 * @see xterm
 * @see getErrorMetadata
 * @see ResolveMetadataInterface
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
