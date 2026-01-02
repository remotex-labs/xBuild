/**
 * Import will remove at compile time
 */

/**
 * Imports
 */

import { formatErrors } from './uncaught.error';
import { xBuildBaseError } from '@errors/base.error';
import { formatStack } from '@providers/stack.provider';

/**
 * Tests
 */

describe('formatErrors', () => {
    beforeEach(() => {
        xJet.restoreAllMocks();
        xJet.spyOn(console, 'error');
        xJet.mock(formatStack).mockImplementation(() => 'Formatted: Standard error');
    });

    afterEach(() => {
        xJet.restoreAllMocks();
    });

    describe('standard Error handling', () => {
        test('should format and log standard Error instances', () => {
            const error = new Error('Standard error');
            formatErrors(error);

            expect(formatStack).toHaveBeenCalledWith(error, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
            expect(console.error).toHaveBeenCalledWith('Formatted: Standard error');
        });

        test('should format TypeError instances', () => {
            const error = new TypeError('Type error');
            formatErrors(error);

            expect(formatStack).toHaveBeenCalledWith(error, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
            expect(formatStack).toHaveBeenCalled();
        });

        test('should format RangeError instances', () => {
            const error = new RangeError('Range error');
            formatErrors(error);

            expect(formatStack).toHaveBeenCalledWith(error, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
            expect(console.error).toHaveBeenCalled();
        });
    });

    describe('xBuildBaseError handling', () => {
        test('should log xBuildBaseError directly without formatting', () => {
            new Error('Base error');
            class TestError extends xBuildBaseError {}
            const baseError = Object.create(TestError.prototype);
            baseError.message = 'Test base error';
            baseError.name = 'TestError';

            formatErrors(baseError);

            expect(formatStack).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith(baseError);
        });

        test('should not format errors extending xBuildBaseError', () => {
            class CustomError extends xBuildBaseError {
                constructor(message: string) {
                    super(message, 'CustomError');
                }
            }

            const customError = Object.create(CustomError.prototype);
            customError.message = 'Custom error message';
            customError.name = 'CustomError';

            formatErrors(customError);

            expect(formatStack).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith(customError);
        });
    });

    describe('AggregateError handling', () => {
        test('should log AggregateError message and format nested standard errors', () => {
            const error1 = new Error('Error 1');
            const error2 = new Error('Error 2');
            const aggregateError = new AggregateError([ error1, error2 ], 'Multiple errors');

            formatErrors(aggregateError);

            expect(console.error).toHaveBeenCalledWith('AggregateError:', 'Multiple errors');
            expect(formatStack).toHaveBeenCalledTimes(2);
            expect(formatStack).toHaveBeenCalledWith(error1, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
            expect(formatStack).toHaveBeenCalledWith(error2, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
        });

        test('should handle AggregateError with mixed error types', () => {
            const standardError = new Error('Standard');
            const baseError = Object.create(xBuildBaseError.prototype);
            baseError.message = 'Base error';
            const aggregateError = new AggregateError([ standardError, baseError ], 'Mixed errors');

            formatErrors(aggregateError);

            expect(console.error).toHaveBeenCalledWith('AggregateError:', 'Mixed errors');
            expect(formatStack).toHaveBeenCalledTimes(1);
            expect(formatStack).toHaveBeenCalledWith(standardError, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
            expect(console.error).toHaveBeenCalledWith(baseError);
        });

        test('should handle AggregateError with empty errors array', () => {
            const aggregateError = new AggregateError([], 'No errors');

            formatErrors(aggregateError);

            expect(console.error).toHaveBeenCalledWith('AggregateError:', 'No errors');
            expect(formatStack).not.toHaveBeenCalled();
        });

        test('should handle AggregateError with non-Error values', () => {
            const aggregateError = new AggregateError([ 'string error', 123, null ], 'Non-error values');

            formatErrors(aggregateError);

            expect(console.error).toHaveBeenCalledWith('AggregateError:', 'Non-error values');
            expect(console.error).toHaveBeenCalledWith('string error');
            expect(console.error).toHaveBeenCalledWith(123);
            expect(console.error).toHaveBeenCalledWith(null);
            expect(formatStack).not.toHaveBeenCalled();
        });

        test('should handle AggregateError with only xBuildBaseError instances', () => {
            const baseError1 = Object.create(xBuildBaseError.prototype);
            baseError1.message = 'Base 1';
            const baseError2 = Object.create(xBuildBaseError.prototype);
            baseError2.message = 'Base 2';
            const aggregateError = new AggregateError([ baseError1, baseError2 ], 'Base errors only');

            formatErrors(aggregateError);

            expect(console.error).toHaveBeenCalledWith('AggregateError:', 'Base errors only');
            expect(formatStack).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith(baseError1);
            expect(console.error).toHaveBeenCalledWith(baseError2);
        });
    });

    describe('non-Error value handling', () => {
        test('should log string values directly', () => {
            formatErrors('Simple string error');

            expect(formatStack).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith('Simple string error');
        });

        test('should log number values directly', () => {
            formatErrors(404);

            expect(formatStack).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith(404);
        });

        test('should log object values directly', () => {
            const obj = { code: 'ERR_001', message: 'Custom error object' };
            formatErrors(obj);

            expect(formatStack).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith(obj);
        });

        test('should log null directly', () => {
            formatErrors(null);

            expect(formatStack).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith(null);
        });

        test('should log undefined directly', () => {
            formatErrors(undefined);

            expect(formatStack).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith(undefined);
        });

        test('should log boolean values directly', () => {
            formatErrors(false);

            expect(formatStack).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith(false);
        });

        test('should log array values directly', () => {
            const arr = [ 'error1', 'error2' ];
            formatErrors(arr);

            expect(formatStack).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith(arr);
        });
    });

    describe('edge cases', () => {
        test('should handle Error with no message', () => {
            const error = new Error();
            formatErrors(error);

            expect(formatStack).toHaveBeenCalledWith(error, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
            expect(console.error).toHaveBeenCalled();
        });

        test('should handle Error with no stack', () => {
            const error = new Error('No stack');
            delete error.stack;
            formatErrors(error);

            expect(formatStack).toHaveBeenCalledWith(error, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
            expect(console.error).toHaveBeenCalled();
        });

        test('should handle nested AggregateErrors', () => {
            xJet.mock(formatStack).mockRestore();

            const innerError = new Error('Inner');
            const innerAggregate = new AggregateError([ innerError ], 'Inner aggregate');
            const outerAggregate = new AggregateError([ innerAggregate ], 'Outer aggregate');

            formatErrors(outerAggregate);

            expect(console.error).toHaveBeenCalledWith('AggregateError:', 'Outer aggregate');
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Inner aggregate'));
        });
    });

    describe('formatStack options', () => {
        test('should always call formatStack with both framework and native frames', () => {
            const error = new Error('Test');
            formatErrors(error);

            expect(formatStack).toHaveBeenCalledWith(error, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
        });

        test('should use same options for all errors in AggregateError', () => {
            const error1 = new Error('Error 1');
            const error2 = new Error('Error 2');
            const error3 = new Error('Error 3');
            const aggregateError = new AggregateError([ error1, error2, error3 ]);

            formatErrors(aggregateError);

            expect(formatStack).toHaveBeenCalledTimes(3);
            expect(formatStack).toHaveBeenNthCalledWith(1, error1, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
            expect(formatStack).toHaveBeenNthCalledWith(2, error2, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
            expect(formatStack).toHaveBeenNthCalledWith(3, error3, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
        });
    });
});
