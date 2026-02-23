/**
 * Imports
 */

import { readFileSync } from 'fs';
import { inject } from '@symlinks/symlinks.module';
import { esBuildError } from '@errors/esbuild.error';
import { FilesModel } from '@typescript/models/files.model';

/**
 * Tests
 */

describe('esBuildError', () => {
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
        test('should set id from message', () => {
            const message: any = {
                id: 'plugin-transform',
                text: 'Unexpected token',
                location: null,
                notes: []
            };

            const error = new esBuildError(message);

            expect(error.id).toBe('plugin-transform');
        });

        test('should default id to empty string when missing', () => {
            const message: any = {
                text: 'Unexpected token',
                location: null,
                notes: []
            };

            const error = new esBuildError(message);

            expect(error.id).toBe('');
        });

        test('should create error with message text', () => {
            const message: any = {
                text: 'Unexpected token',
                location: null,
                notes: []
            };

            const error = new esBuildError(message);

            expect(error.message).toBe('Unexpected token');
        });

        test('should default message to empty string when text is missing', () => {
            const message: any = {
                location: null,
                notes: []
            };

            const error = new esBuildError(message);

            expect(error.message).toBe('');
        });

        test('should set error name to "esBuildError"', () => {
            const message: any = {
                text: 'Test error',
                location: null,
                notes: []
            };

            const error = new esBuildError(message);

            expect(error.name).toBe('esBuildError');
        });

        test('should generate formatted stack', () => {
            const message: any = {
                text: 'Syntax error',
                location: { file: 'test.ts', line: 10, column: 5 },
                notes: []
            };

            const error = new esBuildError(message);

            expect(error.stack).toBeDefined();
            expect(error.stack).toContain('esBuildError');
        });

        test('should include file path in stack', () => {
            const message: any = {
                text: 'Error message',
                location: { file: 'src/app.ts', line: 1, column: 0 },
                notes: []
            };

            const error = new esBuildError(message);
            expect(error.stack).toContain('src/app.ts');
        });

        test('should include error text in stack', () => {
            const message: any = {
                text: 'Custom error text',
                location: { file: 'test.ts', line: 1, column: 0 },
                notes: []
            };

            const error = new esBuildError(message);

            expect(error.stack).toContain('Custom error text');
        });

        test('should include diagnostic notes in stack', () => {
            const message: any = {
                text: 'Error',
                location: { file: 'test.ts', line: 1, column: 0 },
                notes: [
                    { text: 'First note', location: undefined },
                    { text: 'Second note', location: undefined }
                ]
            };

            const error = new esBuildError(message);

            expect(error.stack).toContain('First note');
            expect(error.stack).toContain('Second note');
        });

        test('should use detail error message and stack when detail is Error', () => {
            const detail = new Error('detail error message');
            detail.stack = 'Error: detail error message\n    at detail.ts:1:1';

            const message: any = {
                id: 'detail-id',
                text: 'outer text should be ignored',
                detail,
                location: null,
                notes: []
            };

            const error = new esBuildError(message);

            expect(error.id).toBe('detail-id');
            expect(error.message).toBe('detail error message');
            expect(error.stack).toBe(detail.stack);
        });

        test('should pass constructor options to stack metadata when detail is Error', () => {
            const detail = new Error('detail error message');
            const reformatStackSpy = xJet.spyOn((esBuildError as any).prototype, 'reformatStack');

            const message: any = {
                text: 'outer text',
                detail,
                location: null,
                notes: []
            };

            const options = { withFrameworkFrames: false, withNativeFrames: true };
            new esBuildError(message, options);

            expect(reformatStackSpy).toHaveBeenCalledWith(detail, options);
        });
    });

    describe('integration', () => {
        test('should create complete error with all information', () => {
            const files = inject(FilesModel);
            xJet.spyOn(files, 'getOrTouchFile').mockReturnValue({
                contentSnapshot: {
                    text: 'const x = invalid;\nconst y = 2;'
                } as any
            });

            const message: any = {
                text: 'Expected identifier',
                location: { file: 'src/index.ts', line: 1, column: 11 },
                notes: [{ text: 'This identifier is not defined', location: null }]
            };

            const error = new esBuildError(message);

            expect(error.name).toBe('esBuildError');
            expect(error.message).toBe('Expected identifier');
            expect(error.stack).toContain('src/index.ts');
            expect(error.stack).toContain('Expected identifier');
            expect(error.stack).toContain('This identifier is not defined');
            expect(error.stack).toContain('invalid');
        });

        test('should handle error without location gracefully', () => {
            const message: any = {
                text: 'Build error',
                location: null,
                notes: [{ text: 'Additional info', location: null }]
            };

            const error = new esBuildError(message);

            expect(error.message).toBe('Build error');
            expect(error.stack).toContain('Build error');
            expect(error.stack).toContain('Additional info');
        });

        test('should be throwable as Error', () => {
            const message: any = {
                text: 'Test error',
                location: null,
                notes: []
            };

            const error = new esBuildError(message);

            expect(error).toBeInstanceOf(Error);
            expect(() => {
                throw error;
            }).toThrow();
        });
    });
});
