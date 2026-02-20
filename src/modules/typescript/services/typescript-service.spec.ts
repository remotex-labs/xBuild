/**
 * Imports
 */

import ts from 'typescript';
import { resolve } from 'path';
import { join } from 'path/posix';
import { TypescriptService } from '@typescript/services/typescript.service';

/**
 * Tests
 */

describe('TypescriptService', () => {
    let service: TypescriptService;
    let languageHostService: any;

    const fakeConfigPath = '/project/root/tsconfig.json';
    const fakeFileName = '/project/root/src/index.ts';

    beforeEach(() => {
        xJet.resetAllMocks();

        // Reset static cache
        (TypescriptService as any).serviceCache.clear();

        languageHostService = {
            getCompilationSettings: () => ({ outDir: '/project/root/dist' }),
            getScriptVersion: () => '1',
            hasScriptSnapshot: () => false,
            touchFile: xJet.fn(),
            touchFiles: xJet.fn(),
            options: {},
            aliasRegex: /@app\/[^'"]*/
        };

        xJet.mock(resolve).mockImplementation((path: string): string => {
            if (path.includes('/project/root')) return path;

            return join('/project/root', path);
        });

        // Mock config parsing with realistic fileNames
        xJet.mock(ts.getParsedCommandLineOfConfigFile).mockReturnValue({
            options: { strict: true, target: ts.ScriptTarget.ESNext },
            fileNames: [ fakeFileName ],
            errors: []
        } as any);

        // Mock language service creation
        xJet.mock(ts.createLanguageService).mockReturnValue({
            getProgram: () => ({
                getSourceFiles: () => [{ fileName: fakeFileName, isDeclarationFile: false }]
            }),
            getSemanticDiagnostics: xJet.fn().mockReturnValue([]),
            getSyntacticDiagnostics: xJet.fn().mockReturnValue([]),
            getSuggestionDiagnostics: xJet.fn().mockReturnValue([]),
            dispose: xJet.fn()
        } as any);

        xJet.mock(ts.createDocumentRegistry).mockReturnValue({} as any);

        service = new TypescriptService(fakeConfigPath);
        (service as any).languageHostService = languageHostService; // override
    });

    afterAll(() => {
        xJet.restoreAllMocks();
    });

    describe('constructor & service caching', () => {
        test('creates language service from config and caches it', () => {
            expect((TypescriptService as any).serviceCache.size).toBe(1);
            expect((TypescriptService as any).serviceCache.get(fakeConfigPath)!.refCount).toBe(1);
        });

        test('reuses cached service on second instance', () => {
            const firstRefCount = (TypescriptService as any).serviceCache.get(fakeConfigPath)!.refCount;
            expect(firstRefCount).toBe(1);

            new TypescriptService(fakeConfigPath);

            expect((TypescriptService as any).serviceCache.get(fakeConfigPath)!.refCount).toBe(2);
        });
    });

    describe('touchFiles', () => {
        test('touches tracked files and reparses config when tsconfig touched', () => {
            const cached = (TypescriptService as any).serviceCache.get(fakeConfigPath)!;

            cached.config = { options: {}, fileNames: [] };
            service.touchFiles([ fakeFileName, fakeConfigPath ]);

            expect(languageHostService.touchFile).not.toHaveBeenCalledWith(fakeFileName); // not track file
            expect(ts.getParsedCommandLineOfConfigFile).toHaveBeenCalledWith(fakeConfigPath, expect.any(Object), expect.any(Object));
            expect(cached.config).toBeDefined();

            expect(cached.host.compilerOptions).toEqual(cached.config.options);
        });

        test('skips untracked files', () => {
            service.touchFiles([ '/untracked/file.ts' ]);

            expect(languageHostService.touchFile).not.toHaveBeenCalled();
        });
    });

    describe('check diagnostics', () => {
        test('returns empty diagnostics when no source files', () => {
            (service.languageService as any).getProgram = () => null;

            const diagnostics = service.check();

            expect(diagnostics).toEqual([]);
        });

        test('skips node_modules and declaration files', () => {
            (service.languageService as any).getProgram = () => ({
                getSourceFiles: () => [
                    { fileName: fakeFileName, isDeclarationFile: false },
                    { fileName: '/node_modules/lib.d.ts', isDeclarationFile: false },
                    { fileName: '/project/root/types.d.ts', isDeclarationFile: true }
                ]
            }) as any;

            const diagnostics = service.check();

            expect(diagnostics.length).toBe(0);
        });

        test('collects semantic/syntactic/suggestion diagnostics', () => {
            const fakeDiag = {
                file: { fileName: fakeFileName, getLineAndCharacterOfPosition: () => ({ line: 0, character: 0 }) },
                messageText: 'Test error',
                category: ts.DiagnosticCategory.Error,
                code: 1234,
                start: 10
            } as any;

            (service.languageService as any).getProgram = () => ({
                getSourceFiles: () => [{ fileName: fakeFileName, isDeclarationFile: false }]
            }) as any;

            xJet.mock(service.languageService.getSemanticDiagnostics).mockReturnValue([ fakeDiag ]);
            xJet.mock(service.languageService.getSyntacticDiagnostics).mockReturnValue([ fakeDiag ]);
            xJet.mock(service.languageService.getSuggestionDiagnostics).mockReturnValue([ fakeDiag ]);

            const diagnostics = service.check();

            expect(diagnostics).toHaveLength(3);
            expect(diagnostics[0]).toEqual({
                message: 'Test error',
                file: fakeFileName,
                line: 1,
                column: 1,
                code: 1234,
                category: ts.DiagnosticCategory.Error
            });
        });
    });

    describe('emit & emitBundle delegation', () => {
        test('delegates emit to EmitterService', async () => {
            const emitterMock = { emit: xJet.fn() } as any;
            (service as any).emitterService = emitterMock;

            await service.emit('/custom/dist');

            expect(emitterMock.emit).toHaveBeenCalledWith('/custom/dist');
        });

        test('delegates emitBundle to BundlerService', async () => {
            const bundlerMock = { emit: xJet.fn() } as any;
            (service as any).bundlerService = bundlerMock;

            await service.emitBundle({ 'bundle': fakeFileName });

            expect(bundlerMock.emit).toHaveBeenCalledWith({ 'bundle': fakeFileName }, undefined);
        });
    });

    describe('dispose & cleanup', () => {
        test('decrements refCount and cleans up zero-ref services', () => {
            const cached = (TypescriptService as any).serviceCache.get(fakeConfigPath)!;
            cached.refCount = 2;
            cached.service = { dispose: xJet.fn() } as any;

            service.dispose(fakeConfigPath);

            expect(cached.refCount).toBe(1);

            cached.refCount = 0;
            (TypescriptService as any).cleanupUnusedServices();

            expect((TypescriptService as any).serviceCache.size).toBe(0);
            expect(cached.service.dispose).toHaveBeenCalled();
        });

        test('ignores unknown config path', () => {
            expect(() => service.dispose('/unknown/config.json')).not.toThrow();
        });
    });
});
