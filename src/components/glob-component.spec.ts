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

describe('glob.component', () => {
    describe('parseGlobs', () => {
        test('separates include and exclude patterns', () => {
            const result = parseGlobs([ '**/*.ts', '!**/*.test.ts', '**/*.js', '!node_modules/**' ]);

            expect(result.include).toEqual([ '**/*.ts', '**/*.js' ]);
            expect(result.exclude).toEqual([ '**/*.test.ts', 'node_modules/**' ]);
        });

        test('handles include-only patterns', () => {
            const result = parseGlobs([ '**/*.ts', '**/*.js' ]);

            expect(result.include).toEqual([ '**/*.ts', '**/*.js' ]);
            expect(result.exclude).toEqual([]);
        });

        test('handles exclude-only patterns', () => {
            const result = parseGlobs([ '!**/*.test.ts', '!node_modules/**' ]);

            expect(result.include).toEqual([]);
            expect(result.exclude).toEqual([ '**/*.test.ts', 'node_modules/**' ]);
        });

        test('handles an empty array', () => {
            const result = parseGlobs([]);

            expect(result.include).toEqual([]);
            expect(result.exclude).toEqual([]);
        });
    });

    describe('matchesAny', () => {
        test('returns true when the path matches a pattern', () => {
            const patterns = [ '**/*.ts', '**/*.js' ];

            expect(matchesAny('src/app.ts', patterns)).toBe(true);
            expect(matchesAny('lib/utils.js', patterns)).toBe(true);
        });

        test('returns false when the path matches no pattern', () => {
            const patterns = [ '**/*.ts', '**/*.js' ];

            expect(matchesAny('src/app.css', patterns)).toBe(false);
            expect(matchesAny('README.md', patterns)).toBe(false);
        });

        test('returns false for an empty pattern array', () => {
            expect(matchesAny('src/app.ts', [])).toBe(false);
        });

        test('matches a literal full path via the suffix check', () => {
            expect(matchesAny('src/app.ts', [ 'pkg/src/app.ts' ])).toBe(true);
        });

        test('handles nested glob patterns', () => {
            const patterns = [ 'src/**/*.ts', 'lib/**/index.js' ];

            expect(matchesAny('src/components/Button.ts', patterns)).toBe(true);
            expect(matchesAny('lib/utils/index.js', patterns)).toBe(true);
            expect(matchesAny('dist/app.ts', patterns)).toBe(false);
        });
    });

    describe('isDirectoryExcluded', () => {
        test('returns true when the directory matches an exclude pattern', () => {
            const exclude = [ 'node_modules/**', 'dist/**' ];

            expect(isDirectoryExcluded('node_modules', exclude)).toBe(true);
            expect(isDirectoryExcluded('dist', exclude)).toBe(true);
        });

        test('returns true via the appended /** form', () => {
            expect(isDirectoryExcluded('src/test', [ '**/test/**' ])).toBe(true);
        });

        test('returns false when the directory does not match', () => {
            const exclude = [ 'node_modules/**', 'dist/**' ];

            expect(isDirectoryExcluded('src', exclude)).toBe(false);
            expect(isDirectoryExcluded('lib', exclude)).toBe(false);
        });

        test('returns false for an empty exclude array', () => {
            expect(isDirectoryExcluded('node_modules', [])).toBe(false);
        });

        test('handles nested directory paths', () => {
            const exclude = [ '**/node_modules/**' ];

            expect(isDirectoryExcluded('src/node_modules', exclude)).toBe(true);
            expect(isDirectoryExcluded('lib/vendor/node_modules', exclude)).toBe(true);
        });
    });

    describe('shouldIncludeFile', () => {
        test('returns true when the file matches include and not exclude', () => {
            expect(shouldIncludeFile('src/app.ts', [ '**/*.ts' ], [ '**/*.test.ts' ])).toBe(true);
        });

        test('returns false when the file does not match include', () => {
            expect(shouldIncludeFile('src/app.js', [ '**/*.ts' ], [ '**/*.test.ts' ])).toBe(false);
        });

        test('returns false when the file matches exclude', () => {
            expect(shouldIncludeFile('src/app.test.ts', [ '**/*.ts' ], [ '**/*.test.ts' ])).toBe(false);
        });

        test('returns true when there are no exclude patterns', () => {
            expect(shouldIncludeFile('src/app.ts', [ '**/*.ts' ], [])).toBe(true);
        });

        test('returns false when include is empty', () => {
            expect(shouldIncludeFile('src/app.ts', [], [ '**/*.test.ts' ])).toBe(false);
        });

        test('handles multiple include patterns', () => {
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

        /**
         * Mocks readdirSync to return the given entries per traversal level, in order.
         */
        function mockTree(...levels: Array<Array<{ name: string; dir?: boolean }>>): void {
            const mock = xJet.mock(readdirSync);
            for (const level of levels) {
                mock.mockReturnValueOnce(<any> level.map(e => ({ name: e.name, isDirectory: () => Boolean(e.dir) })));
            }
        }

        test('returns an empty object when the directory cannot be read', () => {
            xJet.mock(readdirSync).mockImplementation(() => {
                throw new Error('ENOENT');
            });

            expect(collectFilesFromGlob('/bad/path', [ '**/*' ])).toEqual({});
        });

        test('returns an empty object when no include patterns are provided', () => {
            expect(collectFilesFromGlob(testDir, [])).toEqual({});
        });

        test('returns an empty object when only negation patterns are provided', () => {
            expect(collectFilesFromGlob(testDir, [ '!**/*.test.ts' ])).toEqual({});
        });

        test('collects files matching include patterns', () => {
            mockTree([{ name: 'index.ts' }, { name: 'index.js' }, { name: 'README.md' }]);

            const result = collectFilesFromGlob(testDir, [ '**/*.ts' ]);

            expect(result['index']).toContain('.ts');
            expect(result['index.js']).toBeUndefined();
            expect(result['README']).toBeUndefined();
        });

        test('walks directories recursively', () => {
            const mock = xJet.mock(readdirSync);
            mockTree([{ name: 'index.ts' }, { name: 'src', dir: true }], [{ name: 'app.ts' }]);

            const result = collectFilesFromGlob(testDir, [ '**/*.ts' ]);

            expect(result['index']).toBeDefined();
            expect(result['src/app']).toBeDefined();
            expect(mock).toHaveBeenCalledTimes(2);
        });

        test('excludes files matching exclude patterns', () => {
            mockTree([{ name: 'app.ts' }, { name: 'app.test.ts' }]);

            const result = collectFilesFromGlob(testDir, [ '**/*.ts', '!**/*.test.ts' ]);

            expect(result['app']).toBeDefined();
            expect(result['app.test']).toBeUndefined();
        });

        test('skips excluded directories without walking them', () => {
            const mock = xJet.mock(readdirSync);
            mockTree([{ name: 'src', dir: true }, { name: 'node_modules', dir: true }], [{ name: 'app.ts' }]);

            const result = collectFilesFromGlob(testDir, [ '**/*', '!node_modules/**' ]);

            expect(result['src/app']).toBeDefined();
            expect(mock).toHaveBeenCalledTimes(2);
        });

        test('handles deeply nested directory structures', () => {
            const mock = xJet.mock(readdirSync);
            mockTree(
                [{ name: 'src', dir: true }],
                [{ name: 'components', dir: true }],
                [{ name: 'Button.tsx' }]
            );

            const result = collectFilesFromGlob(testDir, [ '**/*.tsx' ]);

            expect(result['src/components/Button']).toBeDefined();
            expect(mock).toHaveBeenCalledTimes(3);
        });

        test('handles multiple include and exclude patterns', () => {
            mockTree([
                { name: 'app.ts' }, { name: 'app.test.ts' },
                { name: 'utils.js' }, { name: 'utils.test.js' },
                { name: 'README.md' }
            ]);

            const result = collectFilesFromGlob(testDir, [ '**/*.ts', '**/*.js', '!**/*.test.*' ]);

            expect(result['app']).toBeDefined();
            expect(result['utils']).toBeDefined();
            expect(result['app.test']).toBeUndefined();
            expect(result['utils.test']).toBeUndefined();
            expect(result['README']).toBeUndefined();
        });

        test('handles mixed directory and file exclusions', () => {
            const mock = xJet.mock(readdirSync);
            mockTree(
                [{ name: 'src', dir: true }, { name: 'dist', dir: true }],
                [{ name: 'app.ts' }, { name: 'temp.ts' }]
            );

            const result = collectFilesFromGlob(testDir, [ '**/*.ts', '!dist/**', '!**/temp.ts' ]);

            expect(result['src/app']).toBeDefined();
            expect(result['src/temp']).toBeUndefined();
            expect(mock).toHaveBeenCalledTimes(2); // does not walk into dist
        });

        test('keys are extension-less, values are cwd-relative with extension', () => {
            mockTree([{ name: 'app.ts' }]);

            const result = collectFilesFromGlob(testDir, [ '**/*.ts' ]);

            expect(result['app']).toMatch(/\.ts$/);
            expect(result['app']).toContain('dir'); // relative to the mocked cwd
        });

        test('keeps files without an extension intact', () => {
            mockTree([{ name: 'README' }]);

            const result = collectFilesFromGlob(testDir, [ '**/*' ]);

            expect(result['README']).toMatch(/README$/);
        });

        test('keeps dots in directory names when the file has no extension', () => {
            mockTree([{ name: 'feature.v2', dir: true }], [{ name: 'README' }]);

            const result = collectFilesFromGlob(testDir, [ '**/*' ]);

            expect(result['feature.v2/README']).toBeDefined();
            expect(result['feature']).toBeUndefined();
        });
    });
});
