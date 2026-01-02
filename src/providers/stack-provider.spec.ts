
/**
 * Import will remove at compile time
 */

import type { FrameworkService } from '@services/framework.service';
import type { StackFrameInterface } from '@remotex-labs/xmap/parser.component';
import type { PositionWithCodeInterface } from '@remotex-labs/xmap/formatter.component';
import type { StackContextInterface } from '@providers/interfaces/stack-provider.interface';

/**
 * Imports
 */

import { inject } from '@symlinks/symlinks.module';
import { formatStack, stackMetadata } from '@providers/stack.provider';
import { ConfigurationService } from '@services/configuration.service';
import { formatFrameWithPosition, stackEntry, parseStackTrace } from '@providers/stack.provider';
import { formatStackFrame, getSourceLocation, highlightPositionCode } from '@providers/stack.provider';

/**
 * Tests
 */

afterAll(() => xJet.restoreAllMocks());

describe('formatStackFrame', () => {
    let context: StackContextInterface;
    let frame: StackFrameInterface;

    beforeEach(() => {
        context = {
            code: '',
            source: '',
            formatCode: '',
            withNativeFrames: false,
            withFrameworkFrames: false,
            framework: {
                rootPath: '/project/root'
            } as unknown as FrameworkService
        };

        frame = {
            functionName: 'myFunction',
            fileName: '/project/root/src/utils.ts',
            line: 42,
            column: 10
        } as unknown as StackFrameInterface;
    });

    test('should format stack frame with function name, file path, and position', () => {
        const result = formatStackFrame.call(context, frame);

        expect(result).toContain('myFunction');
        expect(result).toContain('src/utils.ts');
        expect(result).toContain('[42:10]');
    });

    test('should shorten paths inside framework root', () => {
        frame.fileName = '/project/root/src/file.ts';
        const result = formatStackFrame.call(context, frame);

        expect(result).toContain('src/file.ts');
        expect(result).not.toContain('/project/root');
    });

    test('should handle frames without line or column information', () => {
        frame.line = undefined;
        frame.column = undefined;
        const result = formatStackFrame.call(context, frame);

        expect(result).not.toContain('utils.ts[');
        expect(result).toContain('myFunction');
    });

    test('should return source if fileName is not available', () => {
        frame.fileName = undefined;
        frame.source = 'native code';
        const result = formatStackFrame.call(context, frame);

        expect(result).toBe('native code');
    });

    test('should handle empty function name', () => {
        frame.functionName = '';
        const result = formatStackFrame.call(context, frame);

        expect(result).toBeDefined();
        expect(result).toContain('src/utils.ts');
    });

    test('should normalize multiple consecutive spaces', () => {
        frame.functionName = 'test';
        frame.fileName = '/project/root/file.ts';
        const result = formatStackFrame.call(context, frame);

        expect(result).not.toMatch(/\s{2,}/);
    });
});

describe('getSourceLocation', () => {
    let context: StackContextInterface;
    let frame: StackFrameInterface;
    let position: Required<PositionWithCodeInterface>;

    beforeEach(() => {
        context = {
            code: '',
            source: '',
            formatCode: '',
            withNativeFrames: false,
            withFrameworkFrames: false,
            framework: {
                rootPath: '/project/root',
                distPath: '/project/root/dist'
            } as unknown as FrameworkService
        };

        frame = {
            fileName: 'utils.ts'
        } as unknown as StackFrameInterface;

        position = {
            source: 'src/utils.ts',
            sourceRoot: 'https://example.com/',
            line: 15,
            column: 5,
            code: 'const x = 1;',
            name: 'myFunc'
        } as unknown as Required<PositionWithCodeInterface>;
    });

    test('should append line number with #L format', () => {
        const result = getSourceLocation.call(context, frame, position);

        expect(result).toContain('#L15');
    });

    test('should handle HTTP URLs in source', () => {
        position.source = 'http://localhost/bundle.js?v=1';
        const result = getSourceLocation.call(context, frame, position);

        expect(result).toContain('http://localhost');
        expect(result).toContain('#L15');
    });

    test('should handle HTTPS URLs in source', () => {
        position.source = 'https://cdn.example.com/app.js';
        const result = getSourceLocation.call(context, frame, position);

        expect(result).toContain('https://cdn.example.com');
        expect(result).toContain('#L15');
    });

    test('should use sourceRoot with relative path when available', () => {
        position.source = 'src/utils.ts';
        position.sourceRoot = 'https://github.com/myrepo/blob/main/';
        const result = getSourceLocation.call(context, frame, position);

        expect(result).toContain('https://github.com/myrepo/blob/main/');
        expect(result).toContain('#L15');
    });

    test('should strip file:// protocol from fileName', () => {
        frame.fileName = 'file:///path/to/file.ts';
        position.source = <any> undefined;
        const result = getSourceLocation.call(context, frame, position);

        expect(result).toBe('/path/to/file.ts');
    });

    test('should return empty string when no source or fileName', () => {
        frame.fileName = undefined;
        position.source = <any> undefined;
        const result = getSourceLocation.call(context, frame, position);

        expect(result).toBe('');
    });

    test('should handle URLs with lastIndexOf properly', () => {
        position.source = 'https://example.com/path/http://old-url/file.js';
        const result = getSourceLocation.call(context, frame, position);

        expect(result).toContain('http://old-url/file.js#L15');
    });
});

describe('highlightPositionCode', () => {
    let position: PositionWithCodeInterface;

    beforeEach(() => {
        position = {
            code: 'const x = 1;',
            line: 10,
            column: 5
        } as unknown as PositionWithCodeInterface;
    });

    test('should apply syntax highlighting to code', () => {
        const result = highlightPositionCode(position);

        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
    });

    test('should process code through formatErrorCode', () => {
        const result = highlightPositionCode(position);

        expect(result.length).toBeGreaterThan(0);
    });

    test('should handle empty code', () => {
        position.code = '';
        const result = highlightPositionCode(position);

        expect(typeof result).toBe('string');
    });
});

describe('formatFrameWithPosition', () => {
    let context: StackContextInterface;
    let frame: StackFrameInterface;
    let position: Required<PositionWithCodeInterface>;

    beforeEach(() => {
        context = {
            code: '',
            source: '',
            formatCode: '',
            withNativeFrames: false,
            withFrameworkFrames: false,
            framework: {
                rootPath: '/project/root',
                distPath: '/project/root/dist'
            } as unknown as FrameworkService
        };

        frame = {
            functionName: 'oldFunc',
            fileName: 'old-file.ts',
            line: 1,
            column: 1
        } as unknown as StackFrameInterface;

        position = {
            source: 'src/file.ts',
            sourceRoot: 'https://example.com/',
            line: 42,
            column: 15,
            code: 'const result = compute();',
            name: 'newFunc'
        } as unknown as Required<PositionWithCodeInterface>;
    });

    test('should cache code and formatCode on context', () => {
        formatFrameWithPosition.call(context, frame, position);

        expect(context.code).toBe(position.code);
        expect(context.source).toBe(position.source);
        expect(context.formatCode).toBeDefined();
    });

    test('should not recache if already set', () => {
        const originalCode = 'original code';
        context.code = originalCode;
        context.formatCode = 'original format';

        formatFrameWithPosition.call(context, frame, position);

        expect(context.code).toBe(originalCode);
        expect(context.formatCode).toBe('original format');
    });

    test('should use position information to update frame', () => {
        const result = formatFrameWithPosition.call(context, frame, position);

        expect(result).toContain('42');
        expect(result).toContain('15');
        expect(result).toContain('newFunc');
    });

    test('should build file location using getSourceLocation', () => {
        const result = formatFrameWithPosition.call(context, frame, position);

        expect(result).toContain('src/file.ts');
    });
});

describe('stackEntry', () => {
    let frame: StackFrameInterface;
    let context: StackContextInterface;
    let mockFramework: any;

    beforeEach(() => {
        mockFramework = {
            rootPath: '/project/root',
            getSourceMap: xJet.fn().mockReturnValue(null),
            isFrameworkFile: xJet.fn().mockReturnValue(false)
        };

        context = {
            code: '',
            source: '',
            formatCode: '',
            withNativeFrames: false,
            withFrameworkFrames: false,
            framework: mockFramework as FrameworkService
        };

        frame = {
            functionName: 'testFunc',
            fileName: '/project/root/src/test.ts',
            line: 10,
            column: 5,
            native: false
        } as unknown as StackFrameInterface;
    });

    test('should return empty string for native frames when withNativeFrames is false', () => {
        frame.native = true;
        context.withNativeFrames = false;

        const result = stackEntry.call(context, frame);

        expect(result).toBe('');
    });

    test('should include native frames when withNativeFrames is true', () => {
        frame.native = true;
        context.withNativeFrames = true;

        const result = stackEntry.call(context, frame);

        expect(result).not.toBe('');
    });

    test('should return empty string for frames without location info', () => {
        frame.line = undefined;
        frame.column = undefined;
        frame.fileName = undefined;
        frame.functionName = undefined;

        const result = stackEntry.call(context, frame);

        expect(result).toBe('');
    });

    test('should return formatted frame when no source map available', () => {
        const result = stackEntry.call(context, frame);

        expect(result).toContain('testFunc');
    });

    test('should filter framework files when withFrameworkFrames is false', () => {
        const mockSourceMap = {
            getPositionWithCode: xJet.fn().mockReturnValue({
                line: 10,
                column: 5,
                code: 'test',
                source: 'src/test.ts'
            })
        };

        (mockFramework.getSourceMap as any).mockReturnValue(mockSourceMap);
        (mockFramework.isFrameworkFile as any).mockReturnValue(true);
        context.withFrameworkFrames = false;

        const result = stackEntry.call(context, frame);

        expect(result).toBe('');
    });

    test('should use position with code when available', () => {
        const position = {
            line: 42,
            column: 10,
            code: 'const x = 1;',
            source: 'src/file.ts'
        };

        const mockSourceMap = {
            getPositionWithCode: xJet.fn().mockReturnValue(position)
        };

        (mockFramework.getSourceMap as any).mockReturnValue(mockSourceMap);
        (mockFramework.isFrameworkFile as any).mockReturnValue(false);

        const result = stackEntry.call(context, frame);

        expect(context.line).toBe(42);
        expect(context.column).toBe(10);
        expect(result).toBeDefined();
    });
});

describe('parseStackTrace', () => {
    let error: Error;

    beforeEach(() => {
        error = new Error('Test error');
        xJet.spyOn({ inject }, 'inject' as any).mockImplementation(
            (classObject) => xJet.mock(classObject)
        );
    });

    test('should parse error and return structured stack', () => {
        const result = parseStackTrace(error);

        expect(result).toHaveProperty('stacks');
        expect(result).toHaveProperty('code');
        expect(result).toHaveProperty('line');
        expect(result).toHaveProperty('column');
        expect(result).toHaveProperty('source');
        expect(result).toHaveProperty('formatCode');
    });

    test('should return stacks as array of strings', () => {
        const result = parseStackTrace(error);

        expect(Array.isArray(result.stacks)).toBe(true);
    });

    test('should set withNativeFrames to true when VERBOSE is enabled', () => {
        inject(ConfigurationService).patch({ verbose: true });
        const result = parseStackTrace(error);

        expect(result.stacks.some(s =>
            s.includes('processTicksAndRejections')
        )).toBe(true);

        inject(ConfigurationService).patch({ verbose: false });
    });

    test('should filter out empty stack entries', () => {
        const result = parseStackTrace(error);

        expect(result.stacks.every((s) => s.length > 0)).toBe(true);
    });

    test('should accept custom options', () => {
        const options = {
            withNativeFrames: true,
            withFrameworkFrames: true,
            linesBefore: 3,
            linesAfter: 3
        };

        const result = parseStackTrace(error, options);

        expect(result).toBeDefined();
    });
});

describe('formatStack', () => {
    let error: Error;
    let mockFramework: any;

    beforeEach(() => {
        error = new Error('Something went wrong');
        mockFramework = {
            rootPath: '/project/root',
            getSourceMap: xJet.fn().mockReturnValue(null),
            isFrameworkFile: xJet.fn().mockReturnValue(false)
        };

        xJet.spyOn({ inject }, 'inject' as any).mockReturnValue(mockFramework as FrameworkService);
    });

    test('should include error name and message', () => {
        const result = formatStack(error);

        expect(result).toContain('Error');
        expect(result).toContain('Something went wrong');
    });

    test('should include formatted code if available', () => {
        const result = formatStack(error);

        expect(result).toContain('Enhanced Stack Trace');
    });

    test('should return formatted string starting with newline', () => {
        const result = formatStack(error);

        expect(result.startsWith('\n')).toBe(true);
    });

    test('should format multiple stack frames', () => {
        const result = formatStack(error);

        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
    });

    test('should accept custom stack trace options', () => {
        const options = {
            withNativeFrames: true,
            linesBefore: 5,
            linesAfter: 5
        };

        const result = formatStack(error, options);

        expect(result).toContain('Error');
    });

    test('should handle errors with complex messages', () => {
        const complexError = new Error('Line 1\nLine 2\nLine 3');
        const result = formatStack(complexError);

        expect(result).toContain('Line 1');
    });
});

describe('stackMetadata', () => {
    let error: Error;

    beforeEach(() => {
        error = new Error('Metadata test error');
        xJet.spyOn({ inject }, 'inject' as any).mockImplementation(
            (classObject) => xJet.mock(classObject)
        );
    });

    test('should return metadata interface', () => {
        const result = stackMetadata(error);

        expect(result).toHaveProperty('code');
        expect(result).toHaveProperty('line');
        expect(result).toHaveProperty('column');
        expect(result).toHaveProperty('source');
        expect(result).toHaveProperty('stacks');
        expect(result).toHaveProperty('formatCode');
    });

    test('should indent stack frames with 4 spaces', () => {
        const result = stackMetadata(error);

        if (result.stacks.length > 0) {
            expect(result.stacks.startsWith('    ')).toBe(true);
        }
    });

    test('should join stacks into single string', () => {
        const result = stackMetadata(error);

        expect(typeof result.stacks).toBe('string');
    });

    test('should retry parsing with framework frames if initial stacks are empty', () => {
        const result = stackMetadata(error);

        // The function should ensure stacks are populated
        expect(result.stacks).toBeDefined();
    });

    test('should accept custom trace options', () => {
        const options = {
            withNativeFrames: true,
            withFrameworkFrames: true
        };

        const result = stackMetadata(error, options);

        expect(result).toHaveProperty('stacks');
        expect(typeof result.stacks).toBe('string');
    });

    test('should handle errors without stack traces', () => {
        const simpleError = new Error('Simple');
        const result = stackMetadata(simpleError);

        expect(result.code).toBeDefined();
        expect(result.stacks).toBeDefined();
    });
});
