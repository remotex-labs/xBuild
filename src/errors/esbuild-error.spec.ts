/**
 * Import will remove at compile time
 */

import type {
    ESBuildErrorInterface,
    ESBuildAggregateErrorInterface,
    ESBuildLocationInterface
} from '@errors/interfaces/esbuild-error.interface';

/**
 * Imports
 */

import { esBuildError } from './esbuild.error';
import { xBuildBaseError } from '@errors/base.error';
import { xterm } from '@remotex-labs/xansi/xterm.component';
import { formatCode } from '@remotex-labs/xmap/formatter.component';
import { highlightCode } from '@remotex-labs/xmap/highlighter.component';

/**
 * Tests
 */

describe('esBuildError', () => {
    beforeEach(() => {
        xJet.restoreAllMocks();
        xJet.spyOn(xterm, 'lightCoral').mockImplementation(<any> (
            (text: string) => `[lightCoral]${ text }[/lightCoral]`)
        );

        xJet.spyOn(xterm, 'dim').mockImplementation(<any> (
            (text: string) => `[dim]${ text }[/dim]`)
        );

        xJet.spyOn(xterm, 'gray').mockImplementation(<any> (
            (text: string) => `[gray]${ text }[/gray]`)
        );

        xJet.mock(highlightCode).mockImplementation((code: string) => `[highlighted]${ code }[/highlighted]`);
        xJet.mock(formatCode).mockImplementation((code: string, options: any) => `[formatted:${ options.startLine }]${ code }[/formatted]`);
    });

    afterEach(() => {
        xJet.restoreAllMocks();
    });

    describe('constructor', () => {
        test('should create an esBuildError instance', () => {
            const error: ESBuildErrorInterface = {
                name: 'Error',
                message: 'Build failed'
            };

            const buildError = new esBuildError(error);

            expect(buildError).toBeInstanceOf(esBuildError);
            expect(buildError).toBeInstanceOf(xBuildBaseError);
            expect(buildError.name).toBe('esBuildError');
            expect(buildError.message).toBe('esBuildError build failed');
        });

        test('should handle error without aggregateErrors', () => {
            const error: ESBuildErrorInterface = {
                name: 'Error',
                message: 'Simple build error',
                stack: 'Error stack trace'
            };

            const buildError = new esBuildError(error);

            expect(buildError).toBeInstanceOf(esBuildError);
            expect(buildError.message).toBe('esBuildError build failed');
        });
    });

    describe('formatAggregateErrors', () => {
        const makeLocation = (data: Partial<ESBuildLocationInterface> = {}): ESBuildLocationInterface => ({
            file: '/file.ts',
            line: 1,
            column: 1,
            length: 1,
            lineText: 'code',
            namespace: 'default',
            suggestion: '',
            ...data
        });

        const makeAggError = (data: Partial<ESBuildAggregateErrorInterface> = {}): ESBuildAggregateErrorInterface => ({
            id: '1',
            text: 'Error',
            notes: [{ text: 'Note' }],
            location: makeLocation(),
            pluginName: 'plugin',
            ...data
        });

        test('should format single aggregate error with all components', () => {
            const aggregateError = makeAggError({
                text: 'Syntax error',
                notes: [{ text: 'Missing semicolon' }],
                location: makeLocation({
                    file: '/path/to/file.ts',
                    line: 42,
                    column: 15,
                    lineText: '  const x = 10'
                })
            });

            const error: ESBuildErrorInterface = {
                name: 'Error',
                message: 'Build failed',
                aggregateErrors: [ aggregateError ]
            };

            const buildError: any = new esBuildError(error);

            expect(buildError.formattedStack).toContain('esBuildError:');
            expect(buildError.formattedStack).toContain('[lightCoral]Syntax error: Missing semicolon[/lightCoral]');
            expect(buildError.formattedStack).toContain('[formatted:42][highlighted]const x = 10[/highlighted][/formatted]');
            expect(buildError.formattedStack).toContain('[dim]/path/to/file.ts[/dim]');
            expect(buildError.formattedStack).toContain('[gray][42:15][/gray]');
        });

        test('should trim lineText before highlighting', () => {
            const aggregateError = makeAggError({
                location: makeLocation({ lineText: '    const x = 10    ' })
            });

            const error: ESBuildErrorInterface = {
                name: 'Error',
                message: 'Error',
                aggregateErrors: [ aggregateError ]
            };

            new esBuildError(error);

            expect(highlightCode).toHaveBeenCalledWith('const x = 10');
        });

        test('should use last note text from notes array', () => {
            const aggregateError = makeAggError({
                notes: [
                    { text: 'First note' },
                    { text: 'Second note' },
                    { text: 'Last note' }
                ]
            });

            const error: ESBuildErrorInterface = {
                name: 'Error',
                message: 'Error',
                aggregateErrors: [ aggregateError ]
            };

            const buildError: any = new esBuildError(error);

            expect(buildError.formattedStack).toContain('[lightCoral]Error: Last note[/lightCoral]');
        });

        test('should handle aggregate error with empty notes', () => {
            const aggregateError = makeAggError({ notes: [] });

            const error: ESBuildErrorInterface = {
                name: 'Error',
                message: 'Error',
                aggregateErrors: [ aggregateError ]
            };

            const buildError: any = new esBuildError(error);

            expect(buildError.formattedStack).toContain('[lightCoral]Error: undefined[/lightCoral]');
        });

        test('should handle long file paths', () => {
            const longPath = '/very/long/path/to/some/deeply/nested/file.ts';
            const aggregateError = makeAggError({
                location: makeLocation({ file: longPath })
            });

            const error: ESBuildErrorInterface = {
                name: 'Error',
                message: 'Error',
                aggregateErrors: [ aggregateError ]
            };

            const buildError: any = new esBuildError(error);
            expect(buildError.formattedStack).toContain(`[dim]${ longPath }[/dim]`);
        });

        test('should call xterm methods correctly', () => {
            const aggregateError = makeAggError({
                text: 'Syntax Error',
                notes: [{ text: 'Missing bracket' }],
                location: makeLocation({
                    file: '/src/index.ts',
                    line: 50,
                    column: 10,
                    lineText: 'function test()'
                })
            });

            const error: ESBuildErrorInterface = {
                name: 'Error',
                message: 'Error',
                aggregateErrors: [ aggregateError ]
            };

            new esBuildError(error);

            expect(xterm.lightCoral).toHaveBeenCalledWith('Syntax Error: Missing bracket');
            expect(xterm.dim).toHaveBeenCalledWith('/src/index.ts');
            expect(xterm.gray).toHaveBeenCalledWith('[50:10]');
        });
    });
});
