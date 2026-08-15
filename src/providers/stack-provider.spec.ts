/**
 * Imports
 */

import { inject } from '@remotex-labs/xinject';
import { resolveError } from '@remotex-labs/xmap';
import { FrameworkService } from '@services/framework.service';
import { parseErrorStack } from '@remotex-labs/xmap/parser.component';
import { formatErrorCode } from '@remotex-labs/xmap/formatter.component';
import { highlightCode } from '@remotex-labs/xmap/highlighter.component';
import { getSource, getErrorStack, getErrorMetadata, formatStack } from './stack.provider';

/**
 * Tests
 */

describe('stack.provider', () => {
    const parsed: any = { stack: [], name: 'Error', message: 'boom', rawStack: '' };

    let framework: any;
    let filesModel: any;
    let resolved: any;
    let resolveErrorMock: any;
    let formatErrorCodeMock: any;

    beforeEach(() => {
        xJet.restoreAllMocks();

        framework = { getSourceMap: xJet.fn(() => undefined), isFrameworkFile: xJet.fn(() => false) };
        filesModel = { touch: xJet.fn(() => ({ snapshot: undefined })) };
        resolved = { stack: [] };

        xJet.mock(inject).mockImplementation(
            (<any> ((token: unknown) => token === FrameworkService ? framework : filesModel))
        );

        xJet.mock(parseErrorStack).mockReturnValue(parsed);
        xJet.mock(highlightCode).mockImplementation(((code: string) => `highlighted:${ code }`) as any);
        resolveErrorMock = xJet.mock(resolveError).mockImplementation((() => resolved) as any);
        formatErrorCodeMock = xJet.mock(formatErrorCode).mockReturnValue('the code window');
    });

    describe('getSource', () => {
        test('should return the source map registered for the file', () => {
            const map: any = { getPositionWithCode: (): null => null };
            framework.getSourceMap.mockReturnValue(map);

            expect(getSource('dist/index.js')).toBe(map);
            expect(filesModel.touch).not.toHaveBeenCalled();
        });

        test('should return null when the file has neither a map nor cached text', () => {
            expect(getSource('missing.ts')).toBeNull();
        });

        test('should stand the cached text in for a file with no map', () => {
            filesModel.touch.mockReturnValue({ snapshot: { text: 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj' } });

            expect(getSource('src/index.ts')?.getPositionWithCode(5, 2, <any> undefined)).toEqual({
                line: 5,
                column: 2,
                name: null,
                startLine: 2,
                endLine: 8,
                sourceRoot: null,
                sourceIndex: -1,
                generatedLine: -1,
                generatedColumn: -1,
                source: 'src/index.ts',
                code: 'b\nc\nd\ne\nf\ng\nh'
            });
        });

        test('should take the window size the caller asks for', () => {
            filesModel.touch.mockReturnValue({ snapshot: { text: 'a\nb\nc\nd\ne\nf\ng' } });

            const position = getSource('src/index.ts')?.getPositionWithCode(3, 0, <any> undefined, {
                linesBefore: 1, linesAfter: 1
            });

            expect(position).toEqual(expect.objectContaining({ startLine: 2, endLine: 4, code: 'b\nc\nd' }));
        });

        test('should clamp the window to the bounds of the file', () => {
            filesModel.touch.mockReturnValue({ snapshot: { text: 'a\nb\nc' } });
            const source = getSource('src/index.ts');

            expect(source?.getPositionWithCode(1, 0, <any> undefined)).toEqual(
                expect.objectContaining({ startLine: 1, endLine: 3, code: 'a\nb\nc' })
            );
            expect(source?.getPositionWithCode(3, 0, <any> undefined)).toEqual(
                expect.objectContaining({ startLine: 1, endLine: 3, code: 'a\nb\nc' })
            );
        });

        test('should return null for a file whose cached text is empty', () => {
            filesModel.touch.mockReturnValue({ snapshot: { text: '' } });

            expect(getSource('src/empty.ts')).toBeNull();
        });

        test('should default the side of the window the caller leaves out', () => {
            filesModel.touch.mockReturnValue({ snapshot: { text: 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj' } });
            const source = getSource('src/index.ts');

            expect(source?.getPositionWithCode(5, 0, <any> undefined, <any> { linesBefore: 0 })).toEqual(
                expect.objectContaining({ startLine: 5, endLine: 8, code: 'e\nf\ng\nh' })
            );
            expect(source?.getPositionWithCode(5, 0, <any> undefined, <any> { linesAfter: 0 })).toEqual(
                expect.objectContaining({ startLine: 2, endLine: 5, code: 'b\nc\nd\ne' })
            );
        });

        test('should give back no code for a line past the end of the file', () => {
            filesModel.touch.mockReturnValue({ snapshot: { text: 'a\nb\nc' } });

            expect(getSource('src/index.ts')?.getPositionWithCode(99, 0, <any> undefined)).toEqual(
                expect.objectContaining({ line: 99, startLine: 96, endLine: 3, code: '' })
            );
        });

        test('should look the file up under the empty name when it is given none', () => {
            getSource();

            expect(framework.getSourceMap).toHaveBeenCalledWith('');
            expect(filesModel.touch).toHaveBeenCalledWith('');
        });

        test('should read the file through the cache under the name it was given', () => {
            getSource('src/index.ts');

            expect(filesModel.touch).toHaveBeenCalledWith('src/index.ts');
        });
    });

    describe('getErrorStack', () => {
        test('should parse an error from its own stack', () => {
            const failure = new Error('boom');

            expect(getErrorStack(failure)).toBe(parsed);
            expect(parseErrorStack).toHaveBeenCalledWith(failure);
        });

        test('should parse the error an esbuild message carries as its detail', () => {
            const failure = new Error('boom');

            expect(getErrorStack({ text: 'build failed', detail: failure })).toBe(parsed);
            expect(parseErrorStack).toHaveBeenCalledWith(failure);
        });

        test('should turn the location of a message into its single frame', () => {
            expect(getErrorStack({
                text: 'Unexpected token',
                location: <any> { file: 'src/index.ts', line: 4, column: 2 }
            })).toEqual({
                rawStack: '',
                name: 'esBuildMessage',
                message: 'Unexpected token',
                stack: [
                    {
                        line: 4,
                        column: 2,
                        eval: false,
                        async: false,
                        native: false,
                        constructor: false,
                        source: '@src/index.ts',
                        fileName: 'src/index.ts'
                    }
                ]
            });
        });

        test('should resolve a message with no location to no frames', () => {
            expect(getErrorStack({ text: 'Could not resolve module' })).toEqual({
                stack: [], rawStack: '', name: 'esBuildMessage', message: 'Could not resolve module'
            });
        });

        test('should prefer the error a message carries over its location', () => {
            const failure = new Error('boom');
            const message = { text: 'build failed', detail: failure, location: <any> { file: 'a.ts', line: 1, column: 1 } };

            expect(getErrorStack(message)).toBe(parsed);
            expect(parseErrorStack).toHaveBeenCalledWith(failure);
        });

        test('should ignore a detail that is not an error', () => {
            expect(getErrorStack({ text: 'build failed', detail: 'a note of its own' })).toEqual({
                stack: [], rawStack: '', name: 'esBuildMessage', message: 'build failed'
            });

            expect(parseErrorStack).not.toHaveBeenCalled();
        });

        test('should report a column of zero as the first column', () => {
            const [ frame ] = getErrorStack({
                text: 'Unexpected token',
                location: <any> { file: 'src/index.ts', line: 3, column: 0 }
            }).stack;

            expect(frame).toEqual(expect.objectContaining({ line: 3, column: 1 }));
        });

        test('should carry an empty message when the text is missing', () => {
            expect(getErrorStack({}).message).toBe('');
            expect(getErrorStack({ location: <any> { file: 'a.ts', line: 1, column: 0 } }).message).toBe('');
        });
    });

    describe('getErrorMetadata', () => {
        test('should resolve every frame through the source lookup', () => {
            const map: any = { getPositionWithCode: (): null => null };
            framework.getSourceMap.mockReturnValue(map);

            getErrorMetadata(new Error('boom'));

            const [ trace, options ] = resolveErrorMock.mock.calls[0];

            expect(trace).toBe(parsed);
            expect(options.getSource('dist/index.js')).toBe(map);
        });

        test('should keep native frames out by default', () => {
            getErrorMetadata(new Error('boom'));

            expect(resolveErrorMock).toHaveBeenCalledWith(parsed, expect.objectContaining({ withNativeFrames: false }));
        });

        test.each(
            { case: 'framework frames are kept', options: { withFrameworkFrames: true }, verbose: false },
            { case: 'it is asked to be verbose', options: undefined, verbose: true }
        )('should admit native frames when $case', ({ options, verbose }) => {
            getErrorMetadata(new Error('boom'), options, verbose);

            expect(resolveErrorMock).toHaveBeenCalledWith(parsed, expect.objectContaining({ withNativeFrames: true }));
        });

        test('should pass the window size through to the resolver', () => {
            getErrorMetadata(new Error('boom'), { linesBefore: 2, linesAfter: 2 });

            expect(resolveErrorMock).toHaveBeenCalledWith(parsed, expect.objectContaining({
                linesBefore: 2, linesAfter: 2
            }));
        });

        test('should take the window from the first frame that carries code', () => {
            resolved.stack = [
                { code: 'const a = 1;', line: 11, column: 2, stratLine: 8 },
                { code: 'const b = 2;', line: 20, column: 1, stratLine: 17 }
            ];

            expect(getErrorMetadata(new Error('boom')).formatCode).toBe('the code window');
            expect(formatErrorCodeMock).toHaveBeenCalledTimes(1);
            expect(formatErrorCodeMock).toHaveBeenCalledWith({
                code: 'highlighted:const a = 1;', line: 11, column: 2, startLine: 8
            }, expect.objectContaining({ color: expect.any(Function) }));
        });

        test('should leave the window unset when no frame carries code', () => {
            resolved.stack = [{ line: 11, column: 2 }];

            expect(getErrorMetadata(new Error('boom')).formatCode).toBeUndefined();
            expect(formatErrorCodeMock).not.toHaveBeenCalled();
        });

        test('should default the position of a frame that reports none', () => {
            resolved.stack = [{ code: 'const a = 1;' }];

            getErrorMetadata(new Error('boom'));

            expect(formatErrorCodeMock).toHaveBeenCalledWith(
                expect.objectContaining({ line: 1, column: 1, startLine: 1 }), expect.any(Object)
            );
        });

        test('should give back the trace the resolver produced', () => {
            expect(getErrorMetadata(new Error('boom'))).toBe(resolved);
        });

        test('should skip a framework frame for the window unless framework frames are kept', () => {
            resolved.stack = [
                { code: 'framework code', line: 1, column: 1, stratLine: 0 },
                { code: 'project code', line: 9, column: 3, stratLine: 6 }
            ];
            framework.isFrameworkFile.mockImplementation((frame: any) => frame.code === 'framework code');

            getErrorMetadata(new Error('boom'));

            expect(formatErrorCodeMock).toHaveBeenCalledTimes(1);
            expect(formatErrorCodeMock).toHaveBeenCalledWith(
                expect.objectContaining({ code: 'highlighted:project code' }), expect.any(Object)
            );
        });

        test('should let a framework frame supply the window when framework frames are kept', () => {
            resolved.stack = [{ code: 'framework code', line: 1, column: 1, stratLine: 0 }];
            framework.isFrameworkFile.mockReturnValue(true);

            getErrorMetadata(new Error('boom'), { withFrameworkFrames: true });

            expect(framework.isFrameworkFile).not.toHaveBeenCalled();
            expect(formatErrorCodeMock).toHaveBeenCalledWith(
                expect.objectContaining({ code: 'highlighted:framework code' }), expect.any(Object)
            );
        });

        test('should keep a framework frame in the trace it passed over for the window', () => {
            resolved.stack = [
                { code: 'framework code', line: 1, column: 1, stratLine: 0 },
                { code: 'project code', line: 9, column: 3, stratLine: 6 }
            ];
            framework.isFrameworkFile.mockImplementation((frame: any) => frame.code === 'framework code');

            expect(getErrorMetadata(new Error('boom')).stack).toHaveLength(2);
        });
    });

    describe('formatStack', () => {
        test('should head the block with the name and the message', () => {
            expect(formatStack(<any> { stack: [] }, 'TypeError', 'x is not a function'))
                .toBe('\nTypeError: \x1B[38;5;203mx is not a function\x1B[39m');
        });

        test('should print the notes under the heading', () => {
            const block = formatStack(<any> { stack: [] }, 'esBuildMessage', 'failed', [{ text: 'the import is unused' }, <any> {} ]);

            expect(block).toContain('the import is unused');
            expect(block.split('\n')).toHaveLength(3);
        });

        test('should print the code window when the metadata carries one', () => {
            expect(formatStack(<any> { stack: [], formatCode: 'the code window' }, 'TypeError', 'boom'))
                .toContain('\n\nthe code window');
        });

        test('should print the heading, the notes, the window, and the trace in that order', () => {
            const block = formatStack(
                <any> { stack: [{ format: 'at run src/index.ts:11:2' }], formatCode: 'the code window' },
                'TypeError', 'x is not a function', [{ text: 'the import is unused' }]
            );

            const heading = block.indexOf('TypeError');
            const note = block.indexOf('the import is unused');
            const window = block.indexOf('the code window');
            const trace = block.indexOf('Enhanced Stack Trace');

            expect(heading).toBe(1);
            expect(note).toBeGreaterThan(heading);
            expect(window).toBeGreaterThan(note);
            expect(trace).toBeGreaterThan(window);
        });

        test('should print the resolved trace when there are frames', () => {
            const block = formatStack(<any> {
                stack: [{ format: 'at run src/index.ts:11:2' }, { format: 'at main src/bash.ts:4:1' }]
            }, 'TypeError', 'boom');

            expect(block).toContain('\n\nEnhanced Stack Trace:\n    at run src/index.ts:11:2\n    at main src/bash.ts:4:1\n');
        });
    });
});
