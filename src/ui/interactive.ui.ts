/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { Key } from 'readline';
import type { Screen } from '@ui/screen.ui';

/**
 * Imports
 */

import { exec } from 'child_process';
import * as readline from 'node:readline';
import { clearScreen, width } from '@ui/print.ui';
import { platform, stdin, stdout, exit } from 'process';
import { xterm } from '@remotex-labs/xansi/xterm.component';
import { ANSI, moveCursor, writeRaw } from '@remotex-labs/xansi';
import { ShadowRenderer } from '@remotex-labs/xansi/shadow.service';
import { infoColor, keywordColor, mutedColor, pathColor } from '@ui/color.ui';
import { DotSymbol, Indent, MinimumRows, RepaintInterval, ReloadSymbol, ReportTimeout } from '@constants/ui.constant';

/**
 * The command each platform opens a URL with.
 *
 * @remarks
 * Anything the table does not name falls back to the freedesktop opener, which is what every other Unix carries.
 *
 * @since 3.0.0
 */

const OpenCommands: Record<string, string> = { darwin: 'open', win32: 'start' };

/**
 * What each key does, paired with the line the menu describes it by.
 *
 * @remarks
 * One table drives both the menu and the dispatch, so a key cannot be listed without an action or the other way round.
 * The key that opens a browser is listed only while a server is running, which is what `server` marks it by.
 *
 * @since 3.0.0
 */

const Keys = [
    { key: 'h', describe: 'show this menu', server: false },
    { key: 'b', describe: 'run the build', server: false },
    { key: 'r', describe: 'reload and rebuild', server: false },
    { key: 'v', describe: 'toggle verbose', server: false },
    { key: 'c', describe: 'clear the screen', server: false },
    { key: 'o', describe: 'open it in a browser', server: true },
    { key: 'q', describe: 'quit', server: false }
] as const;

/**
 * The screen the keys act on and the bar reads, absent while no watch is listening.
 *
 * @remarks
 * The settings a run is under live on the screen rather than here,
 * so a key that changes one and a report that reads it are looking at the same value.
 *
 * @since 3.0.0
 */

let session: Screen | undefined;

/**
 * What the run is doing, as the bar says it, empty while the watch rests between builds.
 *
 * @since 3.0.0
 */

let activity = '';

/**
 * The row the bar draws through, absent while the terminal has none to spare.
 *
 * @remarks
 * A viewport one row tall pinned to the foot of the terminal.
 * Its rows count from one, so the row it is offset by is the one above the last,
 * which is what puts its only row on the last one rather than a line past the bottom of the screen.
 * It holds what it drew, so redrawing writes only the cells that moved, and a line too long for the terminal is cut
 * to fit rather than wrapping onto the row above and breaking the region the report scrolls in.
 *
 * @see ShadowRenderer
 * @since 3.0.0
 */

let row: ShadowRenderer | undefined;

/**
 * The beat the bar is painted on, absent while no watch holds a row.
 *
 * @since 3.0.0
 */

let repaint: NodeJS.Timeout | undefined;

/**
 * The row the cursor sits on, as the terminal itself reports it.
 *
 * @returns The row, or the last one where the terminal did not answer
 *
 * @remarks
 * Where a run has printed to is the one thing it cannot know for itself, and it decides everything the row rests on:
 * a watch started on a screen already full leaves the cursor on the last row, which is the row the line is about
 * to take, and every line printed afterward would land under the line and be painted over rather than scrolled.
 * The terminal is asked outright, and it answers on the input the shortcuts have yet to claim,
 * so the reply is read before the keys are listened for rather than swallowed by them.
 * A terminal that does not answer is taken to be full, which is the safe half of the guess.
 *
 * @since 3.0.0
 */

function cursorRow(): Promise<number> {
    return new Promise(resolve => {
        const answer = (data: Buffer): void => {
            const reported = /\[(\d+);\d+R/.exec(data.toString());
            if (!reported) return;

            stdin.off('data', answer);
            resolve(Number(reported[1]));
        };

        stdin.on('data', answer);
        writeRaw('\u001B[6n');
        setTimeout(() => (stdin.off('data', answer), resolve(stdout.rows)), ReportTimeout).unref();
    });
}

/**
 * Opens a URL in whatever the platform treats as the browser.
 *
 * @param url - Address to open
 *
 * @remarks
 * The command is spawned and left to itself, so a browser that takes its time does not hold the watch up,
 * and a platform without an opener fails silently rather than taking down the run with it.
 *
 * @example
 * ```ts
 * openInBrowser('http://localhost:3000');
 * ```
 *
 * @since 3.0.0
 */

export function openInBrowser(url: string): void {
    exec(`${ OpenCommands[platform] ?? 'xdg-open' } ${ url }`);
}

/**
 * Renders the menu of what the keys do.
 *
 * @returns The menu, ready to write
 *
 * @remarks
 * The key that opens a browser is listed only while a server is running, there being nothing to open otherwise.
 *
 * @example
 * ```ts
 * console.log(helpMenu());
 * //  Shortcuts
 * //    press h to show this menu
 * ```
 *
 * @since 3.0.0
 */

export function helpMenu(): string {
    const lines = [ `\n🚀 ${ keywordColor('Shortcuts') }` ];
    for (const { key, describe, server } of Keys) {
        if (!server || session?.url)
            lines.push(`${ Indent }${ mutedColor.dim('press') } ${ xterm.bold(key) } ${ mutedColor.dim(`to ${ describe }`) }`);
    }

    return `${ lines.join('\n') }\n`;
}

/**
 * Draws the status line on the row it holds, leaving the cursor where it found it.
 *
 * @param force - Whether to paint every cell rather than the ones that moved
 *
 * @remarks
 * Only what changed is written, unless the caller asks for the whole row,
 * which is what the repainting beat asks for: a terminal cleared behind the run's back is not what the row
 * remembers drawing, so nothing would be found to differ and nothing would be written.
 * What the run is doing leads, and the rest reads left to right:
 * where the server is, whether it is reporting everything, and how to see the keys.
 *
 * @example
 * ```ts
 * drawStatusBar();
 * // PASS main in 134 ms · http://localhost:3000 · verbose · press h for shortcuts
 * ```
 *
 * @since 3.0.0
 */

export function drawStatusBar(force = false): void {
    if (!row) return;

    const parts = [ activity || `${ infoColor.dim(ReloadSymbol) } ${ mutedColor('watching') }` ];
    if (session?.url) parts.push(pathColor(session.url));
    if (session?.logLevel === 'verbose') parts.push(keywordColor('verbose'));
    parts.push(mutedColor.dim('press h for shortcuts'));

    writeRaw(ANSI.SAVE_CURSOR);
    row.writeText(0, 0, ` ${ parts.join(mutedColor.dim(` ${ DotSymbol } `)) }`, true);
    row.render(force);
    writeRaw(ANSI.RESTORE_CURSOR);
}

/**
 * Says what the run is doing and redraws the bar.
 *
 * @param text - What is happening, already colored, empty to say the watch is resting
 *
 * @example
 * ```ts
 * setActivity(`${ infoColor(ArrowSymbol) } building index`);
 * ```
 *
 * @see drawStatusBar
 * @since 3.0.0
 */

export function setActivity(text: string): void {
    activity = text;
    drawStatusBar();
}

/**
 * Listens for the shortcuts and takes the last row of the terminal for the status line.
 *
 * @param screen - Screen the keys act on and the bar reads its settings from
 * @returns A promise settling once the row is held and the keys are listened for
 *
 * @remarks
 * A terminal that is not one - a pipe, a log file, a pipeline - is left alone,
 * since raw mode would take a run that nobody is watching and break its input.
 * Where the run has printed to is asked of the terminal before the keys are listened for, the answer coming back
 * on the same input: only a run that has reached the last row needs one scrolled free,
 * and one that has not keeps the blank line it would have cost.
 * The region is set so that everything printed afterward scrolls above the line rather than over it,
 * which keeps it out of the scrollback.
 * The row is painted again on a beat, so a terminal cleared from outside the run gets the line back at once,
 * and the beat is unreferenced, so it never holds the process open on its own.
 * The cursor is put away for as long as the line holds the row, and everything is given back as the run leaves.
 *
 * @example
 * ```ts
 * startInteractive(screen);
 * ```
 *
 * @see handleKey
 * @see drawStatusBar
 *
 * @since 3.0.0
 */

export async function startInteractive(screen: Screen): Promise<void> {
    if (!stdin.isTTY || !stdout.isTTY || repaint) return;
    session = screen;

    stdin.setRawMode(true);
    writeRaw(ANSI.HIDE_CURSOR);

    const printed = await cursorRow();
    if (printed >= stdout.rows) writeRaw('\n');
    claimRow(Math.min(printed, stdout.rows - 1));

    readline.emitKeypressEvents(stdin);
    stdin.on('keypress', (_, key: Key) => handleKey(key));

    stdout.on('resize', () => claimRow());
    repaint = setInterval(() => drawStatusBar(true), RepaintInterval).unref();
    process.on('exit', stopInteractive);
}

/**
 * Gives the row back and clears what the status line left on it.
 *
 * @remarks
 * Run as the process leaves, so the terminal is handed back scrolling in the whole of itself, cursor and all.
 * A run that never took a row has none to give, and returns.
 *
 * @since 3.0.0
 */

export function stopInteractive(): void {
    if (!repaint) return;

    clearInterval(repaint);
    repaint = undefined;
    row = undefined;

    writeRaw(`\u001B[r${ moveCursor(stdout.rows, 1) }${ ANSI.CLEAR_LINE }${ ANSI.SHOW_CURSOR }`);
}

/**
 * Cuts the region the output scrolls in out of the terminal as it now stands, and draws the line under it.
 *
 * @param anchor - Row the run had printed to, left out by a resize to put the cursor back where it was
 *
 * @remarks
 * Run on every resize as well as on the first claim, so the row is rebuilt for the size the terminal now is.
 * Setting a region homes the cursor, so it is put back where the caller says the run had printed to:
 * the next line printed belongs under the last one written, not at the foot of a screen it has yet to fill,
 * and never on the row the line holds, where it would be painted over rather than read.
 * A resize is given no row to go back to and restores what was saved, the run printing inside the region by then.
 * The row is cleared before it is drawn, since the line has no claim on what a resize reflowed onto it.
 * A terminal too short to spare a row keeps all of itself and goes without the line until it is resized larger.
 *
 * @since 3.0.0
 */

function claimRow(anchor?: number): void {
    if (stdout.rows < MinimumRows) {
        row = undefined;

        return writeRaw(`\u001B[r${ ANSI.CLEAR_LINE }`);
    }

    const last = stdout.rows - 1;
    const back = anchor === undefined ? ANSI.RESTORE_CURSOR : moveCursor(anchor, 1);

    row = new ShadowRenderer(1, width(), last, 1);
    writeRaw(
        `${ ANSI.SAVE_CURSOR }\u001B[1;${ last }r`
        + `${ moveCursor(stdout.rows, 1) }${ ANSI.CLEAR_LINE }${ back }`
    );

    drawStatusBar(true);
}

/**
 * Runs what a key asks for.
 *
 * @param key - Key that was pressed, as the terminal reported it
 *
 * @remarks
 * Interrupts leave through the same door as `q`, so a watch stopped by a keystroke and one stopped by a signal
 * end the same way, and both hand the terminal back before they go.
 * The run leaves only once the line saying so has been written, since leaving outright would cut the terminal
 * off before what was written for it had reached it.
 * Building and reloading part on one flag: `b` builds again from the configurations as they were parsed,
 * while `r` has every TypeScript project reparse its own first.
 * That reparse is what catches a change their versions miss, such as an edit to a file one of them extends.
 * A key with nothing bound to it is passed over, since a watch is left running rather than surprised by a typo.
 *
 * @see helpMenu
 * @since 3.0.0
 */

async function handleKey(key: Key): Promise<void> {
    if (key.ctrl && (key.name === 'c' || key.name === 'd')) key.name = 'q';

    switch (key.name) {
        case 'q':
            stopInteractive();
            stdout.write(`${ mutedColor('Stopped.') }\n`, () => exit(process.exitCode ? Number(process.exitCode) : 0));

            return;
        case 'c':
            clearScreen();

            return drawStatusBar(true);
        case 'h':
            return console.log(helpMenu());
        case 'v':
            session?.toggleVerbose();

            return drawStatusBar(true);
        case 'o':
            if (session?.url) openInBrowser(session.url);

            return;
        case 'b':
            return session?.rebuild('rebuilding');
        case 'r':
            return session?.rebuild('reloading', true);
    }
}
