/**
 * Import will remove at compile time
 */

import type { MockState } from '@remotex-labs/xjet';

/**
 * Imports
 */

import ts from 'typescript';
import { resolve } from 'path';
import { join } from 'path/posix';
import { closeSync, fstatSync, openSync, readFileSync } from 'fs';
import { LanguageHostService } from '@typescript/services/hosts.service';

/**
 * Tests
 */

describe('LanguageHostService', () => {
    let host: LanguageHostService;
    let resolveModuleNameMock: MockState;
    let openSyncMock: MockState;
    let readFileSyncMock: MockState;

    const MOCK_FD = 42;

    const defaultOptions = {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext
    };

    beforeEach(() => {
        xJet.resetAllMocks();
        host = new LanguageHostService(defaultOptions);

        xJet.mock(resolve).mockImplementation((...args: string[]) => {
            return join('/project/root/', ...args);
        });

        openSyncMock = xJet.mock(openSync).mockReturnValue(MOCK_FD);
        xJet.mock(closeSync).mockImplementation(() => undefined);
        xJet.mock(fstatSync).mockReturnValue({ mtimeMs: 1000 } as any);
        readFileSyncMock = xJet.mock(readFileSync).mockReturnValue('export const x = 10;');

        resolveModuleNameMock = xJet.mock(ts.resolveModuleName);

        xJet.mock(ts.getDefaultLibFilePath).mockReturnValue(
            '/typescript/lib/lib.es2020.d.ts'
        );
    });

    afterAll(() => {
        xJet.restoreAllMocks();
    });

    describe('constructor & options', () => {
        test('uses provided compiler options', () => {
            expect(host.getCompilationSettings()).toEqual(defaultOptions);
        });

        test('generates alias regex when paths are configured', () => {
            const hostWithPaths = new LanguageHostService({
                paths: {
                    '@app/*': [ 'src/app/*' ],
                    '@utils/*': [ 'src/utils/*' ]
                }
            });

            expect(hostWithPaths.aliasRegex).toBeDefined();
            expect(hostWithPaths.aliasRegex!.test('import { foo } from \'@app/component\';')).toBe(true);
        });

        test('aliasRegex is undefined when no paths', () => {
            expect(host.aliasRegex).toBeUndefined();
        });

        test('updating options regenerates alias regex and cache', () => {
            const initialCache = (host as any).moduleResolutionCache;

            host.options = {
                ...defaultOptions,
                paths: { '@core/*': [ 'src/core/*' ] }
            };

            expect(host.aliasRegex).toBeDefined();
            expect((host as any).moduleResolutionCache).not.toBe(initialCache);
        });
    });

    describe('touchFile / touchFiles', () => {
        test('delegates to FilesModel.touchFile', () => {
            const snap = host.touchFile('./src/someFile.ts');

            expect(snap.version).toBe(1);
            expect(openSyncMock).toHaveBeenCalledTimes(1);
            expect(readFileSyncMock).toHaveBeenCalledTimes(1);
        });

        test('touchFiles calls touchFile for each path', () => {
            host.touchFiles([ './src/a.ts', './src/b.ts', './src/c.ts' ]);

            expect(openSyncMock).toHaveBeenCalledTimes(3);
            expect(readFileSyncMock).toHaveBeenCalledTimes(3);
        });
    });

    describe('getScriptSnapshot & getScriptVersion', () => {
        test('returns snapshot from cache if exists', () => {
            host.touchFile('./src/index.ts');

            const snapshot = host.getScriptSnapshot('./src/index.ts');

            expect(snapshot).toBeDefined();
            expect(snapshot!.getText(0, 20)).toContain('export const x = 10');
            expect(readFileSyncMock).toHaveBeenCalledTimes(1); // only once – served from cache
        });

        test('touches file and creates snapshot if not cached yet', () => {
            const snapshot = host.getScriptSnapshot('./src/new-file.ts');

            expect(snapshot).toBeDefined();
            expect(openSyncMock).toHaveBeenCalledTimes(1);
            expect(readFileSyncMock).toHaveBeenCalledTimes(1);
        });

        test('getScriptVersion returns string version and tracks file', () => {
            host.touchFile('./src/index.ts');
            const version = host.getScriptVersion('./src/index.ts');

            expect(version).toBe('1');
            expect(host.getScriptFileNames()).toContain('/project/root/src/index.ts');
        });

        test('getScriptVersion returns "0" for unknown file and tracks it', () => {
            const version = host.getScriptVersion('./src/unknown.ts');

            expect(version).toBe('0');
            expect(host.getScriptFileNames()).toContain('/project/root/src/unknown.ts');
        });
    });

    describe('getScriptFileNames & hasScriptSnapshot', () => {
        test('getScriptFileNames returns tracked files', () => {
            host.touchFile('./src/a.ts');
            host.getScriptSnapshot('./src/b.ts'); // auto-tracks
            host.getScriptVersion('./src/c.ts');  // auto-tracks

            const names = host.getScriptFileNames();

            expect(names).toHaveLength(3);
            expect(names).toContain('/project/root/src/a.ts');
            expect(names).toContain('/project/root/src/b.ts');
            expect(names).toContain('/project/root/src/c.ts');
        });

        test('hasScriptSnapshot checks tracked status', () => {
            expect(host.hasScriptSnapshot('./src/not-yet.ts')).toBe(false);

            host.touchFile('./src/not-yet.ts');

            expect(host.hasScriptSnapshot('./src/not-yet.ts')).toBe(true);
        });
    });

    describe('resolveModuleName', () => {
        test('uses ts.resolveModuleName with correct parameters and cache', () => {
            const fakeResult = { resolvedModule: null, failedLookupLocations: [] };

            resolveModuleNameMock.mockReturnValue(fakeResult);

            const result = host.resolveModuleName('@utils/helper', '/project/root/src/index.ts');

            expect(ts.resolveModuleName).toHaveBeenCalledWith(
                '@utils/helper',
                '/project/root/src/index.ts',
                expect.any(Object),
                ts.sys,
                expect.any(Object)
            );

            expect(result).toBe(fakeResult);
        });
    });

    describe('default lib & sys delegation', () => {
        test('getDefaultLibFileName delegates to ts.getDefaultLibFilePath', () => {
            const path = host.getDefaultLibFileName({ target: ts.ScriptTarget.ES2022 });

            expect(ts.getDefaultLibFilePath).toHaveBeenCalledWith(expect.objectContaining({
                target: ts.ScriptTarget.ES2022
            }));

            expect(path).toBe('/typescript/lib/lib.es2020.d.ts');
        });

        test('fileExists delegates to ts.sys', () => {
            xJet.mock(ts.sys.fileExists).mockReturnValue(true);

            expect(host.fileExists('/project/root/src/index.ts')).toBe(true);
            expect(ts.sys.fileExists).toHaveBeenCalledWith('/project/root/src/index.ts');
        });

        test('readFile delegates to ts.sys', () => {
            xJet.mock(ts.sys.readFile).mockReturnValue('content from sys');

            expect(host.readFile('/project/root/file.ts')).toBe('content from sys');
        });
    });

    describe('alias regex generation edge cases', () => {
        test('escapes special characters in alias keys', () => {
            const hostWithSpecial = new LanguageHostService({
                paths: {
                    '@core+old/*': [ 'src/old/*' ],
                    '@v2.*': [ 'src/v2/*' ]
                }
            });

            expect(hostWithSpecial.aliasRegex).toBeDefined();
            expect(
                hostWithSpecial.aliasRegex!.test('import x from \'@core+old/button\';')
            ).toBe(true);
        });

        test('no alias regex when paths is empty object', () => {
            const hostEmptyPaths = new LanguageHostService({ paths: {} });
            expect(hostEmptyPaths.aliasRegex).toBeUndefined();
        });
    });

    describe('readDirectory', () => {
        test('delegates to ts.sys.readDirectory with correct parameters', () => {
            const mockResult = [ '/project/root/src/file1.ts', '/project/root/src/file2.ts' ];
            xJet.mock(ts.sys.readDirectory).mockReturnValue(mockResult);

            const result = host.readDirectory(
                '/project/root/src',
                [ '.ts', '.tsx' ],
                [ 'node_modules' ],
                [ '**/*' ],
                2
            );

            expect(ts.sys.readDirectory).toHaveBeenCalledWith(
                '/project/root/src',
                [ '.ts', '.tsx' ],
                [ 'node_modules' ],
                [ '**/*' ],
                2
            );
            expect(result).toEqual(mockResult);
        });
    });

    describe('getDirectories', () => {
        test('delegates to ts.sys.getDirectories', () => {
            const mockDirs = [ 'components', 'services', 'models' ];
            xJet.mock(ts.sys.getDirectories).mockReturnValue(mockDirs);

            const result = host.getDirectories('/project/root/src');

            expect(ts.sys.getDirectories).toHaveBeenCalledWith('/project/root/src');
            expect(result).toEqual(mockDirs);
        });
    });

    describe('directoryExists', () => {
        test('delegates to ts.sys.directoryExists', () => {
            xJet.mock(ts.sys.directoryExists).mockReturnValue(true);

            const result = host.directoryExists('/project/root/src');

            expect(ts.sys.directoryExists).toHaveBeenCalledWith('/project/root/src');
            expect(result).toBe(true);
        });

        test('returns false for non-existent directory', () => {
            xJet.mock(ts.sys.directoryExists).mockReturnValue(false);

            const result = host.directoryExists('/project/root/nonexistent');

            expect(result).toBe(false);
        });
    });

    describe('getCurrentDirectory', () => {
        test('delegates to ts.sys.getCurrentDirectory', () => {
            xJet.mock(ts.sys.getCurrentDirectory).mockReturnValue('/project/root');

            const result = host.getCurrentDirectory();

            expect(ts.sys.getCurrentDirectory).toHaveBeenCalled();
            expect(result).toBe('/project/root');
        });
    });

    describe('resolveModuleFileName', () => {
        test('returns resolved file name when resolution succeeds', () => {
            const fakeResult = {
                resolvedModule: {
                    resolvedFileName: '/project/root/src/utils/helper.ts',
                    isExternalLibraryImport: false
                }
            };

            resolveModuleNameMock.mockReturnValue(fakeResult);

            const result = host.resolveModuleFileName('./utils/helper', '/project/root/src/index.ts');

            expect(result).toBe('/project/root/src/utils/helper.ts');
        });

        test('returns undefined when resolution fails', () => {
            resolveModuleNameMock.mockReturnValue({
                resolvedModule: undefined,
                failedLookupLocations: [ '/some/path' ]
            });

            const result = host.resolveModuleFileName('./missing', '/project/root/src/index.ts');

            expect(result).toBeUndefined();
        });
    });

    describe('resolveAliases', () => {
        test('returns content unchanged when no alias regex exists', () => {
            const content = 'import { foo } from \'@app/component\';';
            const sourceFile = ts.createSourceFile(
                '/project/root/src/index.ts',
                content,
                ts.ScriptTarget.ES2020
            );

            const result = host.resolveAliases(content, sourceFile.fileName);

            expect(result).toBe(content);
        });

        test('replaces aliases with relative paths in declaration content', () => {
            const hostWithPaths = new LanguageHostService({
                paths: {
                    '@utils/*': [ 'src/utils/*' ]
                }
            });

            const content = 'import { helper } from \'@utils/helper\';';
            const sourceFile = ts.createSourceFile(
                '/project/root/src/components/button.ts',
                content,
                ts.ScriptTarget.ES2020
            );

            resolveModuleNameMock.mockReturnValue({
                resolvedModule: {
                    resolvedFileName: '/project/root/src/utils/helper.ts'
                }
            });

            const result = hostWithPaths.resolveAliases(content, sourceFile.fileName, '.d.ts');

            expect(result).toContain('../utils/helper.d.ts');
            expect(result).not.toContain('@utils/helper');
        });

        test('preserves original import when resolution fails', () => {
            const hostWithPaths = new LanguageHostService({
                paths: {
                    '@utils/*': [ 'src/utils/*' ]
                }
            });

            const content = 'import { helper } from \'@utils/helper\';';
            const sourceFile = ts.createSourceFile(
                '/project/root/src/index.ts',
                content,
                ts.ScriptTarget.ES2020
            );

            resolveModuleNameMock.mockReturnValue({
                resolvedModule: undefined
            });

            const result = hostWithPaths.resolveAliases(content, sourceFile.fileName);

            expect(result).toBe(content);
        });

        test('handles multiple aliased imports in same content', () => {
            const hostWithPaths = new LanguageHostService({
                paths: {
                    '@utils/*': [ 'src/utils/*' ],
                    '@components/*': [ 'src/components/*' ]
                }
            });

            const content = `import { helper } from '@utils/helper';
import { Button } from '@components/button';`;
            const sourceFile = ts.createSourceFile(
                '/project/root/src/pages/home.ts',
                content,
                ts.ScriptTarget.ES2020
            );

            resolveModuleNameMock.mockImplementation((moduleName: string) => {
                if (moduleName === '@utils/helper') {
                    return { resolvedModule: { resolvedFileName: '/project/root/src/utils/helper.ts' } };
                }
                if (moduleName === '@components/button') {
                    return { resolvedModule: { resolvedFileName: '/project/root/src/components/button.tsx' } };
                }

                return { resolvedModule: undefined };
            });

            const result = hostWithPaths.resolveAliases(content, sourceFile.fileName, '.d.ts');

            expect(result).toContain('../utils/helper.d.ts');
            expect(result).toContain('../components/button.d.ts');
        });

        test('adds ./ prefix when relative path does not start with .', () => {
            const hostWithPaths = new LanguageHostService({
                paths: {
                    '@utils/*': [ 'src/utils/*' ]
                }
            });

            const content = 'import { helper } from \'@utils/helper\';';
            const sourceFile = ts.createSourceFile(
                '/project/root/src/utils/button.ts',
                content,
                ts.ScriptTarget.ES2020
            );

            resolveModuleNameMock.mockReturnValue({
                resolvedModule: {
                    resolvedFileName: '/project/root/src/utils/helper.ts'
                }
            });

            const result = hostWithPaths.resolveAliases(content, sourceFile.fileName, '.d.ts');

            expect(result).toContain('./helper.d.ts');
        });
    });
});
