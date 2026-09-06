/**
 * Imports
 */

import { exec } from 'child_process';
import { writeRaw } from '@remotex-labs/xansi';
import { platform, stdin, stdout } from 'process';
import { ShadowRenderer } from '@remotex-labs/xansi/shadow.service';
import { drawStatusBar, helpMenu, openInBrowser, setActivity, startInteractive, stopInteractive } from './interactive.ui';

/**
 * Tests
 */

describe('interactive.ui', () => {
    let screen: any;
    let execMock: any;
    let writeMock: any;
    let renderMock: any;
    let rawModeMock: any;
    let writeTextMock: any;

    /**
     * What the terminal reports itself to be, both ends of it a terminal by default.
     */

    function terminal(rows = 24, columns = 100, tty = true): void {
        Object.defineProperty(stdout, 'rows', { value: rows, configurable: true });
        Object.defineProperty(stdout, 'columns', { value: columns, configurable: true });
        Object.defineProperty(stdout, 'isTTY', { value: tty, configurable: true });
        Object.defineProperty(stdin, 'isTTY', { value: tty, configurable: true });
    }

    beforeEach(() => {
        xJet.restoreAllMocks();

        screen = {
            url: '',
            logLevel: 'info',
            rebuild: xJet.fn(async () => undefined),
            toggleVerbose: xJet.fn(() => 'verbose')
        };

        rawModeMock = xJet.fn();
        Object.defineProperty(stdin, 'setRawMode', { value: rawModeMock, configurable: true });

        execMock = xJet.mock(exec).mockReturnValue(<any> undefined);
        writeMock = xJet.mock(writeRaw).mockReturnValue(undefined);
        renderMock = xJet.spyOn(ShadowRenderer.prototype, 'render').mockReturnValue(undefined);
        writeTextMock = xJet.spyOn(ShadowRenderer.prototype, 'writeText').mockReturnValue(undefined);

        terminal();
        setActivity('');
    });

    afterEach(() => {
        delete (<any> stdin).setRawMode;
    });

    describe('openInBrowser', () => {
        test('should hand the address to whatever the platform opens one with', () => {
            const opener = (<Record<string, string>> { darwin: 'open', win32: 'start' })[platform] ?? 'xdg-open';
            openInBrowser('http://localhost:3000');

            expect(execMock).toHaveBeenCalledWith(`${ opener } http://localhost:3000`);
        });

        test('should leave the opener to itself rather than waiting on it', () => {
            openInBrowser('http://localhost:3000');

            expect(execMock).toHaveBeenCalledTimes(1);
            expect(execMock.mock.calls[0]).toHaveLength(1);
        });
    });

    describe('helpMenu', () => {
        test('should head the menu with what it is', () => {
            expect(helpMenu()).toContain('Shortcuts');
        });

        test('should name a key for everything a watch can be asked to do', () => {
            const menu = helpMenu();

            expect(menu).toContain('to show this menu');
            expect(menu).toContain('to run the build');
            expect(menu).toContain('to reload and rebuild');
            expect(menu).toContain('to toggle verbose');
            expect(menu).toContain('to clear the screen');
            expect(menu).toContain('to quit');
        });

        test('should leave the browser key out while nothing is being served', () => {
            expect(helpMenu()).not.toContain('to open it in a browser');
        });

        test('should list one line for the heading and one for every key', () => {
            expect(helpMenu().trim().split('\n')).toHaveLength(7);
        });

        test('should stand on its own lines', () => {
            expect(helpMenu().startsWith('\n')).toBe(true);
            expect(helpMenu().endsWith('\n')).toBe(true);
        });
    });

    describe('drawStatusBar', () => {
        test('should draw nothing at all while no row is held', () => {
            drawStatusBar();

            expect(writeTextMock).not.toHaveBeenCalled();
            expect(renderMock).not.toHaveBeenCalled();
            expect(writeMock).not.toHaveBeenCalled();
        });

        test('should draw nothing however hard it is asked while no row is held', () => {
            drawStatusBar(true);

            expect(renderMock).not.toHaveBeenCalled();
        });
    });

    describe('setActivity', () => {
        test('should hold what the run is doing even while there is no row to draw it on', () => {
            setActivity('building index');

            expect(writeTextMock).not.toHaveBeenCalled();
        });
    });

    describe('startInteractive', () => {
        test('should leave a run whose input nobody is typing at alone', async () => {
            terminal(24, 100, true);
            Object.defineProperty(stdin, 'isTTY', { value: false, configurable: true });
            await startInteractive(screen);

            expect(rawModeMock).not.toHaveBeenCalled();
            expect(writeMock).not.toHaveBeenCalled();
        });

        test('should leave a run whose output nobody is reading alone', async () => {
            terminal(24, 100, false);
            await startInteractive(screen);

            expect(rawModeMock).not.toHaveBeenCalled();
            expect(writeMock).not.toHaveBeenCalled();
        });
    });

    describe('stopInteractive', () => {
        test('should leave a run that never took a row alone', () => {
            stopInteractive();

            expect(writeMock).not.toHaveBeenCalled();
        });
    });

    /*
     * Everything below needs the row to be held, and taking it registers `process.on('exit')` and reads the
     * cursor back off the input. The worker holds its own process frozen and without the emitter methods,
     * so `startInteractive` throws before it claims anything, and none of this can be run from here.
     */

    describe.skip('the row it holds', () => {
        test('should cut the region the output scrolls in above the row it holds', () => undefined);
        test('should rebuild the row for the size the terminal now is', () => undefined);
        test('should go without the line on a terminal too short to spare a row', () => undefined);
        test('should paint the row again on a beat without holding the run open', () => undefined);
        test('should give the row back and clear what was left on it', () => undefined);
        test('should say what the run is doing, where the server is, and how to see the keys', () => undefined);
    });

    describe.skip('the keys it listens for', () => {
        test('should show the menu on h', () => undefined);
        test('should clear the screen on c and draw the row again', () => undefined);
        test('should turn reporting up on v and draw the row again', () => undefined);
        test('should build on b and reload on r', () => undefined);
        test('should open the browser on o only while a server is running', () => undefined);
        test('should hand the terminal back and leave on q or on an interrupt', () => undefined);
        test('should pass over a key nothing is bound to', () => undefined);
    });
});
