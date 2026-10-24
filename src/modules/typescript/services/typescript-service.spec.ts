/**
 * Imports
 */

import { cwd } from 'process';
import { inject } from '@remotex-labs/xinject';
import { normalize } from '@remotex-labs/xmap';
import { TypescriptService } from './typescript.service';
import { DeclarationModel } from '@typescript/models/declaration.model';
import { LanguageHostService } from '@typescript/services/host.service';

/**
 * Tests
 */

describe('TypescriptService', () => {
    const root = normalize(cwd());
    const index = `${ root }/src/index.ts`;

    const diagnostic: any = {
        code: 2322, category: 1, text: 'Type error', fileName: index, startPosition: { line: 2, character: 6 }
    };

    let api: any;
    let host: any;
    let config: any;
    let program: any;
    let service: TypescriptService;
    let resolver: any;
    let snapshots: Array<any>;
    let declaration: any;

    /**
     * Builds a snapshot holding the shared program, recording it so a test can tell the snapshots apart.
     */

    function makeSnapshot(): any {
        const snapshot = {
            operation: { createdPrograms: [ program ] },
            update: xJet.fn(() => makeSnapshot()),
            dispose: xJet.fn(),
            getProgram: xJet.fn(() => program)
        };

        snapshots.push(snapshot);

        return snapshot;
    }

    beforeEach(() => {
        xJet.restoreAllMocks();
        (<any> TypescriptService).cache.clear();

        snapshots = [];
        config = { options: { outDir: 'out' }, fileNames: [ 'src/index.ts' ], errors: [], raw: {} };
        program = {
            id: '/dev/null/synthetic/1',
            getSourceFileNames: xJet.fn(() => [ index ]),
            getSyntacticDiagnostics: xJet.fn(() => []),
            getSemanticDiagnostics: xJet.fn(() => []),
            getSuggestionDiagnostics: xJet.fn(() => [])
        };

        resolver = {
            dispose: xJet.fn(),
            resolveModuleName: xJet.fn(() => ({ resolvedModule: undefined }))
        };

        api = {
            close: xJet.fn(),
            createSnapshot: xJet.fn(() => makeSnapshot()),
            parseConfigFile: xJet.fn(() => config),
            createModuleResolver: xJet.fn(() => resolver),
            parseJsonConfigFileContent: xJet.fn((json: any) => ({
                options: { ...json.compilerOptions }, fileNames: [], errors: [], raw: json
            }))
        };

        host = {
            options: undefined,
            observe: xJet.fn(),
            realpath: (path: string): string => path,
            readFile: xJet.fn(),
            isExcluded: xJet.fn(() => false),
            refreshFiles: xJet.fn(),
            collectChanges: xJet.fn(() => []),
            getScriptFileNames: xJet.fn(() => [ index ]),
            filesCache: {
                touch: xJet.fn(() => ({ version: 1 })),
                resolve: (path: string): string => path.startsWith('/') ? path : `${ root }/${ path }`
            }
        };

        declaration = {
            clear: xJet.fn(),
            emit: xJet.fn(() => Promise.resolve([ 'dist/index.d.ts' ])),
            emitBundle: xJet.fn(() => Promise.resolve([ 'dist/index.d.ts' ]))
        };

        (<any> TypescriptService).client = api;
        xJet.mock(LanguageHostService, () => host);
        xJet.mock(DeclarationModel, () => declaration);

        service = new TypescriptService('tsconfig.json');
    });

    afterEach(() => {
        (<any> TypescriptService).client = undefined;
    });

    describe('constructor', () => {
        test('should parse the configuration it was given', () => {
            expect(api.parseConfigFile).toHaveBeenCalledWith('tsconfig.json');
        });

        test('should ask the compiler for types alone', () => {
            expect(service.config.options).toEqual(expect.objectContaining({
                sourceMap: false,
                skipLibCheck: true,
                stripInternal: true,
                declarationMap: false,
                emitDeclarationOnly: true
            }));
        });

        test('should default the configuration path to tsconfig.json', () => {
            expect(new TypescriptService().configPath).toBe('tsconfig.json');
        });

        test('should default the root directory to the working directory', () => {
            expect(service.config.options.rootDir).toBe(cwd());
        });

        test('should leave the emit to the bundler', () => {
            expect(service.config.options.noEmit).toBe(true);
        });

        test('should keep a root directory the configuration names', () => {
            config.options.rootDir = 'src';

            expect(new TypescriptService('tsconfig.json').config.options.rootDir).toBe('src');
        });

        test('should fall back to a built-in configuration when the file cannot be read', () => {
            api.parseConfigFile.mockImplementation(() => {
                throw new Error('could not read file');
            });

            const options = new TypescriptService('missing.json').config.options;

            expect(options).toEqual(expect.objectContaining({
                strict: true,
                target: 'esnext',
                module: 'nodenext',
                sourceMap: false,
                skipLibCheck: true,
                emitDeclarationOnly: true
            }));
            expect(api.parseJsonConfigFileContent).toHaveBeenCalledWith(
                expect.objectContaining({ files: [] }), { configDirectory: cwd() }
            );
        });

        test('should leave the compiler alone until the program is first asked for', () => {
            expect(api.createSnapshot).not.toHaveBeenCalled();
        });
    });

    describe('program', () => {
        test('should build the program from the host roots under the parsed options', () => {
            expect(service.program).toBe(program);
            expect(api.createSnapshot).toHaveBeenCalledWith({
                fileNotifications: undefined,
                createPrograms: [{ rootFiles: [ index ], compilerOptions: service.config.options }]
            });
        });

        test('should record the versions of the files the program read', () => {
            void service.program;

            expect(host.observe).toHaveBeenCalledWith(new Set([ index ]));
        });

        test('should keep the program while nothing changed', () => {
            void service.program;
            void service.program;

            expect(api.createSnapshot).toHaveBeenCalledTimes(1);
            expect(snapshots[0].update).not.toHaveBeenCalled();
        });

        test('should tell the compiler which files changed and drop the snapshot it replaces', () => {
            void service.program;
            host.collectChanges.mockReturnValueOnce([ index ]);
            void service.program;

            expect(snapshots[0].update).toHaveBeenCalledWith({
                fileNotifications: { changed: [ index ] },
                reconfigurePrograms: [{
                    id: program.id, rootFiles: [ index ], compilerOptions: service.config.options
                }]
            });
            expect(snapshots[0].dispose).toHaveBeenCalled();
        });

        test('should rebuild once a root joins the project', () => {
            void service.program;
            host.getScriptFileNames.mockReturnValue([ index, `${ root }/src/other.ts` ]);
            void service.program;

            expect(snapshots[0].update).toHaveBeenCalledTimes(1);
        });
    });

    describe('hasSourceFile', () => {
        test('should report whether the program holds a file', () => {
            expect(service.hasSourceFile(index)).toBe(true);
            expect(service.hasSourceFile(`${ root }/src/other.ts`)).toBe(false);
        });
    });

    describe('check', () => {
        test('should format the diagnostics with positions counted from one and the path made relative', () => {
            program.getSemanticDiagnostics.mockReturnValue([ diagnostic ]);

            expect(service.check()).toEqual([
                {
                    code: 2322,
                    line: 3,
                    column: 7,
                    category: 1,
                    message: 'Type error',
                    file: 'src/index.ts'
                }
            ]);
        });

        test('should flatten a chained message the way the compiler prints it', () => {
            program.getSemanticDiagnostics.mockReturnValue([{
                ...diagnostic,
                text: 'Outer',
                messageChain: [{ text: 'Inner', messageChain: [{ text: 'Deepest' }] }]
            }]);

            expect(service.check()[0].message).toBe('Outer\n  Inner\n    Deepest');
        });

        test('should pass over a diagnostic with no file', () => {
            program.getSemanticDiagnostics.mockReturnValue([{ text: 'Bad option', category: 0 }]);

            expect(service.check()).toEqual([]);
        });

        test('should gather the syntactic and suggestion diagnostics along with the semantic ones', () => {
            program.getSyntacticDiagnostics.mockReturnValue([{ ...diagnostic, text: 'Syntax' }]);
            program.getSuggestionDiagnostics.mockReturnValue([{ ...diagnostic, text: 'Suggestion', category: 2 }]);

            expect(service.check().map(({ message }) => message)).toEqual([ 'Syntax', 'Suggestion' ]);
            expect(program.getSuggestionDiagnostics).toHaveBeenCalledWith([ index ]);
        });

        test('should skip a dependency without asking the host about it', () => {
            program.getSourceFileNames.mockReturnValue([ index, `${ root }/node_modules/pkg/index.d.ts` ]);
            service.check();

            expect(program.getSemanticDiagnostics).toHaveBeenCalledWith([ index ]);
            expect(host.isExcluded).toHaveBeenCalledTimes(1);
        });

        test('should skip the files the host reports as excluded', () => {
            host.isExcluded.mockReturnValue(true);
            service.check();

            expect(program.getSemanticDiagnostics).not.toHaveBeenCalled();
        });

        test('should check once per snapshot', () => {
            program.getSemanticDiagnostics.mockReturnValue([ diagnostic ]);
            service.check();

            expect(service.check()).toHaveLength(1);
            expect(program.getSemanticDiagnostics).toHaveBeenCalledTimes(1);
        });

        test('should check again once a file changed', () => {
            service.check();
            host.collectChanges.mockReturnValueOnce([ index ]);
            service.check();

            expect(program.getSemanticDiagnostics).toHaveBeenCalledTimes(2);
        });

        test('should drop the cached diagnostics of a file that left the program', () => {
            program.getSemanticDiagnostics.mockReturnValue([ diagnostic ]);
            service.check();
            program.getSourceFileNames.mockReturnValue([]);
            host.collectChanges.mockReturnValueOnce([ index ]);

            expect(service.check([ index ])).toEqual([]);
        });

        test('should report the files it was given rather than everything checked', () => {
            program.getSemanticDiagnostics.mockReturnValue([ diagnostic ]);
            service.check();

            expect(service.check(new Set([ index ]))).toHaveLength(1);
            expect(service.check(new Set([ `${ root }/src/other.ts` ]))).toEqual([]);
        });

        test('should resolve the names it was given against the paths the compiler reported', () => {
            program.getSemanticDiagnostics.mockReturnValue([ diagnostic ]);

            expect(service.check([ 'src/index.ts' ])).toHaveLength(1);
        });
    });

    describe('excludeTypeChack', () => {
        /**
         * The files the check handed the compiler, taken from the last semantic request.
         */

        function checkedBy(instance: TypescriptService, files: Array<string>): Array<string> {
            program.getSourceFileNames.mockReturnValue(files.map(file => `${ root }/${ file }`));
            program.getSemanticDiagnostics.mockClear();
            host.collectChanges.mockReturnValueOnce([ 'moved' ]);
            instance.check();

            const calls = program.getSemanticDiagnostics.mock.calls;

            return calls.length ? calls[0][0].map((file: string) => file.slice(root.length + 1)) : [];
        }

        test('should turn away a file the configuration excludes', () => {
            config.raw = { excludeTypeChack: [ 'src/generated/**' ] };
            const instance = new TypescriptService('tsconfig.json');

            expect(checkedBy(instance, [ 'src/generated/api.ts', 'src/index.ts' ])).toEqual([ 'src/index.ts' ]);
        });

        test('should test the path relative to the working directory', () => {
            config.raw = { excludeTypeChack: [ '**/*.generated.ts' ] };
            const instance = new TypescriptService('tsconfig.json');

            expect(checkedBy(instance, [ 'src/models/user.generated.ts', 'src/models/user.ts' ]))
                .toEqual([ 'src/models/user.ts' ]);
        });

        test('should turn nothing away where the configuration names an empty list', () => {
            config.raw = { excludeTypeChack: [] };
            const instance = new TypescriptService('tsconfig.json');

            expect(checkedBy(instance, [ 'src/index.ts' ])).toEqual([ 'src/index.ts' ]);
        });

        test('should turn nothing away where the configuration names no exclusion at all', () => {
            config.raw = undefined;
            const instance = new TypescriptService('tsconfig.json');

            expect(checkedBy(instance, [ 'src/index.ts' ])).toEqual([ 'src/index.ts' ]);
        });

        test('should take up an edit to the list on a reload', () => {
            const shared = inject(TypescriptService, 'tsconfig.json');
            expect(checkedBy(shared, [ 'src/generated/api.ts' ])).toEqual([ 'src/generated/api.ts' ]);

            api.parseConfigFile.mockReturnValue({
                ...config, raw: { excludeTypeChack: [ 'src/generated/**' ] }
            });
            host.filesCache.touch.mockReturnValue({ version: 2 });
            TypescriptService.reload();

            expect(checkedBy(shared, [ 'src/generated/api.ts' ])).toEqual([]);
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
        test('should resolve against the directory of the containing file', () => {
            service.resolve('@components/builder', `${ root }/src/index.ts`);

            expect(api.createModuleResolver).toHaveBeenCalledWith(service.config.options);
            expect(resolver.resolveModuleName).toHaveBeenCalledWith('@components/builder', `${ root }/src`);
        });

        test('should attach the container and the relative path to a fresh resolution', () => {
            resolver.resolveModuleName.mockReturnValue({
                resolvedModule: { resolvedFileName: `${ root }/src/components/builder.ts` }
            });

            expect(service.resolve('@components/builder', `${ root }/src/index.ts`)).toEqual({
                container: `${ root }/src`,
                resolvedFileName: `${ root }/src/components/builder.ts`,
                relativeFileName: './components/builder.ts'
            });
        });

        test('should keep a relative path that already names its own directory', () => {
            resolver.resolveModuleName.mockReturnValue({
                resolvedModule: { resolvedFileName: `${ root }/lib/builder.ts` }
            });

            expect(service.resolve('../lib/builder', `${ root }/src/index.ts`)?.relativeFileName)
                .toBe('../lib/builder.ts');
        });

        test('should serve a cached resolution without asking the compiler again', () => {
            resolver.resolveModuleName.mockReturnValue({ resolvedModule: { resolvedFileName: `${ root }/src/a.ts` } });
            const first = service.resolve('./a', `${ root }/src/index.ts`);

            expect(service.resolve('./a', `${ root }/src/index.ts`)).toBe(first);
            expect(resolver.resolveModuleName).toHaveBeenCalledTimes(1);
            expect(api.createModuleResolver).toHaveBeenCalledTimes(1);
        });

        test('should ask again for a specifier that resolved to nothing', () => {
            service.resolve('./a', `${ root }/src/index.ts`);
            service.resolve('./a', `${ root }/src/index.ts`);

            expect(resolver.resolveModuleName).toHaveBeenCalledTimes(2);
        });

        test('should stand the working directory in for a missing containing file', () => {
            service.resolve('typescript');

            expect(resolver.resolveModuleName).toHaveBeenCalledWith('typescript', cwd());
        });

        test('should return undefined when the specifier resolves to nothing', () => {
            expect(service.resolve('nowhere', `${ root }/src/index.ts`)).toBeUndefined();
        });
    });

    describe('reload', () => {
        test('should reparse the configuration and drop everything derived from it', () => {
            const shared = inject(TypescriptService, 'tsconfig.json');
            const parsed = { options: {}, fileNames: [ 'src/other.ts' ], errors: [], raw: {} };
            shared.resolve('typescript');
            api.parseConfigFile.mockReturnValue(parsed);
            host.filesCache.touch.mockReturnValue({ version: 2 });

            expect(TypescriptService.reload()).toEqual([ 'tsconfig.json' ]);
            expect(shared.config).toBe(parsed);
            expect(host.options).toBe(parsed);
            expect(declaration.clear).toHaveBeenCalled();
            expect(resolver.dispose).toHaveBeenCalled();
        });

        test('should leave the instance alone while the configuration file is unchanged', () => {
            inject(TypescriptService, 'tsconfig.json');

            expect(TypescriptService.reload()).toEqual([]);
            expect(host.filesCache.touch).toHaveBeenCalledWith('tsconfig.json');
            expect(declaration.clear).not.toHaveBeenCalled();
        });

        test('should reparse every shared instance when forced', () => {
            inject(TypescriptService, 'tsconfig.json');

            expect(TypescriptService.reload(true)).toEqual([ 'tsconfig.json' ]);
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

        test('should rebuild the program under the new options', () => {
            const shared = inject(TypescriptService, 'tsconfig.json');
            shared.check();
            host.filesCache.touch.mockReturnValue({ version: 2 });
            TypescriptService.reload();
            shared.check();

            expect(snapshots[0].update).toHaveBeenCalledTimes(1);
            expect(program.getSemanticDiagnostics).toHaveBeenCalledTimes(2);
        });

        test('should drop the diagnostics cached before it', () => {
            const shared = inject(TypescriptService, 'tsconfig.json');
            program.getSemanticDiagnostics.mockReturnValueOnce([ diagnostic ]);
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

        test('should tear the program down only once the last holder releases it', () => {
            const shared = inject(TypescriptService, 'tsconfig.json');
            inject(TypescriptService, 'tsconfig.json');
            void shared.program;

            shared.dispose();
            expect(snapshots[0].dispose).not.toHaveBeenCalled();

            shared.dispose();
            expect(snapshots[0].dispose).toHaveBeenCalled();
        });

        test('should close the compiler once the last instance in the process is released', () => {
            const shared = inject(TypescriptService, 'tsconfig.json');
            const other = inject(TypescriptService, 'tsconfig.build.json');

            shared.dispose();
            expect(api.close).not.toHaveBeenCalled();

            other.dispose();
            expect(api.close).toHaveBeenCalled();
        });

        test('should do nothing for an instance the shared cache never held', () => {
            void service.program;
            service.dispose();

            expect(snapshots[0].dispose).not.toHaveBeenCalled();
            expect(api.close).not.toHaveBeenCalled();
        });

        test('should release the instance when it leaves a using scope', () => {
            {
                using scoped = inject(TypescriptService, 'tsconfig.json');
                expect(scoped.configPath).toBe('tsconfig.json');
            }

            expect(api.close).toHaveBeenCalled();
        });
    });
});
