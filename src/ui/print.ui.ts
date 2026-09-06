/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { errorColor } from '@ui/color.ui';
import type { Metafile, PartialMessage } from 'esbuild';
import type { MessageRowInterface } from '@ui/interfaces/print-ui.interface';
import type { ResolveMetadataInterface } from '@providers/interfaces/stack-provider.interface';

/**
 * Imports
 */

import { resolve } from 'path';
import { stdout } from 'process';
import { prefix } from '@ui/banner.ui';
import { relative } from '@remotex-labs/xmap';
import { inject } from '@remotex-labs/xinject';
import { stripAnsi } from '@remotex-labs/xansi';
import { cursorTo, clearScreenDown } from 'readline';
import { xterm } from '@remotex-labs/xansi/xterm.component';
import { getErrorMetadata } from '@providers/stack.provider';
import { FrameworkService } from '@services/framework.service';
import { infoColor, mutedColor, okColor, pathColor, warnColor } from '@ui/color.ui';
import { ArrowSymbol, DefaultWidth, DotSymbol, Indent, Kilobyte, Megabyte, OutputLimit } from '@constants/ui.constant';

/**
 * Opens a reported line with the package's mark, a symbol, and the action being reported.
 *
 * @param action - What the line reports, such as `build` or `serve`
 * @param symbol - Symbol between the mark and the action, a dimmed arrow by default
 * @returns The opening of the line, colored
 *
 * @remarks
 * Every line printed outside a message group opens this way,
 * so the mark, the symbol, and the action sit in the same three places whatever printed them.
 * The symbol is what a caller varies to say how the action went, since the action itself reads the same either way.
 *
 * @example
 * ```ts
 * createActionPrefix('build');                         // '[xBuild] → build'
 * createActionPrefix('build', okColor(SuccessSymbol)); // '[xBuild] ✓ build'
 * ```
 *
 * @see prefix
 * @since 3.0.0
 */

export function createActionPrefix(action: string, symbol: string = infoColor.dim(ArrowSymbol)): string {
    return `${ prefix() } ${ symbol } ${ infoColor(action) }`;
}

/**
 * Counts the characters a text takes on screen.
 *
 * @param text - Text to measure, colored or not
 * @returns The number of characters that print
 *
 * @remarks
 * The escape sequences a color leaves behind take no width of their own,
 * so measuring the string itself would pad a colored column by however many bytes its color cost.
 *
 * @example
 * ```ts
 * visible(pathColor('src/index.ts')); // 12
 * ```
 *
 * @since 3.0.0
 */

export function visible(text: string): number {
    return stripAnsi(text).length;
}

/**
 * Pads a text with spaces up to a width.
 *
 * @param text - Text to pad, colored or not
 * @param size - Width to pad it to, counted in printed characters
 * @returns The text, followed by the spaces that carry it to the width
 *
 * @remarks
 * The width is measured through {@link visible}, so a colored text pads to what it prints rather than to what it holds.
 * A text already at or past the width comes back as it is rather than cut,
 * since a column that overflows reads better than one that loses the end of a name.
 *
 * @example
 * ```ts
 * pad('src', 6);       // 'src   '
 * pad('src/index', 6); // 'src/index' - already past the width
 * ```
 *
 * @see visible
 * @since 3.0.0
 */

export function pad(text: string, size: number): string {
    return text + ' '.repeat(Math.max(0, size - visible(text)));
}

/**
 * Brings the path a frame resolved to back to one the project can be read against.
 *
 * @param file - Path the frame named, as the source map spelled it
 * @returns The path relative to the directory the run was started in
 *
 * @remarks
 * A map spells its sources relative to what was written rather than to what is being read,
 * so a config compiled by this package resolves as a path reaching back out of the framework's own directory.
 * Such a path is resolved from there rather than from the project, which is the only place it means anything,
 * and every other path is resolved the way this package keys files everywhere else.
 * A source that names a URL rather than a path is left as it is, there being no root to read it against.
 *
 * @example
 * ```ts
 * sourcePath('../config.xbuild.ts');        // 'config.xbuild.ts'
 * sourcePath('src/index.ts');               // 'src/index.ts'
 * sourcePath('https://github.com/x/y.ts');  // 'https://github.com/x/y.ts'
 * ```
 *
 * @see FrameworkService
 * @since 3.0.0
 */

export function sourcePath(file: string): string {
    if (file.includes('://')) return file;
    const absolute = file.startsWith('.')
        ? resolve(inject(FrameworkService).frameworkRoot, file)
        : FrameworkService.resolve(file);

    return relative(process.cwd(), absolute);
}

/**
 * Renders where a message points.
 *
 * @param file - Path the message points at, absent when it points nowhere
 * @param line - Line within that file
 * @param column - Column within that line
 * @returns The location, colored, empty when there is no file to point at
 *
 * @example
 * ```ts
 * formatLocation('src/index.ts', 12, 8); // 'src/index.ts:12:8'
 * formatLocation(undefined);             // ''
 * ```
 *
 * @see sourcePath
 * @since 3.0.0
 */

export function formatLocation(file?: string, line: number = 0, column: number = 0): string {
    if (!file) return '';
    const separator = mutedColor.dim(':');

    return `${ pathColor(sourcePath(file)) }${ separator }${ warnColor(String(line)) }${ separator }${ warnColor(String(column)) }`;
}

/**
 * Renders the code window and the trace printed under a message.
 *
 * @param metadata - Already resolved trace of the message, so nothing is resolved twice
 * @param indent - What every line is indented by
 * @returns The lines to print under the message, empty when it resolved to neither code nor a trace
 *
 * @remarks
 * A trace of a single frame says nothing the location line has not said already, so it is left out.
 * Paths are printed from the directory the run was started in, the absolute part being the same for every frame.
 *
 * @see getErrorMetadata
 * @since 3.0.0
 */

export function formatDetail(metadata: ResolveMetadataInterface, indent: string): Array<string> {
    const root = `${ process.cwd() }/`;
    const lines: Array<string> = [];

    if (metadata.formatCode)
        lines.push('', ...metadata.formatCode.split('\n').map(line => `${ indent }${ xterm.dim(line) }`));

    if (metadata.stack.length > 1) lines.push('', ...metadata.stack.map(frame => {
        return `${ indent }${ mutedColor.dim(frame.format.replaceAll(root, '')) }`;
    }));

    return lines.length > 0 ? [ ...lines, '' ] : lines;
}

/**
 * Works a message out into the parts a report line is laid out from.
 *
 * @param message - Message to describe
 * @param code - Whether the code window and trace are wanted under the line
 * @returns The message worked out, ready to be measured and printed
 *
 * @remarks
 * A diagnostic filed under a TypeScript code - an id of `TS<code>` - already points at the file that was written,
 * so it is taken at its word.
 * Anything else points at what was built rather than at what was written - a plugin throwing from a config that was
 * compiled to run reports the offset it failed at in the compiled text - so it is resolved through the source map
 * and read off the first frame instead.
 * The resolve is done once and serves both the location and what is printed under it,
 * and is skipped entirely by a diagnostic that needs neither.
 *
 * @example
 * ```ts
 * describeMessage({ id: 'TS2304', location: { file: 'src/index.ts', line: 12, column: 8 } }, false);
 * // { id: 'TS2304', location: 'src/index.ts:12:8', detail: [] }
 * ```
 *
 * @see getErrorMetadata
 * @see MessageRowInterface
 *
 * @since 3.0.0
 */

export function describeMessage(message: PartialMessage, code: boolean): MessageRowInterface {
    const typescript = message.id?.startsWith('TS') ?? false;
    const metadata = typescript && !code
        ? undefined
        : getErrorMetadata(message, { linesAfter: 1, linesBefore: 1, withFrameworkFrames: true });

    const frame = typescript ? undefined : metadata?.stack[0];
    const point = frame ?? message.location;

    return {
        id: message.id ?? '',
        detail: code && metadata ? formatDetail(metadata, Indent.repeat(2)) : [],
        location: formatLocation(frame?.fileName ?? message.location?.file, point?.line, point?.column)
    };
}

/**
 * Prints a group of messages under a heading, in columns sized to what they hold.
 *
 * @param messages - Messages to print, the group being skipped when there are none
 * @param title - Heading the group is printed under
 * @param color - Color the heading, the symbol, and the ids are printed in
 * @param symbol - Symbol each message is marked with
 * @param code - Whether each message carries its code window and trace
 *
 * @remarks
 * Every message is worked out once, in the pass that measures the columns,
 * since neither the location column nor the id column can be sized until all of them have been seen.
 * An id column is left out entirely when nothing in the group carries one.
 *
 * @example
 * ```ts
 * printGroup(errors, 'Errors', errorColor, ErrorSymbol, true);
 * //  Errors (1)
 * //    x config.xbuild.ts:126:27  asdasd
 * ```
 *
 * @see describeMessage
 * @since 3.0.0
 */

export function printGroup(
    messages: Array<PartialMessage>, title: string, color: typeof errorColor, symbol: string, code = false
): void {
    if (messages.length < 1) return;

    let left = 0;
    let middle = 0;
    const rows: Array<MessageRowInterface> = [];

    for (const message of messages) {
        const row = describeMessage(message, code);
        left = Math.max(left, visible(row.location));
        middle = Math.max(middle, row.id.length);
        rows.push(row);
    }

    const lines = [ `\n ${ color(title) } ${ mutedColor.dim(`(${ rows.length })`) }` ];
    for (const [ index, { id, location, detail }] of rows.entries()) {
        const tag = middle > 0 ? `${ pad(color(id), middle) }  ` : '';

        lines.push(`${ Indent }${ color(symbol) } ${ pad(location, left) }  ${ tag }${ mutedColor(messages[index].text ?? '') }`);
        lines.push(...detail);
    }

    console.log(lines.join('\n'));
}

/**
 * Clears the terminal and puts the cursor back at the top.
 *
 * @remarks
 * The screen is pushed out of view rather than wiped, so the scrollback survives a clear.
 *
 * @since 3.0.0
 */

export function clearScreen(): void {
    const rows = Math.max(0, stdout.rows - 2);
    if (rows > 0) console.log('\n'.repeat(rows));

    cursorTo(stdout, 0, 0);
    clearScreenDown(stdout);
}

/**
 * The width of the terminal, or what stands in for one that does not report it.
 *
 * @returns Columns the report is laid out in
 *
 * @since 3.0.0
 */

export function width(): number {
    return stdout.columns || DefaultWidth;
}

/**
 * Renders a byte count in the largest unit that keeps it above one.
 *
 * @param bytes - Size to render
 * @returns The size with its unit
 *
 * @example
 * ```ts
 * formatSize(512);    // '512 B'
 * formatSize(458520); // '447.77 KB'
 * ```
 *
 * @since 3.0.0
 */

export function formatSize(bytes: number): string {
    if (bytes < Kilobyte) return `${ bytes } B`;
    if (bytes < Megabyte) return `${ (bytes / Kilobyte).toFixed(2) } KB`;

    return `${ (bytes / Megabyte).toFixed(2) } MB`;
}

/**
 * Writes what a build wrote, largest first, with the sizes set against the right margin.
 *
 * @param metafile - Metafile of the finished build, read for its outputs
 * @param limit - How many outputs to name before the rest are counted rather than listed, `Infinity` for all of them
 *
 * @remarks
 * The sizes are set flush against the right margin, so their digits line up under one another,
 * and the heading carries the total, which is the number a reader is usually after.
 * A build of many entry points writes more than a reader wants to scroll,
 * so the largest few are named and the rest left as a count carrying what it comes to.
 *
 * @example
 * ```ts
 * printOutputs(metafile);
 * //  Outputs (18)                                    1.24 MB
 * //    dist/index.js.map                               681 B
 * ```
 *
 * @since 3.0.0
 */

export function printOutputs(metafile: Metafile, limit: number = OutputLimit): void {
    const outputs = Object.entries(metafile.outputs).sort(
        ([ , a ], [ , b ]) => b.bytes - a.bytes
    );

    if (outputs.length < 1) return;
    const listed = outputs.slice(0, limit);
    const sizes = listed.map(([ , { bytes }]) => formatSize(bytes));
    const right = Math.max(...sizes.map(size => size.length));
    const total = outputs.reduce((sum, [ , { bytes }]) => sum + bytes, 0);

    const room = width() - Indent.length - right - 4;
    const header = ` ${ okColor('Outputs') } ${ mutedColor.dim(`(${ outputs.length })`) }`;
    const lines = [ `\n${ pad(header, width() - right - 1) }${ warnColor.dim(formatSize(total)) }` ];

    for (const [ index, [ path ]] of listed.entries())
        lines.push(
            `${ Indent }${ infoColor.dim(ArrowSymbol) } ${ pad(pathColor(path), room + 1) }`
            + warnColor.dim(sizes[index].padStart(right))
        );

    if (outputs.length > limit) {
        const rest = outputs.slice(limit).reduce((sum, [ , { bytes }]) => sum + bytes, 0);
        const more = mutedColor.dim(`${ DotSymbol } ${ outputs.length - limit } more`);
        lines.push(`${ Indent }  ${ pad(more, room + 1) }${ warnColor.dim(formatSize(rest).padStart(right)) }`);
    }

    console.log(lines.join('\n'));
}
