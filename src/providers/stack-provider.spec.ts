/**
 * Import will remove at compile time
 */

import type { StackInterface } from '@providers/interfaces/stack-provider.interface';

/**
 * Imports
 */

import { readFileSync } from 'fs';
import { inject } from '@symlinks/symlinks.module';
import { formatStack } from '@providers/stack.provider';
import { xterm } from '@remotex-labs/xansi/xterm.component';
import { FilesModel } from '@typescript/models/files.model';
import { FrameworkService } from '@services/framework.service';
import { parseErrorStack } from '@remotex-labs/xmap/parser.component';
import { ConfigurationService } from '@services/configuration.service';
import { formatErrorCode } from '@remotex-labs/xmap/formatter.component';
import { highlightCode } from '@remotex-labs/xmap/highlighter.component';
import { formatStackFrame, getSourceLocation, highlightPositionCode } from '@providers/stack.provider';
import {
    formatFrameWithPosition,
    stackEntry,
    getErrorMetadata,
    getErrorStack,
    getSource
} from '@providers/stack.provider';

/**
 * Defines
 */

const ROOT = '/project/root';
const DIST = '/project/root/dist';

/**
 * Tests
 */

afterAll(() => xJet.restoreAllMocks());
beforeEach(() => xJet.resetAllMocks());

xJet.mock(readFileSync).mockImplementation(() => '{}');
xJet.mock(inject).mockImplementation((ctor) => {
    if (ctor === ConfigurationService) {
        return { getValue: xJet.fn().mockReturnValue(true) };
    }
    if (ctor === FrameworkService) return {
        rootPath: ROOT,
        distPath: DIST,
        // Must have BOTH methods — even if not used in this test
        getSourceMap: xJet.fn().mockReturnValue(null),
        isFrameworkFile: xJet.fn().mockReturnValue(false)
    };
    if (ctor === FilesModel) return {
        getOrTouchFile: xJet.fn().mockReturnValue(null)
    };

    return {};
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
        const message = { detail: detailError, text: 'Message text' };

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
        const message = { text: 'Build failed' };

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
        };

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
        const message = { location: { file: 'test.js', line: 1, column: 1 } };

        const result = getErrorStack(message);

        expect(result.message).toBe('');
    });
});

describe('getSource', () => {
    let context: any;
    let mockFramework: any;
    let mockFiles: any;

    beforeEach(() => {
        mockFramework = {
            getSourceMap: xJet.fn().mockReturnValue(null)
        };
        mockFiles = {
            getOrTouchFile: xJet.fn().mockReturnValue(null)
        };
        context = {
            framework: mockFramework,
            files: mockFiles
        };
    });

    test('returns source map if available', () => {
        const mockSourceMap = { getPositionWithCode: xJet.fn() };
        mockFramework.getSourceMap.mockReturnValue(mockSourceMap);

        const frame: any = { fileName: 'bundle.js' };
        const result = getSource.call(context, frame);

        expect(mockFramework.getSourceMap).toHaveBeenCalledWith('bundle.js');
        expect(result).toBe(mockSourceMap);
    });

    test('returns null if no fileName', () => {
        const frame: any = {};
        const result = getSource.call(context, frame);

        expect(result).toBeNull();
    });

    test('returns null if no snapshot available', () => {
        mockFiles.getOrTouchFile.mockReturnValue(null);

        const frame: any = { fileName: 'src/app.ts' };
        const result = getSource.call(context, frame);

        expect(mockFiles.getOrTouchFile).toHaveBeenCalledWith('src/app.ts');
        expect(result).toBeNull();
    });

    test('returns null if snapshot has no content', () => {
        mockFiles.getOrTouchFile.mockReturnValue({ contentSnapshot: null });

        const frame: any = { fileName: 'src/app.ts' };
        const result = getSource.call(context, frame);

        expect(result).toBeNull();
    });

    test('creates SourceService from file snapshot', () => {
        const code = 'line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7';
        mockFiles.getOrTouchFile.mockReturnValue({
            contentSnapshot: { text: code }
        });

        const frame: any = { fileName: 'src/app.ts' };
        const result = getSource.call(context, frame);

        expect(result).not.toBeNull();
        expect(result?.getPositionWithCode).toBeInstanceOf(Function);
    });

    test('SourceService.getPositionWithCode extracts correct code context', () => {
        const code = 'line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7';
        mockFiles.getOrTouchFile.mockReturnValue({
            contentSnapshot: { text: code }
        });

        const frame: any = { fileName: 'src/app.ts' };
        const source = getSource.call(context, frame);

        const position = source!.getPositionWithCode(3, 5, <any>null, {
            linesBefore: 2,
            linesAfter: 2
        });

        expect(position).toMatchObject({
            line: 3,
            column: 6,
            source: 'src/app.ts',
            name: null,
            startLine: 1,
            endLine: 5,
            code: 'line 2\nline 3\nline 4\nline 5',
            sourceRoot: null,
            sourceIndex: -1,
            generatedLine: -1,
            generatedColumn: -1
        });
    });

    test('SourceService.getPositionWithCode uses default context lines', () => {
        const code = 'line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8';
        mockFiles.getOrTouchFile.mockReturnValue({
            contentSnapshot: { text: code }
        });

        const frame: any = { fileName: 'src/app.ts' };
        const source = getSource.call(context, frame);

        const position = source!.getPositionWithCode(4, 0, <any>null, {});

        expect(position?.startLine).toBe(1); // 4 - 3 = 1
        expect(position?.endLine).toBe(7); // 4 + 3 = 7
    });

    test('SourceService.getPositionWithCode handles edge cases at file boundaries', () => {
        const code = 'line 1\nline 2\nline 3';
        mockFiles.getOrTouchFile.mockReturnValue({
            contentSnapshot: { text: code }
        });

        const frame: any = { fileName: 'src/app.ts' };
        const source = getSource.call(context, frame);

        const posStart = source!.getPositionWithCode(0, 0, <any>null, { linesBefore: 5, linesAfter: 1 });
        expect(posStart?.startLine).toBe(0);
        expect(posStart?.endLine).toBe(1);

        const posEnd = source!.getPositionWithCode(2, 0, <any>null, { linesBefore: 1, linesAfter: 5 });
        expect(posEnd?.startLine).toBe(1);
        expect(posEnd?.endLine).toBe(3);
    });
});

describe('formatStackFrame', () => {
    let context: any;

    beforeEach(() => {
        context = {
            framework: {
                rootPath: ROOT
            }
        };
    });

    test('shortens path inside root and adds colored position', () => {
        const frame: any = {
            functionName: 'handleClick',
            fileName: `${ ROOT }/src/ui/Button.tsx`,
            line: 45,
            column: 12
        };

        const result = formatStackFrame.call(context, frame);

        expect(result).toBe(
            `at handleClick ${ xterm.darkGray('src/ui/Button.tsx') } ${ xterm.gray('[45:12]') }`
        );
    });

    test('omits position when line or column missing', () => {
        const frame: any = {
            functionName: 'initApp',
            fileName: `${ ROOT }/src/main.ts`
        };

        const result = formatStackFrame.call(context, frame);

        expect(result).toBe(`at initApp ${ xterm.darkGray('src/main.ts') }`);
    });

    test('returns source when fileName is missing', () => {
        const frame: any = { source: 'native code' };
        const result = formatStackFrame.call(context, frame);
        expect(result).toBe('native code');
    });

    test('normalizes multiple spaces', () => {
        const frame: any = {
            functionName: '  very   spaced   name ',
            fileName: 'file   .js',
            line: 7,
            column: 3
        };

        const result = formatStackFrame.call(context, frame);
        expect(result).toBe(`at very spaced name ${ xterm.darkGray('file .js') } ${ xterm.gray('[7:3]') }`);
    });
});

describe('getSourceLocation', () => {
    let context: any;

    beforeEach(() => {
        context = {
            framework: { distPath: DIST }
        };
    });

    test('builds #L suffix for simple source path', () => {
        const frame: any = { fileName: 'bundle.js' };
        const pos = { source: 'src/components/App.tsx', line: 88 } as any;

        const result = getSourceLocation.call(context, frame, pos);
        expect(result).toBe('src/components/App.tsx#L88');
    });

    test('preserves full https url', () => {
        const pos = { source: 'https://cdn.example.com/src/index.ts', line: 19 } as any;
        const result = getSourceLocation.call(<any>{}, <any>{}, pos);
        expect(result).toBe('https://cdn.example.com/src/index.ts#L19');
    });

    test('strips file:// protocol from fallback fileName', () => {
        const frame: any = { fileName: 'file:///src/cli.ts' };
        const pos = { line: 4 } as any; // no .source

        const result = getSourceLocation.call(context, frame, pos);
        expect(result).toBe('/src/cli.ts');
    });

    test('uses sourceRoot and relative path when sourceRoot present', () => {
        const pos = {
            source: '../components/Header.tsx',
            sourceRoot: 'https://github.com/org/repo/blob/main/',
            line: 123
        } as any;

        const result = getSourceLocation.call(context, <any>{}, pos);
        expect(result).toBe('https://github.com/org/repo/blob/main/components/Header.tsx#L123');
    });

    test('handles source containing multiple protocol-like strings', () => {
        const pos = {
            source: 'https://example.com/path/http://old/file.js',
            line: 7
        } as any;

        const result = getSourceLocation.call(context, <any>{}, pos);
        expect(result).toBe('http://old/file.js#L7');
    });
});

describe('highlightPositionCode', () => {
    test('applies highlightCode and then formatErrorCode with brightPink', () => {
        xJet.mock(highlightCode).mockReturnValue('[HL]throw new Error("boom");[/HL]');
        xJet.mock(formatErrorCode).mockImplementation((pos: any, opts: any) => {
            return `formatted:${ pos?.code }|color:${ opts?.color.name }`;
        });

        const pos: any = {
            code: 'throw new Error("boom");',
            line: 12,
            column: 7
        };

        const result = highlightPositionCode(pos);
        expect(highlightCode).toHaveBeenCalledWith('throw new Error("boom");');
        expect(formatErrorCode).toHaveBeenCalledWith(
            expect.objectContaining({
                code: '[HL]throw new Error("boom");[/HL]',
                line: 12,
                column: 7
            }),
            expect.anything()
        );

        expect(result).toContain('formatted:');
    });

    test('handles empty code', () => {
        const result = highlightPositionCode({ code: '', line: 1, column: 0 } as any);
        expect(typeof result).toBe('string');
    });
});

describe('formatFrameWithPosition', () => {
    let context: any;

    beforeEach(() => {
        context = {
            code: '',
            source: '',
            formatCode: '',
            framework: { rootPath: ROOT, distPath: DIST }
        };
    });

    test('caches code, source and formatCode on first call', () => {
        const frame: any = { functionName: 'oldName', fileName: 'old.ts' };
        const pos = {
            source: 'src/store.ts',
            line: 38,
            column: 14,
            code: 'state = initial;',
            name: 'reducer'
        } as any;

        const result = formatFrameWithPosition.call(context, frame, pos);

        expect(context.code).toBe('state = initial;');
        expect(context.source).toBe('src/store.ts');
        expect(context.formatCode).not.toBe('');
        expect(result).toContain('reducer');
        expect(result).toContain('src/store.ts');
        expect(result).toContain('[38:14]');
    });

    test('does not overwrite existing cache', () => {
        context.code = 'cached code';
        context.formatCode = 'cached format';

        formatFrameWithPosition.call(context, <any>{}, { code: 'new' } as any);

        expect(context.code).toBe('cached code');
        expect(context.formatCode).toBe('cached format');
    });
});

describe('stackEntry', () => {
    let context: any;
    let mockFramework: any;
    let mockFiles: any;

    beforeEach(() => {
        mockFramework = {
            rootPath: ROOT,
            getSourceMap: xJet.fn().mockReturnValue(null),
            isFrameworkFile: xJet.fn().mockReturnValue(false)
        };
        mockFiles = {
            getOrTouchFile: xJet.fn().mockReturnValue(null)
        };

        context = {
            framework: mockFramework,
            files: mockFiles,
            withNativeFrames: false,
            withFrameworkFrames: false,
            code: '',
            formatCode: '',
            lineOffset: 0
        };
    });

    test('skips native frame when withNativeFrames = false', () => {
        const frame: any = { native: true, functionName: 'tick' };
        const result = stackEntry.call(context, frame);
        expect(result).toBe('');
    });

    test('includes native frame when withNativeFrames = true', () => {
        context.withNativeFrames = true;
        mockFiles.getOrTouchFile.mockReturnValue({
            contentSnapshot: { text: 'native code\nmore code' }
        });

        const frame: any = { native: true, functionName: 'tick', fileName: 'native.js', line: 1, column: 0 };
        const result = stackEntry.call(context, frame);
        expect(result).toContain('tick');
    });

    test('skips frame without any location info', () => {
        const frame: any = {};
        const result = stackEntry.call(context, frame);
        expect(result).toBe('');
    });

    test('returns data as string if no source available', () => {
        const frame: any = { fileName: 'missing.js', line: 10, column: 5 };
        const result = stackEntry.call(context, frame);
        expect(result).toBe(`at ${ xterm.darkGray('missing.js') } ${ xterm.gray('[10:5]') }`);
    });

    test('uses source map position when available', () => {
        const frame: any = { fileName: `${ DIST }/bundle.js`, line: 150, column: 22 };

        const mapped = {
            source: '../src/store.ts',
            line: 38,
            column: 14,
            code: 'user = data;',
            name: 'setUser'
        };

        const sourceMap = { getPositionWithCode: xJet.fn().mockReturnValue(mapped) };
        mockFramework.getSourceMap.mockReturnValue(sourceMap);

        context.withFrameworkFrames = true;

        const result = stackEntry.call(context, frame);

        expect(result).toContain('setUser');
        expect(result).toContain('src/store.ts');
        expect(result).toContain('[38:14]');
        expect(context.line).toBe(38);
        expect(context.column).toBe(14);
    });

    test('skips framework file when withFrameworkFrames = false', () => {
        const frame: any = { fileName: 'internal.js', line: 99, column: 0 };

        mockFramework.getSourceMap.mockReturnValue({
            getPositionWithCode: xJet.fn().mockReturnValue({ source: 'logger.ts', line: 5, column: 0 })
        });
        mockFramework.isFrameworkFile.mockReturnValue(true);

        const result = stackEntry.call(context, frame);
        expect(result).toBe('');
    });

    test('applies lineOffset to position', () => {
        context.lineOffset = 10;
        context.withFrameworkFrames = true;

        const frame: any = { fileName: 'app.js', line: 5, column: 3 };

        mockFramework.getSourceMap.mockReturnValue({
            getPositionWithCode: xJet.fn().mockReturnValue({
                source: 'app.ts',
                line: 5,
                column: 3,
                code: 'test',
                startLine: 2,
                endLine: 8
            })
        });

        stackEntry.call(context, frame);
        expect(context.line).toBe(15); // 5 + 10
    });

    test('falls back to formatStackFrame when no position returned', () => {
        const frame: any = { fileName: 'app.js', line: 5, column: 3, functionName: 'test' };

        mockFramework.getSourceMap.mockReturnValue({
            getPositionWithCode: xJet.fn().mockReturnValue(null)
        });

        const result = stackEntry.call(context, frame);

        expect(result).toContain('test');
        expect(result).toContain('app.js');
    });
});

describe('getErrorMetadata', () => {
    test('creates context and processes frames from Error', () => {
        xJet.mock(parseErrorStack).mockReturnValue(<any>{
            stack: [{ functionName: 'fail', fileName: `${ ROOT }/src/fail.ts`, line: 99, column: 5 }]
        });

        const mockFiles = {
            getOrTouchFile: xJet.fn().mockReturnValue({
                contentSnapshot: { text: 'line 1\nline 2\nline 3\nline 4\nline 5' }
            })
        };

        xJet.mock(inject).mockImplementation((ctor) => {
            if (ctor === ConfigurationService) return { getValue: xJet.fn().mockReturnValue(false) };
            if (ctor === FrameworkService) return {
                rootPath: ROOT,
                distPath: DIST,
                getSourceMap: xJet.fn().mockReturnValue(null),
                isFrameworkFile: xJet.fn().mockReturnValue(false)
            };
            if (ctor === FilesModel) return mockFiles;

            return {};
        });

        const result = getErrorMetadata(new Error('test'));

        expect(result.stacks).toHaveLength(1);
        expect(result.stacks[0]).toContain('fail');
        expect(result.stacks[0]).toContain('src/fail.ts');
    });

    test('handles esbuild PartialMessage', () => {
        const message = {
            text: 'Build error',
            location: { file: 'src/build.ts', line: 10, column: 5 }
        };

        const mockFiles = {
            getOrTouchFile: xJet.fn().mockReturnValue({
                contentSnapshot: { text: 'const x = 1;\nconst y = 2;\nconst z = 3;' }
            })
        };

        xJet.mock(inject).mockImplementation((ctor) => {
            if (ctor === ConfigurationService) return { getValue: xJet.fn().mockReturnValue(false) };
            if (ctor === FrameworkService) return {
                rootPath: ROOT,
                distPath: DIST,
                getSourceMap: xJet.fn().mockReturnValue(null),
                isFrameworkFile: xJet.fn().mockReturnValue(false)
            };
            if (ctor === FilesModel) return mockFiles;

            return {};
        });

        const result = getErrorMetadata(message as any);

        expect(result.stacks).toHaveLength(1);
    });

    test('applies lineOffset to all positions', () => {
        xJet.mock(parseErrorStack).mockReturnValue(<any>{
            stack: [{ functionName: 'test', fileName: 'app.ts', line: 5, column: 3 }]
        });

        const mockFiles = {
            getOrTouchFile: xJet.fn().mockReturnValue({
                contentSnapshot: { text: 'line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7' }
            })
        };

        xJet.mock(inject).mockImplementation((ctor) => {
            if (ctor === ConfigurationService) return { getValue: xJet.fn().mockReturnValue(false) };
            if (ctor === FrameworkService) return {
                rootPath: ROOT,
                distPath: DIST,
                getSourceMap: xJet.fn().mockReturnValue(null),
                isFrameworkFile: xJet.fn().mockReturnValue(false)
            };
            if (ctor === FilesModel) return mockFiles;

            return {};
        });

        const result = getErrorMetadata(new Error('test'), {}, 100);

        expect(result.line).toBe(105); // 5 + 100
    });

    test('respects verbose configuration', () => {
        xJet.mock(parseErrorStack).mockReturnValue(<any>{
            stack: [
                { functionName: 'test', fileName: 'app.ts', line: 1, column: 0 },
                { functionName: 'native', fileName: 'internal', line: 1, column: 0, native: true }
            ]
        });

        const mockFiles = {
            getOrTouchFile: xJet.fn().mockReturnValue({
                contentSnapshot: { text: 'code' }
            })
        };

        xJet.mock(inject).mockImplementation((ctor) => {
            if (ctor === ConfigurationService) return { getValue: xJet.fn().mockReturnValue(true) }; // verbose = true
            if (ctor === FrameworkService) return {
                rootPath: ROOT,
                distPath: DIST,
                getSourceMap: xJet.fn().mockReturnValue(null),
                isFrameworkFile: xJet.fn().mockReturnValue(false)
            };
            if (ctor === FilesModel) return mockFiles;

            return {};
        });

        const result = getErrorMetadata(new Error('test'));

        expect(result.stacks.length).toBeGreaterThan(0); // Should include native frames when verbose
    });

    test('filters empty stack entries', () => {
        xJet.mock(parseErrorStack).mockReturnValue(<any>{
            stack: [
                { functionName: 'valid', fileName: 'app.ts', line: 1, column: 0 },
                { native: true }, // Will be filtered
                {} // Will be filtered (no location info)
            ]
        });

        const mockFiles = {
            getOrTouchFile: xJet.fn().mockReturnValue({
                contentSnapshot: { text: 'code' }
            })
        };

        xJet.mock(inject).mockImplementation((ctor) => {
            if (ctor === ConfigurationService) return { getValue: xJet.fn().mockReturnValue(false) };
            if (ctor === FrameworkService) return {
                rootPath: ROOT,
                distPath: DIST,
                getSourceMap: xJet.fn().mockReturnValue(null),
                isFrameworkFile: xJet.fn().mockReturnValue(false)
            };
            if (ctor === FilesModel) return mockFiles;

            return {};
        });

        const result = getErrorMetadata(new Error('test'));

        expect(result.stacks).toHaveLength(1);
    });
});

describe('formatStack', () => {
    test('includes error name + message + enhanced trace header', () => {
        const metadata: StackInterface = {
            code: 'const x = undefined;',
            line: 77,
            column: 10,
            source: 'src/fail.ts',
            stacks: [ `at Object.<anonymous> ${ xterm.darkGray('src/fail.ts') } ${ xterm.gray('[77:10]') }` ],
            formatCode: ''
        };

        const output = formatStack(metadata, 'Error', 'Disaster!');

        expect(output).toContain(`Error: ${ xterm.lightCoral('Disaster!') }`);
        expect(output).toContain('Enhanced Stack Trace');
        expect(output).toContain('src/fail.ts');
    });

    test('includes highlighted code block when present', () => {
        const metadata: StackInterface = {
            code: 'throw new Error("bug");',
            line: 12,
            column: 7,
            source: `${ ROOT }/src/bug.ts`,
            stacks: [ `at fail ${ xterm.darkGray('src/bug.ts') } ${ xterm.gray('[12:7]') }` ],
            formatCode: '12 | throw new Error("bug");\n       ^'
        };

        const result = formatStack(metadata, 'Error', 'Code error');

        expect(result).toContain(`Error: ${ xterm.lightCoral('Code error') }`);
        expect(result).toContain('12 | throw new Error("bug");');
        expect(result).toContain('\n\n');
    });

    test('handles empty stacks array', () => {
        const metadata: StackInterface = {
            code: '',
            line: 0,
            column: 0,
            stacks: [],
            formatCode: ''
        };

        const output = formatStack(metadata, 'TypeError', 'Something broke');

        expect(output).toBe(`\nTypeError: ${ xterm.lightCoral('Something broke') }`);
        expect(output).not.toContain('Enhanced Stack Trace');
    });

    test('handles missing formatCode', () => {
        const metadata: StackInterface = {
            code: 'some code',
            line: 5,
            column: 3,
            source: 'file.ts',
            stacks: [ 'at test file.ts [5:3]' ],
            formatCode: ''
        };

        const output = formatStack(metadata, 'ReferenceError', 'Not defined');

        expect(output).toContain(`ReferenceError: ${ xterm.lightCoral('Not defined') }`);
        expect(output).toContain('Enhanced Stack Trace');
        expect(output).not.toMatch(/\n\n(?!Enhanced)/); // No double newline before Enhanced
    });

    test('formats multiple stack frames with proper indentation', () => {
        const metadata: StackInterface = {
            code: 'x.toString()',
            line: 10,
            column: 1,
            source: 'app.ts',
            stacks: [
                `at handleClick ${ xterm.darkGray('src/Button.tsx') } ${ xterm.gray('[45:12]') }`,
                `at onClick ${ xterm.darkGray('src/App.tsx') } ${ xterm.gray('[20:5]') }`,
                `at main ${ xterm.darkGray('src/index.ts') } ${ xterm.gray('[5:1]') }`
            ],
            formatCode: '10 | x.toString()\n      ^'
        };

        const output = formatStack(metadata, 'TypeError', 'Cannot read property');

        expect(output).toContain(`TypeError: ${ xterm.lightCoral('Cannot read property') }`);
        expect(output).toContain('10 | x.toString()');
        expect(output).toContain('Enhanced Stack Trace:');
        expect(output).toContain('    at handleClick');
        expect(output).toContain('    at onClick');
        expect(output).toContain('    at main');
    });

    test('includes notes when provided', () => {
        const metadata: StackInterface = {
            code: 'const x = undefined;',
            line: 10,
            column: 5,
            source: 'app.ts',
            stacks: [ 'at test app.ts [10:5]' ],
            formatCode: ''
        };

        const notes = [
            { text: 'This is a warning note' },
            { text: 'Another helpful hint' }
        ];

        const output = formatStack(metadata, 'Error', 'Test error', notes);

        expect(output).toContain(`Error: ${ xterm.lightCoral('Test error') }`);
        expect(output).toContain(xterm.gray('This is a warning note'));
        expect(output).toContain(xterm.gray('Another helpful hint'));
    });

    test('handles notes without text property', () => {
        const metadata: StackInterface = {
            code: '',
            line: 0,
            column: 0,
            stacks: [],
            formatCode: ''
        };

        const notes = [
            { text: 'Valid note' },
            { location: { file: 'test.js', line: 1 } } as any, // no text property
            { text: undefined } as any
        ];

        const output = formatStack(metadata, 'Error', 'Test', notes);

        expect(output).toContain('Valid note');
        expect(output.split('\n').filter(line => line.includes('Valid note'))).toHaveLength(1);
    });

    test('handles empty notes array', () => {
        const metadata: StackInterface = {
            code: '',
            line: 0,
            column: 0,
            stacks: [],
            formatCode: ''
        };

        const output = formatStack(metadata, 'Error', 'Test', []);

        expect(output).toBe(`\nError: ${ xterm.lightCoral('Test') }`);
    });

    test('handles undefined notes parameter', () => {
        const metadata: StackInterface = {
            code: '',
            line: 0,
            column: 0,
            stacks: [],
            formatCode: ''
        };

        const output = formatStack(metadata, 'Error', 'Test');

        expect(output).toBe(`\nError: ${ xterm.lightCoral('Test') }`);
    });
});
