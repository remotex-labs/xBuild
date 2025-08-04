/**
 * Imports
 */

import { join, relative } from 'path';
import { existsSync, readdirSync } from 'fs';
import { collectFilesFromDir, compileGlobPattern, isGlob, matchesAny } from '@components/glob.component';

/**
 * Mock dependencies
 */

jest.mock('fs', () => ({
    existsSync: jest.fn(),
    readdirSync: jest.fn()
}));

jest.mock('path', () => ({
    join: jest.fn((dir, file) => `${ dir }/${ file }`),
    relative: jest.fn((from, to) => to.replace(`${ from }/`, ''))
}));

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

describe('collectFilesFromDir', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Set up a safer mock implementation for relative that won't throw errors
        (relative as jest.Mock).mockImplementation((from, to) => {
            // Safety check to prevent undefined errors
            if (typeof from !== 'string' || typeof to !== 'string') {
                return '';
            }

            // Handle string paths safely
            if (to.startsWith(`${ from }/`)) {
                return to.substring(from.length + 1);
            }

            return to;
        });

        // Set up a consistent join implementation
        (join as jest.Mock).mockImplementation((dir, file) => {
            return `${ dir }/${ file }`;
        });
    });


    test('should return empty array if baseDir does not exist', () => {
        (existsSync as jest.Mock).mockReturnValue(false);

        const result = collectFilesFromDir('non-existent-dir', [ '**/*.ts' ], []);

        expect(result).toEqual([]);
        expect(existsSync).toHaveBeenCalledWith('non-existent-dir');
    });

    test('should collect matching files and skip excluded ones', () => {
        // Mock existsSync to return true for our test directory
        (existsSync as jest.Mock).mockReturnValue(true);

        // Mock directory structure
        const mockFiles = [
            { name: 'file1.ts', isDirectory: () => false },
            { name: 'file2.js', isDirectory: () => false },
            { name: 'file3.ts', isDirectory: () => false },
            { name: 'node_modules', isDirectory: () => true }
        ];

        const mockNodeModulesFiles = [{ name: 'package.ts', isDirectory: () => false }];

        // Set up readdirSync to return our mock files
        (readdirSync as jest.Mock).mockImplementation((dir) => {
            if (dir === 'src') {
                return mockFiles;
            } else if (dir === 'src/node_modules') {
                return mockNodeModulesFiles;
            }

            return [];
        });

        // Set up the join and relative functions to work with our mocks
        (join as jest.Mock).mockImplementation((dir, file) => `${ dir }/${ file }`);
        (relative as jest.Mock).mockImplementation((from, to) => to.replace(`${ from }/`, ''));

        const result = collectFilesFromDir('src', [ '**/*.ts' ], [ '**/node_modules/**' ]);

        // We expect file1.ts and file3.ts to be included, but not file2.js or node_modules/package.ts
        expect(result).toContain('file1.ts');
        expect(result).toContain('file3.ts');
        expect(result).not.toContain('file2.js');
        expect(result).not.toContain('node_modules/package.ts');
    });

    test('should handle negated patterns in include', () => {
        // Mock existsSync to return true for our test directory
        (existsSync as jest.Mock).mockReturnValue(true);

        // Mock directory structure
        const mockFiles = [
            { name: 'file1.ts', isDirectory: () => false },
            { name: 'file1.d.ts', isDirectory: () => false },
            { name: 'file2.js', isDirectory: () => false }
        ];

        // Set up readdirSync to return our mock files
        (readdirSync as jest.Mock).mockReturnValue(mockFiles);

        const result = collectFilesFromDir('src', [ '**/*.ts', '!**/*.d.ts' ], []);

        // We expect file1.ts to be included, but not file1.d.ts or file2.js
        expect(result).toContain('file1.ts');
        expect(result).not.toContain('file1.d.ts');
        expect(result).not.toContain('file2.js');
    });

    test('should handle both include and exclude patterns', () => {
        // Mock existsSync to return true for our test directory
        (existsSync as jest.Mock).mockReturnValue(true);

        // Mock directory structure
        const mockFiles = [
            { name: 'file1.ts', isDirectory: () => false },
            { name: 'file1.test.ts', isDirectory: () => false },
            { name: 'file2.js', isDirectory: () => false },
            { name: 'file2.test.js', isDirectory: () => false }
        ];

        // Set up readdirSync to return our mock files
        (readdirSync as jest.Mock).mockReturnValue(mockFiles);

        const result = collectFilesFromDir(
            'src',
            [ '**/*.ts', '**/*.js' ],
            [ '*.test.*' ]
        );

        // We expect file1.ts and file2.js to be included, but not the test files
        expect(result).toContain('file1.ts');
        expect(result).toContain('file2.js');
        expect(result).not.toContain('file1.test.ts');
        expect(result).not.toContain('file2.test.js');
    });
});
