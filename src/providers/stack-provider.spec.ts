/**
 * Import will remove at compile time
 */

import type { ResolveMetadataInterface } from '@providers/interfaces/stack-provider.interface';

/**
 * Imports
 */

import { resolveError } from '@remotex-labs/xmap';
import { inject } from '@symlinks/symlinks.module';
import { xterm } from '@remotex-labs/xansi/xterm.component';
import { FilesModel } from '@typescript/models/files.model';
import { FrameworkService } from '@services/framework.service';
import { parseErrorStack } from '@remotex-labs/xmap/parser.component';
import { ConfigurationService } from '@services/configuration.service';
import { formatErrorCode } from '@remotex-labs/xmap/formatter.component';
import { highlightCode } from '@remotex-labs/xmap/highlighter.component';
import { formatStack, getErrorMetadata, getErrorStack, getSource } from '@providers/stack.provider';

/**
 * Tests
 */

afterAll(() => xJet.restoreAllMocks());

let mockFiles: { getOrTouchFile: any };
let mockConfig: { getValue: any };
let mockFramework: { getSourceMap: any; isFrameworkFile: any };

beforeEach(() => {
    xJet.resetAllMocks();

    mockFramework = {
        getSourceMap: xJet.fn().mockReturnValue(null),
        isFrameworkFile: xJet.fn().mockReturnValue(false)
    };
    mockFiles = {
        getOrTouchFile: xJet.fn().mockReturnValue(null)
    };
    mockConfig = {
        getValue: xJet.fn().mockReturnValue(false)
    };

    xJet.mock(inject).mockImplementation((ctor) => {
        if (ctor === ConfigurationService) return mockConfig;
        if (ctor === FrameworkService) return mockFramework;
        if (ctor === FilesModel) return mockFiles;

        return {};
    });
});

describe('getErrorStack', () => {
    test('parses Error instance directly', () => {
        const error = new Error('Test error');
        xJet.mock(parseErrorStack).mockReturnValue({
            stack: [ { functionName: 'test', fileName: 'test.ts', line: 1 } as any ],
            name: 'Error',
            message: 'Test error',
            rawStack: 'stack trace'
        });

        const result = getErrorStack(error);

        expect(parseErrorStack).toHaveBeenCalledWith(error);
        expect(result.name).toBe('Error');
        expect(result.message).toBe('Test error');
    });

    test('parses Error from detail property', () => {
        const detailError = new Error('Detail error');
        const message = { detail: detailError, text: 'Message text' } as any;

        xJet.mock(parseErrorStack).mockReturnValue({
            stack: [],
            name: 'Error',
            message: 'Detail error',
            rawStack: ''
        });

        getErrorStack(message);
        expect(parseErrorStack).toHaveBeenCalledWith(detailError);
    });

    test('handles esbuild message without location', () => {
        const message = { text: 'Build failed' } as any;

        const result = getErrorStack(message);

        expect(result.name).toBe('esBuildMessage');
        expect(result.message).toBe('Build failed');
        expect(result.stack).toEqual([]);
        expect(result.rawStack).toBe('');
    });

    test('creates single-frame stack from esbuild location', () => {
        const message = {
            text: 'Syntax error',
            location: {
                file: 'src/app.ts',
                line: 42,
                column: 15
            }
        } as any;

        const result = getErrorStack(message);

        expect(result.name).toBe('esBuildMessage');
        expect(result.message).toBe('Syntax error');
        expect(result.stack).toHaveLength(1);
        expect(result.stack[0]).toMatchObject({
            source: '@src/app.ts',
            line: 42,
            column: 15,
            fileName: 'src/app.ts',
            eval: false,
            async: false,
            native: false,
            constructor: false
        });
    });

    test('handles empty text in message', () => {
        const message = { location: { file: 'test.js', line: 1, column: 1 } } as any;

        const result = getErrorStack(message);

        expect(result.message).toBe('');
    });
});

describe('getSource', () => {
    test('returns source map if available', () => {
        const mapped = { getPositionWithCode: xJet.fn() };
        mockFramework.getSourceMap.mockReturnValue(mapped);

        const result = getSource('bundle.js');

        expect(mockFramework.getSourceMap).toHaveBeenCalledWith('bundle.js');
        expect(result).toBe(mapped);
    });

    test('returns null if no source map and no snapshot', () => {
        const result = getSource('missing.js');
        expect(result).toBeNull();
    });

    test('returns null if snapshot has no code', () => {
        mockFiles.getOrTouchFile.mockReturnValue({ contentSnapshot: { text: '' } });
        const result = getSource('empty.ts');
        expect(result).toBeNull();
    });

    test('returns snapshot-based source service with code context', () => {
        mockFiles.getOrTouchFile.mockReturnValue({
            contentSnapshot: { text: 'a\nb\nc\nd\ne' }
        });

        const source = getSource('file.ts');
        expect(source).not.toBeNull();

        const position = source!.getPositionWithCode(1, 0, null as any, { linesBefore: 3, linesAfter: 3 } as any);
        expect(position).toMatchObject({
            line: 1,
            column: 1,
            source: 'file.ts',
            startLine: 0,
            endLine: 4
        });

        expect(position?.code).toBe('a\nb\nc\nd');
    });
});

describe('getErrorMetadata', () => {
    test('computes withNativeFrames from verbose', () => {
        mockConfig.getValue.mockReturnValue(true);
        xJet.mock(resolveError).mockImplementation((_parsed, opts) => {
            expect(opts?.withNativeFrames).toBe(true);
            expect(typeof opts?.getSource).toBe('function');

            return { stack: [] } as any;
        });

        getErrorMetadata({ text: 'fail' } as any);
    });

    test('computes withNativeFrames from withFrameworkFrames when not verbose', () => {
        mockConfig.getValue.mockReturnValue(false);
        xJet.mock(resolveError).mockImplementation((_parsed, opts) => {
            expect(opts?.withNativeFrames).toBe(true);

            return { stack: [] } as any;
        });

        getErrorMetadata({ text: 'fail' } as any, { withFrameworkFrames: true } as any);
    });

    test('adds formatCode from first non-framework frame that has code', () => {
        mockFramework.isFrameworkFile.mockReturnValue(false);
        xJet.mock(highlightCode).mockImplementation((code: string) => `H(${ code })`);
        xJet.mock(formatErrorCode).mockReturnValue('FORMATTED');
        xJet.mock(resolveError).mockReturnValue({
            formatCode: undefined,
            stack: [
                {
                    code: 'const x = 1;',
                    line: 2,
                    column: 3,
                    stratLine: 1,
                    format: 'at file:2:3'
                }
            ]
        } as any);

        const result = getErrorMetadata({ text: 'fail' } as any);

        expect(highlightCode).toHaveBeenCalledWith('const x = 1;');
        expect(formatErrorCode).toHaveBeenCalledWith(
            {
                code: 'H(const x = 1;)',
                line: 2,
                column: 3,
                startLine: 1
            },
            expect.any(Object)
        );
        expect(result.formatCode).toBe('FORMATTED');
    });

    test('does not add formatCode for framework frames when withFrameworkFrames = false', () => {
        mockFramework.isFrameworkFile.mockReturnValue(true);
        xJet.mock(resolveError).mockReturnValue({
            formatCode: undefined,
            stack: [{ code: 'x', line: 1, column: 1, stratLine: 0, format: 'at x' }]
        } as any);

        const result = getErrorMetadata({ text: 'fail' } as any, { withFrameworkFrames: false } as any);

        expect(highlightCode).not.toHaveBeenCalled();
        expect(formatErrorCode).not.toHaveBeenCalled();
        expect(result.formatCode).toBeUndefined();
    });

    test('can add formatCode for framework frames when withFrameworkFrames = true', () => {
        mockFramework.isFrameworkFile.mockReturnValue(true);
        xJet.mock(highlightCode).mockReturnValue('H');
        xJet.mock(formatErrorCode).mockReturnValue('FORMATTED');
        xJet.mock(resolveError).mockReturnValue({
            formatCode: undefined,
            stack: [{ code: 'x', line: 1, column: 1, stratLine: 0, format: 'at x' }]
        } as any);

        const result = getErrorMetadata({ text: 'fail' } as any, { withFrameworkFrames: true } as any);

        expect(result.formatCode).toBe('FORMATTED');
    });
});

describe('formatStack', () => {
    test('formats error message, notes, code, and enhanced stack trace', () => {
        const metadata = {
            formatCode: 'CODE',
            stack: [{ format: 'at foo (bar.ts:1:1)' }]
        } as ResolveMetadataInterface;

        const notes = [{ text: 'Note 1' }, { text: 'Note 2' }] as any;

        const output = formatStack(metadata, 'Error', 'Test error', notes);

        expect(output).toContain(`\nError: ${ xterm.lightCoral('Test error') }`);
        expect(output).toContain('\n ' + xterm.gray('Note 1'));
        expect(output).toContain('\n ' + xterm.gray('Note 2'));
        expect(output).toContain('\n\nCODE');
        expect(output).toContain('Enhanced Stack Trace:');
        expect(output).toContain('at foo (bar.ts:1:1)');
    });

    test('ignores notes without text', () => {
        const metadata = { stack: [] } as any as ResolveMetadataInterface;
        const output = formatStack(metadata, 'Error', 'Test', [{ text: 'Valid' }, { location: { file: 'x' } } as any ]);

        expect(output).toContain(xterm.gray('Valid'));
        expect(output).not.toContain('location');
    });

    test('omits enhanced stack trace section when stack is empty', () => {
        const metadata = { stack: [] } as any as ResolveMetadataInterface;
        const output = formatStack(metadata, 'Error', 'Test');

        expect(output).toBe(`\nError: ${ xterm.lightCoral('Test') }`);
    });
});

