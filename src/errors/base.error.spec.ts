/**
 * Imports
 */

import { BaseError } from '@errors/base.error';
import { SourceService } from '@remotex-labs/xmap';

/**
 * Mocks
 */

jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    readFileSync: jest.fn().mockImplementation(() => {
        return JSON.stringify({
            version: 3,
            file: 'index.js',
            sources: [ 'source.js' ],
            names: [],
            mappings: 'AAAA',
            sourcesContent: [ 'asd' ]
        });
    })
}));

jest.mock('@remotex-labs/xmap', () => ({
    ...jest.requireActual('@remotex-labs/xmap'),
    SourceService: jest.fn().mockImplementation(() => ({
        getSourcePosition: jest.fn().mockReturnValue({
            source: 'src/file.ts',
            sourceRoot: 'src/',
            line: 10,
            column: 5,
            code: 'const a = 1;'
        })
    })),
    formatErrorCode: (position: any) => `formatted ${ position.code }`,
    highlightCode: (code: any) => `highlighted ${ code }`,
    parseErrorStack: () => [{ file: 'file.js', line: 10, column: 5, at: 'name ' }]
}));

/**
 * Test class
 */

class TestError extends BaseError {
    constructor(message: string, sourceMap?: SourceService) {
        super(message, sourceMap);
    }
}

describe('BaseError', () => {
    let testError: TestError;
    let mockSourceService: SourceService;

    beforeEach(() => {
        mockSourceService = new SourceService(<any> 'test');
        testError = new TestError('Test error message', mockSourceService);
    });

    afterEach(() => {
        jest.restoreAllMocks(); // Restore original implementations
    });

    afterAll(() => {
        jest.resetAllMocks();
        jest.clearAllMocks();
    });

    /**
     * Test case to verify that `TestError` is instantiated correctly.
     *
     * Ensures that the error message and stack are set as expected.
     *
     * Code:
     * ```ts
     * expect(testError).toBeInstanceOf(TestError);
     * expect(testError.message).toBe('Test error message');
     * expect(testError.stack).toBeDefined();
     * ```
     * Expected result: `TestError` instance is correctly created with the provided message and stack trace.
     */

    test('should create an instance of TestError', () => {
        expect(testError).toBeInstanceOf(TestError);
        expect(testError.message).toBe('Test error message');
        expect(testError.stack).toBeDefined();
    });

    /**
     * Test case to handle scenarios where no source map service is provided.
     *
     * This test ensures that `TestError` can handle the absence of a source map service gracefully.
     *
     * Code:
     * ```ts
     * const errorWithoutSourceMap = new TestError('Error without source map');
     * expect(errorWithoutSourceMap).toBeInstanceOf(TestError);
     * expect(errorWithoutSourceMap.stack).toBeDefined();
     * ```
     * Expected result: `TestError` handles the absence of a source map service without issues.
     */

    test('should handle no source map service gracefully', () => {
        const errorWithoutSourceMap = new TestError('Error without source map');
        expect(errorWithoutSourceMap).toBeInstanceOf(TestError);
        expect(errorWithoutSourceMap.stack).toBeDefined();
    });
});
