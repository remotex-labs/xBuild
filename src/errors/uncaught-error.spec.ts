/**
 * Import will remove at compile time
 */

import type { StackInterface } from '@providers/interfaces/stack-provider.interface';

/**
 * Imports
 */

import { readFileSync } from 'fs';
import { formatErrors } from './uncaught.error';
import { xBuildBaseError } from '@errors/base.error';
import { formatStack, getErrorMetadata } from '@providers/stack.provider';

/**
 * Tests
 */

describe('formatErrors', () => {
    const dummySourceMap = JSON.stringify({
        version: 3,
        sources: [ 'framework.ts' ],
        names: [],
        mappings: 'AAAA'
    });

    const mockMetadata: StackInterface = {
        code: 'test code',
        line: 10,
        column: 5,
        source: 'test.ts',
        stacks: [ 'at test test.ts [10:5]' ],
        formatCode: '10 | test code\n        ^'
    };

    beforeEach(() => {
        xJet.restoreAllMocks();
        xJet.mock(readFileSync).mockImplementation(() => dummySourceMap);
        xJet.spyOn(console, 'error');
        xJet.mock(getErrorMetadata).mockReturnValue(mockMetadata);
        xJet.mock(formatStack).mockImplementation(() => 'Formatted: Standard error');
    });

    afterEach(() => {
        xJet.restoreAllMocks();
    });

    describe('standard Error handling', () => {
        test('should parse and format standard Error instances', () => {
            const error = new Error('Standard error');
            formatErrors(error);

            expect(getErrorMetadata).toHaveBeenCalledWith(error, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
            expect(formatStack).toHaveBeenCalledWith(mockMetadata, 'Error', 'Standard error');
            expect(console.error).toHaveBeenCalledWith('Formatted: Standard error');
        });

        test('should format TypeError instances', () => {
            const error = new TypeError('Type error');
            formatErrors(error);

            expect(getErrorMetadata).toHaveBeenCalledWith(error, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
            expect(formatStack).toHaveBeenCalledWith(mockMetadata, 'TypeError', 'Type error');
            expect(console.error).toHaveBeenCalled();
        });

        test('should format RangeError instances', () => {
            const error = new RangeError('Range error');
            formatErrors(error);

            expect(getErrorMetadata).toHaveBeenCalledWith(error, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
            expect(formatStack).toHaveBeenCalledWith(mockMetadata, 'RangeError', 'Range error');
            expect(console.error).toHaveBeenCalled();
        });

        test('should handle custom error names', () => {
            const error = new Error('Custom error');
            error.name = 'CustomError';
            formatErrors(error);

            expect(getErrorMetadata).toHaveBeenCalledWith(error, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
            expect(formatStack).toHaveBeenCalledWith(mockMetadata, 'CustomError', 'Custom error');
        });
    });

    describe('xBuildBaseError handling', () => {
        test('should log xBuildBaseError directly without formatting', () => {
            class TestError extends xBuildBaseError {}
            const baseError = Object.create(TestError.prototype);
            baseError.message = 'Test base error';
            baseError.name = 'TestError';

            formatErrors(baseError);

            expect(getErrorMetadata).not.toHaveBeenCalled();
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

            expect(getErrorMetadata).not.toHaveBeenCalled();
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
            expect(getErrorMetadata).toHaveBeenCalledTimes(2);
            expect(getErrorMetadata).toHaveBeenCalledWith(error1, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
            expect(getErrorMetadata).toHaveBeenCalledWith(error2, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
            expect(formatStack).toHaveBeenCalledTimes(2);
            expect(formatStack).toHaveBeenCalledWith(mockMetadata, 'Error', 'Error 1');
            expect(formatStack).toHaveBeenCalledWith(mockMetadata, 'Error', 'Error 2');
        });

        test('should handle AggregateError with mixed error types', () => {
            const standardError = new Error('Standard');
            const baseError = Object.create(xBuildBaseError.prototype);
            baseError.message = 'Base error';
            const aggregateError = new AggregateError([ standardError, baseError ], 'Mixed errors');

            formatErrors(aggregateError);

            expect(console.error).toHaveBeenCalledWith('AggregateError:', 'Mixed errors');
            expect(getErrorMetadata).toHaveBeenCalledTimes(1);
            expect(getErrorMetadata).toHaveBeenCalledWith(standardError, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
            expect(formatStack).toHaveBeenCalledTimes(1);
            expect(formatStack).toHaveBeenCalledWith(mockMetadata, 'Error', 'Standard');
            expect(console.error).toHaveBeenCalledWith(baseError);
        });

        test('should handle AggregateError with empty errors array', () => {
            const aggregateError = new AggregateError([], 'No errors');

            formatErrors(aggregateError);

            expect(console.error).toHaveBeenCalledWith('AggregateError:', 'No errors');
            expect(getErrorMetadata).not.toHaveBeenCalled();
            expect(formatStack).not.toHaveBeenCalled();
        });

        test('should handle AggregateError with non-Error values', () => {
            const aggregateError = new AggregateError([ 'string error', 123, null ], 'Non-error values');

            formatErrors(aggregateError);

            expect(console.error).toHaveBeenCalledWith('AggregateError:', 'Non-error values');
            expect(console.error).toHaveBeenCalledWith('string error');
            expect(console.error).toHaveBeenCalledWith(123);
            expect(console.error).toHaveBeenCalledWith(null);
            expect(getErrorMetadata).not.toHaveBeenCalled();
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
            expect(getErrorMetadata).not.toHaveBeenCalled();
            expect(formatStack).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith(baseError1);
            expect(console.error).toHaveBeenCalledWith(baseError2);
        });

        test('should handle different error names in AggregateError', () => {
            const typeError = new TypeError('Type issue');
            const rangeError = new RangeError('Range issue');
            const aggregateError = new AggregateError([ typeError, rangeError ], 'Multiple types');

            formatErrors(aggregateError);

            expect(getErrorMetadata).toHaveBeenCalledTimes(2);
            expect(formatStack).toHaveBeenCalledWith(mockMetadata, 'TypeError', 'Type issue');
            expect(formatStack).toHaveBeenCalledWith(mockMetadata, 'RangeError', 'Range issue');
        });
    });

    describe('non-Error value handling', () => {
        test('should log string values directly', () => {
            formatErrors('Simple string error');

            expect(getErrorMetadata).not.toHaveBeenCalled();
            expect(formatStack).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith('Simple string error');
        });

        test('should log number values directly', () => {
            formatErrors(404);

            expect(getErrorMetadata).not.toHaveBeenCalled();
            expect(formatStack).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith(404);
        });

        test('should log object values directly', () => {
            const obj = { code: 'ERR_001', message: 'Custom error object' };
            formatErrors(obj);

            expect(getErrorMetadata).not.toHaveBeenCalled();
            expect(formatStack).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith(obj);
        });

        test('should log null directly', () => {
            formatErrors(null);

            expect(getErrorMetadata).not.toHaveBeenCalled();
            expect(formatStack).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith(null);
        });

        test('should log undefined directly', () => {
            formatErrors(undefined);

            expect(getErrorMetadata).not.toHaveBeenCalled();
            expect(formatStack).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith(undefined);
        });

        test('should log boolean values directly', () => {
            formatErrors(false);

            expect(getErrorMetadata).not.toHaveBeenCalled();
            expect(formatStack).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith(false);
        });

        test('should log array values directly', () => {
            const arr = [ 'error1', 'error2' ];
            formatErrors(arr);

            expect(getErrorMetadata).not.toHaveBeenCalled();
            expect(formatStack).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith(arr);
        });
    });

    describe('edge cases', () => {
        test('should handle Error with no message', () => {
            const error = new Error();
            formatErrors(error);

            expect(getErrorMetadata).toHaveBeenCalledWith(error, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
            expect(formatStack).toHaveBeenCalledWith(mockMetadata, 'Error', '');
            expect(console.error).toHaveBeenCalled();
        });

        test('should handle Error with no stack', () => {
            const error = new Error('No stack');
            delete error.stack;
            formatErrors(error);

            expect(getErrorMetadata).toHaveBeenCalledWith(error, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
            expect(formatStack).toHaveBeenCalledWith(mockMetadata, 'Error', 'No stack');
            expect(console.error).toHaveBeenCalled();
        });

        test('should handle nested AggregateErrors', () => {
            xJet.mock(getErrorMetadata).mockRestore();
            xJet.mock(formatStack).mockRestore();

            const innerError = new Error('Inner');
            const innerAggregate = new AggregateError([ innerError ], 'Inner aggregate');
            const outerAggregate = new AggregateError([ innerAggregate ], 'Outer aggregate');

            formatErrors(outerAggregate);

            expect(console.error).toHaveBeenCalledWith('AggregateError:', 'Outer aggregate');
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Inner aggregate'));
        });

        test('should handle Error with very long message', () => {
            const longMessage = 'A'.repeat(10000);
            const error = new Error(longMessage);
            formatErrors(error);

            expect(getErrorMetadata).toHaveBeenCalledWith(error, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
            expect(formatStack).toHaveBeenCalledWith(mockMetadata, 'Error', longMessage);
        });

        test('should handle Error with multiline message', () => {
            const multilineMessage = 'Line 1\nLine 2\nLine 3';
            const error = new Error(multilineMessage);
            formatErrors(error);

            expect(getErrorMetadata).toHaveBeenCalledWith(error, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
            expect(formatStack).toHaveBeenCalledWith(mockMetadata, 'Error', multilineMessage);
        });

        test('should handle different metadata for different errors', () => {
            const metadata1: StackInterface = {
                code: 'code 1',
                line: 1,
                column: 1,
                stacks: [],
                formatCode: 'format 1'
            };

            const metadata2: StackInterface = {
                code: 'code 2',
                line: 2,
                column: 2,
                stacks: [],
                formatCode: 'format 2'
            };

            xJet.mock(getErrorMetadata)
                .mockReturnValueOnce(metadata1)
                .mockReturnValueOnce(metadata2);

            xJet.mock(formatStack)
                .mockReturnValueOnce('Formatted 1')
                .mockReturnValueOnce('Formatted 2');

            const error1 = new Error('Error 1');
            const error2 = new Error('Error 2');
            const aggregateError = new AggregateError([ error1, error2 ]);

            formatErrors(aggregateError);

            expect(formatStack).toHaveBeenNthCalledWith(1, metadata1, 'Error', 'Error 1');
            expect(formatStack).toHaveBeenNthCalledWith(2, metadata2, 'Error', 'Error 2');
            expect(console.error).toHaveBeenCalledWith('Formatted 1');
            expect(console.error).toHaveBeenCalledWith('Formatted 2');
        });
    });

    describe('formatStack options', () => {
        test('should always call getErrorMetadata with both framework and native frames', () => {
            const error = new Error('Test');
            formatErrors(error);

            expect(getErrorMetadata).toHaveBeenCalledWith(error, {
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

            expect(getErrorMetadata).toHaveBeenCalledTimes(3);
            expect(getErrorMetadata).toHaveBeenNthCalledWith(1, error1, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
            expect(getErrorMetadata).toHaveBeenNthCalledWith(2, error2, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
            expect(getErrorMetadata).toHaveBeenNthCalledWith(3, error3, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
            expect(formatStack).toHaveBeenCalledTimes(3);
        });
    });

    describe('integration with getErrorMetadata and formatStack', () => {
        test('should pass metadata from getErrorMetadata to formatStack', () => {
            const customMetadata: StackInterface = {
                code: 'custom code',
                line: 42,
                column: 7,
                source: 'custom.ts',
                stacks: [ 'at custom custom.ts [42:7]' ],
                formatCode: '42 | custom code\n        ^'
            };

            xJet.mock(getErrorMetadata).mockReturnValue(customMetadata);
            xJet.mock(formatStack).mockReturnValue('Custom formatted output');

            const error = new Error('Custom error');
            error.name = 'CustomError';

            formatErrors(error);

            expect(getErrorMetadata).toHaveBeenCalledWith(error, {
                withFrameworkFrames: true,
                withNativeFrames: true
            });
            expect(formatStack).toHaveBeenCalledWith(customMetadata, 'CustomError', 'Custom error');
            expect(console.error).toHaveBeenCalledWith('Custom formatted output');
        });

        test('should handle getErrorMetadata returning minimal metadata', () => {
            const minimalMetadata: StackInterface = {
                code: '',
                line: 0,
                column: 0,
                stacks: [],
                formatCode: ''
            };

            xJet.mock(getErrorMetadata).mockReturnValue(minimalMetadata);
            xJet.mock(formatStack).mockReturnValue('\nError: Minimal');

            const error = new Error('Minimal');
            formatErrors(error);

            expect(formatStack).toHaveBeenCalledWith(minimalMetadata, 'Error', 'Minimal');
            expect(console.error).toHaveBeenCalledWith('\nError: Minimal');
        });
    });
});
