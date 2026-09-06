/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { Metafile } from 'esbuild';

/**
 * Imports
 */

import { stdout } from 'process';
import { inject } from '@remotex-labs/xinject';
import { cursorTo, clearScreenDown } from 'readline';
import { getErrorMetadata } from '@providers/stack.provider';
import { FrameworkService } from '@services/framework.service';
import { errorColor, mutedColor, warnColor } from '@ui/color.ui';
import { DefaultWidth, ErrorSymbol, Indent } from '@constants/ui.constant';
import {
    clearScreen, createActionPrefix, describeMessage, formatDetail, formatLocation,
    formatSize, pad, printGroup, printOutputs, sourcePath, visible, width
} from './print.ui';

/**
 * Tests
 */

describe('print.ui', () => {
    const cwd = process.cwd();
    const frameworkRoot = `${ cwd }/node_modules/@remotex-labs/xbuild/dist`;

    let logMock: any;
    let framework: any;
    let metadataMock: any;
    let resolveMock: any;

    /**
     * Sizes the terminal, which reports its own rather than answering a getter that can be spied on.
     */

    function terminal(columns: number, rows: number): void {
        Object.defineProperty(stdout, 'columns', { value: columns, configurable: true });
        Object.defineProperty(stdout, 'rows', { value: rows, configurable: true });
    }

    /**
     * The metadata a resolve hands back, empty of everything the caller did not ask for.
     */

    function resolved(overrides: any = {}): any {
        return { stack: [], formatCode: undefined, ...overrides };
    }

    /**
     * A frame as the resolver reports one.
     */

    function frame(overrides: any = {}): any {
        return { fileName: 'src/index.ts', line: 12, column: 8, format: `at run (${ cwd }/src/index.ts:12:8)`, ...overrides };
    }

    /**
     * What was printed, with the color stripped and split back into lines.
     */

    function printed(call = 0): Array<string> {

        return String(logMock.mock.calls[call][0]).replace(/\x1B\[[0-9;]*m/g, '').split('\n');
    }

    beforeEach(() => {
        xJet.restoreAllMocks();

        logMock = xJet.spyOn(console, 'log').mockReturnValue(undefined);
        xJet.mock(cursorTo).mockReturnValue(<any> undefined);
        xJet.mock(clearScreenDown).mockReturnValue(<any> undefined);
        framework = { frameworkRoot, isFrameworkFile: xJet.fn(() => false) };

        xJet.mock(inject).mockImplementation(<any> ((token: unknown) => {
            if (token === FrameworkService) return framework;

            return {};
        }));

        resolveMock = xJet.spyOn(FrameworkService, 'resolve').mockImplementation(
            (path: string) => path.startsWith('/') ? path : `${ cwd }/${ path }`
        );

        metadataMock = xJet.mock(getErrorMetadata).mockReturnValue(<any> resolved());
        terminal(100, 24);
    });

    afterEach(() => {
        delete (<any> stdout).columns;
        delete (<any> stdout).rows;
    });

    describe('createActionPrefix', () => {
        test('should tag the action as the build speaking', () => {
            expect(createActionPrefix('build')).toContain('[xBuild]');
            expect(createActionPrefix('build')).toContain('build');
        });

        test('should mark the action with an arrow of its own by default', () => {
            expect(createActionPrefix('build')).toContain('→');
        });

        test('should mark the action with the symbol it was given', () => {
            const line = createActionPrefix('build', errorColor(ErrorSymbol));

            expect(line).toContain('×');
            expect(line).not.toContain('→');
        });
    });

    describe('visible', () => {
        test('should count what a reader sees rather than what was written', () => {
            expect(visible(mutedColor('build'))).toBe(5);
        });

        test('should count plain text as it stands', () => {
            expect(visible('build')).toBe(5);
        });

        test('should count nothing as nothing', () => {
            expect(visible('')).toBe(0);
        });
    });

    describe('pad', () => {
        test('should fill the text out to the width it was given', () => {
            expect(pad('src', 6)).toBe('src   ');
        });

        test('should pad by what a reader sees rather than by what was written', () => {
            expect(pad(mutedColor('src'), 6)).toBe(`${ mutedColor('src') }   `);
        });

        test('should leave text already wider than the column alone', () => {
            expect(pad('src/index.ts', 4)).toBe('src/index.ts');
        });
    });

    describe('sourcePath', () => {
        test('should read a path the project holds against the directory the run was started in', () => {
            expect(sourcePath('src/index.ts')).toBe('src/index.ts');
        });

        test('should read a path reaching out of the framework against the framework itself', () => {
            expect(sourcePath('../config.xbuild.ts')).toBe('node_modules/@remotex-labs/xbuild/config.xbuild.ts');
            expect(resolveMock).not.toHaveBeenCalled();
        });

        test('should leave a source naming a url as it stands', () => {
            expect(sourcePath('https://github.com/x/y.ts')).toBe('https://github.com/x/y.ts');
            expect(resolveMock).not.toHaveBeenCalled();
        });

        test('should key a path the way the rest of the package keys one', () => {
            sourcePath('src/index.ts');

            expect(resolveMock).toHaveBeenCalledWith('src/index.ts');
        });
    });

    describe('formatLocation', () => {
        test('should point at the file, line and column', () => {
            expect(visible(formatLocation('src/index.ts', 12, 8))).toBe('src/index.ts:12:8'.length);
            expect(formatLocation('src/index.ts', 12, 8)).toContain(warnColor('12'));
        });

        test('should point nowhere for a message carrying no file', () => {
            expect(formatLocation(undefined)).toBe('');
            expect(formatLocation('')).toBe('');
        });

        test('should read a missing line or column as the start of the file', () => {
            expect(visible(formatLocation('src/index.ts'))).toBe('src/index.ts:0:0'.length);
        });
    });

    describe('formatDetail', () => {
        test('should hand back nothing for a resolve carrying neither code nor a trace', () => {
            expect(formatDetail(resolved(), Indent)).toEqual([]);
        });

        test('should print the code window under a blank line and close on one', () => {
            const lines = formatDetail(resolved({ formatCode: '11 | x();\n   | ^' }), Indent);

            expect(lines[0]).toBe('');
            expect(visible(lines[1])).toBe(`${ Indent }11 | x();`.length);
            expect(lines.at(-1)).toBe('');
        });

        test('should leave a trace of one frame to the location line', () => {
            const lines = formatDetail(resolved({ stack: [ frame() ] }), Indent);

            expect(lines).toEqual([]);
        });

        test('should print a trace of more than one frame', () => {
            const lines = formatDetail(resolved({
                stack: [ frame(), frame({ format: `at load (${ cwd }/src/load.ts:4:2)` }) ]
            }), Indent);

            expect(lines.map(line => visible(line))).toEqual(
                [ 0, `${ Indent }at run (src/index.ts:12:8)`.length, `${ Indent }at load (src/load.ts:4:2)`.length, 0 ]
            );
        });

        test('should print each frame from the directory the run was started in', () => {
            const [ , line ] = formatDetail(resolved({ stack: [ frame(), frame() ] }), Indent);

            expect(line).toContain('at run (src/index.ts:12:8)');
            expect(line).not.toContain(cwd);
        });
    });

    describe('describeMessage', () => {
        test('should take a typescript diagnostic at its word', () => {
            const row = describeMessage({ id: 'TS2304', location: <any> { file: 'src/index.ts', line: 12, column: 8 } }, false);

            expect(row.id).toBe('TS2304');
            expect(visible(row.location)).toBe('src/index.ts:12:8'.length);
            expect(metadataMock).not.toHaveBeenCalled();
        });

        test('should resolve anything that is not a typescript diagnostic through its map', () => {
            metadataMock.mockReturnValue(<any> resolved({ stack: [ frame({ fileName: 'config.xbuild.ts', line: 126, column: 27 }) ] }));
            const row = describeMessage({ id: 'plugin', location: <any> { file: 'dist/config.js', line: 4, column: 1 } }, false);

            expect(visible(row.location)).toBe('config.xbuild.ts:126:27'.length);
            expect(metadataMock).toHaveBeenCalledWith(expect.anything(), {
                linesAfter: 1, linesBefore: 1, withFrameworkFrames: true
            });
        });

        test('should fall back to where the message points when nothing resolved', () => {
            const row = describeMessage({ location: <any> { file: 'src/index.ts', line: 3, column: 1 } }, false);

            expect(visible(row.location)).toBe('src/index.ts:3:1'.length);
        });

        test('should name a message carrying no id by nothing at all', () => {
            expect(describeMessage({ text: 'broken' }, false).id).toBe('');
        });

        test('should leave the detail out where the caller asked for none', () => {
            metadataMock.mockReturnValue(<any> resolved({ formatCode: '11 | x();' }));

            expect(describeMessage({ text: 'broken' }, false).detail).toEqual([]);
        });

        test('should carry the detail where the caller asked for it', () => {
            metadataMock.mockReturnValue(<any> resolved({ formatCode: '11 | x();' }));
            const row = describeMessage({ text: 'broken' }, true);

            expect(row.detail.map(line => visible(line))).toEqual([ 0, `${ Indent.repeat(2) }11 | x();`.length, 0 ]);
        });

        test('should resolve a typescript diagnostic all the same where its code is wanted', () => {
            describeMessage({ id: 'TS2304', location: <any> { file: 'src/index.ts', line: 12, column: 8 } }, true);

            expect(metadataMock).toHaveBeenCalled();
        });

        test('should keep a typescript diagnostic pointing where it says even with its code wanted', () => {
            metadataMock.mockReturnValue(<any> resolved({ stack: [ frame({ fileName: 'dist/index.js', line: 1, column: 1 }) ] }));
            const row = describeMessage({ id: 'TS2304', location: <any> { file: 'src/index.ts', line: 12, column: 8 } }, true);

            expect(visible(row.location)).toBe('src/index.ts:12:8'.length);
        });
    });

    describe('printGroup', () => {
        test('should print nothing at all for a group holding no message', () => {
            printGroup([], 'Errors', errorColor, ErrorSymbol);

            expect(logMock).not.toHaveBeenCalled();
        });

        test('should head the group with its title and how many it holds', () => {
            printGroup([{ text: 'broken' }], 'Errors', errorColor, ErrorSymbol);

            expect(printed()[1]).toBe(' Errors (1)');
        });

        test('should mark each message with the symbol it was given and carry its text', () => {
            printGroup([{ text: 'broken' }], 'Errors', errorColor, ErrorSymbol);

            expect(printed()[2]).toContain('×');
            expect(printed()[2]).toContain('broken');
        });

        test('should size the location column to the widest of them', () => {
            printGroup([
                { text: 'first', location: <any> { file: 'src/a.ts', line: 1, column: 1 } },
                { text: 'second', location: <any> { file: 'src/a-longer-name.ts', line: 22, column: 3 } }
            ], 'Errors', errorColor, ErrorSymbol);

            const [ , , first, second ] = printed();

            expect(first.indexOf('first')).toBe(second.indexOf('second'));
        });

        test('should leave the id column out where nothing in the group carries one', () => {
            printGroup([{ text: 'broken' }], 'Errors', errorColor, ErrorSymbol);

            expect(printed()[2]).toBe(`${ Indent }× ${ ''.padEnd(0) }  broken`);
        });

        test('should size the id column to the widest of them', () => {
            printGroup([
                { id: 'TS2304', text: 'first' },
                { id: 'TS7', text: 'second' }
            ], 'Errors', errorColor, ErrorSymbol);

            const [ , , first, second ] = printed();

            expect(first.indexOf('first')).toBe(second.indexOf('second'));
            expect(second).toContain('TS7   ');
        });

        test('should print the detail of each message under its line', () => {
            metadataMock.mockReturnValue(<any> resolved({ formatCode: '11 | x();' }));
            printGroup([{ text: 'broken' }], 'Errors', errorColor, ErrorSymbol, true);

            expect(printed()[3]).toBe('');
            expect(printed()[4]).toBe(`${ Indent.repeat(2) }11 | x();`);
        });

        test('should work every message out once rather than once per column', () => {
            printGroup([{ text: 'first' }, { text: 'second' }], 'Errors', errorColor, ErrorSymbol, true);

            expect(metadataMock).toHaveBeenCalledTimes(2);
        });
    });

    describe('clearScreen', () => {
        test('should push the screen out of view and put the cursor back at the top', () => {
            clearScreen();

            expect(logMock).toHaveBeenCalledWith('\n'.repeat(22));
            expect(cursorTo).toHaveBeenCalledWith(stdout, 0, 0);
            expect(clearScreenDown).toHaveBeenCalledWith(stdout);
        });

        test('should print nothing to scroll on a terminal with no rows to spare', () => {
            terminal(100, 1);
            clearScreen();

            expect(logMock).not.toHaveBeenCalled();
            expect(cursorTo).toHaveBeenCalled();
        });
    });

    describe('width', () => {
        test('should lay the report out in the columns the terminal reports', () => {
            expect(width()).toBe(100);
        });

        test('should stand a width in for a terminal reporting none', () => {
            terminal(0, 24);

            expect(width()).toBe(DefaultWidth);
        });
    });

    describe('formatSize', () => {
        test.each`
            bytes         | text
            ${ 0 }        | ${ '0 B' }
            ${ 512 }      | ${ '512 B' }
            ${ 1023 }     | ${ '1023 B' }
            ${ 1024 }     | ${ '1.00 KB' }
            ${ 458520 }   | ${ '447.77 KB' }
            ${ 1048575 }  | ${ '1024.00 KB' }
            ${ 1048576 }  | ${ '1.00 MB' }
            ${ 1300234 }  | ${ '1.24 MB' }
        `('should render $bytes as $text', ({ bytes, text }: any) => {
            expect(formatSize(bytes)).toBe(text);
        });
    });

    describe('printOutputs', () => {
        /**
         * A metafile naming the outputs a build wrote.
         */

        function metafile(outputs: Record<string, number>): Metafile {
            return <Metafile> { outputs: Object.fromEntries(Object.entries(outputs).map(([ path, bytes ]) => [ path, { bytes }])) };
        }

        test('should print nothing at all for a build that wrote no output', () => {
            printOutputs(metafile({}));

            expect(logMock).not.toHaveBeenCalled();
        });

        test('should head the list with how many there are and what they come to', () => {
            printOutputs(metafile({ 'dist/index.js': 1024, 'dist/index.js.map': 512 }));

            const [ , header ] = printed();

            expect(header).toContain('Outputs (2)');
            expect(header.trimEnd().endsWith('1.50 KB')).toBe(true);
        });

        test('should name the largest output first', () => {
            printOutputs(metafile({ 'dist/small.js': 10, 'dist/large.js': 2048 }));

            const [ , , first, second ] = printed();

            expect(first).toContain('dist/large.js');
            expect(second).toContain('dist/small.js');
        });

        test('should set the sizes against the right margin so their digits line up', () => {
            printOutputs(metafile({ 'dist/index.js': 1024, 'dist/a-much-longer-name.js': 512 }));

            const [ , , first, second ] = printed();

            expect(first.length).toBe(second.length);
            expect(first.endsWith('1.00 KB')).toBe(true);
            expect(second.endsWith('  512 B')).toBe(true);
        });

        test('should count the outputs it did not name and what they come to', () => {
            printOutputs(metafile({ a: 300, b: 200, c: 100 }), 1);

            const lines = printed();

            expect(lines).toHaveLength(4);
            expect(lines[2]).toContain('a');
            expect(lines[3]).toContain('· 2 more');
            expect(lines[3].endsWith('300 B')).toBe(true);
        });

        test('should name every output where the caller set no limit', () => {
            printOutputs(metafile({ a: 300, b: 200, c: 100 }), Infinity);

            expect(printed()).toHaveLength(5);
            expect(printed().at(-1)).not.toContain('more');
        });

        test('should name the outputs a limit reaches without counting any as left over', () => {
            printOutputs(metafile({ a: 300, b: 200 }), 2);

            expect(printed()).toHaveLength(4);
            expect(printed().at(-1)).not.toContain('more');
        });

        test('should lay the list out in the width the terminal reports', () => {
            terminal(60, 24);
            printOutputs(metafile({ 'dist/index.js': 1024 }));

            for (const line of printed().slice(1)) expect(line.length).toBeLessThanOrEqual(60);
        });
    });
});
