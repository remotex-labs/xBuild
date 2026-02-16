/**
 * Import will remove at compile time
 */

import type { Message } from 'esbuild';

/**
 * Imports
 */

import { readFileSync } from 'fs';
import { TypesError } from '@errors/types.error';
import { xBuildError } from '@errors/xbuild.error';
import { esBuildError } from '@errors/esbuild.error';
import { VMRuntimeError } from '@errors/vm-runtime.error';
import { enhancedBuildResult } from '@providers/esbuild-messages.provider';
import { processEsbuildMessages } from '@providers/esbuild-messages.provider';
import { normalizeMessageToError } from '@providers/esbuild-messages.provider';

/**
 * Tests
 */

describe('esbuild-messages.provider', () => {
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

    describe('normalizeMessageToError', () => {
        test('should return xBuildBaseError unchanged when msg.detail is xBuildBaseError', () => {
            const error = new xBuildError('Build error');
            const msg: Message = {
                text: 'Error occurred',
                detail: error
            } as any;

            const result = normalizeMessageToError(msg);

            expect(result).toBe(error);
        });

        test('should return TypesError unchanged when msg.detail is TypesError', () => {
            const error = new TypesError('Type checking failed', []);
            const msg: Message = {
                text: 'Type error',
                detail: error
            } as any;

            const result = normalizeMessageToError(msg);

            expect(result).toBe(error);
        });

        test('should wrap generic Error in VMRuntimeError when msg.detail is Error', () => {
            const error = new Error('Generic error');
            const msg: Message = {
                text: 'Runtime error',
                detail: error
            } as any;

            const result = normalizeMessageToError(msg);

            expect(result).toBeInstanceOf(VMRuntimeError);
            expect(result.message).toContain('Generic error');
        });

        test('should create esBuildError when msg has location', () => {
            const msg: Message = {
                text: 'Syntax error',
                location: {
                    file: 'src/index.ts',
                    line: 10,
                    column: 5,
                    length: 3,
                    lineText: 'const x = ;',
                    namespace: 'file'
                }
            } as any;

            const result = normalizeMessageToError(msg);

            expect(result).toBeInstanceOf(esBuildError);
            expect(result.message).toBe('Syntax error');
        });

        test('should create VMRuntimeError when msg has no location and no detail', () => {
            const msg: Message = {
                text: 'Build failed'
            } as any;

            const result = normalizeMessageToError(msg);

            expect(result).toBeInstanceOf(VMRuntimeError);
            expect(result.message).toContain('Build failed');
        });

        test('should handle empty message text', () => {
            const msg: Message = {
                text: ''
            } as any;

            const result = normalizeMessageToError(msg);

            expect(result).toBeInstanceOf(Error);
        });

        test('should prioritize detail over location', () => {
            const error = new xBuildError('Detail error');
            const msg: Message = {
                text: 'Message text',
                detail: error,
                location: {
                    file: 'src/file.ts',
                    line: 1,
                    column: 1,
                    length: 1,
                    lineText: '',
                    namespace: 'file'
                }
            } as any;

            const result = normalizeMessageToError(msg);

            expect(result).toBe(error);
            expect(result).not.toBeInstanceOf(esBuildError);
        });
    });

    describe('processEsbuildMessages', () => {
        test('should process array of messages and populate target array', () => {
            const messages: Array<Message> = [
                { text: 'Error 1' },
                { text: 'Error 2' },
                { text: 'Error 3' }
            ] as any;
            const target: Error[] = [];

            processEsbuildMessages(messages, target);

            expect(target).toHaveLength(3);
            expect(target[0]).toBeInstanceOf(VMRuntimeError);
            expect(target[1]).toBeInstanceOf(VMRuntimeError);
            expect(target[2]).toBeInstanceOf(VMRuntimeError);
        });

        test('should handle empty messages array', () => {
            const messages: Array<Message> = [];
            const target: Error[] = [];

            processEsbuildMessages(messages, target);

            expect(target).toHaveLength(0);
        });

        test('should handle undefined messages parameter with default', () => {
            const target: Error[] = [];

            processEsbuildMessages(undefined, target);

            expect(target).toHaveLength(0);
        });

        test('should append to existing target array', () => {
            const existingError = new Error('Existing');
            const target: Error[] = [ existingError ];
            const messages: Array<Message> = [{ text: 'New error' }] as any;

            processEsbuildMessages(messages, target);

            expect(target).toHaveLength(2);
            expect(target[0]).toBe(existingError);
            expect(target[1]).toBeInstanceOf(VMRuntimeError);
        });

        test('should process mixed message types', () => {
            const messages: Array<Message> = [
                {
                    text: 'Syntax error',
                    location: {
                        file: 'src/index.ts',
                        line: 5,
                        column: 2,
                        length: 1,
                        lineText: '',
                        namespace: 'file'
                    }
                },
                { text: 'Generic error' },
                {
                    text: 'Type error',
                    detail: new TypesError('Types failed', [])
                }
            ] as any;
            const target: Error[] = [];

            processEsbuildMessages(messages, target);

            expect(target).toHaveLength(3);
            expect(target[0]).toBeInstanceOf(esBuildError);
            expect(target[1]).toBeInstanceOf(VMRuntimeError);
            expect(target[2]).toBeInstanceOf(TypesError);
        });

        test('should preserve order of messages', () => {
            const messages: Array<Message> = [
                { text: 'First' },
                { text: 'Second' },
                { text: 'Third' }
            ] as any;
            const target: Error[] = [];

            processEsbuildMessages(messages, target);

            expect(target[0].message).toContain('First');
            expect(target[1].message).toContain('Second');
            expect(target[2].message).toContain('Third');
        });

        test('should handle large arrays efficiently', () => {
            const messages: Array<Message> = Array.from({ length: 100 }, (_, i) => ({
                text: `Error ${ i }`
            })) as any;
            const target: Error[] = [];

            processEsbuildMessages(messages, target);

            expect(target).toHaveLength(100);
        });
    });

    describe('assignBuildArtifacts', () => {
        test('should create BuildResultInterface with normalized errors and warnings', () => {
            const source = {
                errors: [{ text: 'Build error' }],
                warnings: [{ text: 'Build warning' }],
                metafile: {
                    inputs: {},
                    outputs: {}
                },
                outputFiles: [],
                mangleCache: {}
            } as any;

            const result = enhancedBuildResult(source);

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toBeInstanceOf(VMRuntimeError);
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0]).toBeInstanceOf(VMRuntimeError);
            expect(result.metafile).toBe(source.metafile);
            expect(result.outputFiles).toBe(source.outputFiles);
            expect(result.mangleCache).toBe(source.mangleCache);
        });

        test('should handle source with no errors or warnings', () => {
            const source = {
                metafile: { inputs: {}, outputs: {} }
            };

            const result = enhancedBuildResult(source);

            expect(result.errors).toEqual([]);
            expect(result.warnings).toEqual([]);
            expect(result.metafile).toBe(source.metafile);
        });

        test('should handle source with undefined metafile and artifacts', () => {
            const source = {
                errors: [],
                warnings: []
            };

            const result = enhancedBuildResult(source);

            expect(result.errors).toEqual([]);
            expect(result.warnings).toEqual([]);
            expect(result.metafile).toBeUndefined();
            expect(result.outputFiles).toBeUndefined();
            expect(result.mangleCache).toBeUndefined();
        });

        test('should preserve metafile structure', () => {
            const metafile = {
                inputs: {
                    'src/index.ts': {
                        bytes: 100,
                        imports: []
                    }
                },
                outputs: {
                    'dist/index.js': {
                        bytes: 200,
                        inputs: {},
                        imports: [],
                        exports: []
                    }
                }
            };
            const source = {
                metafile
            };

            const result = enhancedBuildResult(source);

            expect(result.metafile).toBe(metafile);
            expect(result.metafile?.inputs).toBe(metafile.inputs);
            expect(result.metafile?.outputs).toBe(metafile.outputs);
        });

        test('should preserve outputFiles array', () => {
            const outputFiles = [
                {
                    path: 'dist/index.js',
                    contents: new Uint8Array(),
                    hash: '',
                    text: 'content'
                }
            ];
            const source = {
                outputFiles
            };

            const result = enhancedBuildResult(source);

            expect(result.outputFiles).toBe(outputFiles);
            expect(result.outputFiles?.[0]).toBe(outputFiles[0]);
        });

        test('should preserve mangleCache object', () => {
            const mangleCache = {
                foo: 'a',
                bar: 'b'
            };
            const source = {
                mangleCache
            };

            const result = enhancedBuildResult(source);

            expect(result.mangleCache).toBe(mangleCache);
        });

        test('should handle mixed error types in errors and warnings', () => {
            const source = {
                errors: [
                    { text: 'Error 1' },
                    {
                        text: 'Error 2',
                        detail: new xBuildError('Custom')
                    },
                    {
                        text: 'Error 3',
                        location: {
                            file: 'src/file.ts',
                            line: 1,
                            column: 1,
                            length: 1,
                            lineText: '',
                            namespace: 'file'
                        }
                    }
                ],
                warnings: [
                    { text: 'Warning 1' },
                    {
                        text: 'Warning 2',
                        detail: new TypesError('Type warning', [])
                    }
                ]
            } as any;

            const result = enhancedBuildResult(source);

            expect(result.errors).toHaveLength(3);
            expect(result.errors[0]).toBeInstanceOf(VMRuntimeError);
            expect(result.errors[1]).toBeInstanceOf(xBuildError);
            expect(result.errors[2]).toBeInstanceOf(esBuildError);

            expect(result.warnings).toHaveLength(2);
            expect(result.warnings[0]).toBeInstanceOf(VMRuntimeError);
            expect(result.warnings[1]).toBeInstanceOf(TypesError);
        });

        test('should initialize empty errors and warnings arrays', () => {
            const source = {};

            const result = enhancedBuildResult(source);

            expect(result.errors).toEqual([]);
            expect(result.warnings).toEqual([]);
            expect(Array.isArray(result.errors)).toBe(true);
            expect(Array.isArray(result.warnings)).toBe(true);
        });

        test('should handle large number of errors and warnings', () => {
            const source = {
                errors: Array.from({ length: 50 }, (_, i) => ({ text: `Error ${ i }` })),
                warnings: Array.from({ length: 30 }, (_, i) => ({ text: `Warning ${ i }` }))
            } as any;

            const result = enhancedBuildResult(source);

            expect(result.errors).toHaveLength(50);
            expect(result.warnings).toHaveLength(30);
        });
    });

    describe('integration tests', () => {
        test('should normalize complete build result with all artifacts', () => {
            const source = {
                errors: [{ text: 'Syntax error', location: { file: 'src/a.ts', line: 1, column: 1, length: 1, lineText: '', namespace: 'file' } }],
                warnings: [{ text: 'Deprecation warning' }],
                metafile: {
                    inputs: { 'src/index.ts': { bytes: 100, imports: [] } },
                    outputs: { 'dist/index.js': { bytes: 200, inputs: {}, imports: [], exports: [] } }
                },
                outputFiles: [{ path: 'dist/index.js', contents: new Uint8Array(), hash: '', text: '' }],
                mangleCache: { foo: 'a' }
            } as any;

            const result = enhancedBuildResult(source);

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toBeInstanceOf(esBuildError);
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0]).toBeInstanceOf(VMRuntimeError);
            expect(result.metafile).toBeDefined();
            expect(result.outputFiles).toBeDefined();
            expect(result.mangleCache).toBeDefined();
        });

        test('should handle build result from successful build', () => {
            const source = {
                errors: [],
                warnings: [],
                metafile: {
                    inputs: {},
                    outputs: {}
                }
            };

            const result = enhancedBuildResult(source);

            expect(result.errors).toEqual([]);
            expect(result.warnings).toEqual([]);
        });

        test('should handle build result from failed build', () => {
            const source = {
                errors: [
                    { text: 'Fatal error' },
                    { text: 'Another error' }
                ],
                warnings: []
            } as any;

            const result = enhancedBuildResult(source);

            expect(result.errors).toHaveLength(2);
            expect(result.warnings).toEqual([]);
        });
    });
});
