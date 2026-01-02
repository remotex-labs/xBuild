/**
 * Import will remove at compile time
 */

import type { SourceFile } from 'typescript';
import type { DeclarationInterface } from '@typescript/services/interfaces/declaration-cache-service.interface';

/**
 * Imports
 */

import ts from 'typescript';
import { mkdir, writeFile } from 'fs/promises';
import { inject } from '@symlinks/symlinks.module';
import { xterm } from '@remotex-labs/xansi/xterm.component';
import { DeclarationService } from '@typescript/services/declaration.service';
import { emitSingleDeclaration, shouldEmitFile } from '@typescript/components/emit.component';

/**
 * Helpers
 */

function createSourceFile(fileName: string, content: string): SourceFile {
    return ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true);
}

/**
 * Tests
 */

describe('DeclarationService', () => {
    let mockProgram: any;
    let mockLanguageHost: any;
    let mockLanguageService: any;
    let mockDeclarationCache: any;
    let service: DeclarationService;

    beforeEach(() => {
        xJet.restoreAllMocks();

        // Core mocks
        mockLanguageHost = {
            getCompilationSettings: xJet.fn(() => ({ paths: { '@app/*': [ 'src/*' ] } })),
            getScriptVersion: xJet.fn(() => 'v1')
        };

        mockProgram = {
            getSourceFiles: xJet.fn(() => []),
            getSourceFile: xJet.fn(() => undefined)
        };

        mockLanguageService = {
            getProgram: xJet.fn(() => mockProgram)
        };

        // Mock cache dependency
        mockDeclarationCache = {
            get: xJet.fn(() => undefined),
            getOrUpdate: () => ({
                fileName: 'entry.ts',
                content: 'export const x = 1;',
                version: 'v1',
                dependency: new Set(),
                imports: { named: {}, default: {}, namespace: {} },
                exports: { star: [], exports: [ 'x' ], namespace: {} },
                externalExports: { star: [], exports: {}, namespace: {} }
            })
        };

        // Replace DI inject() call
        xJet.mock(inject).mockReturnValue(mockDeclarationCache);
        xJet.mock(mkdir).mockImplementation(() => void!0);
        xJet.mock(writeFile).mockImplementation(async () => {});
        xJet.mock(shouldEmitFile).mockImplementation(() => true);
        xJet.mock(emitSingleDeclaration).mockImplementation(async () => {});

        // Mock xterm output
        xJet.spyOn(xterm, 'deepOrange').mockReturnValue('[TS]');

        // Inject mocks
        service = new DeclarationService(mockLanguageService, mockLanguageHost);
    });

    describe('constructor', () => {
        test('should build alias regex from paths', () => {
            const regex = (service as any).aliasRegex;
            expect(regex).toBeInstanceOf(RegExp);
            expect(regex.source).toContain('@app');
        });
    });

    describe('reload', () => {
        test('should rebuild alias regex', () => {
            const oldRegex = (service as any).aliasRegex;
            service.reload();
            const newRegex = (service as any).aliasRegex;
            expect(newRegex).not.toBe(oldRegex);
        });
    });

    describe('emitDeclarations', () => {
        test('should emit declarations for valid source files', async () => {
            const file = createSourceFile('test.ts', 'export const x = 1;');
            mockProgram.getSourceFiles.mockReturnValue([ file ]);
            mockLanguageService.getProgram.mockReturnValue(mockProgram);
            (shouldEmitFile as any).mockReturnValue(true);

            await service.emitDeclarations(false);

            expect(emitSingleDeclaration).toHaveBeenCalledTimes(1);
            expect(emitSingleDeclaration).toHaveBeenCalledWith(
                file, expect.any(Object), expect.any(RegExp)
            );
        });

        test('should throw if no program available', async () => {
            mockLanguageService.getProgram.mockReturnValue(undefined);
            await expect(service.emitDeclarations(false))
                .rejects.toThrow(/program is not available/);
        });

        test('should skip when no files to emit', async () => {
            mockProgram.getSourceFiles.mockReturnValue([]);
            await service.emitDeclarations(false);
            expect(emitSingleDeclaration).not.toHaveBeenCalled();
        });
    });

    describe('emitBundleDeclarations', () => {
        test('should throw when program unavailable', async () => {
            mockLanguageService.getProgram.mockReturnValue(undefined);
            await expect(service.emitBundleDeclarations({ 'bundle/out': 'entry.ts' }))
                .rejects.toThrow(/program is not available/);
        });
    });

    describe('generateRandomName', () => {
        test('should generate unique random names', () => {
            const set = new Set<string>();
            const n1 = (service as any).generateRandomName(set);
            const n2 = (service as any).generateRandomName(set);
            expect(n1).not.toBe(n2);
            expect(set.has(n1)).toBe(true);
            expect(set.has(n2)).toBe(true);
        });
    });

    describe('collectNamespaceExports', () => {
        test('should collect nested namespace exports', () => {
            const decl = {
                exports: { exports: [ 'x' ], star: [], namespace: { Foo: 'foo.ts' } }
            };
            mockDeclarationCache.get.mockImplementation((file: string) => file === 'foo.ts' ? decl : decl);

            const result = (service as any).collectNamespaceExports('entry.ts');
            expect(result.exports).toContain('Foo');
            expect(result.declarations.some((d: string) => d.includes('const Foo'))).toBe(true);
        });
    });

    describe('collectExternalImports', () => {
        test('should merge imports from multiple declarations', () => {
            const decls = new Set([
                {
                    imports: {
                        default: { 'lib-a': 'A' },
                        named: { 'lib-b': [ 'B1', 'B2' ] },
                        namespace: { NS: 'lib-c' }
                    }
                },
                {
                    imports: {
                        default: {},
                        named: { 'lib-b': [ 'B3' ] },
                        namespace: {}
                    }
                }
            ]);

            const result = (service as any).collectExternalImports(decls);
            expect(result.has('lib-a')).toBe(true);
            expect(result.get('lib-b').named.size).toBe(3);
            expect(result.get('lib-c').namespace.size).toBe(1);
        });
    });

    describe('generateImportStatements', () => {
        test('should generate import lines for all types', () => {
            const imports = new Map([[ 'lib-a', { default: 'A', named: new Set([ 'B' ]), namespace: new Map([[ 'NS', 'lib-c' ]]) }]]);
            const result = (service as any).generateImportStatements(imports);
            expect(result.some((line: string) => line.includes('import A, { B }'))).toBe(true);
            expect(result.some((line: string) => line.includes('import * as NS'))).toBe(true);
        });
    });

    describe('collectBundleExports', () => {
        test('should include all export patterns', () => {
            const decl: DeclarationInterface = {
                fileName: 'f.ts',
                content: '',
                version: 'v1',
                dependency: new Set(),
                imports: { named: {}, default: {}, namespace: {} },
                exports: { star: [], exports: [ 'a' ], namespace: { Foo: 'foo.ts' } },
                externalExports: {
                    star: [ 'lib-ext' ],
                    namespace: { Bar: 'lib-bar' },
                    exports: { 'lib-baz': [ 'Q' ] }
                }
            };
            const result = (service as any).collectBundleExports(new Set([ decl ]), new Set());
            expect(result.exports).toContain('a');
            expect(result.externalExports.join()).toContain('export * as Bar');
            expect(result.externalExports.join()).toContain('export { Q } from \'lib-baz\'');
            expect(result.declarations.some((d: string) => d.includes('import * as'))).toBe(true);
        });
    });

    describe('parseContent', () => {
        test('should assemble content with imports, declarations, and exports', () => {
            const dep: DeclarationInterface = {
                fileName: 'd.ts',
                content: '',
                version: 'v1',
                dependency: new Set(),
                imports: { named: { lib: [ 'A' ] }, default: {}, namespace: {} },
                exports: { star: [], exports: [], namespace: {} },
                externalExports: { star: [], exports: {}, namespace: {} }
            };

            const exp: DeclarationInterface = {
                ...dep,
                exports: { star: [], exports: [ 'B' ], namespace: {} }
            };

            const result = (service as any).parseContent('core', new Set([ dep ]), new Set([ exp ]));
            expect(result).toContain('import { A } from \'lib\'');
            expect(result).toContain('export { B }');
        });
    });

    describe('bundleCollectDeclarations', () => {
        test('should write output file with generated bundle content', async () => {
            const source = createSourceFile('entry.ts', '');
            const program = mockProgram;
            const fakeContent = 'bundle content';

            xJet.spyOn(service as any, 'getBundleContent').mockResolvedValue(fakeContent);

            await (service as any).bundleCollectDeclarations(source, program, '/out/bundle.d.ts');

            expect(mkdir).toHaveBeenCalledWith(expect.stringMatching('/out'), { recursive: true });
            expect(writeFile).toHaveBeenCalledWith('/out/bundle.d.ts', fakeContent, 'utf-8');
        });
    });

    describe('parseAliasRegex', () => {
        test('should return undefined if no paths', () => {
            mockLanguageHost.getCompilationSettings.mockReturnValue({});
            const regex = (service as any).parseAliasRegex();
            expect(regex).toBeUndefined();
        });
    });
});
