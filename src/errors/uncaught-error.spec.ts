/**
 * Imports
 */

import process from 'node:process';
import { xBuildError } from '@errors/xbuild.error';
import { formatErrors } from '@errors/uncaught.error';
import { formatStack, getErrorMetadata } from '@providers/stack.provider';

/**
 * Tests
 */

describe('formatErrors', () => {
    const metadata: any = { stack: [{ format: 'at run src/index.ts:1:1' }] };
    const allFrames = { withFrameworkFrames: true, withNativeFrames: true };

    let errorMock: any;
    let formatStackMock: any;
    let getErrorMetadataMock: any;

    beforeEach(() => {
        xJet.restoreAllMocks();

        errorMock = xJet.spyOn(console, 'error').mockImplementation(() => undefined);
        formatStackMock = xJet.mock(formatStack).mockReturnValue('the resolved block');
        getErrorMetadataMock = xJet.mock(getErrorMetadata).mockReturnValue(metadata);
    });

    test('should resolve a plain error with the framework and native frames kept', () => {
        const failure = new Error('connect ECONNREFUSED');

        formatErrors(failure);

        expect(getErrorMetadataMock).toHaveBeenCalledWith(failure, allFrames);
        expect(formatStackMock).toHaveBeenCalledWith(metadata, 'Error', 'connect ECONNREFUSED');
        expect(errorMock).toHaveBeenCalledWith('the resolved block');
    });

    test('should print the block a framework error already carries', () => {
        const failure = new xBuildError('bad config');

        formatErrors(failure);

        expect(getErrorMetadataMock).toHaveBeenCalledTimes(1);
        expect(errorMock).toHaveBeenCalledWith(failure);
    });

    test('should print a value that is not an error as it stands', () => {
        formatErrors('not an error at all');

        expect(errorMock).toHaveBeenCalledWith('not an error at all');
        expect(getErrorMetadataMock).not.toHaveBeenCalled();
    });

    test('should announce an aggregate error and unwrap it', () => {
        const inner = new Error('first');
        const carried = new xBuildError('second');

        formatErrors(new AggregateError([ inner, carried ], 'everything failed'));

        expect(errorMock).toHaveBeenCalledWith('AggregateError:', 'everything failed');
        expect(getErrorMetadataMock).toHaveBeenCalledWith(inner, allFrames);
        expect(errorMock).toHaveBeenCalledWith('the resolved block');
        expect(errorMock).toHaveBeenCalledWith(carried);
    });

    test('should print a value inside an aggregate that is not an error as it stands', () => {
        formatErrors(new AggregateError([ 'plain value' ], 'everything failed'));

        expect(errorMock).toHaveBeenCalledWith('plain value');
    });
});

describe('process handlers', () => {
    let exitMock: any;
    let errorMock: any;

    beforeEach(() => {
        xJet.restoreAllMocks();

        errorMock = xJet.spyOn(console, 'error').mockImplementation(() => undefined);
        exitMock = xJet.spyOn(process, 'exit').mockImplementation(<any> (() => undefined));
        xJet.mock(formatStack).mockReturnValue('the resolved block');
        xJet.mock(getErrorMetadata).mockReturnValue(<any> { stack: [] });
    });

    test.each(
        { case: 'an exception nobody caught', event: 'uncaughtException', errorCode: 2 },
        { case: 'a rejection nobody awaited', event: 'unhandledRejection', errorCode: 3 }
    )('should print $case and leave the process with exit code $errorCode', ({ event, errorCode }) => {
        const listeners = process.listeners(<any> event);
        listeners[listeners.length - 1](<any> new Error('unreachable state'));

        expect(errorMock).toHaveBeenCalledWith('the resolved block');
        expect(exitMock).toHaveBeenCalledWith(errorCode);
    });
});
