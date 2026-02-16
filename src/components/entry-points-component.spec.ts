/**
 * Imports
 */

import process from 'process';
import { readdirSync, readFileSync } from 'fs';
import { extractEntryPoints } from '@components/entry-points.component';

/**
 * Tests
 */

const dummySourceMap = JSON.stringify({
    version: 3,
    sources: [ 'framework.ts' ],
    names: [],
    mappings: 'AAAA'
});

beforeEach(() => {
    xJet.restoreAllMocks();
    xJet.mock(readFileSync).mockImplementation(() => dummySourceMap);
});

describe('extractEntryPoints', () => {
    const testDir = '/test/dir';

    beforeEach(() => {
        xJet.spyOn(process, 'cwd').mockReturnValue('/test/dir');
    });

    test('should handle array of { in: string, out: string }', () => {
        const entryPoints = [
            { in: 'src/index.ts', out: 'dist/index' },
            { in: 'src/utils.ts', out: 'dist/utils' }
        ];

        const result = extractEntryPoints(testDir, entryPoints);

        expect(result).toEqual({
            'dist/index': 'src/index.ts',
            'dist/utils': 'src/utils.ts'
        });
    });

    test('should handle array of glob patterns', () => {
        xJet.mock(readdirSync).mockReturnValue(<any>[
            { name: 'index.ts', isDirectory: () => false },
            { name: 'utils.ts', isDirectory: () => false }
        ]);

        const result = extractEntryPoints(testDir, [ '**/*.ts' ]);

        expect(result).toEqual({
            'index': 'index.ts',
            'utils': 'utils.ts'
        });
    });

    test('should handle array of glob patterns with exclusions', () => {
        xJet.mock(readdirSync).mockReturnValue(<any>[
            { name: 'app.ts', isDirectory: () => false },
            { name: 'app.test.ts', isDirectory: () => false }
        ]);

        const result = extractEntryPoints(testDir, [ '**/*.ts', '!**/*.test.ts' ]);

        expect(result).toEqual({
            'app': 'app.ts'
        });
        expect(result).not.toHaveProperty('app.test');
    });

    test('should handle nested files with glob patterns', () => {
        const readdirMock = xJet.mock(readdirSync);

        // root
        readdirMock.mockReturnValueOnce(<any>[{ name: 'src', isDirectory: () => true }]);

        // src
        readdirMock.mockReturnValueOnce(<any>[
            { name: 'index.ts', isDirectory: () => false },
            { name: 'utils.ts', isDirectory: () => false }
        ]);

        const result = extractEntryPoints(testDir, [ '**/*.ts' ]);

        expect(result).toEqual({
            'src/index': 'src/index.ts',
            'src/utils': 'src/utils.ts'
        });
    });

    test('should handle Record<string, string>', () => {
        const entryPoints = {
            'index': 'src/index.ts',
            'utils': 'src/utils.ts'
        };

        const result = extractEntryPoints(testDir, entryPoints);

        expect(result).toEqual(entryPoints);
    });

    test('should handle empty array of in/out objects', () => {
        const result = extractEntryPoints(testDir, []);

        expect(result).toEqual({});
    });

    test('should handle empty array of glob patterns', () => {
        const result = extractEntryPoints(testDir, []);

        expect(result).toEqual({});
    });

    test('should throw error for unsupported format', () => {
        expect(() => extractEntryPoints(testDir, 123 as any)).toThrow('Unsupported entry points format');
        expect(() => extractEntryPoints(testDir, '{}' as any)).toThrow('Unsupported entry points format');
        expect(() => extractEntryPoints(testDir, null as any)).toThrow('Unsupported entry points format');
    });

    test('should throw error for undefined entry points', () => {
        expect(() => extractEntryPoints(testDir, undefined as any)).toThrow('Unsupported entry points format');
    });
});
