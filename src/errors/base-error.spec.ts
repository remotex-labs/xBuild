/**
 * Import will remove at compile time
 */

import type { StackTraceInterface, StackInterface } from '@providers/interfaces/stack-provider.interface';

/**
 * Imports
 */

import { readFileSync } from 'fs';
import { inspect } from 'node:util';
import { xBuildBaseError } from './base.error';
import { formatStack, getErrorMetadata } from '@providers/stack.provider';

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
    const dummySourceMap = JSON.stringify({
        version: 3,
        sources: [ 'framework.ts' ],
        names: [],
        mappings: 'AAAA'
    });

    beforeEach(() => {
        xJet.restoreAllMocks();
        xJet.mock(readFileSync).mockImplementation(() => dummySourceMap);
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

        test('should use default name "TestError" when not provided', () => {
            const error = new TestError('Test message');

            expect(error.name).toBe('TestError');
        });

        test('should initialize formattedStack and errorMetadata as undefined', () => {
            const error = new TestError('Test message');

            expect(error['formattedStack']).toBeUndefined();
            expect(error['errorMetadata']).toBeUndefined();
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

    describe('metadata getter', () => {
        test('should return undefined when errorMetadata is not set', () => {
            const error = new TestError('Test message');

            expect(error.metadata).toBeUndefined();
        });

        test('should return errorMetadata after reformatStack is called', () => {
            const error: any = new TestError('Test message');
            const mockMetadata: StackInterface = {
                code: 'test code',
                line: 10,
                column: 5,
                source: 'test.ts',
                stacks: [ 'at test' ],
                formatCode: 'formatted'
            };

            xJet.mock(getErrorMetadata).mockReturnValue(mockMetadata);
            xJet.mock(formatStack).mockReturnValue('formatted stack');

            error.reformatStack(error);

            expect(error.metadata).toBe(mockMetadata);
            expect(error.metadata?.code).toBe('test code');
            expect(error.metadata?.line).toBe(10);
            expect(error.metadata?.column).toBe(5);
        });

        test('should provide read-only access to metadata', () => {
            const error: any = new TestError('Test message');
            const mockMetadata: StackInterface = {
                code: 'original',
                line: 1,
                column: 1,
                stacks: [],
                formatCode: ''
            };

            xJet.mock(getErrorMetadata).mockReturnValue(mockMetadata);
            xJet.mock(formatStack).mockReturnValue('stack');

            error.reformatStack(error);

            const metadata1 = error.metadata;
            const metadata2 = error.metadata;

            expect(metadata1).toBe(metadata2);
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
        test('should call getErrorMetadata and formatStack with correct arguments', () => {
            const error: any = new TestError('Test message');
            const mockMetadata: StackInterface = {
                code: 'test',
                line: 1,
                column: 1,
                stacks: [ 'stack frame' ],
                formatCode: 'formatted'
            };

            const getErrorMetadataMock = xJet.mock(getErrorMetadata).mockReturnValue(mockMetadata);
            const formatStackMock = xJet.mock(formatStack).mockReturnValue('Formatted stack');

            error.reformatStack(error, { withNativeFrames: true });

            expect(getErrorMetadataMock).toHaveBeenCalledWith(error, { withNativeFrames: true });
            expect(formatStackMock).toHaveBeenCalledWith(mockMetadata, 'TestError', 'Test message');
            expect(error['formattedStack']).toBe('Formatted stack');
            expect(error['errorMetadata']).toBe(mockMetadata);
        });

        test('should store metadata from getErrorMetadata', () => {
            const error: any = new TestError('Test message');
            const mockMetadata: StackInterface = {
                code: 'const x = null;',
                line: 42,
                column: 8,
                source: 'app.ts',
                stacks: [ 'at main app.ts [42:8]' ],
                formatCode: '42 | const x = null;\n        ^'
            };

            xJet.mock(getErrorMetadata).mockReturnValue(mockMetadata);
            xJet.mock(formatStack).mockReturnValue('formatted');

            error.reformatStack(error);

            expect(error['errorMetadata']).toEqual(mockMetadata);
            expect(error.metadata?.code).toBe('const x = null;');
            expect(error.metadata?.line).toBe(42);
            expect(error.metadata?.column).toBe(8);
            expect(error.metadata?.source).toBe('app.ts');
        });

        test('should accept custom options for stack parsing', () => {
            const error: any = new TestError('Test message');
            const options: StackTraceInterface = {
                withNativeFrames: true,
                withFrameworkFrames: false,
                linesBefore: 2,
                linesAfter: 2
            };

            const mockMetadata: StackInterface = {
                code: '',
                line: 1,
                column: 1,
                stacks: [],
                formatCode: ''
            };

            const getErrorMetadataMock = xJet.mock(getErrorMetadata).mockReturnValue(mockMetadata);
            xJet.mock(formatStack).mockReturnValue('stack');

            const testError = new Error('Test');
            error.reformatStack(testError, options);

            expect(getErrorMetadataMock).toHaveBeenCalledWith(testError, options);
            expect(error['formattedStack']).toBeDefined();
            expect(error['errorMetadata']).toBeDefined();
        });

        test('should allow reformatting multiple times', () => {
            const error: any = new TestError('Test message');
            const testError1 = new Error('First error');
            const testError2 = new Error('Second error');

            const mockMetadata1: StackInterface = {
                code: 'first',
                line: 1,
                column: 1,
                stacks: [ 'first stack' ],
                formatCode: 'first format'
            };

            const mockMetadata2: StackInterface = {
                code: 'second',
                line: 2,
                column: 2,
                stacks: [ 'second stack' ],
                formatCode: 'second format'
            };

            xJet.mock(getErrorMetadata)
                .mockReturnValueOnce(mockMetadata1)
                .mockReturnValueOnce(mockMetadata2);

            xJet.mock(formatStack)
                .mockReturnValueOnce('First formatted')
                .mockReturnValueOnce('Second formatted');

            error.reformatStack(testError1);
            const firstFormat = error['formattedStack'];
            const firstMetadata = error['errorMetadata'];

            error.reformatStack(testError2);
            const secondFormat = error['formattedStack'];
            const secondMetadata = error['errorMetadata'];

            expect(firstFormat).toBe('First formatted');
            expect(secondFormat).toBe('Second formatted');
            expect(firstFormat).not.toBe(secondFormat);
            expect(firstMetadata).not.toBe(secondMetadata);
        });

        test('should work without providing options parameter', () => {
            const error: any = new TestError('Test message');
            const testError = new Error('Test');

            const mockMetadata: StackInterface = {
                code: '',
                line: 1,
                column: 1,
                stacks: [],
                formatCode: ''
            };

            xJet.mock(getErrorMetadata).mockReturnValue(mockMetadata);
            xJet.mock(formatStack).mockReturnValue('formatted');

            expect(() => {
                error.reformatStack(testError);
            }).not.toThrow();

            expect(error['formattedStack']).toBeDefined();
            expect(error['errorMetadata']).toBeDefined();
        });

        test('should handle errors with empty message', () => {
            const error: any = new TestError('Main error');
            const emptyError = new Error('');

            const mockMetadata: StackInterface = {
                code: '',
                line: 1,
                column: 1,
                stacks: [],
                formatCode: ''
            };

            xJet.mock(getErrorMetadata).mockReturnValue(mockMetadata);
            const formatStackMock = xJet.mock(formatStack).mockReturnValue('formatted empty');

            error.reformatStack(emptyError);

            expect(formatStackMock).toHaveBeenCalledWith(mockMetadata, 'Error', '');
            expect(error['formattedStack']).toBeDefined();
        });

        test('should preserve error instance name and message passed to formatStack', () => {
            const error: any = new TestError('Test message');
            const sourceError = new Error('Source error message');
            sourceError.name = 'SourceError';

            const mockMetadata: StackInterface = {
                code: '',
                line: 1,
                column: 1,
                stacks: [],
                formatCode: ''
            };

            xJet.mock(getErrorMetadata).mockReturnValue(mockMetadata);
            const formatStackMock = xJet.mock(formatStack).mockReturnValue('\nSourceError: Source error message');

            error.reformatStack(sourceError);

            expect(formatStackMock).toHaveBeenCalledWith(mockMetadata, 'SourceError', 'Source error message');
            expect(error['formattedStack']).toContain('Source error message');
        });

        test('should pass withNativeFrames option to getErrorMetadata', () => {
            const error: any = new TestError('Test message');
            const testError = new Error('Test');

            const mockMetadata: StackInterface = {
                code: '',
                line: 1,
                column: 1,
                stacks: [],
                formatCode: ''
            };

            const getErrorMetadataMock = xJet.mock(getErrorMetadata).mockReturnValue(mockMetadata);
            xJet.mock(formatStack).mockReturnValue('formatted');

            error.reformatStack(testError, { withNativeFrames: true });

            expect(getErrorMetadataMock).toHaveBeenCalledWith(testError, { withNativeFrames: true });
        });

        test('should pass withFrameworkFrames option to getErrorMetadata', () => {
            const error: any = new TestError('Test message');
            const testError = new Error('Test');

            const mockMetadata: StackInterface = {
                code: '',
                line: 1,
                column: 1,
                stacks: [],
                formatCode: ''
            };

            const getErrorMetadataMock = xJet.mock(getErrorMetadata).mockReturnValue(mockMetadata);
            xJet.mock(formatStack).mockReturnValue('formatted');

            error.reformatStack(testError, { withFrameworkFrames: false });

            expect(getErrorMetadataMock).toHaveBeenCalledWith(testError, { withFrameworkFrames: false });
        });
    });

    describe('Integration tests', () => {
        test('should work as a complete error handling flow', () => {
            const error: any = new TestError('Something went wrong', 'ValidationError');

            const mockMetadata: StackInterface = {
                code: 'validate(data)',
                line: 15,
                column: 3,
                source: 'validator.ts',
                stacks: [ 'at validate validator.ts [15:3]' ],
                formatCode: '15 | validate(data)\n        ^'
            };

            xJet.mock(getErrorMetadata).mockReturnValue(mockMetadata);
            xJet.mock(formatStack).mockReturnValue(
                '\nValidationError: Something went wrong\n\n15 | validate(data)\n' +
                '        ^\n\nEnhanced Stack Trace:\n    at validate validator.ts [15:3]\n'
            );

            error.reformatStack(error);
            const inspectSymbol = Symbol.for('nodejs.util.inspect.custom');
            const inspectResult = error[inspectSymbol]();

            expect(error.name).toBe('ValidationError');
            expect(error.message).toBe('Something went wrong');
            expect(error.metadata).toBe(mockMetadata);
            expect(inspectResult).toBe(error['formattedStack']);
            expect(inspectResult).toContain('ValidationError: Something went wrong');
        });

        test('should support error chaining', () => {
            const originalError = new Error('Root cause');
            const wrappedError: any = new TestError(`Wrapped: ${ originalError.message }`, 'WrappedError');

            const mockMetadata: StackInterface = {
                code: '',
                line: 1,
                column: 1,
                stacks: [],
                formatCode: ''
            };

            xJet.mock(getErrorMetadata).mockReturnValue(mockMetadata);
            xJet.mock(formatStack).mockReturnValue('formatted');

            wrappedError.reformatStack(wrappedError);

            expect(wrappedError.message).toContain('Wrapped: Root cause');
            expect(wrappedError['formattedStack']).toBeDefined();
            expect(wrappedError['errorMetadata']).toBeDefined();
        });

        test('should work in try-catch scenarios', () => {
            const mockMetadata: StackInterface = {
                code: '',
                line: 1,
                column: 1,
                stacks: [],
                formatCode: ''
            };

            xJet.mock(getErrorMetadata).mockReturnValue(mockMetadata);
            xJet.mock(formatStack).mockReturnValue('formatted');

            const error: any = new TestError('Caught error', 'CaughtError');
            error.reformatStack(error);

            expect(error.name).toBe('CaughtError');
            expect(error['formattedStack']).toBeDefined();
            expect(error.metadata).toBeDefined();
        });

        test('should maintain error context through reformatting', () => {
            const error: any = new TestError('Context error');
            const originalMessage = error.message;
            const originalName = error.name;

            const mockMetadata: StackInterface = {
                code: '',
                line: 1,
                column: 1,
                stacks: [],
                formatCode: ''
            };

            xJet.mock(getErrorMetadata).mockReturnValue(mockMetadata);
            xJet.mock(formatStack).mockReturnValue('formatted');

            error.reformatStack(error);

            expect(error.message).toBe(originalMessage);
            expect(error.name).toBe(originalName);
        });

        test('should produce consistent results on multiple inspect calls', () => {
            const error: any = new TestError('Consistent error');

            const mockMetadata: StackInterface = {
                code: '',
                line: 1,
                column: 1,
                stacks: [],
                formatCode: ''
            };

            xJet.mock(getErrorMetadata).mockReturnValue(mockMetadata);
            xJet.mock(formatStack).mockReturnValue('consistent formatted output');

            error.reformatStack(error);

            const inspectSymbol = Symbol.for('nodejs.util.inspect.custom');
            const result1 = error[inspectSymbol]();
            const result2 = error[inspectSymbol]();

            expect(result1).toBe(result2);
            expect(result1).toBe('consistent formatted output');
        });

        test('should be serializable with JSON when formatted', () => {
            const error: any = new TestError('Serializable error');

            const mockMetadata: StackInterface = {
                code: 'serialize()',
                line: 20,
                column: 1,
                source: 'serializer.ts',
                stacks: [],
                formatCode: ''
            };

            xJet.mock(getErrorMetadata).mockReturnValue(mockMetadata);
            xJet.mock(formatStack).mockReturnValue('formatted for json');

            error.reformatStack(error);

            const errorObj = {
                name: error.name,
                message: error.message,
                stack: error['formattedStack'],
                metadata: error.metadata
            };

            const jsonStr = JSON.stringify(errorObj);
            const parsed = JSON.parse(jsonStr);

            expect(parsed.name).toBe('TestError');
            expect(parsed.message).toBe('Serializable error');
            expect(parsed.stack).toBe('formatted for json');
            expect(parsed.metadata.code).toBe('serialize()');
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

        test('should handle metadata with empty stacks array', () => {
            const error: any = new TestError('Test');

            const mockMetadata: StackInterface = {
                code: 'test',
                line: 1,
                column: 1,
                stacks: [],
                formatCode: ''
            };

            xJet.mock(getErrorMetadata).mockReturnValue(mockMetadata);
            xJet.mock(formatStack).mockReturnValue('\nTestError: Test');

            error.reformatStack(error);

            expect(error.metadata?.stacks).toEqual([]);
        });
    });
});
