/**
 * Import will remove at compile time
 */

import type { MockState } from '@remotex-labs/xjet';

/**
 * Imports
 */

import { readFileSync } from 'fs';
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

    // Dummy valid source map (minimal to pass parsing)
    const dummySourceMap = JSON.stringify({
        version: 3,
        sources: [ 'framework.ts' ],
        names: [],
        mappings: 'AAAA'
    });

    beforeAll(() => {
        // Mock import.meta
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
        test('sets filePath, rootPath and distPath correctly', () => {
            expect(framework.filePath).toBe(fakeFilePath);
            expect(framework.distPath).toBe(fakeDistPath);
        });

        test('initializes main source map for own file', () => {
            const map = framework.getSourceMap(fakeFilePath);

            expect(map).toBeDefined();
            expect(readFileSync).toHaveBeenCalledWith(fakeMapPath, 'utf-8');
        });
    });

    describe('isFrameworkFile', () => {
        test('returns true for positions from xJet framework files', () => {
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

        test('returns false for xbuild.config files', () => {
            expect(framework.isFrameworkFile(<any> {
                source: '/project/root/xbuild.config.ts',
                sourceRoot: undefined
            })).toBe(false);
        });
    });

    describe('getSourceMap', () => {
        test('returns undefined for unregistered path', () => {
            expect(framework.getSourceMap('/unregistered/file.ts')).toBeUndefined();
        });

        test('returns cached SourceService for known path', () => {
            const first = framework.getSourceMap(fakeFilePath);
            const second = framework.getSourceMap(fakeFilePath);

            expect(second).toBe(first);
        });
    });

    describe('setSource', () => {
        test('initializes SourceService from raw source map string', () => {
            const raw = JSON.stringify({
                version: 3,
                sources: [ 'custom.ts' ],
                mappings: 'AAAA',
                names: []
            });

            framework.setSource(raw, '/project/root/custom.ts');

            expect(framework.getSourceMap('/project/root/custom.ts')).toBeDefined();
        });

        test('skips empty mappings', () => {
            framework.setSource('{"mappings": ""}', '/project/root/empty.ts');

            expect(framework.getSourceMap('/project/root/empty.ts')).toBeUndefined();
        });

        test('throws on invalid source map', () => {
            expect(() => framework.setSource('invalid', '/bad.ts'))
                .toThrow(/Failed to initialize SourceService:.+?\/bad\.ts.*/);
        });
    });

    describe('setSourceFile', () => {
        test('loads and initializes .map companion file', () => {
            const fakeMap = JSON.stringify({
                version: 3,
                sources: [ 'index.ts' ],
                mappings: 'AAAA',
                names: []
            });

            readFileSyncMock.mockReturnValueOnce(fakeMap);
            framework.setSourceFile(fakeFilePath);

            expect(readFileSyncMock).toHaveBeenCalledWith(fakeMapPath, 'utf-8');
            expect(framework.getSourceMap(fakeFilePath)).toBeDefined();
        });

        test('throws when .map file missing', () => {
            expect(() => framework.setSourceFile('fakeFilePath'))
                .toThrow(/Failed to initialize SourceService: .+fakeFilePath.*/);
        });

        test('does nothing if path is falsy', () => {
            readFileSyncMock.mockReset();
            framework.setSourceFile('');

            expect(readFileSync).not.toHaveBeenCalled();
        });

        test('reuses existing cached map', () => {
            framework.setSourceFile(fakeFilePath); // first

            const readSpy = xJet.mock(readFileSync).mockClear();

            framework.setSourceFile(fakeFilePath); // second

            expect(readSpy).not.toHaveBeenCalled();
        });
    });
});
