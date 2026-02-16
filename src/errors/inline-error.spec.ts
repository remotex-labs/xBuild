/**
 * Imports
 */

import { readFileSync } from 'fs';
import { InlineError } from '@errors/inline.error';
import { inject } from '@symlinks/symlinks.module';
import { FilesModel } from '@typescript/models/files.model';

/**
 * Tests
 */

describe('InlineError', () => {
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
        test('should create error with message from base error', () => {
            const baseError = new Error('Unexpected token');

            const error = new InlineError(baseError);

            expect(error.message).toBe('Unexpected token');
        });

        test('should set error name to "InlineError"', () => {
            const baseError = new Error('Test error');

            const error = new InlineError(baseError);

            expect(error.name).toBe('InlineError');
        });

        test('should generate formatted stack', () => {
            const baseError = new Error('Syntax error');
            baseError.stack = 'Error: Syntax error\n    at test.ts:10:5';

            const error = new InlineError(baseError);

            expect(error.stack).toBeDefined();
            expect(error.stack).toContain('InlineError');
        });

        test('should include file path in stack when available', () => {
            const baseError = new Error('Error message');
            baseError.stack = 'Error: Error message\n    at Object.<anonymous> (src/app.ts:1:0)';

            const error = new InlineError(baseError);

            expect(error.stack).toBeDefined();
        });

        test('should include error text in stack', () => {
            const baseError = new Error('Custom error text');

            const error = new InlineError(baseError);

            expect(error.stack).toContain('Custom error text');
        });

        test('should handle lineOffset parameter', () => {
            const baseError = new Error('Error with offset');
            baseError.stack = 'Error: Error with offset\n    at test.ts:10:5';

            const error: any = new InlineError(baseError, 5);

            expect(error.errorMetadata).toBeDefined();
            expect(error.stack).toBeDefined();
        });

        test('should handle negative lineOffset', () => {
            const baseError = new Error('Error with negative offset');
            baseError.stack = 'Error: Error with negative offset\n    at test.ts:10:5';

            const error: any = new InlineError(baseError, -3);

            expect(error.errorMetadata).toBeDefined();
            expect(error.stack).toBeDefined();
        });

        test('should use default lineOffset of 0 when not provided', () => {
            const baseError = new Error('Error without offset');

            const error: any = new InlineError(baseError);

            expect(error.errorMetadata).toBeDefined();
            expect(error.stack).toBeDefined();
        });
    });

    describe('integration', () => {
        test('should create complete error with all information', () => {
            const files = inject(FilesModel);
            xJet.spyOn(files, 'getSnapshot').mockReturnValue({
                contentSnapshot: {
                    text: 'const x = invalid;\nconst y = 2;'
                } as any
            });

            const baseError = new Error('Expected identifier');
            baseError.stack = 'Error: Expected identifier\n    at Object.<anonymous> (src/index.ts:1:11)';

            const error: any = new InlineError(baseError);

            expect(error.name).toBe('InlineError');
            expect(error.message).toBe('Expected identifier');
            expect(error.stack).toBeDefined();
            expect(error.errorMetadata).toBeDefined();
        });

        test('should handle error without location information gracefully', () => {
            const baseError = new Error('Build error');

            const error = new InlineError(baseError);

            expect(error.message).toBe('Build error');
            expect(error.stack).toBeDefined();
        });

        test('should handle error with minimal stack trace', () => {
            const baseError = new Error('Minimal error');
            baseError.stack = 'Error: Minimal error';

            const error = new InlineError(baseError);

            expect(error.message).toBe('Minimal error');
            expect(error.stack).toContain('Minimal error');
        });

        test('should be throwable as Error', () => {
            const baseError = new Error('Test error');

            const error = new InlineError(baseError);

            expect(error).toBeInstanceOf(Error);
            expect(() => {
                throw error;
            }).toThrow();
        });

        test('should preserve error metadata', () => {
            const baseError = new Error('Error with metadata');
            baseError.stack = 'Error: Error with metadata\n    at test.ts:42:15';

            const error: any = new InlineError(baseError, 2);

            expect(error.errorMetadata).toBeDefined();
            expect(error.stack).toBeDefined();
        });

        test('should handle TypeError correctly', () => {
            const baseError = new TypeError('Type mismatch');
            baseError.stack = 'TypeError: Type mismatch\n    at src/utils.ts:5:10';

            const error = new InlineError(baseError);

            expect(error.message).toBe('Type mismatch');
            expect(error.name).toBe('InlineError');
        });

        test('should handle ReferenceError correctly', () => {
            const baseError = new ReferenceError('Variable not defined');

            const error: any = new InlineError(baseError, -1);

            expect(error.message).toBe('Variable not defined');
            expect(error.errorMetadata).toBeDefined();
        });
    });
});
