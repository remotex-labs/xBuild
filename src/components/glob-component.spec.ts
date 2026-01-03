/**
 * Imports
 */

import { existsSync, readdirSync } from 'fs';
import { collectFilesFromGlob, compileGlobPattern, compilePatterns, isGlob, matchesAny } from '@components/glob.component';

/**
 * Tests
 */

describe('isGlob', () => {
    test('should return true for basic glob patterns', () => {
        expect(isGlob('*.js')).toBe(true);
        expect(isGlob('src/**/*.ts')).toBe(true);
        expect(isGlob('file-?.txt')).toBe(true);
    });

    test('should return true for brace patterns', () => {
        expect(isGlob('{a,b}.js')).toBe(true);
        expect(isGlob('src/{foo,bar}/*.js')).toBe(true);
    });

    test('should return true for character class patterns', () => {
        expect(isGlob('[abc].js')).toBe(true);
        expect(isGlob('src/[0-9]*.ts')).toBe(true);
    });

    test('should return true for extglob patterns', () => {
        expect(isGlob('@(pattern).js')).toBe(true);
        expect(isGlob('+(foo|bar).ts')).toBe(true);
    });

    test('should return false for regular file paths', () => {
        expect(isGlob('file.js')).toBe(false);
        expect(isGlob('src/components/Button.tsx')).toBe(false);
        expect(isGlob('path/to/file.txt')).toBe(false);
        expect(isGlob('C:\\Users\\admin\\GoogleDrive\\Desktop\\main\\src\\test2.spec.ts')).toBe(false);
    });
});

describe('matchesAny', () => {
    test('should return true when path matches one of the patterns', () => {
        const path = 'src/file.ts';
        const patterns = [ /\.ts$/, /\.js$/ ];

        expect(matchesAny(path, patterns)).toBe(true);
    });

    test('should return false when path does not match any pattern', () => {
        const path = 'src/file.css';
        const patterns = [ /\.ts$/, /\.js$/ ];

        expect(matchesAny(path, patterns)).toBe(false);
    });

    test('should return true when path matches the only pattern', () => {
        const path = 'src/file.ts';
        const patterns = [ /\.ts$/ ];

        expect(matchesAny(path, patterns)).toBe(true);
    });

    test('should return false for empty patterns array', () => {
        const path = 'src/file.ts';
        const patterns: RegExp[] = [];

        expect(matchesAny(path, patterns)).toBe(false);
    });

    test('should match directory paths correctly', () => {
        const path = 'node_modules/package';
        const patterns = [ /^node_modules\// ];

        expect(matchesAny(path, patterns)).toBe(true);
    });

    test('should handle complex regex patterns', () => {
        const path = 'src/components/Button.test.tsx';
        const patterns = [ /^src\/.*\.test\.(ts|tsx)$/ ];

        expect(matchesAny(path, patterns)).toBe(true);
    });
});

describe('compileGlobPattern', () => {
    test('should correctly match simple wildcards', () => {
        const regex = compileGlobPattern('*.js');
        expect(regex.test('file.js')).toBe(true);
        expect(regex.test('test.js')).toBe(true);
        expect(regex.test('file.ts')).toBe(false);
        expect(regex.test('folder/file.js')).toBe(false);
    });

    test('should handle double asterisk (recursive matching)', () => {
        const regex = compileGlobPattern('src/**/test.js');
        expect(regex.test('src/test.js')).toBe(true);
        expect(regex.test('src/foo/test.js')).toBe(true);
        expect(regex.test('src/foo/bar/test.js')).toBe(true);
        expect(regex.test('src/test.ts')).toBe(false);
    });

    test('should handle question marks', () => {
        const regex = compileGlobPattern('file-?.js');
        expect(regex.test('file-1.js')).toBe(true);
        expect(regex.test('file-a.js')).toBe(true);
        expect(regex.test('file-ab.js')).toBe(false);
    });

    test('should handle brace expansion', () => {
        const regex = compileGlobPattern('src/{foo,bar}.js');
        expect(regex.test('src/foo.js')).toBe(true);
        expect(regex.test('src/bar.js')).toBe(true);
        expect(regex.test('src/baz.js')).toBe(false);
    });

    test('should handle character classes', () => {
        const regex = compileGlobPattern('file-[abc].js');
        expect(regex.test('file-a.js')).toBe(true);
        expect(regex.test('file-b.js')).toBe(true);
        expect(regex.test('file-c.js')).toBe(true);
        expect(regex.test('file-d.js')).toBe(false);
    });

    test('should handle complex patterns', () => {
        const regex = compileGlobPattern('src/**/{test,spec}.[jt]s');
        expect(regex.test('src/test.js')).toBe(true);
        expect(regex.test('src/test.ts')).toBe(true);
        expect(regex.test('src/foo/test.js')).toBe(true);
        expect(regex.test('src/foo/spec.ts')).toBe(true);
        expect(regex.test('src/foo/file.js')).toBe(false);
    });

    test('should escape special regex characters', () => {
        const regex = compileGlobPattern('file+name.js');
        expect(regex.test('file+name.js')).toBe(true);
        expect(regex.test('filename.js')).toBe(false);
    });

    test('should handle file extensions with dots', () => {
        const regex = compileGlobPattern('*.min.js');
        expect(regex.test('file.min.js')).toBe(true);
        expect(regex.test('file.js')).toBe(false);
    });

    test('should handle file extensions with dots', () => {
        const regex = compileGlobPattern('*.min.js');
        expect(regex.test('file.min.js')).toBe(true);
        expect(regex.test('file.js')).toBe(false);
    });
});

describe('glob', () => {
    test('should match single wildcard patterns', () => {
        const patterns = compilePatterns([ '*.txt' ]);
        expect(matchesAny('file.txt', patterns)).toBe(true);
        expect(matchesAny('test.txt', patterns)).toBe(true);
        expect(matchesAny('file.jpg', patterns)).toBe(false);
        expect(matchesAny('path/file.txt', patterns)).toBe(false);
    });

    test('should match double asterisk patterns for directories', () => {
        const patterns = compilePatterns([ '**/test.txt' ]);
        expect(matchesAny('test.txt', patterns)).toBe(true);
        expect(matchesAny('dir/test.txt', patterns)).toBe(true);
        expect(matchesAny('dir/sub-dir/test.txt', patterns)).toBe(true);
        expect(matchesAny('test.jpg', patterns)).toBe(false);
    });

    test('should match patterns with middle directory wildcards', () => {
        const patterns = compilePatterns([ 'src/**/test.txt' ]);
        expect(matchesAny('src/test.txt', patterns)).toBe(true);
        expect(matchesAny('src/dir/test.txt', patterns)).toBe(true);
        expect(matchesAny('src/dir/sub-dir/test.txt', patterns)).toBe(true);
        expect(matchesAny('other/test.txt', patterns)).toBe(false);
    });

    test('should match multiple patterns', () => {
        const patterns = compilePatterns([ '*.txt', '*.md' ]);
        expect(matchesAny('file.txt', patterns)).toBe(true);
        expect(matchesAny('readme.md', patterns)).toBe(true);
        expect(matchesAny('image.png', patterns)).toBe(false);
    });

    test('should match patterns with question marks', () => {
        const patterns = compilePatterns([ 'test.???' ]);
        expect(matchesAny('test.txt', patterns)).toBe(true);
        expect(matchesAny('test.doc', patterns)).toBe(true);
        expect(matchesAny('test.jpeg', patterns)).toBe(false);
    });

    test('should match patterns with character sets', () => {
        const patterns = compilePatterns([ 'file[0-9].txt' ]);
        expect(matchesAny('file1.txt', patterns)).toBe(true);
        expect(matchesAny('file5.txt', patterns)).toBe(true);
        expect(matchesAny('filea.txt', patterns)).toBe(false);
    });

    test('should match patterns with negated character sets', () => {
        const patterns = compilePatterns([ 'file[^0-9].txt' ]);
        expect(matchesAny('filea.txt', patterns)).toBe(true);
        expect(matchesAny('file1.txt', patterns)).toBe(false);
    });

    test('should match patterns with braces', () => {
        const patterns = compilePatterns([ '*.{jpg,png}' ]);
        expect(matchesAny('image.jpg', patterns)).toBe(true);
        expect(matchesAny('image.png', patterns)).toBe(true);
        expect(matchesAny('image.gif', patterns)).toBe(false);
    });

    test('should handle RegExp patterns directly', () => {
        const patterns = compilePatterns([ /^test\d+\.txt$/ ]);
        expect(matchesAny('test123.txt', patterns)).toBe(true);
        expect(matchesAny('test.txt', patterns)).toBe(false);
    });

    test('should match complex nested patterns', () => {
        const patterns = compilePatterns([ 'src/**/test/*.{js,ts}' ]);
        expect(matchesAny('src/test/file.js', patterns)).toBe(true);
        expect(matchesAny('src/deep/test/file.ts', patterns)).toBe(true);
        expect(matchesAny('src/test/file.css', patterns)).toBe(false);
        expect(matchesAny('other/test/file.js', patterns)).toBe(false);
    });

    test('should match patterns with multiple double asterisks', () => {
        const patterns = compilePatterns([ '**/*.test.{js,ts}' ]);
        expect(matchesAny('file.test.js', patterns)).toBe(true);
        expect(matchesAny('src/file.test.ts', patterns)).toBe(true);
        expect(matchesAny('src/nested/deep/file.test.js', patterns)).toBe(true);
        expect(matchesAny('file.js', patterns)).toBe(false);
    });

    test('should handle empty patterns array', () => {
        expect(matchesAny('file.txt', [])).toBe(false);
    });

    test('should handle mixed string and RegExp patterns', () => {
        const patterns = compilePatterns([ '*.txt', /^test\d+\.js$/ ]);
        expect(matchesAny('file.txt', patterns)).toBe(true);
        expect(matchesAny('test123.js', patterns)).toBe(true);
        expect(matchesAny('other.js', patterns)).toBe(false);
    });

    test('should match directory with /** at the end', () => {
        const regex = compileGlobPattern('node_modules/**');
        expect(regex.test('node_modules/package.json')).toBe(true);
        expect(regex.test('node_modules/lib/index.js')).toBe(true);
        expect(regex.test('node_modules/deep/nested/file.js')).toBe(true);
        expect(regex.test('node_modules/')).toBe(true);
        expect(regex.test('other/file.js')).toBe(false);
        expect(regex.test('node_modules')).toBe(true);
    });

    test('should match /** at the beginning', () => {
        const regex = compileGlobPattern('**/test.js');
        expect(regex.test('test.js')).toBe(true);
        expect(regex.test('src/test.js')).toBe(true);
        expect(regex.test('src/nested/test.js')).toBe(true);
        expect(regex.test('other.js')).toBe(false);
    });

    test('should match /**/ in the middle', () => {
        const regex = compileGlobPattern('src/**/test.js');
        expect(regex.test('src/test.js')).toBe(true);
        expect(regex.test('src/foo/test.js')).toBe(true);
        expect(regex.test('src/foo/bar/baz/test.js')).toBe(true);
        expect(regex.test('test.js')).toBe(false);
        expect(regex.test('other/test.js')).toBe(false);
    });

    test('should match multiple ** patterns', () => {
        const regex = compileGlobPattern('src/**/*.test.js');
        expect(regex.test('src/file.test.js')).toBe(true);
        expect(regex.test('src/utils/file.test.js')).toBe(true);
        expect(regex.test('src/deep/nested/utils/file.test.js')).toBe(true);
        expect(regex.test('src/file.js')).toBe(false);
        expect(regex.test('file.test.js')).toBe(false);
    });

    test('should handle dist/** pattern', () => {
        const regex = compileGlobPattern('dist/**');
        expect(regex.test('dist/bundle.js')).toBe(true);
        expect(regex.test('dist/assets/style.css')).toBe(true);
        expect(regex.test('dist/deeply/nested/file.map')).toBe(true);
        expect(regex.test('src/file.js')).toBe(false);
    });

    test('should handle **/*.{js,ts} pattern', () => {
        const regex = compileGlobPattern('**/*.{js,ts}');
        expect(regex.test('file.js')).toBe(true);
        expect(regex.test('file.ts')).toBe(true);
        expect(regex.test('src/file.js')).toBe(true);
        expect(regex.test('deep/nested/file.ts')).toBe(true);
        expect(regex.test('file.css')).toBe(false);
    });

    test('should handle **/.* pattern for hidden files', () => {
        const regex = compileGlobPattern('**/.*');
        expect(regex.test('.gitignore')).toBe(true);
        expect(regex.test('src/.eslintrc')).toBe(true);
        expect(regex.test('deep/nested/.env')).toBe(true);
        expect(regex.test('file.js')).toBe(false);
    });

    test('should handle **/.g* pattern for hidden files', () => {
        const regex = compileGlobPattern('**/.g*');
        expect(regex.test('.gitignore')).toBe(true);
        expect(regex.test('src/.eslintrc')).toBe(false);
        expect(regex.test('deep/nested/.genv')).toBe(true);
        expect(regex.test('file.js')).toBe(false);
    });

    test('should preserve node_modules prefix in pattern', () => {
        const regex = compileGlobPattern('node_modules/**');
        const regexString = regex.toString();

        expect(regexString).toContain('node_modules');
        expect(regexString).not.toBe('/^(?:.*)$/');
        expect(regexString).toBe('/^node_modules(?:\\/.*)?$/');
    });

    test('should not create overly permissive regex', () => {
        const regex = compileGlobPattern('specific/**');

        // Should match files under 'specific'
        expect(regex.test('specific/file.js')).toBe(true);

        // Should NOT match files under other directories
        expect(regex.test('other/file.js')).toBe(false);
        expect(regex.test('notspecific/file.js')).toBe(false);
    });

    test('should handle patterns with ** only', () => {
        const regex = compileGlobPattern('**');
        expect(regex.test('file.js')).toBe(true);
        expect(regex.test('src/file.js')).toBe(true);
        expect(regex.test('deeply/nested/file.js')).toBe(true);
    });
});

describe('collectFilesFromGlob', () => {
    const testDir = '/test/dir';

    beforeEach(() => {
        xJet.restoreAllMocks();
    });

    test('should return empty array for non-existent directory', () => {
        xJet.mock(existsSync).mockReturnValue(false);

        const result = collectFilesFromGlob('/non/existent/path', [ '**/*' ], []);

        expect(result).toEqual([]);
    });

    test('should return empty array when no include patterns provided', () => {
        xJet.mock(existsSync).mockReturnValue(true);

        const result = collectFilesFromGlob(testDir, [], []);

        expect(result).toEqual([]);
    });

    test('should compile positive patterns', () => {
        xJet.mock(existsSync).mockReturnValue(true);
        const compilePatternsSpy = xJet.mock(compilePatterns).mockReturnValue([ /.*\.ts$/ ]);
        xJet.mock(readdirSync).mockReturnValue([]);

        collectFilesFromGlob(testDir, [ '**/*.ts' ], []);

        expect(compilePatternsSpy).toHaveBeenCalledWith([ '**/*.ts' ]);
    });

    test('should separate negation patterns from include array', () => {
        xJet.mock(existsSync).mockReturnValue(true);
        const compilePatternsSpy = xJet.mock(compilePatterns).mockReturnValue([]);
        xJet.mock(readdirSync).mockReturnValue([]);

        collectFilesFromGlob(testDir, [ '**/*.ts', '!**/*.test.ts' ], []);

        expect(compilePatternsSpy).toHaveBeenNthCalledWith(1, [ '**/*.ts' ]);
        expect(compilePatternsSpy).toHaveBeenNthCalledWith(2, [ '**/*.test.ts' ]);
    });

    test('should combine negation patterns with exclude array', () => {
        xJet.mock(existsSync).mockReturnValue(true);
        const compilePatternsSpy = xJet.mock(compilePatterns).mockReturnValue([]);
        xJet.mock(readdirSync).mockReturnValue([]);

        collectFilesFromGlob(testDir, [ '**/*.ts', '!**/*.test.ts' ], [ 'node_modules/**' ]);

        expect(compilePatternsSpy).toHaveBeenNthCalledWith(2, [ '**/*.test.ts', 'node_modules/**' ]);
    });

    test('should collect files matching include patterns', () => {
        xJet.mock(existsSync).mockReturnValue(true);
        xJet.mock(compilePatterns).mockReturnValue([ /.*\.ts$/ ]);
        xJet.mock(readdirSync).mockReturnValue(<any> [
            { name: 'index.ts', isDirectory: () => false },
            { name: 'index.js', isDirectory: () => false },
            { name: 'README.md', isDirectory: () => false }
        ]);
        xJet.mock(matchesAny)
            .mockReturnValueOnce(true)  // index.ts matches
            .mockReturnValueOnce(false) // index.js doesn't match
            .mockReturnValueOnce(false); // README.md doesn't match

        const result = collectFilesFromGlob(testDir, [ '**/*.ts' ], []);

        expect(result).toContain('index.ts');
        expect(result).not.toContain('index.js');
        expect(result).not.toContain('README.md');
    });

    test('should recursively walk directories', () => {
        xJet.mock(existsSync).mockReturnValue(true);
        xJet.mock(compilePatterns).mockReturnValue([ /.*\.ts$/ ]);

        const readdirSyncMock = xJet.mock(readdirSync);
        // Root directory
        readdirSyncMock.mockReturnValueOnce(<any> [
            { name: 'index.ts', isDirectory: () => false },
            { name: 'src', isDirectory: () => true }
        ]);
        // src directory
        readdirSyncMock.mockReturnValueOnce(<any> [{ name: 'app.ts', isDirectory: () => false }]);

        xJet.mock(matchesAny).mockReturnValue(true);

        const result = collectFilesFromGlob(testDir, [ '**/*.ts' ], []);

        expect(result).toContain('index.ts');
        expect(result).toContain('src/app.ts');
        expect(readdirSyncMock).toHaveBeenCalledTimes(2);
    });

    test('should exclude files matching exclude patterns', () => {
        xJet.mock(existsSync).mockReturnValue(true);
        xJet.mock(compilePatterns).mockReturnValue([ /.*\.ts$/ ]);
        xJet.mock(readdirSync).mockReturnValue(<any> [
            { name: 'app.ts', isDirectory: () => false },
            { name: 'app.test.ts', isDirectory: () => false }
        ]);

        const matchesAnySpy = xJet.mock(matchesAny);
        matchesAnySpy.mockReturnValueOnce(false);
        matchesAnySpy.mockReturnValueOnce(true);
        matchesAnySpy.mockReturnValueOnce(true); // Excluded!

        const result = collectFilesFromGlob(testDir, [ '**/*.ts' ], [ '**/*.test.ts' ]);

        expect(result).toContain('app.ts');
        expect(result).not.toContain('app.test.ts');
    });

    test('should skip excluded directories without walking them', () => {
        xJet.mock(existsSync).mockReturnValue(true);
        const readdirSyncMock = xJet.mock(readdirSync);
        readdirSyncMock.mockReturnValueOnce(<any> [
            { name: 'src', isDirectory: () => true },
            { name: 'node_modules', isDirectory: () => true }
        ]);

        readdirSyncMock.mockReturnValueOnce(<any> [{ name: 'app.ts', isDirectory: () => false }]);
        const result = collectFilesFromGlob(testDir, [ '**/*' ], [ 'node_modules/**' ]);

        expect(readdirSyncMock).toHaveBeenCalledTimes(2);
        expect(result).toContain('src/app.ts');
    });

    test('should handle inaccessible directories gracefully', () => {
        xJet.mock(existsSync).mockReturnValue(true);
        xJet.mock(compilePatterns).mockReturnValue([ /.*/ ]);
        xJet.mock(readdirSync).mockImplementation(() => {
            throw new Error('Permission denied');
        });

        const result = collectFilesFromGlob(testDir, [ '**/*' ], []);

        expect(result).toEqual([]);
    });

    test('should handle mixed file types in directory', () => {
        xJet.mock(existsSync).mockReturnValue(true);
        xJet.mock(compilePatterns).mockReturnValue([ /.*\.(ts|tsx)$/ ]);
        xJet.mock(readdirSync).mockReturnValue(<any> [
            { name: 'component.tsx', isDirectory: () => false },
            { name: 'helper.ts', isDirectory: () => false },
            { name: 'styles.css', isDirectory: () => false }
        ]);

        const matchesAnySpy = xJet.mock(matchesAny);
        // Include checks
        matchesAnySpy.mockReturnValueOnce(true);  // component.tsx
        matchesAnySpy.mockReturnValueOnce(true);  // helper.ts
        matchesAnySpy.mockReturnValueOnce(false); // styles.css

        const result = collectFilesFromGlob(testDir, [ '**/*.{ts,tsx}' ], []);

        expect(result).toContain('component.tsx');
        expect(result).toContain('helper.ts');
        expect(result).not.toContain('styles.css');
    });

    test('should not compile exclude patterns if no exclusions', () => {
        xJet.mock(existsSync).mockReturnValue(true);
        const compilePatternsSpy = xJet.mock(compilePatterns).mockReturnValue([ /.*/ ]);
        xJet.mock(readdirSync).mockReturnValue([]);

        collectFilesFromGlob(testDir, [ '**/*' ], []);

        // Should only compile include patterns
        expect(compilePatternsSpy).toHaveBeenCalledTimes(1);
    });

    test('should handle deeply nested directory structures', () => {
        xJet.mock(existsSync).mockReturnValue(true);
        xJet.mock(compilePatterns).mockReturnValue([ /.*\.ts$/ ]);

        const readdirSyncMock = xJet.mock(readdirSync);
        readdirSyncMock.mockReturnValueOnce(<any> [{ name: 'src', isDirectory: () => true }]);
        readdirSyncMock.mockReturnValueOnce(<any> [{ name: 'components', isDirectory: () => true }]);
        readdirSyncMock.mockReturnValueOnce(<any> [{ name: 'Button.tsx', isDirectory: () => false }]);
        xJet.mock(matchesAny).mockReturnValue(true);

        const result = collectFilesFromGlob(testDir, [ '**/*.tsx' ], []);

        expect(result).toContain('src/components/Button.tsx');
        expect(readdirSyncMock).toHaveBeenCalledTimes(3);
    });

    test('should use relative paths from baseDir', () => {
        xJet.mock(existsSync).mockReturnValue(true);
        xJet.mock(compilePatterns).mockReturnValue([ /.*/ ]);
        xJet.mock(readdirSync).mockReturnValue(<any> [{ name: 'file.ts', isDirectory: () => false }]);
        xJet.mock(matchesAny).mockReturnValue(true);

        const result = collectFilesFromGlob(testDir, [ '**/*' ], []);

        expect(result[0]).toBe('file.ts');
        expect(result[0]).not.toContain(testDir);
    });

    test('should handle only negation patterns in include', () => {
        xJet.mock(existsSync).mockReturnValue(true);
        xJet.mock(compilePatterns).mockReturnValue([]);

        const result = collectFilesFromGlob(testDir, [ '!**/*.test.ts' ], []);
        expect(result).toEqual([]);
    });

    test('should check excludes before recursing into directories', () => {
        xJet.mock(existsSync).mockReturnValue(true);
        xJet.mock(compilePatterns).mockReturnValue([ /.*/ ]);

        const readdirSyncMock = xJet.mock(readdirSync);
        readdirSyncMock.mockReturnValueOnce(<any> [{ name: 'node_modules', isDirectory: () => true }]);

        const matchesAnySpy = xJet.mock(matchesAny);
        matchesAnySpy.mockReturnValueOnce(true); // Excluded
        collectFilesFromGlob(testDir, [ '**/*' ], [ 'node_modules/**' ]);
        expect(readdirSyncMock).toHaveBeenCalledTimes(1);
    });

    test('should match files at root level', () => {
        xJet.mock(existsSync).mockReturnValue(true);
        xJet.mock(compilePatterns).mockReturnValue([ /README\.md$/ ]);
        xJet.mock(readdirSync).mockReturnValue(<any> [{ name: 'README.md', isDirectory: () => false }]);
        xJet.mock(matchesAny).mockReturnValue(true);

        const result = collectFilesFromGlob(testDir, [ 'README.md' ], []);

        expect(result).toEqual([ 'README.md' ]);
    });
});
