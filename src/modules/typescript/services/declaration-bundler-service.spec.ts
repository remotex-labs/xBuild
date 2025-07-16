/**
 * Imports
 */

import type ts from 'typescript';
import { HeaderDeclarationBundle  } from '@typescript/constants/typescript.constant';
import { DeclarationBundlerService } from '@typescript/services/declaration-bundler.service';

/**
 * Mock dependencies
 */

jest.mock('typescript', () => {
    const originalTs = jest.requireActual('typescript');

    return {
        ...originalTs,
        resolveModuleName: jest.fn(),
        sys: {
            ...originalTs.sys
        }
    };
});

/**
 * Tests
 */


describe('DeclarationBundlerService', () => {
    // Mock variables
    let mockConfig: ts.ParsedCommandLine;
    let mockLanguageService: ts.LanguageService;
    let mockProgram: ts.Program;
    let mockTypeChecker: ts.TypeChecker;
    let mockSourceFile: ts.SourceFile;
    let service: DeclarationBundlerService;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Setup mock for TS config
        mockConfig = {
            options: {
                outDir: '/dist'
            }
        } as ts.ParsedCommandLine;

        // Setup mock for type checker
        mockTypeChecker = {
            getSymbolAtLocation: jest.fn(),
            getExportsOfModule: jest.fn()
        } as unknown as ts.TypeChecker;

        // Setup mock for program
        mockProgram = {
            getTypeChecker: jest.fn().mockReturnValue(mockTypeChecker),
            getSourceFile: jest.fn(),
            getCompilerOptions: jest.fn().mockReturnValue({})
        } as unknown as ts.Program;

        // Setup mock for source file
        mockSourceFile = {
            fileName: '/src/index.ts',
            statements: []
        } as unknown as ts.SourceFile;

        // Setup mock for language service
        mockLanguageService = {
            getProgram: jest.fn().mockReturnValue(mockProgram),
            getEmitOutput: jest.fn()
        } as unknown as ts.LanguageService;

        // Create service instance
        service = new DeclarationBundlerService(mockConfig, mockLanguageService);
    });

    describe('emitBundledDeclarations', () => {
        test('should return an empty array when no entry points provided', () => {
            const result = service.emitBundledDeclarations([]);

            expect(result).toEqual([]);
            expect(mockLanguageService.getProgram).not.toHaveBeenCalled();
        });

        test('should process each entry point and return bundled declarations', () => {
            // Setup mocks
            const entryPoints = [ '/src/index.ts', '/src/types.ts' ];

            // Mock implementation of private method using jest spyOn
            jest.spyOn(service as any, 'generateBundledDeclaration')
                .mockImplementation((path: any) => {
                    return path === '/src/index.ts' ? 'bundled content 1' : 'bundled content 2';
                });

            // Call the method
            const result = service.emitBundledDeclarations(entryPoints);

            // Verify results
            expect(result).toEqual([ 'bundled content 1', 'bundled content 2' ]);
            expect((service as any).generateBundledDeclaration).toHaveBeenCalledTimes(2);
            expect((service as any).generateBundledDeclaration).toHaveBeenCalledWith('/src/index.ts');
            expect((service as any).generateBundledDeclaration).toHaveBeenCalledWith('/src/types.ts');
        });

        test('should clear the processedFiles cache before processing entry points', () => {
            // Setup
            const entryPoints = [ '/src/index.ts' ];
            jest.spyOn(service as any, 'generateBundledDeclaration')
                .mockReturnValue('bundled content');

            // Add something to the cache
            (service as any).processedFiles.set('test', 'cached content');

            // Call the method
            service.emitBundledDeclarations(entryPoints);

            // Verify cache was cleared
            expect((service as any).processedFiles.size).toBe(0);
        });

        test('should filter out undefined results', () => {
            // Setup
            const entryPoints = [ '/src/index.ts', '/src/types.ts' ];

            jest.spyOn(service as any, 'generateBundledDeclaration')
                .mockImplementation((path: any) => {
                    return path === '/src/index.ts' ? 'bundled content' : undefined;
                });

            // Call the method
            const result = service.emitBundledDeclarations(entryPoints);

            // Verify results
            expect(result).toEqual([ 'bundled content' ]);
        });
    });

    describe('generateBundledDeclaration', () => {
        test('should return undefined if program is not available', () => {
            // Setup
            (mockLanguageService.getProgram as any).mockReturnValue(undefined);

            // Call the method
            const result = (service as any).generateBundledDeclaration('/src/index.ts');

            // Verify
            expect(result).toBeUndefined();
        });

        test('should throw error if entry file is not found', () => {
            // Setup
            (mockProgram.getSourceFile as any).mockReturnValue(undefined);

            // Call & verify
            expect(() => {
                (service as any).generateBundledDeclaration('/src/index.ts');
            }).toThrow('Entry point not found: /src/index.ts');
        });

        test('should process entry file and generate bundled declaration', () => {
            // Setup
            (mockProgram.getSourceFile as any).mockReturnValue(mockSourceFile);

            // Mock helper methods
            jest.spyOn(service as any, 'collectFilesRecursive').mockImplementation();
            jest.spyOn(service as any, 'collectExportsFromSourceFile').mockImplementation();
            jest.spyOn(service as any, 'processDeclaredFiles').mockReturnValue({
                bundledContent: [ 'content1', 'content2' ],
                externalImports: new Set([ 'import { x } from "external"' ])
            });
            jest.spyOn(service as any, 'createFinalBundleContent').mockReturnValue('final bundled content');

            // Call the method
            const result = (service as any).generateBundledDeclaration('/src/index.ts');

            // Verify
            expect(result).toBe('final bundled content');
            expect((service as any).collectFilesRecursive).toHaveBeenCalledWith(
                mockSourceFile,
                mockProgram,
                expect.any(Set)
            );
            expect((service as any).collectExportsFromSourceFile).toHaveBeenCalledWith(
                mockSourceFile,
                mockTypeChecker,
                expect.any(Set)
            );
        });
    });

    describe('processDeclarationFile', () => {
        test('should return cached result if file was already processed', () => {
            // Setup
            (service as any).processedFiles.set('/src/cached.ts', 'cached content');

            // Call the method
            const result = (service as any).processDeclarationFile(
                '/src/cached.ts',
                new Set(),
                new Set()
            );

            // Verify
            expect(result).toBe('cached content');
            expect(mockLanguageService.getEmitOutput).not.toHaveBeenCalled();
        });

        test('should return undefined if emit was skipped', () => {
            // Setup
            (mockLanguageService.getEmitOutput as any).mockReturnValue({
                emitSkipped: true,
                outputFiles: []
            });

            // Call the method
            const result = (service as any).processDeclarationFile(
                '/src/index.ts',
                new Set(),
                new Set()
            );

            // Verify
            expect(result).toBeUndefined();
        });

        test('should return undefined if no declaration file was found', () => {
            // Setup
            (mockLanguageService.getEmitOutput as any).mockReturnValue({
                emitSkipped: false,
                outputFiles: [{ name: 'index.js', text: 'js content' }]
            });

            // Call the method
            const result = (service as any).processDeclarationFile(
                '/src/index.ts',
                new Set(),
                new Set()
            );

            // Verify
            expect(result).toBeUndefined();
        });

        test('should process declaration file content correctly', () => {
            // Setup
            const dtsContent = `
import { something } from "./local";
import { external } from "external-lib";
export * from "./other";
export const foo = 123;
export class Bar {}

// Comment
const internalVar = 456;
      `.trim();

            (mockLanguageService.getEmitOutput as any).mockReturnValue({
                emitSkipped: false,
                outputFiles: [{ name: 'index.d.ts', text: dtsContent }]
            });

            jest.spyOn(service as any, 'isImportOrExportWithFrom')
                .mockImplementation((line: any) =>
                    line.includes('import ') || (line.includes('export ') && line.includes(' from '))
                );

            jest.spyOn(service as any, 'extractModulePath')
                .mockImplementation((line: any) => {
                    const match = line.match(/from ["'](.+)["']/);

                    return match ? match[1] : undefined;
                });

            jest.spyOn(service as any, 'isExternalModule')
                .mockImplementation((modulePath: any) => modulePath.startsWith('external'));

            jest.spyOn(service as any, 'processExportLine')
                .mockImplementation((line: any) => line.includes('foo') ? 'const foo = 123;' : line);

            const externalImports = new Set<string>();

            // Call the method
            const result = (service as any).processDeclarationFile(
                '/src/index.ts',
                new Set([ 'Bar' ]),  // Only Bar is collected
                externalImports
            );

            // Verify
            expect(externalImports.has('import { external } from "external-lib";')).toBe(true);
            expect(result).toContain('export class Bar {}');
            expect(result).toContain('const foo = 123;');
            expect(result).not.toContain('import { something } from "./local";');
            expect(result).not.toContain('export * from "./other";');
            expect((service as any).processedFiles.has('/src/index.ts')).toBe(true);
        });
    });

    describe('createFinalBundleContent', () => {
        test('should combine imports and content with header', () => {
            // Setup
            const externalImports = new Set([ 'import { x } from "external";', 'import { y } from "other";' ]);
            const bundledContent = [ 'const foo = 123;', 'class Bar {}' ];

            // Call the method
            const result = (service as any).createFinalBundleContent(externalImports, bundledContent);

            // Verify
            expect(result).toBe(
                `${ HeaderDeclarationBundle }import { x } from "external";\n` +
                'import { y } from "other";\n\n' +
                'const foo = 123;\n\nclass Bar {}'
            );
        });

        test('should handle empty imports', () => {
            // Setup
            const externalImports = new Set<string>();
            const bundledContent = [ 'const foo = 123;', 'class Bar {}' ];

            // Call the method
            const result = (service as any).createFinalBundleContent(externalImports, bundledContent);

            // Verify
            expect(result).toBe(
                `${ HeaderDeclarationBundle }const foo = 123;\n\nclass Bar {}`
            );
        });
    });
});

