/**
 * Imports
 */

import { BaseError } from '@errors/base.error';
import { SourceService } from '@remotex-labs/xmap';
import { parseErrorStack } from '@remotex-labs/xmap/parser.component';
import { formatErrorCode } from '@remotex-labs/xmap/formatter.component';
import { highlightCode } from '@remotex-labs/xmap/highlighter.component';

/**
 * Test class
 */

class TestError extends BaseError {
    constructor(message: string, sourceMap?: SourceService) {
        super(message, sourceMap);
    }
}

/**
 * Mocks
 */

xJet.mock(highlightCode).mockImplementation((code: any) => `highlighted ${ code }`);
xJet.mock(formatErrorCode).mockImplementation((position: any) => `formatted ${ position.code }`);
xJet.mock(parseErrorStack).mockImplementation((): any => [{ file: 'file.js', line: 10, column: 5, at: 'name ' }]);

xJet.mock(SourceService).mockImplementation((): any => {
    return {
        getSourcePosition: xJet.fn().mockReturnValue({
            source: 'src/file.ts',
            sourceRoot: 'src/',
            line: 10,
            column: 5,
            code: 'const a = 1;'
        })
    };
});

/**
 * Tests
 */

describe('BaseError', () => {
    let testError: TestError;
    let mockSourceService: SourceService;

    beforeEach(() => {
        mockSourceService = new SourceService(<any> 'test');
        testError = new TestError('Test error message', mockSourceService);
    });

    afterAll(() => {
        xJet.restoreAllMocks();
    });

    test('should create an instance of TestError', () => {
        expect(testError).toBeInstanceOf(TestError);
        expect(testError.message).toBe('Test error message');
        expect(testError.stack).toBeDefined();
    });

    test('should handle no source map service gracefully', () => {
        const errorWithoutSourceMap = new TestError('Error without source map');
        expect(errorWithoutSourceMap).toBeInstanceOf(TestError);
        expect(errorWithoutSourceMap.stack).toBeDefined();
    });
});
