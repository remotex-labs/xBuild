/**
 * Import will remove at compile time
 */

import type { StackTraceInterface } from '@providers/interfaces/stack-provider.interface';

/**
 * Imports
 */

import { readFileSync } from 'fs';
import { VMRuntimeError } from './vm-runtime.error';
import { xBuildBaseError } from '@errors/base.error';

/**
 * Tests
 */

describe('VMRuntimeError', () => {
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
        test('should create a VMRuntimeError from a native Error', () => {
            const nativeError = new Error('Test error message');
            const vmError = new VMRuntimeError(nativeError);

            expect(vmError).toBeInstanceOf(VMRuntimeError);
            expect(vmError).toBeInstanceOf(xBuildBaseError);
            expect(vmError.message).toBe('Test error message');
            expect(vmError.name).toBe('VMRuntimeError');
        });

        test('should preserve the original error stack', () => {
            const nativeError = new Error('Test error');
            const originalStack = nativeError.stack;
            const vmError = new VMRuntimeError(nativeError);

            expect(vmError.stack).toBe(originalStack);
        });

        test('should return the original error if it is already a xBuildBaseError', () => {
            const firstError = new Error('Base error');
            const baseError = new VMRuntimeError(firstError);
            const vmError = new VMRuntimeError(baseError as any);

            expect(vmError).toBe(baseError);
        });

        test('should pass stack trace options to reformatStack', () => {
            const nativeError = new Error('Test error');
            const options: StackTraceInterface = {
                withFrameworkFrames: true
            };

            const vmError = new VMRuntimeError(nativeError, options);

            expect(vmError).toBeInstanceOf(VMRuntimeError);
        });
    });

    describe('AggregateError handling', () => {
        test('should handle AggregateError with multiple nested errors', () => {
            const error1 = new Error('First error');
            const error2 = new Error('Second error');
            const error3 = new Error('Third error');
            const aggregateError = new AggregateError([ error1, error2, error3 ], 'Multiple errors occurred');

            const vmError = new VMRuntimeError(aggregateError);

            expect(vmError.errors).toHaveLength(3);
            expect(vmError.errors?.[0]).toBeInstanceOf(VMRuntimeError);
            expect(vmError.errors?.[0].message).toBe('First error');
            expect(vmError.errors?.[1].message).toBe('Second error');
            expect(vmError.errors?.[2].message).toBe('Third error');
        });

        test('should handle AggregateError with empty errors array', () => {
            const aggregateError = new AggregateError([], 'No errors');
            const vmError = new VMRuntimeError(aggregateError);

            expect(vmError.errors).toHaveLength(0);
            expect(vmError.message).toBe('No errors');
        });

        test('should handle nested AggregateErrors', () => {
            const innerError = new Error('Inner error');
            const innerAggregate = new AggregateError([ innerError ], 'Inner aggregate');
            const outerAggregate = new AggregateError([ innerAggregate ], 'Outer aggregate');

            const vmError = new VMRuntimeError(outerAggregate);

            expect(vmError.errors).toHaveLength(1);
            expect(vmError.errors?.[0]).toBeInstanceOf(VMRuntimeError);
            expect(vmError.errors?.[0].errors).toHaveLength(1);
            expect(vmError.errors?.[0].errors?.[0].message).toBe('Inner error');
        });

        test('should pass options to nested VMRuntimeError instances', () => {
            const error1 = new Error('Error 1');
            const error2 = new Error('Error 2');
            const aggregateError = new AggregateError([ error1, error2 ]);
            const options: StackTraceInterface = {
                withFrameworkFrames: true
            };

            const vmError = new VMRuntimeError(aggregateError, options);

            expect(vmError.errors).toHaveLength(2);
            expect(vmError.errors?.[0]).toBeInstanceOf(VMRuntimeError);
        });
    });

    describe('Symbol.for("nodejs.util.inspect.custom")', () => {
        const inspectSymbol = Symbol.for('nodejs.util.inspect.custom');

        test('should return formattedStack for single errors', () => {
            const nativeError = new Error('Test error');
            const vmError = new VMRuntimeError(nativeError);

            const inspectResult = (vmError as any)[inspectSymbol]();

            expect(typeof inspectResult).toBe('string');
            // Should return formattedStack or stack
            expect(inspectResult).toBeTruthy();
        });

        test('should return formatted list for AggregateError with nested errors', () => {
            const error1 = new Error('Error 1');
            const error2 = new Error('Error 2');
            const aggregateError = new AggregateError([ error1, error2 ], 'Aggregate');

            const vmError = new VMRuntimeError(aggregateError);
            const inspectResult = (vmError as any)[inspectSymbol]();

            expect(inspectResult).toContain('VMRuntimeError Contains 2 nested errors:');
            expect(inspectResult).toContain('Error 1');
            expect(inspectResult).toContain('Error 2');
        });

        test('should handle empty errors array in inspect', () => {
            const nativeError = new Error('Single error');
            const vmError = new VMRuntimeError(nativeError);
            vmError.errors = []; // Manually set empty array

            const inspectResult = (vmError as any)[inspectSymbol]();

            // Should fall back to formattedStack or stack
            expect(inspectResult).not.toContain('nested errors');
        });

        test('should concatenate multiple error stacks in inspect output', () => {
            const error1 = new Error('First');
            const error2 = new Error('Second');
            const error3 = new Error('Third');
            const aggregateError = new AggregateError([ error1, error2, error3 ]);

            const vmError = new VMRuntimeError(aggregateError);
            const inspectResult = (vmError as any)[inspectSymbol]();

            expect(inspectResult).toContain('3 nested errors');
            expect(inspectResult).toContain('First');
            expect(inspectResult).toContain('Second');
            expect(inspectResult).toContain('Third');
        });
    });

    describe('edge cases', () => {
        test('should handle Error with no message', () => {
            const nativeError = new Error();
            const vmError = new VMRuntimeError(nativeError);

            expect(vmError.message).toBe('');
            expect(vmError).toBeInstanceOf(VMRuntimeError);
        });

        test('should handle Error with no stack', () => {
            const nativeError = new Error('No stack');
            delete nativeError.stack;
            const vmError = new VMRuntimeError(nativeError);

            expect(vmError.stack).toBeUndefined();
            expect(vmError.message).toBe('No stack');
        });

        test('should handle TypeError as native error', () => {
            const typeError = new TypeError('Type error occurred');
            const vmError = new VMRuntimeError(typeError);

            expect(vmError).toBeInstanceOf(VMRuntimeError);
            expect(vmError.message).toBe('Type error occurred');
        });

        test('should handle RangeError as native error', () => {
            const rangeError = new RangeError('Range error occurred');
            const vmError = new VMRuntimeError(rangeError);

            expect(vmError).toBeInstanceOf(VMRuntimeError);
            expect(vmError.message).toBe('Range error occurred');
        });
    });

    describe('property preservation', () => {
        test('should preserve the name property', () => {
            const nativeError = new Error('Test');
            const vmError = new VMRuntimeError(nativeError);

            expect(vmError.name).toBe('VMRuntimeError');
        });

        test('should maintain errors array after creation', () => {
            const aggregateError = new AggregateError([ new Error('E1'), new Error('E2') ]);
            const vmError = new VMRuntimeError(aggregateError);

            expect(Array.isArray(vmError.errors)).toBe(true);
            expect(vmError.errors?.length).toBe(2);
        });

        test('should initialize errors as empty array for non-AggregateError', () => {
            const nativeError = new Error('Test');
            const vmError = new VMRuntimeError(nativeError);

            expect(Array.isArray(vmError.errors)).toBe(true);
            expect(vmError.errors?.length).toBe(0);
        });
    });
});
