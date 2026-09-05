/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { Metafile, Message, PartialMessage } from 'esbuild';
import type { LifecycleEventsType } from '@interfaces/lifecycle.interface';
import type { DiagnosticInterface } from '@typescript/services/interfaces/typescript-service.interface';

/**
 * Imports
 */

import { stdout } from 'process';
import { prefix } from '@ui/banner.ui';
import * as readline from 'node:readline';
import { relative } from '@remotex-labs/xmap';
import { stripAnsi } from '@remotex-labs/xansi';
import { getErrorMetadata } from '@providers/stack.provider';
import { errorColor, infoColor, keywordColor, mutedColor, okColor, pathColor, textColor, warnColor } from '@ui/color.ui';

/**
 * The indent every line under a heading is written at.
 *
 * @since 3.0.0
 */

export const INDENT = '   ';

/**
 * The units a byte count is rendered in.
 *
 * @since 3.0.0
 */

export const KILOBYTE = 1024;
export const MEGABYTE = KILOBYTE * 1024;

/**
 * The glyphs the report is drawn with.
 *
 * @remarks
 * One glyph per role rather than per caller, so a reader learns them once:
 * a tick for what went through, a cross for what did not, a dot for what deserves a look,
 * and an arrow for what is only being named.
 *
 * @since 3.0.0
 */

export const DOT_SYMBOL = '·';
export const ARROW_SYMBOL = '→';
export const ERROR_SYMBOL = '×';
export const RELOAD_SYMBOL = '↻';
export const WARNING_SYMBOL = '•';
export const SUCCESS_SYMBOL = '✓';

/**
 * The widths the report lays itself out in.
 *
 * @remarks
 * A column is capped rather than left to the longest entry it holds,
 * since one deep path would otherwise push every message off the right of the terminal.
 * The fallback width is what a terminal that does not report its own is drawn at.
 *
 * @since 3.0.0
 */

export const OUTPUT_LIMIT = 6;
export const DEFAULT_WIDTH = 100;
export const LOCATION_WIDTH = 42;

/**
 * The width of the terminal, or what stands in for one that does not report it.
 *
 * @returns Columns the report is laid out in
 *
 * @since 3.0.0
 */

export function width(): number {
    return stdout.columns || DEFAULT_WIDTH;
}

/**
 * The width a string takes on screen, whatever escapes it carries.
 *
 * @param text - Text to measure, colored or plain
 * @returns The number of columns it occupies
 *
 * @example
 * ```ts
 * visible(errorColor('boom')); // 4
 * ```
 *
 * @since 3.0.0
 */

export function visible(text: string): number {
    return stripAnsi(text).length;
}

/**
 * Pads a string on the right to a column width, measuring what shows rather than what it holds.
 *
 * @param text - Text to pad, colored or plain
 * @param size - Width to pad it to, left as it stands where it is already wider
 * @returns The padded text
 *
 * @since 3.0.0
 */

export function pad(text: string, size: number): string {
    return text + ' '.repeat(Math.max(0, size - visible(text)));
}

/**
 * Shortens a path from the middle, keeping the ends a reader recognizes it by.
 *
 * @param text - Path to shorten
 * @param size - Width to fit it into
 * @returns The path, its middle replaced by an ellipsis where it did not fit
 *
 * @example
 * ```ts
 * truncate('src/modules/typescript/services/host.service.ts', 30); // 'src/modules/t…/host.service.ts'
 * ```
 *
 * @since 3.0.0
 */

export function truncate(text: string, size: number): string {
    if (text.length <= size || size < 4) return text;
    const head = Math.ceil((size - 1) / 2);

    return `${ text.slice(0, head) }…${ text.slice(text.length - (size - head - 1)) }`;
}

/**
 * Breaks a message into the lines a column can hold.
 *
 * @param text - Message to break, its own line breaks kept
 * @param size - Width of the column it is written in
 * @returns One entry per line, none of them wider than the column
 *
 * @remarks
 * Broken on words rather than on characters, so a message wraps where a reader would break it,
 * and a column too narrow to be worth wrapping in takes each line whole rather than one word per line.
 *
 * @since 3.0.0
 */

export function wrap(text: string, size: number): Array<string> {
    if (size < 20) return text.split('\n');

    const lines: Array<string> = [];
    for (const paragraph of text.split('\n')) {
        let line = '';
        for (const word of paragraph.split(' ')) {
            if (line && line.length + word.length + 1 > size) {
                lines.push(line);
                line = '';
            }

            line += line ? ` ${ word }` : word;
        }

        lines.push(line);
    }

    return lines;
}

/**
 * Renders the line a stage of the run announces itself on.
 *
 * @param action - What is happening, such as `build` or `serve`
 * @param symbol - Glyph to head it with, an arrow unless something went wrong
 * @returns The line, ready to write
 *
 * @example
 * ```ts
 * createActionPrefix('build'); // '[xBuild] → build'
 * ```
 *
 * @since 3.0.0
 */

export function createActionPrefix(action: string, symbol: string = infoColor.dim(ARROW_SYMBOL)): string {
    return `${ prefix() } ${ symbol } ${ infoColor(action) }`;
}

/**
 * Renders the heading a group is written under, with a note set against the right margin.
 *
 * @param title - Name of the group, already colored
 * @param count - How many entries follow it
 * @param note - Text to set against the right margin, such as a total
 * @returns The heading, ready to write
 *
 * @example
 * ```ts
 * heading(okColor('Outputs'), 18, '1.24 MB');
 * //  Outputs (18)                                    1.24 MB
 * ```
 *
 * @since 3.0.0
 */

export function heading(title: string, count: number, note = ''): string {
    const left = ` ${ title } ${ mutedColor.dim(`(${ count })`) }`;
    if (!note) return `\n${ left }\n`;

    return `\n${ pad(left, width() - visible(note) - 1) }${ note }\n`;
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

    readline.cursorTo(stdout, 0, 0);
    readline.clearScreenDown(stdout);
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
    if (bytes < KILOBYTE) return `${ bytes } B`;
    if (bytes < MEGABYTE) return `${ (bytes / KILOBYTE).toFixed(2) } KB`;

    return `${ (bytes / MEGABYTE).toFixed(2) } MB`;
}

/**
 * Renders where a message points, relative to the directory the run was started in.
 *
 * @param message - Message to read the location off
 * @returns The location as `path:line:column`, or an empty string where the message points at nothing
 *
 * @example
 * ```ts
 * formatLocation(message); // 'src/bash.ts:111:91'
 * ```
 *
 * @since 3.0.0
 */

export function formatLocation({ location }: PartialMessage): string {
    if (!location?.file) return '';
    const path = truncate(relative(process.cwd(), location.file), LOCATION_WIDTH);

    return `${ pathColor(path) }${ mutedColor.dim(`:${ location.line ?? 0 }:${ location.column ?? 0 }`) }`;
}

/**
 * The code a message is filed under.
 *
 * @param message - Message to read the code off
 * @returns The compiler's code where it carries one, the id it was filed under otherwise, empty where neither
 *
 * @remarks
 * A TypeScript diagnostic travels as a message carrying its code on `detail`, so it reads as `TS6133`,
 * while a message of the build's own reads under the id an override would claim it by.
 *
 * @since 3.0.0
 */

export function formatCode(message: PartialMessage): string {
    const code = (<{ code?: number }> message.detail)?.code;

    return code !== undefined ? `TS${ code }` : message.id ?? '';
}

/**
 * Renders what a run asking for everything is told about one message, indented under it.
 *
 * @param message - Message to expand
 * @param indent - What each line of the block is written at, so it reads as part of the entry above it
 * @returns The lines of the block, empty where the message resolved to nothing worth showing
 *
 * @remarks
 * The summary line has already said what happened and where, so nothing here repeats it:
 * the block carries the notes the message came with, the code the position resolved to, and the frames behind it.
 * A trace of a single frame is left out, since a diagnostic's one frame is the location already printed,
 * while a thrown error's chain of them is the point of asking.
 * Paths are cut back to the directory the run was started in, which is how the rest of the report names them.
 *
 * @since 3.0.0
 */

export function formatDetail(message: PartialMessage, indent: string): Array<string> {
    const metadata = getErrorMetadata(message, { linesAfter: 1, linesBefore: 1, withFrameworkFrames: true }, true);
    const root = `${ process.cwd() }/`;
    const lines: Array<string> = [];

    for (const note of message.notes ?? [])
        if (note.text) lines.push(`${ indent }${ mutedColor.dim(note.text) }`);

    if (metadata.formatCode)
        lines.push('', ...metadata.formatCode.split('\n').map(line => `${ indent }${ line }`));

    if (metadata.stack.length > 1)
        lines.push('', ...metadata.stack.map(frame => `${ indent }${ mutedColor.dim(frame.format.replaceAll(root, '')) }`));

    return lines.length > 0 ? [ ...lines, '' ] : lines;
}

/**
 * Writes a group of messages in aligned columns, with the whole trace of each where the run asked for it.
 *
 * @param messages - Messages to write, empty to write nothing at all
 * @param title - Heading the group is written under, such as `Errors`
 * @param color - Color of the heading and of each glyph
 * @param symbol - Glyph heading each line
 * @param verbose - Whether each message is followed by its code frame and resolved stack
 *
 * @remarks
 * The location and the code take a column each, as wide as the widest entry of this group,
 * so the messages line up under one another however deep the paths they point at run.
 * What is left of the terminal takes the message, wrapped under itself rather than around the right margin.
 * Quiet by default - one line per message, which is what a watch cycle wants -
 * and the code and the frames under `verbose`, indented beneath the entry they belong to.
 * `verbose` decides how much is said about each message rather than which of them are said at all.
 * That trace keeps the frames of the framework and of the runtime,
 * since a reader who asked for everything is asking where the build itself stood as well.
 *
 * @since 3.0.0
 */

export function printMessages(
    messages: Array<Message>, title: string, color: typeof errorColor, symbol: string, verbose = false
): void {
    if (messages.length < 1) return;

    const codes = messages.map(formatCode);
    const locations = messages.map(formatLocation);
    const left = Math.max(...locations.map(visible));
    const middle = Math.max(...codes.map(code => code.length));

    const gutter = INDENT.length + 4 + left + (middle > 0 ? middle + 2 : 0);
    const lines = [ heading(color(title), messages.length) ];

    for (const [ index, message ] of messages.entries()) {
        const code = middle > 0 ? `${ pad(warnColor.dim(codes[index]), middle) }  ` : '';
        const text = wrap(message.text ?? '', width() - gutter - 1);

        lines.push(`${ INDENT }${ color(symbol) } ${ pad(locations[index], left) }  ${ code }${ textColor(text[0]) }`);
        for (const rest of text.slice(1)) lines.push(`${ ' '.repeat(gutter) }${ textColor(rest) }`);
        if (!verbose) continue;

        lines.push(...formatDetail(message, INDENT.repeat(2)));
    }

    console.log(lines.join('\n'));
}

/**
 * Writes what a build wrote, largest first, with the sizes set against the right margin.
 *
 * @param metafile - Metafile of the finished build, read for its outputs
 * @param limit - How many outputs to name before the rest are counted rather than listed, `Infinity` to name them all
 *
 * @remarks
 * The sizes are set flush against the right margin, so their digits line up under one another.
 * A build of many entry points writes more than a reader wants to scroll,
 * so the largest few are named and the rest is left as a count carrying what it comes to.
 * The heading carries the total, which is the number a reader is usually after.
 * A run asking for everything is given every output instead, since scrolling is what it asked for.
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

export function printOutputs(metafile: Metafile, limit: number = OUTPUT_LIMIT): void {
    const outputs = Object.entries(metafile.outputs).sort(([ , a ], [ , b ]) => b.bytes - a.bytes);
    if (outputs.length < 1) return;

    const listed = outputs.slice(0, limit);
    const sizes = listed.map(([ , { bytes }]) => formatSize(bytes));
    const right = Math.max(...sizes.map(size => size.length));
    const total = outputs.reduce((sum, [ , { bytes }]) => sum + bytes, 0);

    const room = width() - INDENT.length - right - 2;
    const lines = [ heading(okColor('Outputs'), outputs.length, warnColor.dim(formatSize(total))) ];

    for (const [ index, [ path ]] of listed.entries())
        lines.push(`${ INDENT }${ pad(pathColor(truncate(path, room)), room + 1) }${ mutedColor.dim(sizes[index].padStart(right)) }`);

    if (outputs.length > limit) {
        const rest = outputs.slice(limit).reduce((sum, [ , { bytes }]) => sum + bytes, 0);
        const more = mutedColor.dim(`${ DOT_SYMBOL } ${ outputs.length - limit } more`);
        lines.push(`${ INDENT }${ pad(more, room + 1) }${ mutedColor.dim(formatSize(rest).padStart(right)) }`);
    }

    console.log(lines.join('\n'));
}

/**
 * Writes the line a variant closes on.
 *
 * @param name - Variant the line reports
 * @param failed - Whether it failed, which decides the glyph and the color of its name
 * @param note - What to close the line with, such as how long it took
 *
 * @since 3.0.0
 */

export function printStatus(name: string, failed: boolean, note: string): void {
    const symbol = failed ? errorColor(ERROR_SYMBOL) : okColor(SUCCESS_SYMBOL);
    console.log(`\n${ prefix() } ${ symbol } ${ failed ? warnColor(name) : keywordColor(name) } ${ mutedColor.dim(note) }\n`);
}

/**
 * Writes what one build of one variant did.
 *
 * @param event - The start or the end of a build, as the run reports it
 * @param verbose - Whether a message is followed by its code frame and resolved stack
 *
 * @remarks
 * A start announces the variant, and an end reports how it went:
 * every message it collected, under the level it was filed at, and what it wrote where nothing failed.
 * `verbose` widens both halves - a message gains its code frame and its resolved stack,
 * and the outputs are named to the last one rather than trimmed to the largest few.
 * Which levels have anything to say is the build's own to decide, since a message the log overrides silenced
 * never reached a bucket, so a group is written whenever it holds something and passed over when it does not.
 * The report closes on the status rather than opening with it,
 * so the last line of a build is the one a reader is looking for.
 * A build that produced no metafile is reported as failed, whatever it did or did not say,
 * and sets the exit code, so a run of several variants still ends non-zero.
 *
 * @see printMessages
 * @see printOutputs
 *
 * @since 3.0.0
 */

export function printEvent(event: LifecycleEventsType, verbose = false): void {
    if (event.type === 'start')
        return console.log(`${ createActionPrefix('build') } ${ keywordColor(event.context.variantName) }`);

    const { errors, warnings, info, debugs, metafile } = event.buildResult;
    const failed = errors.length > 0 || !metafile;

    printMessages(errors, 'Errors', errorColor, ERROR_SYMBOL, verbose);
    printMessages(warnings, 'Warnings', warnColor, WARNING_SYMBOL, verbose);
    printMessages(info, 'Info', pathColor, ARROW_SYMBOL, verbose);
    printMessages(debugs, 'Debug', mutedColor, DOT_SYMBOL, verbose);

    if (metafile) printOutputs(metafile, verbose ? Infinity : OUTPUT_LIMIT);
    if (failed) process.exitCode = 1;

    printStatus(event.context.variantName, failed, `in ${ event.duration } ms`);
}

/**
 * Writes the diagnostics of a check that ran on its own, one group per variant.
 *
 * @param diagnostics - Diagnostics of each variant, keyed by the variant's name
 *
 * @remarks
 * Grouped by what the compiler made of each - an error, a warning, or a note -
 * so a reader sees what stops a build apart from what merely deserves a look.
 * A variant reporting an error sets the exit code, which is what a check run in a pipeline is read by.
 *
 * @example
 * ```ts
 * printDiagnostics({ index: [ diagnostic ] });
 * //  Warnings (1)
 * //    • src/bash.ts:111:91   TS6133  'url' is declared but its value is never read.
 * ```
 *
 * @see printMessages
 * @since 3.0.0
 */

export function printDiagnostics(diagnostics: Record<string, Array<DiagnosticInterface>>): void {
    for (const [ name, reported ] of Object.entries(diagnostics)) {
        const groups = [
            { title: 'Errors', color: errorColor, symbol: ERROR_SYMBOL, of: reported.filter(item => item.category === 1) },
            { title: 'Warnings', color: warnColor, symbol: WARNING_SYMBOL, of: reported.filter(item => item.category === 0) },
            { title: 'Info', color: pathColor, symbol: ARROW_SYMBOL, of: reported.filter(item => item.category > 1) }
        ];

        for (const { title, color, symbol, of } of groups)
            printMessages(of.map(toMessage), title, color, symbol);

        const failed = groups[0].of.length > 0;
        if (failed) process.exitCode = 1;

        printStatus(name, failed, reported.length < 1 ? 'nothing to report' : `${ reported.length } to look at`);
    }
}

/**
 * Brings a compiler diagnostic to the shape the message renderer reads.
 *
 * @param diagnostic - Diagnostic as the checker reported it
 * @returns The same diagnostic as a message, carrying its code where it has one
 *
 * @remarks
 * What lets one renderer serve a check that ran on its own and a build that reported its diagnostics as messages.
 *
 * @since 3.0.0
 */

function toMessage(diagnostic: DiagnosticInterface): Message {
    return <Message> {
        text: diagnostic.message,
        detail: { code: diagnostic.code },
        location: { file: diagnostic.file, line: diagnostic.line, column: diagnostic.column }
    };
}
