/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { Key } from 'readline';
import type { InteractiveOptionsInterface } from '@ui/interfaces/interactive-ui.interface';

/**
 * Imports
 */

import { exec } from 'child_process';
import { prefix } from '@ui/banner.ui';
import * as readline from 'node:readline';
import { platform, stdin, exit } from 'process';
import { clearScreen, INDENT } from '@ui/print.ui';
import { xterm } from '@remotex-labs/xansi/xterm.component';
import { keywordColor, mutedColor, pathColor } from '@ui/color.ui';

/**
 * The command each platform opens a URL with.
 *
 * @remarks
 * Anything the table does not name falls back to the freedesktop opener, which is what every other Unix carries.
 *
 * @since 3.0.0
 */

const OPEN_COMMANDS: Record<string, string> = { darwin: 'open', win32: 'start' };

/**
 * What each key does, paired with the line the menu describes it by.
 *
 * @remarks
 * One table drives both the menu and the dispatch, so a key cannot be listed without an action or the other way round.
 * The two URL keys are listed only while a server is running, which is what `server` marks them by.
 *
 * @since 3.0.0
 */

const KEYS = [
    { key: 'h', describe: 'show this menu', server: false },
    { key: 'b', describe: 'run the build', server: false },
    { key: 'r', describe: 'reload and rebuild', server: false },
    { key: 'v', describe: 'toggle verbose errors', server: false },
    { key: 'c', describe: 'clear the screen', server: false },
    { key: 'u', describe: 'show the server url', server: true },
    { key: 'o', describe: 'open it in a browser', server: true },
    { key: 'q', describe: 'quit', server: false }
] as const;

/**
 * Opens a URL in whatever the platform treats as the browser.
 *
 * @param url - Address to open
 *
 * @remarks
 * The command is spawned and left to itself, so a browser that takes its time does not hold the watch up,
 * and a platform without an opener fails silently rather than taking the run down with it.
 *
 * @example
 * ```ts
 * openInBrowser('http://localhost:3000');
 * ```
 *
 * @since 3.0.0
 */

export function openInBrowser(url: string): void {
    exec(`${ OPEN_COMMANDS[platform] ?? 'xdg-open' } ${ url }`);
}

/**
 * Renders the menu of what the keys do.
 *
 * @param server - Whether a server is running, which is what the two URL keys are worth listing for
 * @returns The menu, ready to write
 *
 * @example
 * ```ts
 * console.log(helpMenu(true));
 * //  Shortcuts
 * //    press h to show this menu
 * ```
 *
 * @since 3.0.0
 */

export function helpMenu(server = false): string {
    const lines = [ `\n ${ keywordColor('Shortcuts') }` ];
    for (const { key, describe, server: needsServer } of KEYS) {
        if (!needsServer || server)
            lines.push(`${ INDENT }${ mutedColor.dim('press') } ${ xterm.bold(key) } ${ mutedColor.dim(`to ${ describe }`) }`);
    }

    return lines.join('\n');
}

/**
 * Runs what a key asks for.
 *
 * @param key - Key that was pressed, as the terminal reported it
 * @param options - What the keys act on: the build, the reload, the verbose flag, and the server's URL
 *
 * @remarks
 * Interrupts leave through the same door as `q`, so a watch stopped by a keystroke and one stopped by a signal
 * end the same way.
 * A key that nothing is bound to is passed over, since a watch is left running rather than surprised by a typo.
 *
 * @see helpMenu
 * @since 3.0.0
 */

export async function handleKey(key: Key, options: InteractiveOptionsInterface): Promise<void> {
    const { url } = options;
    if (key.ctrl && (key.name === 'c' || key.name === 'd')) key.name = 'q';

    switch (key.name) {
        case 'q':
            console.log(mutedColor('\nStopped.'));

            return exit(process.exitCode ? Number(process.exitCode) : 0);
        case 'c':
            return clearScreen();
        case 'h':
            return console.log(helpMenu(Boolean(url)));
        case 'v':
            options.verbose = !options.verbose;

            return console.log(`${ prefix() } ${ mutedColor('verbose') } ${ keywordColor(options.verbose ? 'on' : 'off') }`);
        case 'u':
            if (url) console.log(`${ prefix() } ${ pathColor(url) }`);

            return;
        case 'o':
            if (url) openInBrowser(url);

            return;
        case 'b':
            return void await options.build();
        case 'r':
            return void await options.reload();
    }
}

/**
 * Puts the terminal into the mode the shortcuts need and starts listening.
 *
 * @param options - What the keys act on, carrying the verbose flag the `v` key writes back to
 *
 * @remarks
 * A terminal that is not one - a pipe, a log file, a pipeline - is left alone,
 * since raw mode would take a run that nobody is watching and break its input.
 * The menu is written once as the watch starts, so a reader is told what is available without asking.
 *
 * @example
 * ```ts
 * startInteractive({ verbose: false, url, build, reload });
 * ```
 *
 * @see handleKey
 * @since 3.0.0
 */

export function startInteractive(options: InteractiveOptionsInterface): void {
    if (!stdin.isTTY) return;
    console.log(helpMenu(Boolean(options.url)));

    stdin.setRawMode(true);
    readline.emitKeypressEvents(stdin);
    stdin.on('keypress', (_, key: Key) => handleKey(key, options));
}
