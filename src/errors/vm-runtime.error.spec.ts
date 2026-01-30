/**
 * Imports
 */

import { xBuildLazy } from '@errors/stack.error';
import { SourceService } from '@remotex-labs/xmap';
import { VMRuntimeError } from '@errors/vm-runtime.error';

describe('VMRuntimeError', () => {
    let originalError: Error;
    let mockSourceService: SourceService;

    beforeEach(() => {
        xJet.clearAllMocks();
        originalError = new Error('Original VM error');
        mockSourceService = new SourceService({
            version: 3,
            file: 'index.js',
            sources: [ 'source.js' ],
            names: [],
            mappings: 'AAAA',
            sourcesContent: [ 'asd' ]
        });

        xJet.mock(xBuildLazy).mockReturnValue(<any>{
            get service() {
                return mockSourceService;
            }
        });

        xJet.spyOn(mockSourceService, 'getPositionWithCode').mockReturnValue(<any> {
            source: 'src/file.ts',
            sourceRoot: 'src/',
            line: 10,
            column: 5,
            code: 'const a = 1;'
        });
    });

    /**
     * Test: Creation of VMRuntimeError
     *
     * This test verifies that an instance of `VMRuntimeError` is correctly created with the provided
     * original error and optional source map service. It checks that the instance properties such as
     * `message`, `originalError`, `name`, and `stack` are set correctly.
     */

    test('should create an instance of VMRuntimeError with the original error', () => {
        const error = new VMRuntimeError(originalError, mockSourceService);
        expect(error).toBeInstanceOf(VMRuntimeError);
        expect(error.message).toBe(originalError.message);
        expect(error.originalError).toBe(originalError);
        expect(error.name).toBe('VMRuntimeError');
        expect(error.stack).toBeDefined();
    });


    /**
     * Test: Stack Trace Formatting with Source Map Service
     *
     * This test checks that the stack trace of the `VMRuntimeError` instance is correctly formatted
     * when a source map service is provided. The expected stack trace should reflect the enhanced
     * formatting applied by the source map service.
     */

    test('should format the stack trace with the source map service', () => {
        const error = new VMRuntimeError(originalError, mockSourceService);
        const expectedStackTrace = 'Enhanced Stack Trace:'; // Update this based on the actual implementation
        expect(error.stack).toContain(expectedStackTrace);
    });

    /**
     * Test: Handling Absence of Source Map Service
     *
     * This test verifies that `VMRuntimeError` handles the case where no source map service is provided.
     * It ensures that the error instance is created correctly and that the `stack` property is still defined.
     */

    test('should handle the absence of a source map service gracefully', () => {
        const error = new VMRuntimeError(originalError);
        expect(error).toBeInstanceOf(VMRuntimeError);
        expect(error.message).toBe(originalError.message);
        expect(error.originalError).toBe(originalError);
        expect(error.stack).toBeDefined();
    });

    /**
     * Test: Correct Capture of Stack Trace with Source Map
     *
     * This test checks that the stack trace of the `VMRuntimeError` correctly includes information
     * about the error and the source map. It ensures that the stack trace reflects the details of
     * the `VMRuntimeError` class and the original error.
     */

    test('should correctly capture stack trace with the source map', () => {
        const error = new VMRuntimeError(originalError, mockSourceService);
        expect(error.stack).toContain('VMRuntimeError');
        expect(error.stack).toContain('Original VM error');
    });
});
