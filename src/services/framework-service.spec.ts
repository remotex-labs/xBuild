/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { MockState } from '@remotex-labs/xjet';

/**
 * Imports
 */

import { readFileSync } from 'fs';
import { toPosix } from '@remotex-labs/xmap';
import { FrameworkService } from '@services/framework.service';

/**
 * Tests
 */

describe('FrameworkService', () => {
    let framework: FrameworkService;
    let readFileSyncMock: MockState;

    const fakeFilePath = '/project/root/src/framework.ts';
    const fakeMapPath = '/project/root/src/framework.ts.map';
    const fakeDistPath = '/project/root/dist';

    // Minimal valid source map (enough to pass parsing).
    const dummySourceMap = JSON.stringify({
        version: 3,
        sources: [ 'framework.ts' ],
        names: [],
        mappings: 'AAAA'
    });

    beforeAll(() => {
        xJet.spyOn(import.meta, 'filename').mockReturnValue(fakeFilePath);
        xJet.spyOn(import.meta, 'dirname').mockReturnValue(fakeDistPath);
        readFileSyncMock = xJet.mock(readFileSync).mockImplementation(((path: string): string => {
            if (path === fakeMapPath) return dummySourceMap;
            throw new Error(`ENOENT: no such file or directory, open '${ path }'`);
        }) as any);
    });

    beforeEach(() => {
        xJet.resetAllMocks();
        framework = new FrameworkService();
    });

    afterAll(() => {
        xJet.restoreAllMocks();
    });

    describe('constructor & paths', () => {
        test('exposes filePath, distPath and rootPath', () => {
            expect(framework.filePath).toBe(fakeFilePath);
            expect(framework.distPath).toBe(fakeDistPath);
            expect(framework.rootPath).toBe(toPosix(process.cwd()));
        });

        test('loads the source map for its own file', () => {
            expect(framework.getSourceMap(fakeFilePath)).toBeDefined();
            expect(readFileSync).toHaveBeenCalledWith(fakeMapPath, 'utf-8');
        });
    });

    describe('sourcePath', () => {
        test('falls back to rootPath when unset', () => {
            expect(framework.sourcePath).toBe(framework.rootPath);
        });

        test('resolves a relative directory against rootPath', () => {
            framework.sourcePath = 'src';

            expect(framework.sourcePath).toBe(`${ framework.rootPath }/src`);
        });

        test('resets to rootPath when set to undefined', () => {
            framework.sourcePath = 'src';
            framework.sourcePath = undefined;

            expect(framework.sourcePath).toBe(framework.rootPath);
        });
    });

    describe('isFrameworkFile', () => {
        test('returns true for a source inside xBuild', () => {
            expect(framework.isFrameworkFile(<any> {
                source: '/project/root/node_modules/xbuild/index.ts',
                sourceRoot: undefined
            })).toBe(true);
        });

        test('returns true when sourceRoot contains xBuild', () => {
            expect(framework.isFrameworkFile(<any> {
                source: undefined,
                sourceRoot: '/some/path/xBuild/src'
            })).toBe(true);
        });

        test('returns false for unrelated files', () => {
            expect(framework.isFrameworkFile(<any> {
                source: '/project/root/src/app.ts',
                sourceRoot: '/project/root'
            })).toBe(false);
        });

        test('returns false for the user xbuild.config file', () => {
            expect(framework.isFrameworkFile(<any> {
                source: '/project/root/xbuild.config.ts',
                sourceRoot: undefined
            })).toBe(false);
        });
    });

    describe('getSourceMap', () => {
        test('returns undefined for an unregistered path', () => {
            expect(framework.getSourceMap('/unregistered/file.ts')).toBeUndefined();
        });

        test('returns the same cached instance for a known path', () => {
            const first = framework.getSourceMap(fakeFilePath);
            const second = framework.getSourceMap(fakeFilePath);

            expect(second).toBe(first);
        });
    });

    describe('setSource', () => {
        test('registers a SourceService from a raw source-map string', () => {
            framework.setSource(dummySourceMap, '/project/root/custom.ts');

            expect(framework.getSourceMap('/project/root/custom.ts')).toBeDefined();
        });

        test('ignores a source map with empty mappings', () => {
            framework.setSource('{"mappings": ""}', '/project/root/empty.ts');

            expect(framework.getSourceMap('/project/root/empty.ts')).toBeUndefined();
        });

        test('throws on an invalid source map', () => {
            expect(() => framework.setSource('invalid', '/bad.ts'))
                .toThrow(/Failed to initialize SourceService:.+?\/bad\.ts.*/);
        });
    });

    describe('setSourceFile', () => {
        test('loads and registers the adjacent .map companion', () => {
            readFileSyncMock.mockReturnValueOnce(dummySourceMap);
            framework.setSourceFile('/project/root/src/other.ts');

            expect(readFileSyncMock).toHaveBeenCalledWith('/project/root/src/other.ts.map', 'utf-8');
            expect(framework.getSourceMap('/project/root/src/other.ts')).toBeDefined();
        });

        test('throws when the .map file is missing', () => {
            expect(() => framework.setSourceFile('/missing/file.ts'))
                .toThrow(/Failed to initialize SourceService: .+\/missing\/file\.ts.*/);
        });

        test('does nothing for a falsy path', () => {
            readFileSyncMock.mockClear();
            framework.setSourceFile('');

            expect(readFileSync).not.toHaveBeenCalled();
        });

        test('reuses an already-cached map without re-reading', () => {
            framework.setSourceFile(fakeFilePath);
            readFileSyncMock.mockClear();

            framework.setSourceFile(fakeFilePath);

            expect(readFileSyncMock).not.toHaveBeenCalled();
        });
    });
});
