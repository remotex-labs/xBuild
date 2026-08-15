/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { StackTraceInterface } from '@providers/interfaces/stack-provider.interface';

/**
 * Imports
 */

import { xBuildBaseError } from './base.error';
import { formatStack, getErrorMetadata } from '@providers/stack.provider';

/**
 * Tests
 */

describe('xBuildBaseError', () => {
    const inspect = Symbol.for('nodejs.util.inspect.custom');
    const metadata: any = { stack: [{ format: 'at run src/index.ts:1:1' }], formatCode: 'const a = 1;' };

    class ValidationError extends xBuildBaseError {
        constructor(message: string, name?: string, options?: StackTraceInterface, error?: Error) {
            super(message, name);
            this.reformatStack(error ?? this, options);
        }
    }

    class SilentError extends xBuildBaseError {
        constructor(message: string) {
            super(message);
        }
    }

    let formatStackMock: any;
    let getErrorMetadataMock: any;

    beforeEach(() => {
        xJet.restoreAllMocks();

        formatStackMock = xJet.mock(formatStack).mockReturnValue('the resolved block');
        getErrorMetadataMock = xJet.mock(getErrorMetadata).mockReturnValue(metadata);
    });

    describe('constructor', () => {
        test('should carry the message and the name it was given', () => {
            const error = new ValidationError('email is not an address', 'ValidationError');

            expect(error.message).toBe('email is not an address');
            expect(error.name).toBe('ValidationError');
        });

        test('should name itself after the base class when it is given no name', () => {
            expect(new SilentError('nothing').name).toBe('xBuildBaseError');
        });

        test('should keep the prototype chain of the subclass', () => {
            const error = new ValidationError('bad');

            expect(error).toBeInstanceOf(ValidationError);
            expect(error).toBeInstanceOf(xBuildBaseError);
            expect(error).toBeInstanceOf(Error);
        });

        test('should start the captured stack at the caller', () => {
            expect(new SilentError('nothing').stack).not.toContain('new SilentError');
        });
    });

    describe('metadata', () => {
        test('should stay undefined until the subclass reformats the stack', () => {
            expect(new SilentError('nothing').metadata).toBeUndefined();
            expect(getErrorMetadataMock).not.toHaveBeenCalled();
        });

        test('should carry what the stack provider resolved', () => {
            expect(new ValidationError('bad').metadata).toBe(metadata);
        });
    });

    describe('reformatStack', () => {
        test('should head the block with the name and the message of the error', () => {
            new ValidationError('email is not an address', 'ValidationError');

            expect(formatStackMock).toHaveBeenCalledWith(metadata, 'ValidationError', 'email is not an address');
        });

        test('should pass the frame options through to the stack provider', () => {
            const error = new ValidationError('bad', 'ValidationError', { withFrameworkFrames: false });

            expect(getErrorMetadataMock).toHaveBeenCalledWith(error, { withFrameworkFrames: false });
        });

        test('should resolve the error it was given rather than always this one', () => {
            const cause = new Error('the failure that happened');
            new ValidationError('wrapper', 'WrapperError', undefined, cause);

            expect(getErrorMetadataMock).toHaveBeenCalledWith(cause, undefined);
            expect(formatStackMock).toHaveBeenCalledWith(metadata, 'Error', 'the failure that happened');
        });

        test('should replace both fields when it runs again', () => {
            const error = new ValidationError('bad');

            getErrorMetadataMock.mockReturnValue(<any> { stack: [] });
            formatStackMock.mockReturnValue('another block');
            (<any> error).reformatStack(error, { linesBefore: 1 });

            expect(error.metadata).toEqual({ stack: [] });
            expect((<any> error)[inspect]()).toBe('another block');
        });
    });

    describe('inspect', () => {
        test('should print the resolved block when there is one', () => {
            expect((<any> new ValidationError('bad'))[inspect]()).toBe('the resolved block');
        });

        test('should fall back to the native stack when nothing was resolved', () => {
            const error = new SilentError('nothing');

            expect((<any> error)[inspect]()).toBe(error.stack);
        });

        test('should count an empty block as no block at all', () => {
            formatStackMock.mockReturnValue('');
            const error = new ValidationError('bad');

            expect((<any> error)[inspect]()).toBe(error.stack);
        });
    });
});
