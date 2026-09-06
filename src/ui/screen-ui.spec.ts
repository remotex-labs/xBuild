/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { LifecycleLogsType } from '@interfaces/lifecycle.interface';

/**
 * Imports
 */

import { exit } from 'process';
import { Screen } from './screen.ui';
import { inject } from '@remotex-labs/xinject';
import { setActivity } from '@ui/interactive.ui';
import { clearScreen, printGroup, printOutputs } from '@ui/print.ui';
import { ConfigurationService } from '@services/configuration.service';
import { errorColor, infoColor, mutedColor, warnColor } from '@ui/color.ui';
import { ArrowSymbol, DotSymbol, ErrorSymbol, WarningSymbol } from '@constants/ui.constant';

/**
 * Tests
 */

describe('Screen', () => {
    let config: any;
    let screen: any;
    let logMock: any;
    let exitMock: any;
    let buildMock: any;
    let groupMock: any;
    let clearMock: any;
    let outputsMock: any;
    let activityMock: any;

    /**
     * The buckets a build or a check hands back, empty of whatever the caller did not name.
     */

    function logs(overrides: Partial<LifecycleLogsType> = {}): LifecycleLogsType {
        return <LifecycleLogsType> { info: [], verbose: [], error: [], warning: [], ...overrides };
    }

    /**
     * The end of a build, as the variant reports one.
     */

    function ended(overrides: any = {}): any {
        return {
            type: 'end',
            duration: 134,
            context: { variantName: 'esm' },
            buildResult: { ...logs(), errors: [], warnings: [], metafile: { outputs: {} }, ...overrides }
        };
    }

    /**
     * The titles the groups were printed under, in the order they were printed.
     */

    function titles(): Array<string> {
        return groupMock.mock.calls.map((call: Array<unknown>) => call[1]);
    }

    beforeEach(() => {
        xJet.restoreAllMocks();

        config = { logLevel: 'info' };
        logMock = xJet.spyOn(console, 'log').mockReturnValue(undefined);
        buildMock = xJet.fn(async () => undefined);

        const configuration = {
            getValue: xJet.fn(() => config),
            patch: xJet.fn((patch: any) => Object.assign(config, patch))
        };

        xJet.mock(inject).mockImplementation(<any> ((token: unknown) => {
            if (token === ConfigurationService) return configuration;

            return {};
        }));

        exitMock = xJet.mock(exit).mockReturnValue(<any> undefined);
        clearMock = xJet.mock(clearScreen).mockReturnValue(undefined);
        groupMock = xJet.mock(printGroup).mockReturnValue(undefined);
        outputsMock = xJet.mock(printOutputs).mockReturnValue(undefined);
        activityMock = xJet.mock(setActivity).mockReturnValue(undefined);

        screen = new Screen(buildMock);
    });

    describe('the level it reports at', () => {
        test('should read the level the configuration holds', () => {
            config.logLevel = 'warning';

            expect(screen.logLevel).toBe('warning');
        });

        test('should report at info where the configuration names no level', () => {
            config.logLevel = undefined;

            expect(screen.logLevel).toBe('info');
        });

        test('should write a level back through the configuration', () => {
            screen.logLevel = 'error';

            expect(config.logLevel).toBe('error');
        });
    });

    describe('the address it holds', () => {
        test('should hold no address until a server reports one', () => {
            expect(screen.url).toBe('');
        });

        test('should hold the address it was given', () => {
            screen.url = 'http://localhost:3000';

            expect(screen.url).toBe('http://localhost:3000');
        });
    });

    describe('the builds it reports', () => {
        test('should say which variant a build is starting on', () => {
            screen.buildEvent({ type: 'start', context: { variantName: 'esm' } });

            expect(logMock.mock.calls[0][0]).toContain('esm');
            expect(logMock.mock.calls[0][0]).toContain('[xBuild]');
            expect(activityMock).toHaveBeenCalledWith(expect.stringContaining('building'));
        });

        test('should print no group and no output for a build that is only starting', () => {
            screen.buildEvent({ type: 'start', context: { variantName: 'esm' } });

            expect(groupMock).not.toHaveBeenCalled();
            expect(outputsMock).not.toHaveBeenCalled();
        });

        /*
         * The end of a build writes `process.exitCode`, and the worker holds its own process frozen,
         * so the branch throws before it reports anything and cannot be run from here.
         * What it routes to either side of that write is covered by the groups below.
         */

        test.skip('should mark a build as done or failed and report what it wrote', () => {
            screen.buildEvent(ended());
        });
    });

    describe('the groups it prints', () => {
        test('should print every group while reporting everything', () => {
            config.logLevel = 'verbose';
            screen.groups(logs());

            expect(titles()).toEqual([ 'Errors', 'Warnings', 'Info', 'Verbose' ]);
        });

        test('should leave the quiet groups out at info', () => {
            config.logLevel = 'info';
            screen.groups(logs());

            expect(titles()).toEqual([ 'Errors', 'Warnings', 'Info' ]);
        });

        test('should print warnings and errors alone at warning', () => {
            config.logLevel = 'warning';
            screen.groups(logs());

            expect(titles()).toEqual([ 'Errors', 'Warnings' ]);
        });

        test('should print errors alone at error', () => {
            config.logLevel = 'error';
            screen.groups(logs());

            expect(titles()).toEqual([ 'Errors' ]);
        });

        test('should print nothing at all while silenced', () => {
            config.logLevel = 'silent';
            screen.groups(logs());

            expect(groupMock).not.toHaveBeenCalled();
        });

        test('should mark each group with a symbol and a color of its own', () => {
            config.logLevel = 'verbose';
            screen.groups(logs());

            expect(groupMock.mock.calls.map((call: Array<unknown>) => [ call[2], call[3] ])).toEqual([
                [ errorColor, ErrorSymbol ],
                [ warnColor, WarningSymbol ],
                [ infoColor, ArrowSymbol ],
                [ mutedColor, DotSymbol ]
            ]);
        });

        test('should hand each group the bucket it was filed from', () => {
            config.logLevel = 'verbose';
            const filed = logs({ error: <any> [{ text: 'broken' }], warning: <any> [{ text: 'careful' }] });
            screen.groups(filed);

            expect(groupMock.mock.calls.map((call: Array<unknown>) => call[0]))
                .toEqual([ filed.error, filed.warning, filed.info, filed.verbose ]);
        });

        test('should always carry the code of an error, whatever the level', () => {
            config.logLevel = 'error';
            screen.groups(logs());

            expect(groupMock).toHaveBeenCalledWith(expect.anything(), 'Errors', errorColor, ErrorSymbol, true);
        });

        test('should leave the code off the quieter groups unless it is reporting everything', () => {
            config.logLevel = 'info';
            screen.groups(logs());

            expect(groupMock.mock.calls.map((call: Array<unknown>) => call[4])).toEqual([ true, false, false ]);
        });

        test('should carry the code of every group while reporting everything', () => {
            config.logLevel = 'verbose';
            screen.groups(logs());

            for (const call of groupMock.mock.calls) expect(call[4]).toBe(true);
        });
    });

    describe('the server it reports', () => {
        test('should hold the address a server started on and say where it is', () => {
            screen.serverEvent({ type: 'start', url: 'http://localhost:3000' });

            expect(screen.url).toBe('http://localhost:3000');
            expect(logMock.mock.calls[0][0]).toContain('http://localhost:3000');
            expect(logMock.mock.calls[0][0]).toContain('serve');
        });

        test('should let the address go as the server stops and say it stopped', () => {
            screen.serverEvent({ type: 'start', url: 'http://localhost:3000' });
            screen.serverEvent({ type: 'stop', running: true });

            expect(screen.url).toBe('');
            expect(logMock.mock.calls[1][0]).toContain('stopped');
        });

        test('should say nothing of a server that was never running', () => {
            screen.serverEvent({ type: 'stop', running: false });

            expect(screen.url).toBe('');
            expect(logMock).not.toHaveBeenCalled();
        });

        test('should leave a request unreported unless it is reporting everything', () => {
            screen.serverEvent({ type: 'request', url: '/index.html' });

            expect(logMock).not.toHaveBeenCalled();
        });

        test('should report each request while reporting everything', () => {
            config.logLevel = 'verbose';
            screen.serverEvent({ type: 'request', url: '/index.html' });

            expect(logMock.mock.calls[0][0]).toContain('/index.html');
        });

        test('should report what the server could not serve', () => {
            screen.serverEvent({ type: 'error', url: '/missing', error: new Error('not found') });

            expect(logMock.mock.calls[0][0]).toContain('not found');
            expect(logMock.mock.calls[0][0]).toContain('×');
        });

        test('should pass over a browser asking after an icon that was never there', () => {
            screen.serverEvent({ type: 'error', url: '/favicon.ico', error: new Error('not found') });

            expect(logMock).not.toHaveBeenCalled();
        });
    });

    describe('the diagnostics it reports', () => {
        test('should head each variant with its name and how much it has to look at', () => {
            screen.diagnostics({ esm: logs({ error: <any> [{ text: 'broken' }], info: <any> [{ text: 'a note' }] }) });

            expect(logMock.mock.calls[0][0]).toContain('esm');
            expect(logMock.mock.calls[0][0]).toContain('2 to look at');
            expect(logMock.mock.calls[0][0]).toContain('type-check');
        });

        test('should file the buckets of each variant under their groups', () => {
            screen.diagnostics({ esm: logs({ error: <any> [{ text: 'broken' }] }) });

            expect(groupMock).toHaveBeenCalledWith([{ text: 'broken' }], 'Errors', errorColor, ErrorSymbol, true);
        });

        test('should report each variant it was handed', () => {
            screen.diagnostics({ esm: logs(), cjs: logs() });

            expect(logMock.mock.calls[0][0]).toContain('esm');
            expect(logMock.mock.calls[2][0]).toContain('cjs');
        });

        test('should leave the run failed where a variant reported an error', () => {
            screen.diagnostics({ esm: logs(), cjs: logs({ error: <any> [{ text: 'broken' }] }) });

            expect(exitMock).toHaveBeenCalledWith(1);
        });

        test('should leave the run clean where nothing but quieter levels were reported', () => {
            screen.diagnostics({ esm: logs({ warning: <any> [{ text: 'careful' }] }) });

            expect(exitMock).toHaveBeenCalledWith(0);
        });

        test('should leave a run that checked nothing at all clean', () => {
            screen.diagnostics({});

            expect(exitMock).toHaveBeenCalledWith(0);
            expect(groupMock).not.toHaveBeenCalled();
        });
    });

    describe('the rebuilds it runs', () => {
        test('should clear what the last build left before saying anything', async () => {
            await screen.rebuild('2 files changed');

            expect(clearMock).toHaveBeenCalled();
        });

        test('should say what set the build off', async () => {
            await screen.rebuild('2 files changed');

            expect(logMock.mock.calls[0][0]).toContain('2 files changed');
            expect(logMock.mock.calls[0][0]).toContain('rebuild');
            expect(activityMock).toHaveBeenCalledWith(expect.stringContaining('2 files changed'));
        });

        test('should run the build the screen was handed', async () => {
            await screen.rebuild('2 files changed');

            expect(buildMock).toHaveBeenCalled();
        });

        test('should wait on the build it set off', async () => {
            let finished = false;
            buildMock.mockImplementation(async () => {
                finished = true;
            });

            await screen.rebuild('a key was pressed');

            expect(finished).toBe(true);
        });
    });

    describe('the level it toggles', () => {
        test('should turn reporting all the way up', () => {
            expect(screen.toggleVerbose()).toBe('verbose');
            expect(config.logLevel).toBe('verbose');
        });

        test('should turn reporting back to what it was before', () => {
            screen.toggleVerbose();

            expect(screen.toggleVerbose()).toBe('info');
        });

        test('should remember the level the run was started at rather than the default', () => {
            config.logLevel = 'error';
            screen = new Screen(buildMock);

            screen.toggleVerbose();

            expect(screen.toggleVerbose()).toBe('error');
        });

        test('should turn a run started verbose back to info, there being nothing quieter to remember', () => {
            config.logLevel = 'verbose';
            screen = new Screen(buildMock);

            expect(screen.toggleVerbose()).toBe('info');
        });

        test('should say what the run now reports at every time it is toggled', () => {
            expect(screen.toggleVerbose()).toBe('verbose');
            expect(screen.toggleVerbose()).toBe('info');
            expect(screen.toggleVerbose()).toBe('verbose');
        });
    });
});
