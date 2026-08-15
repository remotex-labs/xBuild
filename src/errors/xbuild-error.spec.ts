/**
 * Imports
 */

import { xBuildError } from './xbuild.error';
import { xBuildBaseError } from '@errors/base.error';
import { formatStack, getErrorMetadata } from '@providers/stack.provider';

/**
 * Tests
 */

describe('xBuildError', () => {
    const inspect = Symbol.for('nodejs.util.inspect.custom');
    const metadata: any = { stack: [{ format: 'at run src/bash.ts:41:11' }], formatCode: 'throw new xBuildError();' };

    let formatStackMock: any;
    let getErrorMetadataMock: any;

    beforeEach(() => {
        xJet.restoreAllMocks();

        formatStackMock = xJet.mock(formatStack).mockReturnValue('the resolved block');
        getErrorMetadataMock = xJet.mock(getErrorMetadata).mockReturnValue(metadata);
    });

    test('should resolve its stack as it is constructed, keeping the framework frames', () => {
        const error = new xBuildError('tsconfig.json was not found');

        expect(getErrorMetadataMock).toHaveBeenCalledWith(error, { withFrameworkFrames: true });
        expect(error.metadata).toBe(metadata);
    });

    test('should pass the frame options it was given through', () => {
        const error = new xBuildError('entry point missing', { linesBefore: 1, linesAfter: 1 });

        expect(getErrorMetadataMock).toHaveBeenCalledWith(error, { linesBefore: 1, linesAfter: 1 });
    });

    test('should head its block with the base name and its own message', () => {
        new xBuildError('tsconfig.json was not found');

        expect(formatStackMock).toHaveBeenCalledWith(metadata, 'xBuildBaseError', 'tsconfig.json was not found');
    });

    test('should print the block it resolved', () => {
        expect((<any> new xBuildError('bad config'))[inspect]()).toBe('the resolved block');
    });

    test('should be catchable as a framework error', () => {
        const error = new xBuildError('bad config');

        expect(error).toBeInstanceOf(xBuildBaseError);
        expect(error).toBeInstanceOf(Error);
    });
});
