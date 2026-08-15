/**
 * Imports
 */

import ts from 'typescript';
import { cwd } from 'process';
import { inject } from '@remotex-labs/xinject';
import { TypescriptService } from './typescript.service';
import { DeclarationModel } from '@typescript/models/declaration.model';
import { LanguageHostService } from '@typescript/services/host.service';

/**
 * Tests
 */

describe('TypescriptService', () => {
    const sourceFile: any = {
        fileName: '/project/src/index.ts',
        getLineAndCharacterOfPosition: (): unknown => ({ line: 2, character: 6 })
    };

    const diagnostic: any = {
        code: 2322, start: 10, category: 1, file: sourceFile, messageText: 'Type error'
    };

    let host: any;
    let config: any;
    let builder: any;
    let program: any;
    let dirCache: any;
    let service: TypescriptService;
    let declaration: any;
    let languageService: any;
    let resolutionCache: any;
    let parseConfigMock: any;
    let resolveModuleMock: any;
    let builderProgramMock: any;
    let resolutionCacheMock: any;

    beforeEach(() => {
        xJet.restoreAllMocks();
        (<any> TypescriptService).cache.clear();

        config = { options: { outDir: 'out' }, fileNames: [ 'src/index.ts' ], errors: [], raw: {} };
        program = {
            getSourceFiles: xJet.fn(() => [ sourceFile ]),
            getSourceFile: xJet.fn((name: string) => name === sourceFile.fileName ? sourceFile : undefined)
        };
        dirCache = { get: xJet.fn(() => undefined) };
        resolutionCache = { getOrCreateCacheForDirectory: xJet.fn(() => dirCache) };
        builder = {
            getSyntacticDiagnostics: xJet.fn(() => []),
            getSemanticDiagnosticsOfNextAffectedFile: xJet.fn(() => undefined)
        };

        languageService = {
            dispose: xJet.fn(),
            getProgram: xJet.fn(() => program),
            getSuggestionDiagnostics: xJet.fn(() => [])
        };

        host = {
            options: undefined,
            realpath: (path: string): string => path,
            readFile: xJet.fn(),
            refreshFiles: xJet.fn(),
            filesCache: {
                touch: xJet.fn(() => ({ version: 1 })),
                resolve: (path: string): string => path.startsWith('/') ? path : `/project/${ path }`
            },
            ignoreSourceFile: xJet.fn(() => false)
        };

        declaration = {
            clear: xJet.fn(),
            emit: xJet.fn(() => Promise.resolve([ 'dist/index.d.ts' ])),
            emitBundle: xJet.fn(() => Promise.resolve([ 'dist/index.d.ts' ]))
        };

        xJet.mock(LanguageHostService, () => host);
        xJet.mock(DeclarationModel, () => declaration);
        xJet.spyOn(ts, 'createDocumentRegistry').mockReturnValue(<any> {});
        xJet.spyOn(ts, 'createLanguageService').mockReturnValue(languageService);
        parseConfigMock = xJet.spyOn(ts, 'getParsedCommandLineOfConfigFile').mockReturnValue(config);
        resolutionCacheMock = xJet.spyOn(ts, 'createModuleResolutionCache').mockReturnValue(resolutionCache);
        builderProgramMock = xJet.spyOn(ts, 'createEmitAndSemanticDiagnosticsBuilderProgram').mockReturnValue(builder);
        resolveModuleMock = xJet.spyOn(ts, 'resolveModuleName').mockReturnValue(<any> { resolvedModule: undefined });

        service = new TypescriptService('tsconfig.json');
    });

    describe('constructor', () => {
        test('should ask the compiler for types alone', () => {
            expect(parseConfigMock).toHaveBeenCalledWith('tsconfig.json', {
                sourceMap: false,
                skipLibCheck: true,
                stripInternal: true,
                declarationMap: false,
                emitDeclarationOnly: true
            }, expect.objectContaining({ onUnRecoverableConfigFileDiagnostic: expect.any(Function) }));
        });

        test('should default the configuration path to tsconfig.json', () => {
            expect(new TypescriptService().configPath).toBe('tsconfig.json');
        });

        test('should default the root directory to the working directory', () => {
            expect(service.config.options.rootDir).toBe(cwd());
            expect(service.config.options.useCaseSensitiveFileNames).toBe(true);
        });

        test('should leave the emit to the bundler', () => {
            expect(service.config.options.noEmit).toBe(true);
        });

        test('should keep a root directory the configuration names', () => {
            config.options.rootDir = 'src';

            expect(new TypescriptService('tsconfig.json').config.options.rootDir).toBe('src');
        });

        test('should fall back to a built-in configuration when the file cannot be read', () => {
            parseConfigMock.mockReturnValue(undefined);

            const options = new TypescriptService('missing.json').config.options;

            expect(options).toEqual(expect.objectContaining({
                strict: true,
                sourceMap: false,
                skipLibCheck: true,
                target: ts.ScriptTarget.ESNext,
                module: ts.ModuleKind.NodeNext,
                emitDeclarationOnly: true
            }));
        });
    });

    describe('check', () => {
        test('should report nothing when the language service has no program', () => {
            languageService.getProgram.mockReturnValue(undefined);

            expect(service.check()).toEqual([]);
            expect(builderProgramMock).not.toHaveBeenCalled();
        });

        test('should format the diagnostics of an affected file with positions counted from one', () => {
            builder.getSemanticDiagnosticsOfNextAffectedFile
                .mockReturnValueOnce({ affected: sourceFile, result: [ diagnostic ] });

            expect(service.check()).toEqual([
                {
                    code: 2322,
                    line: 3,
                    column: 7,
                    category: 1,
                    message: 'Type error',
                    file: '/project/src/index.ts'
                }
            ]);
        });

        test('should carry a diagnostic with no file as its message and category alone', () => {
            builder.getSemanticDiagnosticsOfNextAffectedFile.mockReturnValueOnce({
                affected: sourceFile, result: [{ messageText: 'Bad option', category: 0 }]
            });

            expect(service.check()).toEqual([{ message: 'Bad option', category: 0 }]);
        });

        test('should gather the syntactic and suggestion diagnostics along with the semantic ones', () => {
            builder.getSemanticDiagnosticsOfNextAffectedFile.mockReturnValueOnce({ affected: sourceFile, result: [] });
            builder.getSyntacticDiagnostics.mockReturnValue([{ messageText: 'Syntax', category: 1 }]);
            languageService.getSuggestionDiagnostics.mockReturnValue([{ messageText: 'Suggestion', category: 2 }]);

            expect(service.check()).toEqual([
                { message: 'Syntax', category: 1 },
                { message: 'Suggestion', category: 2 }
            ]);
            expect(languageService.getSuggestionDiagnostics).toHaveBeenCalledWith('/project/src/index.ts');
        });

        test('should skip a dependency without asking the host about it', () => {
            service.check();
            const [ , skip ] = builder.getSemanticDiagnosticsOfNextAffectedFile.mock.calls[0];

            expect(builder.getSemanticDiagnosticsOfNextAffectedFile)
                .toHaveBeenCalledWith(undefined, expect.any(Function));
            expect(skip({ fileName: '/project/node_modules/pkg/index.d.ts' })).toBe(true);
            expect(host.ignoreSourceFile).not.toHaveBeenCalled();
        });

        test('should ask the host about every other file', () => {
            service.check();
            const [ , skip ] = builder.getSemanticDiagnosticsOfNextAffectedFile.mock.calls[0];

            expect(skip(sourceFile)).toBe(false);
            expect(host.ignoreSourceFile).toHaveBeenCalledWith(sourceFile);
        });

        test('should skip the files the host reports as ignored', () => {
            host.ignoreSourceFile.mockReturnValue(true);
            service.check();
            const [ , skip ] = builder.getSemanticDiagnosticsOfNextAffectedFile.mock.calls[0];

            expect(skip(sourceFile)).toBe(true);
        });

        test('should keep the diagnostics of a file the builder did not revisit', () => {
            builder.getSemanticDiagnosticsOfNextAffectedFile
                .mockReturnValueOnce({ affected: sourceFile, result: [ diagnostic ] });
            service.check();

            expect(service.check()).toHaveLength(1);
        });

        test('should drop the cached diagnostics of a file that left the program', () => {
            builder.getSemanticDiagnosticsOfNextAffectedFile
                .mockReturnValueOnce({ affected: sourceFile, result: [ diagnostic ] });
            service.check();
            program.getSourceFile.mockReturnValue(undefined);

            expect(service.check()).toEqual([]);
            expect(service.check()).toEqual([]);
        });

        test('should report the files it was given rather than everything checked', () => {
            builder.getSemanticDiagnosticsOfNextAffectedFile
                .mockReturnValueOnce({ affected: sourceFile, result: [ diagnostic ] });
            service.check();

            expect(service.check(new Set([ '/project/src/index.ts' ]))).toHaveLength(1);
            expect(service.check(new Set([ '/project/src/other.ts' ]))).toEqual([]);
        });

        test('should resolve the names it was given against the paths the compiler reported', () => {
            builder.getSemanticDiagnosticsOfNextAffectedFile
                .mockReturnValueOnce({ affected: sourceFile, result: [ diagnostic ] });
            service.check();

            expect(service.check([ 'src/index.ts' ])).toHaveLength(1);
        });

        test('should read the cache rather than walk it', () => {
            builder.getSemanticDiagnosticsOfNextAffectedFile
                .mockReturnValueOnce({ affected: sourceFile, result: [ diagnostic ] });
            service.check();
            service.check([ 'src/index.ts' ]);

            expect(program.getSourceFiles).not.toHaveBeenCalled();
            expect(program.getSourceFile).toHaveBeenCalledWith('/project/src/index.ts');
        });

        test('should carry the builder of the previous check into the next one', () => {
            service.check();
            service.check();

            expect(builderProgramMock).toHaveBeenLastCalledWith(program, expect.any(Object), builder);
        });
    });

    describe('emit', () => {
        test('should write into the output directory the configuration names', async () => {
            await expect(service.emit({ index: 'src/index.ts' })).resolves.toEqual([ 'dist/index.d.ts' ]);
            expect(declaration.emit).toHaveBeenCalledWith({ index: 'src/index.ts' }, 'out');
        });

        test('should write into the directory it was given', async () => {
            await service.emit({ index: 'src/index.ts' }, 'types');

            expect(declaration.emit).toHaveBeenCalledWith({ index: 'src/index.ts' }, 'types');
        });

        test('should fall back to dist when the configuration names no output directory', async () => {
            delete config.options.outDir;
            await new TypescriptService('tsconfig.json').emit({ index: 'src/index.ts' });

            expect(declaration.emit).toHaveBeenCalledWith({ index: 'src/index.ts' }, 'dist');
        });
    });

    describe('emitBundle', () => {
        test('should bundle into the output directory the configuration names', async () => {
            await expect(service.emitBundle({ index: 'src/index.ts' })).resolves.toEqual([ 'dist/index.d.ts' ]);
            expect(declaration.emitBundle).toHaveBeenCalledWith({ index: 'src/index.ts' }, 'out');
        });

        test('should fall back to dist when the configuration names no output directory', async () => {
            delete config.options.outDir;
            await new TypescriptService('tsconfig.json').emitBundle({ index: 'src/index.ts' }, undefined);

            expect(declaration.emitBundle).toHaveBeenCalledWith({ index: 'src/index.ts' }, 'dist');
        });
    });

    describe('touchFiles', () => {
        test('should refresh the given files through the host', () => {
            service.touchFiles([ 'src/index.ts' ]);

            expect(host.refreshFiles).toHaveBeenCalledWith([ 'src/index.ts' ]);
        });
    });

    describe('resolve', () => {
        test('should attach the container and the relative path to a fresh resolution', () => {
            resolveModuleMock.mockReturnValue(<any> {
                resolvedModule: { resolvedFileName: '/project/src/components/builder.ts' }
            });

            expect(service.resolve('@components/builder', '/project/src/index.ts')).toEqual({
                container: '/project/src',
                resolvedFileName: '/project/src/components/builder.ts',
                relativeFileName: './components/builder.ts'
            });
        });

        test('should keep a relative path that already names its own directory', () => {
            resolveModuleMock.mockReturnValue(<any> {
                resolvedModule: { resolvedFileName: '/project/lib/builder.ts' }
            });

            expect(service.resolve('../lib/builder', '/project/src/index.ts')?.relativeFileName)
                .toBe('../lib/builder.ts');
        });

        test('should serve a cached resolution without asking the compiler again', () => {
            const cached = { resolvedFileName: '/project/src/a.ts' };
            dirCache.get.mockReturnValue({ resolvedModule: cached });

            expect(service.resolve('./a', '/project/src/index.ts')).toBe(cached);
            expect(resolveModuleMock).not.toHaveBeenCalled();
        });

        test('should stand the working directory in for a missing containing file', () => {
            service.resolve('typescript');

            expect(resolutionCache.getOrCreateCacheForDirectory).toHaveBeenCalledWith(cwd());
            expect(resolveModuleMock).toHaveBeenCalledWith(
                'typescript', '', service.config.options, host, resolutionCache
            );
        });

        test('should return undefined when the specifier resolves to nothing', () => {
            expect(service.resolve('nowhere', '/project/src/index.ts')).toBeUndefined();
        });
    });

    describe('reload', () => {
        test('should reparse the configuration and drop everything derived from it', () => {
            const shared = inject(TypescriptService, 'tsconfig.json');
            const parsed = { options: {}, fileNames: [ 'src/other.ts' ], errors: [], raw: {} };
            shared.check();
            parseConfigMock.mockReturnValue(parsed);
            host.filesCache.touch.mockReturnValue({ version: 2 });

            expect(TypescriptService.reload()).toEqual([ 'tsconfig.json' ]);
            expect(shared.config).toBe(parsed);
            expect(host.options).toBe(parsed);
            expect(declaration.clear).toHaveBeenCalled();
            expect(resolutionCacheMock).toHaveBeenLastCalledWith(
                expect.any(String), expect.any(Function), parsed.options
            );
        });

        test('should leave the instance alone while the configuration file is unchanged', () => {
            inject(TypescriptService, 'tsconfig.json');

            expect(TypescriptService.reload()).toEqual([]);
            expect(host.filesCache.touch).toHaveBeenCalledWith('tsconfig.json');
            expect(declaration.clear).not.toHaveBeenCalled();
        });

        test('should reparse only the shared instances whose configuration changed', () => {
            inject(TypescriptService, 'tsconfig.json');
            inject(TypescriptService, 'tsconfig.build.json');
            host.filesCache.touch.mockImplementation((path: string) => ({
                version: path === 'tsconfig.build.json' ? 2 : 1
            }));

            expect(TypescriptService.reload()).toEqual([ 'tsconfig.build.json' ]);
        });

        test('should leave an instance the shared cache never held out of the walk', () => {
            host.filesCache.touch.mockReturnValue({ version: 2 });

            expect(TypescriptService.reload()).toEqual([]);
            expect(service.config).toBe(config);
            expect(declaration.clear).not.toHaveBeenCalled();
        });

        test('should make the next check a full pass', () => {
            const shared = inject(TypescriptService, 'tsconfig.json');
            host.filesCache.touch.mockReturnValue({ version: 2 });
            shared.check();
            TypescriptService.reload();
            shared.check();

            expect(builderProgramMock).toHaveBeenLastCalledWith(program, expect.any(Object), undefined);
        });

        test('should drop the diagnostics cached before it', () => {
            const shared = inject(TypescriptService, 'tsconfig.json');
            builder.getSemanticDiagnosticsOfNextAffectedFile
                .mockReturnValueOnce({ affected: sourceFile, result: [ diagnostic ] });
            host.filesCache.touch.mockReturnValue({ version: 2 });
            shared.check();
            TypescriptService.reload();

            expect(shared.check()).toEqual([]);
        });
    });

    describe('dispose', () => {
        test('should share one instance per normalized configuration path', () => {
            expect(inject(TypescriptService, './tsconfig.json')).toBe(inject(TypescriptService, 'tsconfig.json'));
        });

        test('should tear the language service down only once the last holder releases it', () => {
            const shared = inject(TypescriptService, 'tsconfig.json');
            inject(TypescriptService, 'tsconfig.json');

            shared.dispose();
            expect(languageService.dispose).not.toHaveBeenCalled();

            shared.dispose();
            expect(languageService.dispose).toHaveBeenCalled();
        });

        test('should do nothing for an instance the shared cache never held', () => {
            service.dispose();

            expect(languageService.dispose).not.toHaveBeenCalled();
        });

        test('should release the instance when it leaves a using scope', () => {
            {
                using scoped = inject(TypescriptService, 'tsconfig.json');
                expect(scoped.configPath).toBe('tsconfig.json');
            }

            expect(languageService.dispose).toHaveBeenCalled();
        });
    });
});
