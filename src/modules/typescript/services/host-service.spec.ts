/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { ParsedCommandLine } from 'typescript';

/**
 * Imports
 */

import ts from 'typescript';
import { cwd } from 'process';
import { inject } from '@remotex-labs/xinject';
import { normalize } from '@remotex-labs/xmap';
import { FilesModel } from '@models/files.model';
import { LanguageHostService } from './host.service';
import { createMatcher } from '@components/glob.component';

/**
 * Tests
 */

describe('LanguageHostService', () => {
    const entry: any = { mtimeMs: 1, version: 2, snapshot: { text: 'export const x = 10;' } };
    const cache = inject(FilesModel);
    const root = normalize(cwd());
    const abs = (path: string): string => `${ root }/${ path }`;

    let host: LanguageHostService;
    let config: ParsedCommandLine;
    let touchMock: any;
    let refreshMock: any;
    let resolveMock: any;
    let matcherMock: any;
    let createMatcherMock: any;

    beforeEach(() => {
        xJet.restoreAllMocks();

        config = <ParsedCommandLine> <unknown> {
            options: { target: ts.ScriptTarget.ES2020 },
            fileNames: [ 'src/index.ts', 'src/index.spec.ts' ],
            raw: { exclude: [ '**/*.spec.ts' ] }
        };

        resolveMock = xJet.spyOn(cache, 'resolve').mockImplementation(
            (path: string) => path.startsWith(root) ? path : abs(path)
        );

        touchMock = xJet.spyOn(cache, 'touch').mockReturnValue(entry);
        refreshMock = xJet.spyOn(cache, 'refresh').mockReturnValue(entry);
        matcherMock = xJet.fn((path: string) => path.endsWith('.spec.ts'));
        createMatcherMock = xJet.mock(createMatcher).mockReturnValue(<any> matcherMock);

        host = new LanguageHostService(config);
    });

    describe('constructor', () => {
        test('should track the configured entry files and read them', () => {
            expect(host.getScriptFileNames()).toEqual([ abs('src/index.ts') ]);
            expect(refreshMock).toHaveBeenCalledWith(abs('src/index.ts'));
        });

        test('should skip an entry file the exclude globs match', () => {
            expect(host.tracked.has(abs('src/index.spec.ts'))).toBe(false);
            expect(createMatcherMock).toHaveBeenCalledWith([ '**/*.spec.ts' ]);
        });

        test('should exclude nothing when the configuration carries no exclude globs', () => {
            config.raw.exclude = [];
            host = new LanguageHostService(config);

            expect(host.getScriptFileNames()).toEqual([ abs('src/index.ts'), abs('src/index.spec.ts') ]);
            expect(createMatcherMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('options', () => {
        test('should replace the tracked set with the entry files of the new configuration', () => {
            host.refresh('src/scratch.ts');
            host.options = <ParsedCommandLine> <unknown> {
                options: {}, fileNames: [ 'src/other.ts' ], raw: {}
            };

            expect(host.getScriptFileNames()).toEqual([ abs('src/other.ts') ]);
        });
    });

    describe('reload', () => {
        test('should recompile the exclude globs the configuration now carries', () => {
            config.raw.exclude = undefined;
            host.reload();

            expect(host.getScriptFileNames()).toEqual([ abs('src/index.ts'), abs('src/index.spec.ts') ]);
        });
    });

    describe('clearTracked', () => {
        test('should drop everything and track the entry files again', () => {
            host.refresh('src/scratch.ts');
            host.clearTracked();

            expect(host.getScriptFileNames()).toEqual([ abs('src/index.ts') ]);
        });
    });

    describe('refresh', () => {
        test('should track the path and return the entry the cache rebuilt', () => {
            expect(host.refresh('src/new.ts')).toBe(entry);
            expect(host.tracked.has(abs('src/new.ts'))).toBe(true);
        });

        test('should track a path the exclude globs match', () => {
            host.refresh('src/other.spec.ts');

            expect(host.tracked.has(abs('src/other.spec.ts'))).toBe(true);
        });
    });

    describe('refreshFiles', () => {
        test('should refresh the given paths and skip the excluded ones', () => {
            refreshMock.mockClear();
            host.refreshFiles([ 'src/a.ts', 'src/a.spec.ts' ]);

            expect(refreshMock).toHaveBeenCalledTimes(1);
            expect(refreshMock).toHaveBeenCalledWith(abs('src/a.ts'));
        });

        test('should refresh the tracked set when it is given no paths', () => {
            host.refresh('src/new.ts');
            refreshMock.mockClear();

            host.refreshFiles();

            expect(refreshMock).toHaveBeenCalledTimes(2);
            expect(refreshMock).toHaveBeenCalledWith(abs('src/index.ts'));
            expect(refreshMock).toHaveBeenCalledWith(abs('src/new.ts'));
        });
    });

    describe('isExcluded', () => {
        test('should test the path relative to the working directory', () => {
            host.refreshFiles([ 'src/a.ts' ]);

            expect(matcherMock).toHaveBeenCalledWith('src/a.ts');
        });

        test('should ask the matcher once per path', () => {
            matcherMock.mockClear();
            host.refreshFiles([ 'src/a.ts', 'src/a.ts' ]);

            expect(matcherMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('ignoreSourceFile', () => {
        test('should ignore a source file the exclude globs match', () => {
            expect(host.ignoreSourceFile(<any> { fileName: abs('src/a.spec.ts') })).toBe(true);
            expect(host.ignoreSourceFile(<any> { fileName: abs('src/a.ts') })).toBe(false);
        });
    });

    describe('getScriptVersion', () => {
        test('should report the cached version as a string and track the path', () => {
            expect(host.getScriptVersion('src/new.ts')).toBe('2');
            expect(host.tracked.has(abs('src/new.ts'))).toBe(true);
        });
    });

    describe('getScriptSnapshot', () => {
        test('should read through the cache without tracking the path', () => {
            expect(host.getScriptSnapshot('src/new.ts')).toBe(entry.snapshot);
            expect(host.tracked.has(abs('src/new.ts'))).toBe(false);
        });
    });

    describe('readFile', () => {
        test('should return the cached text and pass the encoding on', () => {
            expect(host.readFile('src/index.ts', 'latin1')).toBe('export const x = 10;');
            expect(touchMock).toHaveBeenCalledWith('src/index.ts', 'latin1');
        });

        test('should return undefined when the path holds no readable file', () => {
            touchMock.mockReturnValue(<any> { mtimeMs: 0, version: 1, snapshot: undefined });

            expect(host.readFile('src/gone.ts')).toBeUndefined();
        });
    });

    describe('realpath', () => {
        test('should resolve a path the way the cache keys it', () => {
            expect(host.realpath('src/index.ts')).toBe(abs('src/index.ts'));
            expect(resolveMock).toHaveBeenCalledWith('src/index.ts');
        });
    });

    describe('getCompilationSettings', () => {
        test('should return the options the configuration carries', () => {
            expect(host.getCompilationSettings()).toBe(config.options);
        });
    });

    describe('getDefaultLibFileName', () => {
        test('should name the lib matching the target', () => {
            expect(host.getDefaultLibFileName({ target: ts.ScriptTarget.ES2020 }))
                .toBe(ts.getDefaultLibFilePath({ target: ts.ScriptTarget.ES2020 }));
        });
    });

    describe('filesystem hooks', () => {
        test('should ask ts.sys whether a file exists', () => {
            const fileExists = xJet.spyOn(ts.sys, 'fileExists').mockReturnValue(true);

            expect(host.fileExists(abs('src/index.ts'))).toBe(true);
            expect(fileExists).toHaveBeenCalledWith(abs('src/index.ts'));
        });

        test('should ask ts.sys whether a directory exists', () => {
            const directoryExists = xJet.spyOn(ts.sys, 'directoryExists').mockReturnValue(false);

            expect(host.directoryExists(abs('src'))).toBe(false);
            expect(directoryExists).toHaveBeenCalledWith(abs('src'));
        });

        test('should hand the directory listing criteria to ts.sys', () => {
            const readDirectory = xJet.spyOn(ts.sys, 'readDirectory').mockReturnValue([ 'src/index.ts' ]);

            expect(host.readDirectory('src', [ '.ts' ], [ 'node_modules' ], undefined, 2)).toEqual([ 'src/index.ts' ]);
            expect(readDirectory).toHaveBeenCalledWith('src', [ '.ts' ], [ 'node_modules' ], undefined, 2);
        });

        test('should ask ts.sys for the subdirectories of a path', () => {
            const getDirectories = xJet.spyOn(ts.sys, 'getDirectories').mockReturnValue([ 'services' ]);

            expect(host.getDirectories('src')).toEqual([ 'services' ]);
            expect(getDirectories).toHaveBeenCalledWith('src');
        });

        test('should ask ts.sys for the working directory', () => {
            xJet.spyOn(ts.sys, 'getCurrentDirectory').mockReturnValue(root);

            expect(host.getCurrentDirectory()).toBe(root);
        });
    });
});
