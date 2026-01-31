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
import { statSync, readFileSync } from 'fs';
import { LanguageHostService } from '@typescript/services/hosts.service';

/**
 * Tests
 */

describe('LanguageHostService', () => {
    let host: LanguageHostService;
    let resolveModuleNameMock: MockState;

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

        xJet.mock(statSync).mockImplementation(() => ({
            mtimeMs: 1000
        }));

        xJet.mock(readFileSync).mockImplementation(() => 'export const x = 10;');
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
            expect(statSync).toHaveBeenCalledTimes(1);
            expect(readFileSync).toHaveBeenCalledTimes(1);
        });

        test('touchFiles calls touchFile for each path', () => {
            host.touchFiles([ './src/a.ts', './src/b.ts', './src/c.ts' ]);

            expect(statSync).toHaveBeenCalledTimes(3);
            expect(readFileSync).toHaveBeenCalledTimes(3);
        });
    });

    describe('getScriptSnapshot & getScriptVersion', () => {
        test('returns snapshot from cache if exists', () => {
            host.touchFile('./src/index.ts');

            const snapshot = host.getScriptSnapshot('./src/index.ts');

            expect(snapshot).toBeDefined();
            expect(snapshot!.getText(0, 20)).toContain('export const x = 10');
            expect(readFileSync).toHaveBeenCalledTimes(1); // only once
        });

        test('touches file and creates snapshot if not cached yet', () => {
            const snapshot = host.getScriptSnapshot('./src/new-file.ts');

            expect(snapshot).toBeDefined();
            expect(statSync).toHaveBeenCalledTimes(1);
            expect(readFileSync).toHaveBeenCalledTimes(1);
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
                expect.any(Object),           // compilerOptions
                ts.sys,
                expect.any(Object)            // cache
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

            expect(path).toBe('/typescript/lib/lib.es2020.d.ts'); // mocked value
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
});
