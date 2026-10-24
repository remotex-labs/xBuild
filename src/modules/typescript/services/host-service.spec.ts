/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { ParsedCommandLine } from 'typescript/sync';

/**
 * Imports
 */

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
    const entry: any = { mtimeMs: 1, version: 2, text: 'export const x = 10;' };
    const cache = inject(FilesModel);
    const root = normalize(cwd());
    const abs = (path: string): string => `${ root }/${ path }`;

    let host: LanguageHostService;
    let config: ParsedCommandLine;
    let snapshotMock: any;
    let refreshMock: any;
    let resolveMock: any;
    let matcherMock: any;
    let createMatcherMock: any;

    beforeEach(() => {
        xJet.restoreAllMocks();

        config = <ParsedCommandLine> <unknown> {
            options: {},
            fileNames: [ 'src/index.ts', 'src/index.spec.ts' ],
            raw: { exclude: [ '**/*.spec.ts' ] }
        };

        resolveMock = xJet.spyOn(cache, 'resolve').mockImplementation(
            (path: string) => path.startsWith(root) ? path : abs(path)
        );

        snapshotMock = xJet.spyOn(cache, 'getSnapshot').mockReturnValue(entry);
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
            createMatcherMock.mockClear();
            config.raw = { exclude: [] };
            host = new LanguageHostService(config);

            expect(host.getScriptFileNames()).toEqual([ abs('src/index.ts'), abs('src/index.spec.ts') ]);
            expect(createMatcherMock).not.toHaveBeenCalled();
        });
    });

    describe('options', () => {
        test('should replace the tracked set with the entry files of the new configuration', () => {
            host.refreshFiles([ 'src/scratch.ts' ]);
            host.options = <ParsedCommandLine> <unknown> { options: {}, fileNames: [ 'src/other.ts' ], raw: {} };

            expect(host.getScriptFileNames()).toEqual([ abs('src/other.ts') ]);
        });

        test('should compile the exclude globs the new configuration carries', () => {
            host.options = <ParsedCommandLine> <unknown> { ...config, raw: undefined };

            expect(host.getScriptFileNames()).toEqual([ abs('src/index.ts'), abs('src/index.spec.ts') ]);
        });

        test('should forget the observed versions', () => {
            host.observe([ abs('src/index.ts') ]);
            host.options = config;
            snapshotMock.mockReturnValue({ ...entry, version: 3 });
            cache.revision++;

            expect(host.collectChanges()).toEqual([]);
        });
    });

    describe('refreshFiles', () => {
        test('should track and refresh the given paths and skip the excluded ones', () => {
            refreshMock.mockClear();
            host.refreshFiles([ 'src/a.ts', 'src/a.spec.ts' ]);

            expect(refreshMock).toHaveBeenCalledTimes(1);
            expect(refreshMock).toHaveBeenCalledWith(abs('src/a.ts'));
            expect(host.tracked.has(abs('src/a.ts'))).toBe(true);
        });

        test('should keep a path tracked even when the file turns out to be gone', () => {
            refreshMock.mockReturnValue({ mtimeMs: 0, version: 1, text: undefined });
            host.refreshFiles([ 'src/gone.ts' ]);

            expect(host.tracked.has(abs('src/gone.ts'))).toBe(true);
        });
    });

    describe('observe', () => {
        test('should pass over a file the cache has never read', () => {
            snapshotMock.mockReturnValue(undefined);
            host.observe([ abs('lib.d.ts') ]);
            snapshotMock.mockReturnValue({ ...entry, version: 3 });
            cache.revision++;

            expect(host.collectChanges()).toEqual([]);
        });
    });

    describe('collectChanges', () => {
        test('should skip the walk while the file model has not moved', () => {
            host.observe([ abs('src/index.ts') ]);
            snapshotMock.mockClear();

            expect(host.collectChanges()).toEqual([]);
            expect(snapshotMock).not.toHaveBeenCalled();
        });

        test('should report nothing while the observed versions stand', () => {
            host.observe([ abs('src/index.ts') ]);
            cache.revision++;

            expect(host.collectChanges()).toEqual([]);
        });

        test('should report a file whose version moved, and only once', () => {
            host.observe([ abs('src/index.ts') ]);
            snapshotMock.mockReturnValue({ ...entry, version: 3 });
            cache.revision++;

            expect(host.collectChanges()).toEqual([ abs('src/index.ts') ]);
            cache.revision++;
            expect(host.collectChanges()).toEqual([]);
        });

        test('should report a file the cache no longer holds', () => {
            host.observe([ abs('src/index.ts') ]);
            snapshotMock.mockReturnValue(undefined);
            cache.revision++;

            expect(host.collectChanges()).toEqual([ abs('src/index.ts') ]);
        });
    });

    describe('isExcluded', () => {
        test('should report whether the exclude globs match a path', () => {
            expect(host.isExcluded(abs('src/a.spec.ts'))).toBe(true);
            expect(host.isExcluded(abs('src/a.ts'))).toBe(false);
        });

        test('should test the path relative to the working directory', () => {
            host.isExcluded(abs('src/a.ts'));

            expect(matcherMock).toHaveBeenCalledWith('src/a.ts');
        });

        test('should ask the matcher once per path', () => {
            matcherMock.mockClear();
            host.isExcluded('src/a.ts');
            host.isExcluded(abs('src/a.ts'));

            expect(matcherMock).toHaveBeenCalledTimes(1);
            expect(resolveMock).toHaveBeenCalledWith('src/a.ts');
        });
    });

    describe('isTypeCheckExcluded', () => {
        test('should test the path against the excludeTypeChack globs, relative to the working directory', () => {
            const typeCheckMatcher = xJet.fn((path: string) => path.startsWith('src/generated/'));
            createMatcherMock.mockReturnValueOnce(matcherMock).mockReturnValueOnce(typeCheckMatcher);
            config.raw = { exclude: [ '**/*.spec.ts' ], excludeTypeChack: [ 'src/generated/**' ] };
            host = new LanguageHostService(config);

            expect(host.isTypeCheckExcluded(abs('src/generated/api.ts'))).toBe(true);
            expect(host.isTypeCheckExcluded(abs('src/index.ts'))).toBe(false);
            expect(typeCheckMatcher).toHaveBeenCalledWith('src/index.ts');
        });

        test('should exclude nothing when the configuration names no excludeTypeChack globs', () => {
            expect(host.isTypeCheckExcluded(abs('src/generated/api.ts'))).toBe(false);
        });
    });
});
