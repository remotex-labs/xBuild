/**
 * Imports
 */

import process from 'process';
import { readdirSync } from 'fs';
import { isDirectoryExcluded, shouldIncludeFile } from '@components/glob.component';
import { collectFilesFromGlob, parseGlobs, matchesAny } from '@components/glob.component';

/**
 * Tests
 */

describe('parseGlobs', () => {
    test('should separate include and exclude patterns', () => {
        const result = parseGlobs([ '**/*.ts', '!**/*.test.ts', '**/*.js', '!node_modules/**' ]);

        expect(result.include).toEqual([ '**/*.ts', '**/*.js' ]);
        expect(result.exclude).toEqual([ '**/*.test.ts', 'node_modules/**' ]);
    });

    test('should handle only include patterns', () => {
        const result = parseGlobs([ '**/*.ts', '**/*.js' ]);

        expect(result.include).toEqual([ '**/*.ts', '**/*.js' ]);
        expect(result.exclude).toEqual([]);
    });

    test('should handle only exclude patterns', () => {
        const result = parseGlobs([ '!**/*.test.ts', '!node_modules/**' ]);

        expect(result.include).toEqual([]);
        expect(result.exclude).toEqual([ '**/*.test.ts', 'node_modules/**' ]);
    });

    test('should handle empty array', () => {
        const result = parseGlobs([]);

        expect(result.include).toEqual([]);
        expect(result.exclude).toEqual([]);
    });
});

describe('matchesAny', () => {
    test('should return true when path matches any pattern', () => {
        const patterns = [ '**/*.ts', '**/*.js' ];

        expect(matchesAny('src/app.ts', patterns)).toBe(true);
        expect(matchesAny('lib/utils.js', patterns)).toBe(true);
    });

    test('should return false when path matches no patterns', () => {
        const patterns = [ '**/*.ts', '**/*.js' ];

        expect(matchesAny('src/app.css', patterns)).toBe(false);
        expect(matchesAny('README.md', patterns)).toBe(false);
    });

    test('should return false for empty patterns array', () => {
        expect(matchesAny('src/app.ts', [])).toBe(false);
    });

    test('should handle complex glob patterns', () => {
        const patterns = [ 'src/**/*.ts', 'lib/**/index.js' ];

        expect(matchesAny('src/components/Button.ts', patterns)).toBe(true);
        expect(matchesAny('lib/utils/index.js', patterns)).toBe(true);
        expect(matchesAny('dist/app.ts', patterns)).toBe(false);
    });
});

describe('isDirectoryExcluded', () => {
    test('should return true when directory matches exclude pattern', () => {
        const exclude = [ 'node_modules/**', 'dist/**' ];

        expect(isDirectoryExcluded('node_modules', exclude)).toBe(true);
        expect(isDirectoryExcluded('dist', exclude)).toBe(true);
    });

    test('should return true when directory matches with /** pattern', () => {
        const exclude = [ '**/test/**' ];

        expect(isDirectoryExcluded('src/test', exclude)).toBe(true);
    });

    test('should return false when directory does not match', () => {
        const exclude = [ 'node_modules/**', 'dist/**' ];

        expect(isDirectoryExcluded('src', exclude)).toBe(false);
        expect(isDirectoryExcluded('lib', exclude)).toBe(false);
    });

    test('should return false for empty exclude array', () => {
        expect(isDirectoryExcluded('node_modules', [])).toBe(false);
    });

    test('should handle nested directory paths', () => {
        const exclude = [ '**/node_modules/**' ];

        expect(isDirectoryExcluded('src/node_modules', exclude)).toBe(true);
        expect(isDirectoryExcluded('lib/vendor/node_modules', exclude)).toBe(true);
    });
});

describe('shouldIncludeFile', () => {
    test('should return true when file matches include and not exclude', () => {
        const include = [ '**/*.ts' ];
        const exclude = [ '**/*.test.ts' ];

        expect(shouldIncludeFile('src/app.ts', include, exclude)).toBe(true);
    });

    test('should return false when file does not match include', () => {
        const include = [ '**/*.ts' ];
        const exclude = [ '**/*.test.ts' ];

        expect(shouldIncludeFile('src/app.js', include, exclude)).toBe(false);
    });

    test('should return false when file matches exclude', () => {
        const include = [ '**/*.ts' ];
        const exclude = [ '**/*.test.ts' ];

        expect(shouldIncludeFile('src/app.test.ts', include, exclude)).toBe(false);
    });

    test('should return true when no exclude patterns', () => {
        const include = [ '**/*.ts' ];
        const exclude: Array<string> = [];

        expect(shouldIncludeFile('src/app.ts', include, exclude)).toBe(true);
    });

    test('should return false when include is empty', () => {
        const include: Array<string> = [];
        const exclude = [ '**/*.test.ts' ];

        expect(shouldIncludeFile('src/app.ts', include, exclude)).toBe(false);
    });

    test('should handle multiple include patterns', () => {
        const include = [ '**/*.ts', '**/*.tsx' ];
        const exclude = [ '**/*.test.*' ];

        expect(shouldIncludeFile('src/Component.tsx', include, exclude)).toBe(true);
        expect(shouldIncludeFile('src/utils.ts', include, exclude)).toBe(true);
        expect(shouldIncludeFile('src/app.test.tsx', include, exclude)).toBe(false);
    });
});


describe('collectFilesFromGlob', () => {
    const testDir = '/mock/cwd/test/dir';

    beforeEach(() => {
        xJet.restoreAllMocks();
        xJet.spyOn(process, 'cwd').mockReturnValue('/mock/cwd');
    });

    test('should return empty object when directory cannot be read', () => {
        xJet.mock(readdirSync).mockImplementation(() => {
            throw new Error('ENOENT');
        });

        const result = collectFilesFromGlob('/bad/path', [ '**/*' ]);
        expect(result).toEqual({});
    });

    test('should return empty object when no include patterns provided', () => {
        const result = collectFilesFromGlob(testDir, []);
        expect(result).toEqual({});
    });

    test('should collect files matching include patterns', () => {
        xJet.mock(readdirSync).mockReturnValue(<any>[
            { name: 'index.ts', isDirectory: () => false },
            { name: 'index.js', isDirectory: () => false },
            { name: 'README.md', isDirectory: () => false }
        ]);

        const result = collectFilesFromGlob(testDir, [ '**/*.ts' ]);

        expect(result['index']).toBeDefined();
        expect(result['index']).toContain('.ts');
        expect(result['index.js']).toBeUndefined();
        expect(result['README']).toBeUndefined();
    });

    test('should recursively walk directories', () => {
        const readdirMock = xJet.mock(readdirSync);

        // root
        readdirMock.mockReturnValueOnce(<any>[
            { name: 'index.ts', isDirectory: () => false },
            { name: 'src', isDirectory: () => true }
        ]);

        // src
        readdirMock.mockReturnValueOnce(<any>[{ name: 'app.ts', isDirectory: () => false }]);

        const result = collectFilesFromGlob(testDir, [ '**/*.ts' ]);

        expect(result['index']).toBeDefined();
        expect(result['src/app']).toBeDefined();
        expect(readdirMock).toHaveBeenCalledTimes(2);
    });

    test('should exclude files matching exclude patterns', () => {
        xJet.mock(readdirSync).mockReturnValue(<any>[
            { name: 'app.ts', isDirectory: () => false },
            { name: 'app.test.ts', isDirectory: () => false }
        ]);

        const result = collectFilesFromGlob(testDir, [ '**/*.ts', '!**/*.test.ts' ]);

        expect(result['app']).toBeDefined();
        expect(result['app.test']).toBeUndefined();
    });

    test('should skip excluded directories without walking them', () => {
        const readdirMock = xJet.mock(readdirSync);

        // root
        readdirMock.mockReturnValueOnce(<any>[
            { name: 'src', isDirectory: () => true },
            { name: 'node_modules', isDirectory: () => true }
        ]);

        // src
        readdirMock.mockReturnValueOnce(<any>[{ name: 'app.ts', isDirectory: () => false }]);
        const result = collectFilesFromGlob(testDir, [ '**/*', '!node_modules/**' ]);

        expect(result['src/app']).toBeDefined();
        expect(readdirMock).toHaveBeenCalledTimes(2);
    });

    test('should handle deeply nested directory structures', () => {
        const readdirMock = xJet.mock(readdirSync);

        readdirMock.mockReturnValueOnce(<any>[{ name: 'src', isDirectory: () => true }]);
        readdirMock.mockReturnValueOnce(<any>[{ name: 'components', isDirectory: () => true }]);
        readdirMock.mockReturnValueOnce(<any>[{ name: 'Button.tsx', isDirectory: () => false }]);

        const result = collectFilesFromGlob(testDir, [ '**/*.tsx' ]);

        expect(result['src/components/Button']).toBeDefined();
        expect(readdirMock).toHaveBeenCalledTimes(3);
    });

    test('should return record with keys as paths without extension and values with extension', () => {
        xJet.mock(readdirSync).mockReturnValue(<any>[{ name: 'file.ts', isDirectory: () => false }]);

        const result = collectFilesFromGlob(testDir, [ '**/*' ]);

        expect(result['file']).toBeDefined();
        expect(result['file']).toMatch(/file\.ts$/);
    });

    test('should return empty object if only negation patterns provided', () => {
        const result = collectFilesFromGlob(testDir, [ '!**/*.test.ts' ]);
        expect(result).toEqual({});
    });

    test('should handle multiple include and exclude patterns', () => {
        xJet.mock(readdirSync).mockReturnValue(<any>[
            { name: 'app.ts', isDirectory: () => false },
            { name: 'app.test.ts', isDirectory: () => false },
            { name: 'utils.js', isDirectory: () => false },
            { name: 'utils.test.js', isDirectory: () => false },
            { name: 'README.md', isDirectory: () => false }
        ]);

        const result = collectFilesFromGlob(testDir, [ '**/*.ts', '**/*.js', '!**/*.test.*' ]);

        expect(result['app']).toBeDefined();
        expect(result['utils']).toBeDefined();
        expect(result['app.test']).toBeUndefined();
        expect(result['utils.test']).toBeUndefined();
        expect(result['README']).toBeUndefined();
    });

    test('should handle mixed directory and file exclusions', () => {
        const readdirMock = xJet.mock(readdirSync);

        // root
        readdirMock.mockReturnValueOnce(<any>[
            { name: 'src', isDirectory: () => true },
            { name: 'dist', isDirectory: () => true }
        ]);

        // src
        readdirMock.mockReturnValueOnce(<any>[
            { name: 'app.ts', isDirectory: () => false },
            { name: 'temp.ts', isDirectory: () => false }
        ]);

        const result = collectFilesFromGlob(testDir, [ '**/*.ts', '!dist/**', '!**/temp.ts' ]);

        expect(result['src/app']).toBeDefined();
        expect(result['src/temp']).toBeUndefined();
        expect(readdirMock).toHaveBeenCalledTimes(2); // Should not walk into dist
    });

    test('should store value as path relative to cwd with extension', () => {
        xJet.mock(readdirSync).mockReturnValue(<any>[{ name: 'app.ts', isDirectory: () => false }]);

        const result = collectFilesFromGlob(testDir, [ '**/*.ts' ]);

        // Key is without extension, value is with extension relative to cwd
        expect(result['app']).toBeDefined();
        expect(result['app']).toMatch(/\.ts$/);
        expect(result['app']).toContain('dir');
    });

    test('should handle files without extension', () => {
        xJet.mock(readdirSync).mockReturnValue(<any>[{ name: 'README', isDirectory: () => false }]);

        const result = collectFilesFromGlob(testDir, [ '**/*' ]);

        expect(result['README']).toBeDefined();
        expect(result['README']).toMatch(/README$/);
    });
});
