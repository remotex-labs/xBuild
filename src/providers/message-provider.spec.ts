/**
 * Imports
 */

import { errorToMessage, isEsbuildError } from './message.provider';
import { parseErrorStack } from '@remotex-labs/xmap/parser.component';

/**
 * Tests
 */

describe('isEsbuildError', () => {
    test.each(
        { case: 'null', value: null },
        { case: 'nothing at all', value: undefined },
        { case: 'a string', value: 'boom' },
        { case: 'a number', value: 42 },
        { case: 'a function', value: (): undefined => undefined },
        { case: 'a thrown error', value: new Error('boom') },
        { case: 'an object naming no errors', value: {} },
        { case: 'an object whose errors are not a list', value: { errors: { 0: { detail: 1 } } } },
        { case: 'an empty list of errors', value: { errors: [] } },
        { case: 'a list starting with null', value: { errors: [ null ] } },
        { case: 'a list starting with a string', value: { errors: [ 'boom' ] } },
        { case: 'a message carrying no detail', value: { errors: [{ text: 'boom' }] } }
    )('should read $case as no esbuild failure', ({ value }) => {
        expect(isEsbuildError(value)).toBe(false);
    });

    test('should read a failure whose first message carries a detail', () => {
        const failure = { errors: [{ text: 'boom', detail: new Error('boom') }], warnings: [] };

        expect(isEsbuildError(failure)).toBe(true);
    });

    test('should read a detail that is named but holds nothing', () => {
        expect(isEsbuildError({ errors: [{ text: 'boom', detail: undefined }] })).toBe(true);
    });

    test('should read a detail the first message inherits', () => {
        expect(isEsbuildError({ errors: [ Object.create({ detail: new Error('boom') }) ] })).toBe(true);
    });

    test('should read the first message alone', () => {
        expect(isEsbuildError({ errors: [{ text: 'boom' }, { detail: new Error('boom') }] })).toBe(false);
        expect(isEsbuildError({ errors: [{ detail: new Error('boom') }, 'junk' ] })).toBe(true);
    });

    test('should read a bare list of messages as no failure', () => {
        expect(isEsbuildError([{ detail: new Error('boom') }])).toBe(false);
    });
});

describe('errorToMessage', () => {
    const error = new Error('x is not a function');
    const located = { file: 'src/index.ts', line: 12, column: 4, namespace: 'file' };

    let parseMock: any;

    /**
     * Stands a parsed stack in for the one the parser would return.
     */

    function parsed(...stack: Array<unknown>): any {
        return { name: 'TypeError', message: 'x is not a function', rawStack: '', stack };
    }

    beforeEach(() => {
        xJet.restoreAllMocks();

        parseMock = xJet.mock(parseErrorStack).mockReturnValue(
            parsed({ fileName: 'src/index.ts', line: 12, column: 4 })
        );
    });

    describe('the message it builds', () => {
        test('should parse the error it was given', () => {
            errorToMessage(error);

            expect(parseMock).toHaveBeenCalledWith(error);
        });

        test('should carry the error as the detail of the message', () => {
            expect(errorToMessage(error).detail).toBe(error);
        });

        test('should take the text from the parsed stack rather than from the error', () => {
            expect(errorToMessage(new Error('the raw text')).text).toBe('x is not a function');
        });

        test('should carry the identifier and the plugin name it was given', () => {
            expect(errorToMessage(error, 'macro-failed', 'xbuild')).toEqual(expect.objectContaining({
                id: 'macro-failed', pluginName: 'xbuild'
            }));
        });

        test('should name neither when it is given neither', () => {
            expect(errorToMessage(error)).toEqual({
                detail: error,
                id: '',
                pluginName: '',
                text: 'x is not a function',
                location: located
            });
        });
    });

    describe('the location it points at', () => {
        test('should point at the file, the line, and the column the first frame named', () => {
            expect(errorToMessage(error).location).toEqual(located);
        });

        test('should read the first frame alone', () => {
            parseMock.mockReturnValue(parsed(
                { fileName: 'src/index.ts', line: 12, column: 4 },
                { fileName: 'src/bash.ts', line: 40, column: 1 }
            ));

            expect(errorToMessage(error).location).toEqual(located);
        });

        test.each(
            { case: 'names no file', frame: { line: 12, column: 4 } },
            { case: 'knows no line', frame: { fileName: 'src/index.ts', column: 4 } },
            { case: 'knows no column', frame: { fileName: 'src/index.ts', line: 12 } },
            { case: 'sits at line zero', frame: { fileName: 'src/index.ts', line: 0, column: 4 } },
            { case: 'sits at column zero', frame: { fileName: 'src/index.ts', line: 12, column: 0 } }
        )('should leave the location unset for a frame that $case', ({ frame }) => {
            parseMock.mockReturnValue(parsed(frame));
            const message = errorToMessage(error);

            expect(message.location).toBeUndefined();
            expect('location' in message).toBe(false);
        });

        test('should leave the location unset for a parsed stack carrying no frames', () => {
            parseMock.mockReturnValue(parsed());
            const message = errorToMessage(error);

            expect(message.location).toBeUndefined();
            expect(message.text).toBe('x is not a function');
        });
    });
});
