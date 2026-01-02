
/**
 * Import will remove at compile time
 */

import type { StackTraceInterface } from '@providers/interfaces/stack-provider.interface';

/**
 * Imports
 */

import { inspect } from 'node:util';
import { xBuildBaseError } from './base.error';
import { formatStack } from '@providers/stack.provider';

/**
 * Mock Error subclass for testing abstract class
 */

class TestError extends xBuildBaseError {
    constructor(message: string, name: string = 'TestError') {
        super(message, name);
    }
}

/**
 * Tests
 */

describe('xBuildBaseError', () => {
    beforeEach(() => {
        xJet.restoreAllMocks();
    });

    describe('constructor', () => {
        test('should create instance with message', () => {
            const error = new TestError('Test error message');

            expect(error).toBeInstanceOf(TestError);
            expect(error).toBeInstanceOf(xBuildBaseError);
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toBe('Test error message');
        });

        test('should use custom error name', () => {
            const error = new TestError('Test message', 'CustomError');

            expect(error.name).toBe('CustomError');
        });

        test('should use default name "xBuildBaseError" when not provided', () => {
            const error = new TestError('Test message');

            expect(error.name).toBe('TestError');
        });

        test('should initialize formattedStack as undefined', () => {
            const error = new TestError('Test message');

            expect(error['formattedStack']).toBeUndefined();
        });

        test('should set up correct prototype chain', () => {
            const error = new TestError('Test message');

            expect(Object.getPrototypeOf(error)).toBe(TestError.prototype);
        });

        test('should support instanceof check', () => {
            const error = new TestError('Test message');

            expect(error).toBeInstanceOf(TestError);
            expect(error).toBeInstanceOf(xBuildBaseError);
            expect(error).toBeInstanceOf(Error);
        });

        test('should capture stack trace if available', () => {
            const captureStackTraceSpy = xJet.spyOn(Error, 'captureStackTrace');
            new TestError('Test message');
            expect(captureStackTraceSpy).toHaveBeenCalled();
        });

        test('should have stack property set', () => {
            const error = new TestError('Test message');

            expect(error.stack).toBeDefined();
            expect(typeof error.stack).toBe('string');
        });

        test('should include error name in stack trace', () => {
            const error = new TestError('Test message', 'CustomTestError');

            expect(error.stack).toContain('CustomTestError');
        });

        test('should work with multiple error instances independently', () => {
            const error1 = new TestError('Error 1', 'Error1');
            const error2 = new TestError('Error 2', 'Error2');

            expect(error1.message).toBe('Error 1');
            expect(error2.message).toBe('Error 2');
            expect(error1.name).toBe('Error1');
            expect(error2.name).toBe('Error2');
        });
    });

    describe('Symbol.for("nodejs.util.inspect.custom")', () => {
        const inspectSymbol = Symbol.for('nodejs.util.inspect.custom');

        test('should return formattedStack when available', () => {
            const error: any = new TestError('Test message');
            const customFormattedStack = 'Formatted error output';

            error['formattedStack'] = customFormattedStack;

            const result = error[inspectSymbol]();

            expect(result).toBe(customFormattedStack);
        });

        test('should return raw stack trace when formattedStack is undefined', () => {
            const error: any = new TestError('Test message');
            const result = error[inspectSymbol]();

            expect(result).toBe(error.stack);
        });

        test('should return raw stack trace when formattedStack is empty string', () => {
            const error: any = new TestError('Test message');
            error['formattedStack'] = '';
            const result = error[inspectSymbol]();

            expect(result).toBe(error.stack);
        });

        test('should work with console.log inspection', () => {
            const error = new TestError('Test message');
            const customOutput = 'Custom formatted output';
            error['formattedStack'] = customOutput;

            const consoleSpy = xJet.spyOn(console, 'log');
            console.log(error);

            expect(consoleSpy).toHaveBeenCalledWith({ formattedStack: customOutput, name: error.name });
        });

        test('should support node util.inspect', () => {
            const error = new TestError('Test message');
            const customOutput = 'Node inspected output';
            error['formattedStack'] = customOutput;

            const utilInspect = inspect;
            const result = utilInspect(error);

            expect(result).toContain(customOutput);
        });

        test('should return formattedStack even if it contains special characters', () => {
            const error: any = new TestError('Test message');
            const specialOutput = 'Error with \n newlines \t tabs and "quotes"';
            error['formattedStack'] = specialOutput;

            const result = error[inspectSymbol]();

            expect(result).toBe(specialOutput);
        });
    });

    describe('reformatStack', () => {
        test('should call formatStack with error and options', () => {
            const error: any = new TestError('Test message');

            xJet.mock(formatStack).mockReturnValueOnce('Formatted stack');
            error.reformatStack(error, { withNativeFrames: true });

            expect(error['formattedStack']).toBeDefined();
        });

        test('should accept custom options for stack parsing', () => {
            const error: any = new TestError('Test message');
            const options: StackTraceInterface = {
                withNativeFrames: true,
                withFrameworkFrames: false,
                linesBefore: 2,
                linesAfter: 2
            };

            const testError = new Error('Test');
            error.reformatStack(testError, options);

            expect(error['formattedStack']).toBeDefined();
        });

        test('should allow reformatting multiple times', () => {
            const error: any = new TestError('Test message');
            const testError1 = new Error('First error');
            const testError2 = new Error('Second error');

            error.reformatStack(testError1);
            const firstFormat = error['formattedStack'];

            error.reformatStack(testError2);
            const secondFormat = error['formattedStack'];

            expect(firstFormat).toBeDefined();
            expect(secondFormat).toBeDefined();
            expect(firstFormat).not.toBe(secondFormat);
        });

        test('should work without providing options parameter', () => {
            const error: any = new TestError('Test message');
            const testError = new Error('Test');

            expect(() => {
                error.reformatStack(testError);
            }).not.toThrow();

            expect(error['formattedStack']).toBeDefined();
        });

        test('should handle errors with empty message', () => {
            const error: any = new TestError('Main error');
            const emptyError = new Error('');

            error.reformatStack(emptyError);

            expect(error['formattedStack']).toBeDefined();
        });

        test('should preserve error instance passed to reformatStack', () => {
            const error: any = new TestError('Test message');
            const sourceError = new Error('Source error message');

            error.reformatStack(sourceError);

            expect(error['formattedStack']).toContain('Source error message');
        });

        test('should include native frames when option is true', () => {
            const error: any = new TestError('Test message');
            const testError = new Error('Test');

            error.reformatStack(testError, { withNativeFrames: true });

            expect(error['formattedStack']).toBeDefined();
        });

        test('should exclude native frames when option is false', () => {
            const error: any = new TestError('Test message');
            const testError = new Error('Test');

            error.reformatStack(testError, { withNativeFrames: false });

            expect(error['formattedStack']).toBeDefined();
        });
    });

    describe('Integration tests', () => {
        test('should work as a complete error handling flow', () => {
            const error: any = new TestError('Something went wrong', 'ValidationError');

            // Reformat the error
            error.reformatStack(error);

            // Check the custom inspect output
            const inspectSymbol = Symbol.for('nodejs.util.inspect.custom');
            const inspectResult = error[inspectSymbol]();

            expect(error.name).toBe('ValidationError');
            expect(error.message).toBe('Something went wrong');
            expect(inspectResult).toBe(error['formattedStack']);
        });

        test('should support error chaining', () => {
            const originalError = new Error('Root cause');
            const wrappedError: any = new TestError(`Wrapped: ${ originalError.message }`, 'WrappedError');

            wrappedError.reformatStack(wrappedError);

            expect(wrappedError.message).toContain('Wrapped: Root cause');
            expect(wrappedError['formattedStack']).toBeDefined();
        });

        test('should work in try-catch scenarios', () => {
            try {
                throw new TestError('Caught error', 'CaughtError');
            } catch (err) {
                const error: any = err as TestError;
                error.reformatStack(error);

                expect(error.name).toBe('CaughtError');
                expect(error['formattedStack']).toBeDefined();
            }
        });

        test('should maintain error context through reformatting', () => {
            const error: any = new TestError('Context error');
            const originalMessage = error.message;
            const originalName = error.name;

            error.reformatStack(error);

            expect(error.message).toBe(originalMessage);
            expect(error.name).toBe(originalName);
        });

        test('should produce consistent results on multiple inspect calls', () => {
            const error: any = new TestError('Consistent error');
            error.reformatStack(error);

            const inspectSymbol = Symbol.for('nodejs.util.inspect.custom');
            const result1 = error[inspectSymbol]();
            const result2 = error[inspectSymbol]();

            expect(result1).toBe(result2);
        });

        test('should be serializable with JSON when formatted', () => {
            const error: any = new TestError('Serializable error');
            error.reformatStack(error);

            const errorObj = {
                name: error.name,
                message: error.message,
                stack: error['formattedStack']
            };

            const jsonStr = JSON.stringify(errorObj);
            const parsed = JSON.parse(jsonStr);

            expect(parsed.name).toBe('TestError');
            expect(parsed.message).toBe('Serializable error');
            expect(parsed.stack).toBeDefined();
        });
    });

    describe('Edge cases', () => {
        test('should handle very long error messages', () => {
            const longMessage = 'A'.repeat(10000);
            const error: any = new TestError(longMessage);

            expect(error.message).toBe(longMessage);
            expect(error.message.length).toBe(10000);
        });

        test('should handle special characters in error name', () => {
            const error: any = new TestError('Test', 'Error<T>Generic[]');

            expect(error.name).toBe('Error<T>Generic[]');
        });

        test('should handle unicode characters', () => {
            const error: any = new TestError('Error: 错误 🚀 مشكلة');

            expect(error.message).toContain('错误');
            expect(error.message).toContain('🚀');
        });

        test('should handle multiline error messages', () => {
            const multilineMessage = 'Line 1\nLine 2\nLine 3';
            const error: any = new TestError(multilineMessage);

            expect(error.message).toBe(multilineMessage);
            expect(error.message.split('\n').length).toBe(3);
        });

        test('should handle null-like values gracefully', () => {
            const error: any = new TestError('Test');
            error['formattedStack'] = undefined;

            const inspectSymbol = Symbol.for('nodejs.util.inspect.custom');
            const result = error[inspectSymbol]();

            expect(result).toBe(error.stack);
        });
    });
});
